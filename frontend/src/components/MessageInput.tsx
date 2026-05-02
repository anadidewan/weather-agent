import { type KeyboardEvent, useState } from "react";

type MessageInputProps = {
  onSend: (value: string) => Promise<void>;
  disabled?: boolean;
};

function MessageInput({ onSend, disabled = false }: MessageInputProps) {
  const [value, setValue] = useState("");

  async function submit() {
    const trimmed = value.trim();
    if (!trimmed || disabled) {
      return;
    }
    await onSend(trimmed);
    setValue("");
  }

  async function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      await submit();
    }
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm">
      <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-zinc-500">
        Message
      </label>
      <textarea
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={onKeyDown}
        rows={3}
        disabled={disabled}
        placeholder="Ask about weather, forecast, or air quality..."
        className="w-full resize-none rounded-xl border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 disabled:cursor-not-allowed disabled:bg-zinc-100"
      />
      <div className="mt-2 flex items-center justify-between">
        <p className="m-0 text-xs text-zinc-500">Send with Cmd/Ctrl + Enter</p>
        <button
          type="button"
          onClick={() => {
            void submit();
          }}
          disabled={disabled || value.trim().length === 0}
          className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-50 transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-400"
        >
          Send
        </button>
      </div>
    </div>
  );
}

export default MessageInput;
