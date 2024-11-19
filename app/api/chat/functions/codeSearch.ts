import type { ChatCompletionCreateParams } from "openai/resources/chat";
import { searchCode } from "@/app/utils/github";
const meta: ChatCompletionCreateParams.Function = {
  name: "codeSearch",
  description: `Retrieves a paginated list of code snippets or files in repositories.`,
  parameters: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Required. The query to search for.",
      },
    },
    required: ["query"],
  },
};

async function run(query: string, page: number = 1) {
  try {
    const code = await searchCode(query, page);
    return code;
  } catch (error) {
    console.log("Failed to fetch code results!");
    console.log(error);
    return "An error occured when trying to fetch code results.";
  }
}

export default { run, meta };
