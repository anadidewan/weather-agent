import { useState } from "react";
import { postChat } from "./api/chat";
import MessageInput from "./components/MessageInput";
import MessageList from "./components/MessageList";
import type { ChatMessage } from "./types";

function App() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "Ask me about current weather, forecast, or air quality."
    }
  ]);
  const [isThinking, setIsThinking] = useState(false);

  async function sendMessage(content: string) {
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content
    };

    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setIsThinking(true);

    try {
      const history = nextMessages
        .slice(0, -1)
        .map((message) => ({ role: message.role, content: message.content }));

      const response = await postChat({
        message: content,
        history
      });

      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: response.reply,
          toolCalls: response.toolCalls
        }
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "Sorry, I could not process that request right now. Please try again in a moment."
        }
      ]);
    } finally {
      setIsThinking(false);
    }
  }

  return (
    <main className="mx-auto flex h-screen w-full max-w-4xl flex-col gap-3 p-3 md:gap-4 md:p-6">
      <header className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h1 className="m-0 text-xl font-semibold tracking-tight text-zinc-900">Weather Agent</h1>
        <p className="m-0 mt-1 text-sm text-zinc-600">
          Chat with your weather assistant powered by the backend agent.
        </p>
      </header>

      <MessageList messages={messages} isThinking={isThinking} />
      <MessageInput onSend={sendMessage} disabled={isThinking} />
    </main>
  );
}

export default App;
