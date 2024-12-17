import { Octicon, Box } from "@primer/react";
import { PaperAirplaneIcon } from "@primer/octicons-react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

const source = `### What is this?

This is a prototype of OpenAI function calling with GPT 4 Turbo. [The code behind this prototype](https://github.com/skylar-anderson/openai-chat-playground) is rather simple.  The model is provided a list of retrieval functions, and when prompted, is allowed to recursively call these functions until there is sufficient context to answer the user's question. 

### How to use this prototype:

- Messages are stored in your browser. Clear the conversation by refreshing or clicking the clear button
- Use the input below to start a conversation with Copilot
- On the right, you'll see the functions called by the model. Click on a function to reveal the raw response body and function schema
- Click on the cog icon in the top left to modify settings

### Try it`;

const examples = [
  `Show me the last two issues in facebook/react`,
  `Create a simple website about dinosaurs`,
  `Create me a script to fetch recipes from a website in Swift`,
  `I want to create a website in HTML/CSS about dinosaurs and I need a title > Draft some HTML/CSS`,
  "How should I get started exploring with the primer/react repository?",
  "Start me off with Tailwind CSS",
  "Start me off with Tailwind CSS in a React project",
];

type Props = {
  appendMessage: (s: string) => void;
};

export function SuggestedPrompt({
  children,
  onClick,
}: {
  children: string;
  onClick: () => void;
}) {
  return (
    <Box
      sx={{
        paddingY: 2,
        paddingX: 3,
        display: "flex",
        flexDirection: "row",
        gap: 3,
        border: "1px solid",
        borderColor: "border.default",
        backgroundColor: "canvas.default",
        borderRadius: 2,
        width: "fit-content",
        color: "fg.muted",
        "&:hover": {
          backgroundColor: "canvas.subtle",
          cursor: "pointer",
          color: "fg.default",
        },
      }}
      onClick={onClick}
    >
      {children}
      <Box sx={{}}>
        <Octicon icon={PaperAirplaneIcon} />
      </Box>
    </Box>
  );
}

export default function Intro({ appendMessage }: Props) {
  return (
    <Box
      sx={{
        padding: 4,
        display: "flex",
        flexDirection: "column",
        alignItems: "stretch",
        flexGrow: 1,
        overflowY: "scroll",
        paddingBottom: 0,
        width: "100%",
        fontSize: 1,
      }}
    >
      <Box
        sx={{
          p: 3,
          marginRight: "auto",
          marginLeft: "auto",
          maxWidth: "960px",
          backgroundColor: "canvas.default",
        }}
      >
        <Markdown remarkPlugins={[remarkGfm]} className="markdownContainer">
          {source}
        </Markdown>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 3 }}>
          {examples.map((e, i) => (
            <SuggestedPrompt key={i} onClick={() => appendMessage(e)}>
              {e}
            </SuggestedPrompt>
          ))}
        </Box>
      </Box>
    </Box>
  );
}
