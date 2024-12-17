import { Box } from "@primer/react";
import { useRef, useEffect } from "react";
import MessageItem from "./MessageItem";
import { type Message } from "ai";

export default function MessageList({ messages, data }: { messages: Message[]; data: any }) {
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]);

  console.log("MESSAGES_ALL:", messages);

  const debugData = data as unknown as FunctionData[];

  console.log("DATA:", data);
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "stretch",
        marginRight: "auto",
        marginLeft: "auto",
        flexGrow: 1,
        overflowY: "scroll",
        padding: 4,
        width: "100%",
        fontSize: 1,
      }}
    >
      <Box
        sx={{
          alignItems: "center",
          display: "flex",
          flexDirection: "column",
          gap: 5,
        }}
      >
        {messages.length > 0
          ? messages.map((m, i) => <MessageItem key={i} message={m} />)
          : null}
      </Box>
      <div ref={messagesEndRef} />
    </Box>
  );
}
