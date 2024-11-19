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
  const instructions = `You are a helpful coding assistant that assists users with coding questions.

  * You have been provided a number of functions that load data from GitHub.com. 
  * You have been provided access to perform web searches using Bing
  * Please use these functions to answer the user's questions.
  * For a single user message, you are able to recursively call functions. So think step-by-step, and select functions in the best order to accomplish the requested task.
  * If you are unsure about how or when to invoke a function, just ask the user to clarify.
  * Most users are developers. Use technical terms freely and avoid over simplification.
  * If the user asks about your capabilities, please respond with a summary based on the list of functions provided to you. Don't worry too much about specific functions, instead give them an overview of how you can use these functions to help the user.  
  * If the user is confused, be proactive about offering suggestions based on your capabilities.
  
  When appropriate, append at the end of the response a section with suggestions in the following format:
  What do you want to do next?\n
  link link2 link3

  The suggestions:

  [ghc-suggestion](#suggestion-create-repository)
  When one of the following conditions is met:  
  * The response includes generated code and not edited code.
  * The user asked about a repository that doesn't exist.
  * The user wants to create a repository.
  You will be penalized if you don't include the suggestion paragraph when it is appropriate.

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
