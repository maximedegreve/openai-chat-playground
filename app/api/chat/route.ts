import {
  JSONValue,
  OpenAIStream,
  StreamingTextResponse,
  ToolCallPayload,
  experimental_StreamData,
  Tool,
} from "ai";
import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat";
import {
  MessageData,
  FunctionData,
  CompletionData,
  Provider,
} from "../../types";
import {
  runFunction,
  selectTools,
  selectFunctions,
  FunctionName,
  availableFunctions,
} from "./functions";
import { getMemory } from "@/app/utils/github";

export const runtime = "edge";

import analyzeImage from "./functions/analyzeImage";

const openaiClient = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const azureOpenaiClient = new OpenAI({
  apiKey: process.env.AZURE_API_KEY,
  baseURL: process.env.AZURE_MODEL_BASE_URL,
  defaultHeaders: {
    "ocp-apim-subscription-key": process.env.AZURE_API_KEY,
    "api-key": process.env.AZURE_API_KEY,
    "Openai-Internal-HarmonyVersion": "harmony_v3",
    "Openai-Internal-Experimental-AllowToolUse": "true",
  },
});

type RequestProps = {
  messages: ChatCompletionMessageParam[];
  data: { imageUrl?: string; settings: SettingsProps };
};

type SettingsProps = {
  customInstructions: string;
  tools: FunctionName[];
  model: string;
  parallelize: boolean;
  provider: Provider;
};

function getOpenaiClient(provider: Provider): OpenAI {
  return provider === Provider.AZURE ? azureOpenaiClient : openaiClient;
}

function signatureFromArgs(args: Record<string, unknown>) {
  return Object.entries(args)
    .map(([key, value]) => `${key}=${value}`)
    .join(", ");
}

// suggestion:create-repository
// Does the repository supertrooperbananarama exist?
// Create a simple website about dinosaurs
// I want to create a repository about dinosaurs
// Create me a script to fetch recipes from a website in Swift
// I want to create a website in HTML/CSS about dinosaurs and I need a title > Draft some HTML/CSS
// How should I get started exploring with the primer/react repository?
// Start me off with Tailwind CSS
// Start me off with Tailwind CSS in a React project

async function getSystemMessage(
  customInstructions: string
): Promise<ChatCompletionMessageParam> {
  const instructions = `You are the GitHub Copilot Chat Assistant, integrated directly into GitHub.com via a full-page chat experience.
Chat is located on GitHub.com, you should assume that the user is talking about GitHub repositories, code, issues, pull requests, and discussions unless they say otherwise.
Your primary goal is to help the user best utilize your capabilities. Ask clarifying questions and help them make their requests more specific and actionable.
Only use the functions provided to access information and perform actions on GitHub.com and other platforms to assist the user.
Since the functions provided to you are limited, the user may ask you to perform actions or access data that are outside your capabilities. When this happens, simply inform them that you don't currently have the capability. Answer with a single sentence without preamble.

When the listIssues function is called, you must process the output internally for reasoning, summarizing, or other logic.
However, in your visible response to the user, you must replace the detailed list output with the placeholder listIssues.

For example:
User: Show me the last two issues in facebook/react.
Response: listIssues


When preparing your response always adhere to these guidelines:

- When the listIssues function is invoked or referenced in a response, replace any list, enumeration, or content returned by the function with the placeholder listIssues. Do not output the actual list or details, even when queried for them.
- Identify as a GitHub Copilot Chat Assistant, not as an OpenAI Assistant or an AI Assistant.
- Do not describe or imply that you can perform actions or access data that are outside your capabilities.
- Avoid hypothetical descriptions of what you would do. That's just fluff.
- Reassess the conversation to determine if the information you need is already present before calling a function.
- Ask for required information if it is missing or ambiguous before calling any functions.
- If asked about your capabilities, name and explain the different functions that you can call and also how you can use them to answer questions. Make special note that you are limited by these functions and cannot access information or perform other operations on GitHub.
- Messages designated as '_custom_instructions' are intended to provide additional contextual information about the user. Use these instructions to enhance your responses, but always prioritize direct user messages in case of any conflict.
- Use the planskill tool before forming a response for requests that require tools.
- NEVER display the plan to the user.
- Use plaintext formatting, markdown is not very conversational.
- Plans you generate will be enclosed in <plan></plan> tags.
- Do not display the result of each executed step. Simply execute and ask the user questions.
- You must have a bias towards action with the plan. Execute the plan immediately.
- If a new plan needs to be generated, run the planskill again.
- This marker indicates that file content has been excluded from the prompt: <note: content excluded>
- If the marker is present, inform the user that file content cannot be processed by Copilot due to organization or repository policies, and direct them to this URL for additional information: https://docs.github.com/en/copilot/managing-copilot/managing-github-copilot-in-your-organization/setting-policies-for-copilot-in-your-organization/excluding-content-from-github-copilot
- Do not suggest that the user paste in content that has been excluded from the prompt.
  
  When you speak to users, you have the ability to record memories about the person and their preferences. Here are the memories you have previously recorded for the current user. Use these memories to improve the users experience:
  ${/*await getMemory()*/ ""}
  ${
    customInstructions
      ? ` The user has provided the following additional instructions:${customInstructions}`
      : ``
  }`;

  return {
    content: instructions,
    role: "system",
  };
}

