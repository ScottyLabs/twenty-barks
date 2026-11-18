import { useState } from "react";

function Suggestions({
  suggestions,
  onAsk,
}: {
  readonly suggestions: readonly string[];
  readonly onAsk: (question: string) => void;
}) {
  if (suggestions.length === 0) {
    return null;
  }
  return (
    <div className="flex flex-wrap items-center justify-center gap-2 text-sm">
      <span className="text-muted">Try:</span>
      {suggestions.map((suggestion) => (
        <button
          key={suggestion}
          type="button"
          className="pill pill--small"
          onClick={() => {
            onAsk(suggestion);
          }}
        >
          {suggestion}
        </button>
      ))}
    </div>
  );
}

/** A free-text question box, with a few starter questions for anyone stuck. */
export function AskForm({
  maxLength,
  busy,
  suggestions,
  onAsk,
}: {
  readonly maxLength: number;
  /** Waiting on an answer: typing goes on, asking waits. */
  readonly busy: boolean;
  readonly suggestions: readonly string[];
  readonly onAsk: (question: string) => void;
}) {
  const [text, setText] = useState("");
  const blank = text.trim() === "";

  return (
    <div className="flex w-full max-w-xl flex-col items-center gap-3">
      <form
        className="ask"
        onSubmit={(event) => {
          event.preventDefault();
          if (!blank && !busy) {
            onAsk(text);
            setText("");
          }
        }}
      >
        <label htmlFor="question" className="sr-only">
          Your yes-or-no question
        </label>
        <input
          id="question"
          className="ask__input"
          value={text}
          maxLength={maxLength}
          autoComplete="off"
          placeholder="Ask a yes-or-no question, or guess..."
          onChange={(event) => {
            setText(event.target.value);
          }}
        />
        <button type="submit" className="pill pill--solid" disabled={blank || busy}>
          {busy ? "..." : "Ask"}
        </button>
      </form>
      <Suggestions suggestions={busy ? [] : suggestions} onAsk={onAsk} />
    </div>
  );
}
