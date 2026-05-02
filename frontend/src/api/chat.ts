import type { ChatRequest, ChatResponse } from "../types";

const backendUrl = import.meta.env.VITE_AGENT_BACKEND_URL;

if (!backendUrl) {
  throw new Error("Missing VITE_AGENT_BACKEND_URL. Add it to your .env file.");
}

export async function postChat(payload: ChatRequest): Promise<ChatResponse> {
  const response = await fetch(`${backendUrl}/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    let detail = "Unknown backend error";
    try {
      const body = (await response.json()) as { detail?: unknown };
      detail = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail ?? body);
    } catch {
      detail = response.statusText || detail;
    }
    throw new Error(`Chat request failed (${response.status}): ${detail}`);
  }

  const data = (await response.json()) as ChatResponse;
  const tools = data.toolCalls ?? data.tool_calls ?? [];
  

  if (tools.length > 0) {
    console.log("[weather-agent] tool calls", tools);
  }

  return {
    reply: data.reply,
    toolCalls: tools,
  };
}
