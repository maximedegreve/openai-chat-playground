import { CopilotIcon } from "@primer/octicons-react";
import { Avatar, Spinner, Box, Text } from "@primer/react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Message as AIMessage } from "ai";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";

type Props = {
  message: AIMessage;
};

function CopilotAvatar() {
  return (
    <Box
      sx={{
        height: "24px",
        width: "24px",
        flexShrink: 0,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        position: "relative",
        borderRadius: "24px",
        backgroundColor: "bg.sublte",
        border: "1px solid",
        borderColor: "border.default",
        color: "fg.muted",
      }}
    >
      <CopilotIcon size={16} />
    </Box>
  );
}

export default function Message({ message }: Props) {
  const { content, role } = message;
  const title = role == "assistant" ? "Copilot" : "User";
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "row",
        maxWidth: "960px",
        width: "100%",
        gap: 3,
      }}
    >
      {role === "assistant" ? (
        <CopilotAvatar />
      ) : (
        <Avatar
          sx={{ flexShrink: 0 }}
          src={"https://avatars.githubusercontent.com/u/90914?v=4"}
          size={24}
        />
      )}
      <Box>
        <Box
          sx={{
            fontWeight: 600,
            color: "fg.default",
            pb: 1,
          }}
        >
          {title}
        </Box>
        <Markdown
          remarkPlugins={[remarkGfm]}
          className="markdownContainer"
          components={{
            div({ node, ...props }) {
              if (
                !node ||
                !node.properties ||
                typeof node.properties.suggestion !== "string"
              ) {
                return <div {...props} />;
              }
              const suggestionMatch = /suggestion="([^"]+)"/.exec(
                node.properties.suggestion
              );
              const suggestion = suggestionMatch ? suggestionMatch[1] : null;

              if (suggestion) {
                return <Box>Suggestion: {suggestion}</Box>;
              }

              return <div {...props} />;
            },
            code(props) {
              const { children, className, node, ...rest } = props;

              const matchCodeLanguage = /language-(\w+)/.exec(className || "");

              switch (matchCodeLanguage) {
                case matchCodeLanguage && matchCodeLanguage[1] !== null:
                  return (
                    <SyntaxHighlighter
                      {...(rest as any)}
                      language={matchCodeLanguage && matchCodeLanguage[1]}
                      PreTag="div"
                      children={String(children).replace(/\n$/, "")}
                      {...rest}
                    />
                  );

                default:
                  return (
                    <code {...rest} className={className}>
                      {children}
                    </code>
                  );
              }
            },
          }}
        >
          {content}
        </Markdown>
      </Box>
    </Box>
  );
}
