import { CopilotIcon } from "@primer/octicons-react";
import { Avatar, Box, Text } from "@primer/react";
import { RepoIcon } from "@primer/octicons-react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Message as AIMessage } from "ai";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { FC, AnchorHTMLAttributes } from "react";
import { text } from "stream/consumers";

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

const CustomLink: FC<AnchorHTMLAttributes<HTMLAnchorElement>> = ({
  href,
  children,
  ...rest
}) => {
  // Detect `ghc-suggestion` links by checking the href pattern.
  if (href && href.startsWith("#suggestion-")) {
    return (
      <Box
        as="a"
        sx={{
          borderColor: "border.default",
          borderWidth: 1,
          borderStyle: "solid",
          textDecoration: "none",
          px: "12px",
          py: 2,
          fontSize: 1,
          borderRadius: 2,
          display: "inline-flex",
          alignItems: "center",
          gap: 2,
          color: "fg.default",
          boxShadow: "shadow.small",
          fontFamily: "normal",
          ":hover": { bg: "canvas.subtle" },
          svg: {
            color: "fg.muted",
          },
        }}
        href={href}
        {...rest}
      >
        <RepoIcon size={16} />
        Create repository
      </Box>
    );
  }
  // Default link handling
  return (
    <a href={href} {...rest}>
      {children}
    </a>
  );
};

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
            a: CustomLink,
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
