import { useState } from "react";
import { VERDICT_LABEL } from "../components/RoundParts.tsx";
import type { Verdict } from "../practice.ts";
import { at, list, sendJson, str } from "../server.ts";

/** What the AI filled in, for the editor below to take. */
export interface Drafted {
  readonly name: string;
  readonly aliases: string;
  readonly facts: string;
}

interface Tried {
  readonly question: string;
  readonly verdict: Verdict | "unsure";
}

interface Result {
  readonly check: readonly string[];
  readonly tried: readonly Tried[];
}

const texts = (value: unknown): string[] =>
  list(value).filter((item): item is string => typeof item === "string");

const VERDICTS: readonly (Verdict | "unsure")[] = ["yes", "no", "sortof", "correct", "unsure"];

function triedOf(value: unknown): Tried {
  const said = at(value, "verdict");
  return {
    question: str(at(value, "question")) ?? "",
    verdict: VERDICTS.find((verdict) => verdict === said) ?? "unsure",
  };
}

function Findings({ result }: { readonly result: Result }) {
  return (
    <div className="flex flex-col gap-4 text-left">
      {result.check.length > 0 && (
        <div className="check">
          <p className="text-sm font-bold">Check these before saving</p>
          <ul className="list-disc pl-5 text-sm">
            {result.check.map((fact) => (
              <li key={fact}>{fact}</li>
            ))}
          </ul>
        </div>
      )}
      {result.tried.length > 0 && (
        <div>
          <p className="mb-1 text-sm font-bold">How Bark would answer</p>
          <ol className="log">
            {result.tried.map((row) => (
              <li key={row.question}>
                <span className="log__q text-sm">{row.question}</span>
                <span className={`verdict verdict--${row.verdict}`}>
                  {row.verdict === "unsure" ? "Unsure" : VERDICT_LABEL[row.verdict]}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

function useDraft(onDraft: (drafted: Drafted) => void) {
  const [thing, setThing] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const run = (): void => {
    setBusy(true);
    setError("");
    void sendJson("/api/admin/draft", "POST", { thing, notes })
      .then(({ status, body }) => {
        const draft = at(body, "draft");
        if (status !== 200 || draft === undefined) {
          setError(str(at(body, "error")) ?? "The AI could not draft a puzzle.");
          return;
        }
        onDraft({
          name: str(at(draft, "name")) ?? "",
          aliases: texts(at(draft, "aliases")).join(", "),
          facts: texts(at(draft, "facts")).join("\n"),
        });
        setResult({
          check: texts(at(draft, "check")),
          tried: list(at(body, "tried")).map((row) => triedOf(row)),
        });
      })
      .catch(() => {
        setError("Could not reach the server.");
      })
      .finally(() => {
        setBusy(false);
      });
  };
  return { thing, setThing, notes, setNotes, busy, error, result, run };
}

/** Drafts a puzzle with AI when pressed. It fills in the form; nothing is saved until you press Save. */
export function DraftPanel({ onDraft }: { readonly onDraft: (drafted: Drafted) => void }) {
  const d = useDraft(onDraft);
  return (
    <section className="flex flex-col gap-3 text-left">
      <h2 className="eyebrow">Draft with AI</h2>
      <input
        className="input"
        value={d.thing}
        placeholder="What should it be? Leave empty for a suggestion"
        onChange={(event) => {
          d.setThing(event.target.value);
        }}
      />
      <input
        className="input"
        value={d.notes}
        placeholder="Notes for the AI (optional), e.g. mention it moved in 2024"
        onChange={(event) => {
          d.setNotes(event.target.value);
        }}
      />
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="pill pill--solid" disabled={d.busy} onClick={d.run}>
          {d.busy ? "Drafting..." : "Draft with AI"}
        </button>
        <span className="text-sm text-muted" aria-live="polite">
          {d.busy ? "Writing facts and trying questions, about 15 seconds." : d.error}
        </span>
      </div>
      {d.result !== null && !d.busy && <Findings result={d.result} />}
    </section>
  );
}
