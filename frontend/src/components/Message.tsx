import type { ChatMessage } from "../types";

type MessageProps = {
  message: ChatMessage;
};

function formatToolLabel(name: string): string {
  const labels: Record<string, string> = {
    get_current_weather: "Current weather",
    get_forecast: "Forecast",
    get_air_quality: "Air quality"
  };
  return labels[name] ?? name.replace(/_/g, " ");
}

function Message({ message }: MessageProps) {
  const isUser = message.role === "user";

  return (
    <div className={`flex w-full ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 shadow-sm md:max-w-[70%] ${
          isUser ? "bg-zinc-900 text-zinc-50" : "bg-white text-zinc-900"
        }`}
      >
        <p className="m-0 whitespace-pre-wrap leading-relaxed">{message.content}</p>
        {!isUser && message.toolCalls && message.toolCalls.length > 0 ? (
          <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
            <p className="m-0 font-semibold tracking-wide text-emerald-900">Tools used</p>
            <ul className="m-0 mt-2 list-none space-y-1 pl-0">
              {message.toolCalls.map((tool) => (
                <li
                  key={`${message.id}-${tool.name}`}
                  className="flex items-center gap-2 rounded-lg bg-white/60 px-2 py-1 text-emerald-900 ring-1 ring-emerald-100"
                >
                  <span className="font-mono text-[11px] text-emerald-700">{tool.name}</span>
                  <span className="text-emerald-600">·</span>
                  <span>{formatToolLabel(tool.name)}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default Message;
