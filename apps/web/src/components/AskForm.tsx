import { useState } from "react";

/** A free-text question box. */
export function AskForm({
  maxLength,
  busy,
  onAsk,
}: {
  readonly maxLength: number;
  /** Waiting on an answer: typing goes on, asking waits. */
  readonly busy: boolean;
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
    </div>
  );
}
