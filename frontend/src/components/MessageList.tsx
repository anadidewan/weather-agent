import { useEffect, useRef } from "react";
import type { ChatMessage } from "../types";
import Message from "./Message";

type MessageListProps = {
  messages: ChatMessage[];
  isThinking: boolean;
};

function MessageList({ messages, isThinking }: MessageListProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }
    containerRef.current.scrollTop = containerRef.current.scrollHeight;
  }, [messages, isThinking]);

  return (
    <section
      ref={containerRef}
      className="flex-1 space-y-3 overflow-y-auto rounded-2xl border border-zinc-200 bg-zinc-100/60 p-3 md:p-4"
    >
      {messages.map((message) => (
        <Message key={message.id} message={message} />
      ))}

      {isThinking ? (
        <div className="flex justify-start">
          <div className="rounded-2xl bg-white px-4 py-3 text-sm text-zinc-600 shadow-sm">
            Agent is thinking...
          </div>
        </div>
      ) : null}
    </section>
  );
}

export default MessageList;