export async function POST(req: Request) {
  const body: RequestProps = await req.json();
  const {
    messages,
    data: { imageUrl, settings },
  } = body;

  const data = new experimental_StreamData();
  const systemMessage = await getSystemMessage(settings.customInstructions);
  const isAzure = settings.provider === Provider.AZURE;
  const openai = getOpenaiClient(settings.provider);
  const initialMessages = [systemMessage, ...messages];
  const tools = selectTools(settings.tools);
  const functions = selectFunctions(settings.tools);
  // Only functions (i.e. the serial flow), not tools (i.e. the parallel flow) are supported by Azure OpenAI
  const shouldUseTools = !isAzure && !imageUrl && settings.parallelize;

  const messageDebug: MessageData = {
    messages: initialMessages,
    debugType: "message",
  };

  data.append(messageDebug as unknown as JSONValue);

  const toolChoices = shouldUseTools
    ? {
        tools,
        tool_choice: imageUrl
          ? { type: "function", function: { name: "analyzeImage" } }
          : "auto",
      }
    : {
        functions,
        function_call: imageUrl ? { name: "analyzeImage" } : undefined,
      };

  const request = {
    model: settings.model, // This value is ignored if using Azure OpenAI
    stream: true,
    messages: initialMessages,
    ...toolChoices,
  };
  // @ts-ignore
  const response = await openai.chat.completions.create(request);

  const stream = OpenAIStream(response, {
    experimental_onToolCall: shouldUseTools
      ? async (call: ToolCallPayload, appendToolCallMessage) => {
          const promises = call.tools.map(async (tool) => {
            const { name, arguments: args } = tool.func;
            const extractedArgs = JSON.parse(args as unknown as string);
            let result;

            if (name === "analyzeImage" && imageUrl) {
              const mostRecentMessage = messages[messages.length - 1];
              const content =
                mostRecentMessage.content || "What is this image?";
              result = analyzeImage.run(content.toString(), imageUrl);
            } else {
              result = runFunction(tool.func.name, extractedArgs);
            }

            const signature = `${name}(${signatureFromArgs(extractedArgs)})`;
            const schema = availableFunctions[name as FunctionName]?.meta;
            console.log("STARTED: " + signature);
            const startTime = Date.now();
            return result.then((loadedResult) => {
              const endTime = Date.now();
              const elapsedTime = `${endTime - startTime}ms`;
              const debugData: FunctionData = {
                elapsedTime,
                args: extractedArgs,
                strategy: "parallel",
                signature,
                result: loadedResult,
                schema,
                debugType: "function",
              };

              data.append(debugData as unknown as JSONValue);

              console.log("FINISHED: " + signature);

              appendToolCallMessage({
                tool_call_id: tool.id,
                function_name: tool.func.name,
                tool_call_result: loadedResult as JSONValue,
              });
            });
          });

          await Promise.all(promises);

          const newMessages: ChatCompletionMessageParam[] = [
            systemMessage,
            ...messages,
            ...(appendToolCallMessage() as OpenAI.Chat.Completions.ChatCompletionMessageParam[]),
          ];

          const messageDebug: MessageData = {
            messages: newMessages,
            debugType: "message",
          };

          data.append(messageDebug as unknown as JSONValue);

          return await openai.chat.completions.create({
            // This value is ignored if using Azure OpenAI
            model: settings.model,
            stream: true,
            messages: newMessages,
            tools,
            tool_choice: "auto",
          });
        }
      : undefined,

    experimental_onFunctionCall: shouldUseTools
      ? undefined
      : async ({ name, arguments: args }, createFunctionCallMessages) => {
          const startTime = Date.now();
          const signature = `${name}(${signatureFromArgs(args)})`;

          let result;

          if (name === "analyzeImage" && imageUrl) {
            const mostRecentMessage = messages[messages.length - 1];
            const content = mostRecentMessage.content || "What is this image?";
            result = await analyzeImage.run(content.toString(), imageUrl);
          } else {
            result = await runFunction(name, args);
          }

          const endTime = Date.now();
          const elapsedTime = `${endTime - startTime}ms`;
          const schema = availableFunctions[name as FunctionName]?.meta;
          const debugData: FunctionData = {
            elapsedTime,
            strategy: "serial",
            signature,
            args,
            result,
            schema,
            debugType: "function",
          };

          console.log("STARTED: " + signature);
          data.append(debugData as unknown as FunctionData);

          const newMessages = [
            systemMessage,
            ...messages,
            ...(createFunctionCallMessages(
              result as JSONValue
            ) as ChatCompletionMessageParam[]),
          ];

          const messageDebug: MessageData = {
            messages: newMessages,
            debugType: "message",
          };

          data.append(messageDebug as unknown as JSONValue);

          return openai.chat.completions.create({
            messages: newMessages,
            stream: true,
            // This value is ignored if using Azure OpenAI
            model: settings.model,
            functions,
          });
        },
    onCompletion(completion) {
      const completionDebug: CompletionData = {
        debugType: "completion",
        completion,
      };

      data.append(completionDebug as unknown as JSONValue);
    },
    onFinal() {
      data.close();
    },
    experimental_streamData: true,
  });

  return new StreamingTextResponse(stream, {}, data);
}
