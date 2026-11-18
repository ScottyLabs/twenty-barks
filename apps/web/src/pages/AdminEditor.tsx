import { useState } from "react";
import { at, num, sendJson, str, type Puzzle } from "../server.ts";

/** A puzzle as typed into the form. An empty day means the next free one. */
export interface Draft {
  readonly day: string;
  readonly name: string;
  readonly aliases: string;
  readonly facts: string;
}

export const EMPTY: Draft = { day: "", name: "", aliases: "", facts: "" };

export function draftOf(puzzle: Puzzle): Draft {
  return {
    day: puzzle.day,
    name: puzzle.name,
    aliases: puzzle.aliases.join(", "),
    facts: puzzle.facts.join("\n"),
  };
}

export function bodyOf(draft: Draft) {
  return { name: draft.name, aliases: draft.aliases.split(","), facts: draft.facts.split("\n") };
}

function TextField({
  label,
  hint,
  value,
  type = "text",
  multiline = false,
  onChange,
}: {
  readonly label: string;
  readonly hint?: string;
  readonly value: string;
  readonly type?: string;
  readonly multiline?: boolean;
  readonly onChange: (value: string) => void;
}) {
  const props = {
    className: multiline ? "input min-h-48" : "input",
    required: true,
    value,
    onChange: (event: { target: { value: string } }) => {
      onChange(event.target.value);
    },
  };
  return (
    <label className="flex flex-col gap-1 text-left">
      <span className="text-sm font-bold">{label}</span>
      {multiline ? <textarea {...props} /> : <input type={type} {...props} />}
      {hint !== undefined && <span className="text-xs text-muted">{hint}</span>}
    </label>
  );
}

function Actions({ onDelete, status }: { readonly onDelete: () => void; readonly status: string }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="submit" className="pill pill--solid">
        Save
      </button>
      <button type="button" className="pill" onClick={onDelete}>
        Delete
      </button>
      <span className="text-sm text-muted" aria-live="polite">
        {status}
      </span>
    </div>
  );
}

export function Editor({
  draft,
  onChange,
  onSave,
  onDelete,
  status,
}: {
  readonly draft: Draft;
  readonly onChange: (draft: Draft) => void;
  readonly onSave: () => void;
  readonly onDelete: () => void;
  readonly status: string;
}) {
  const set = (key: keyof Draft) => (value: string) => {
    onChange({ ...draft, [key]: value });
  };
  return (
    <form
      className="flex w-full flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        onSave();
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Day" type="date" value={draft.day} onChange={set("day")} />
        <TextField
          label="Answer"
          hint='Shown when the game ends, like "the Fence".'
          value={draft.name}
          onChange={set("name")}
        />
      </div>
      <TextField
        label="Guesses that win"
        hint="Comma-separated words a winning guess must contain, like: fence"
        value={draft.aliases}
        onChange={set("aliases")}
      />
      <TextField
        label="Facts"
        hint="One per line. Bark answers from these and common knowledge; players never see them."
        value={draft.facts}
        multiline
        onChange={set("facts")}
      />
      <Actions onDelete={onDelete} status={status} />
    </form>
  );
}

const percent = (value: unknown): string => `${Math.round(num(value) * 100)}%`;

function describe(body: unknown): string {
  const error = str(at(body, "error"));
  if (error !== null) {
    return error;
  }
  const odds = at(body, "judgment");
  const parts = [
    ["yes", "yes"],
    ["no", "no"],
    ["sort of", "sortof"],
    ["unanswerable", "unanswerable"],
    ["a guess", "guessed"],
  ].map(([label, key]) => `${label ?? ""} ${percent(at(odds, key ?? ""))}`);
  return `${str(at(body, "verdict")) ?? "?"}: "${str(at(body, "reply")) ?? ""}" (${parts.join(", ")})`;
}

/** Ask a question against the facts in the form, before anyone plays them. */
export function Tryout({ draft }: { readonly draft: Draft }) {
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState("");
  return (
    <form
      className="flex w-full flex-col gap-2 text-left"
      onSubmit={(event) => {
        event.preventDefault();
        setResult("Asking Jev...");
        void sendJson("/api/admin/try", "POST", { ...bodyOf(draft), question }).then(({ body }) => {
          setResult(describe(body));
        });
      }}
    >
      <h2 className="eyebrow">Try a question against these facts</h2>
      <div className="ask">
        <input
          className="ask__input"
          value={question}
          placeholder="Is it outside?"
          onChange={(event) => {
            setQuestion(event.target.value);
          }}
        />
        <button type="submit" className="pill pill--solid" disabled={question.trim() === ""}>
          Try
        </button>
      </div>
      <p className="text-sm" aria-live="polite">
        {result}
      </p>
    </form>
  );
}
