export type Role = "user" | "assistant";

export type ToolCallInfo = {
  name: string;
};

export type ChatMessage = {
  id: string;
  role: Role;
  content: string;
  toolCalls?: ToolCallInfo[];
};

export type ChatRequest = {
  message: string;
  history?: Array<{
    role: Role;
    content: string;
  }>;
};

export type ChatResponse = {
  reply: string;
  toolCalls?: ToolCallInfo[];
  /** Some serializers may emit snake_case */
  tool_calls?: ToolCallInfo[];
};
