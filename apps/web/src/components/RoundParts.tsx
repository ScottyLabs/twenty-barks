import type { Verdict } from "../practice.ts";

export const VERDICT_LABEL: Readonly<Record<Verdict, string>> = {
  yes: "Yes",
  no: "No",
  sortof: "Sort of",
  correct: "You got it",
};

/** What Bark is saying: an answer with its verdict, or a plain line. */
export interface Speech {
  readonly verdict: Verdict | null;
  readonly text: string;
}

export const HELLO: Speech = {
  verdict: null,
  text: "I'm thinking of something at CMU. Ask me anything!",
};

export const THINKING: Speech = { verdict: null, text: "Hmm, let me sniff that out..." };

export function Bubble({ speech }: { readonly speech: Speech }) {
  return (
    <div className="bubble" aria-live="polite">
      {speech.verdict !== null && (
        <span className={`verdict verdict--${speech.verdict}`}>
          {VERDICT_LABEL[speech.verdict]}
        </span>
      )}
      <p>{speech.text}</p>
    </div>
  );
}

export interface LogRow {
  readonly key: string;
  readonly asked: string;
  readonly verdict: Verdict;
}

/** Every question so far, with Bark's verdict. */
export function Log({ rows }: { readonly rows: readonly LogRow[] }) {
  if (rows.length === 0) {
    return null;
  }
  return (
    <ol className="log" aria-label="Your questions so far">
      {rows.map((row, i) => (
        <li key={row.key}>
          <span className="log__n">{i + 1}</span>
          <span className="log__q">{row.asked}</span>
          <span className={`verdict verdict--${row.verdict}`}>{VERDICT_LABEL[row.verdict]}</span>
        </li>
      ))}
    </ol>
  );
}
