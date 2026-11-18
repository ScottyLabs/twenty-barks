/** What the drafting model hands back for an admin to review. Nothing is saved until they do. */
export interface PuzzleDraft {
  readonly name: string;
  readonly aliases: readonly string[];
  readonly facts: readonly string[];
  /** Facts the model is not fully sure of, for a person to verify. */
  readonly check: readonly string[];
  /** Questions a player might ask, to try against the facts. */
  readonly questions: readonly string[];
}

export interface DraftRequest {
  /** What to write about, or empty for the model to suggest something. */
  readonly thing: string;
  /** Anything the admin wants the model to know or include. */
  readonly notes: string;
  /** Earlier answers, so a suggestion does not repeat one. */
  readonly past: readonly string[];
}

export type Drafter = (request: DraftRequest) => Promise<PuzzleDraft>;

const TIMEOUT_MS = 60_000;

const SYSTEM = `You write puzzles for Twenty Barks, a daily twenty-questions game about Carnegie Mellon University. Players ask yes-or-no questions, and a judge answers them using only your facts and common knowledge, so the facts must be true and must cover what players ask about.

Return only a JSON object, with no other text:
{"name": string, "aliases": string[], "facts": string[], "check": string[], "questions": string[]}

- name: the answer as players should see it when the game ends, e.g. "the Fence".
- aliases: 1 to 4 lowercase words or short phrases; a winning guess must contain one of them. Prefer distinctive words ("fence", "buggy"), not generic ones ("the").
- facts: 8 to 12 short, plain sentences. Cover what kind of thing it is (place, building, food, event, tradition, person, object), where it is, when it happens or is open, its size, what it is made of, who uses it, how old it is, and what it is NOT (for example: not a building, not a food, not a course). Only state things you are confident are true about CMU.
- check: copy, word for word, any facts you included but are not fully sure of (dates, numbers, names, anything that may have changed), so a person can verify them.
- questions: 12 yes-or-no questions a player might ask, including a few tricky near-misses, such as guessing something related but different.

If you are asked to suggest something, pick a well-known part of CMU life that is not in the past answers, and vary the kind of thing from day to day.`;

function userMessage(request: DraftRequest): string {
  const past = request.past.length === 0 ? "none yet" : request.past.join("; ");
  const what =
    request.thing === ""
      ? "Suggest one good thing for the next puzzle, then write its puzzle."
      : `Write the puzzle for: ${request.thing}`;
  const notes = request.notes === "" ? "" : `\nNotes from the admin: ${request.notes}`;
  return `${what}\nPast answers: ${past}${notes}`;
}

const read = (value: unknown, key: string): unknown =>
  typeof value === "object" && value !== null ? (Reflect.get(value, key) as unknown) : undefined;

const texts = (value: unknown): string[] =>
  Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter((item) => item !== "")
    : [];

/** The draft in the model's reply, which may come wrapped in a code fence. */
export function parseDraft(content: string): PuzzleDraft {
  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");
  if (start === -1 || end <= start) {
    throw new Error("The model did not return a puzzle");
  }
  const json: unknown = JSON.parse(content.slice(start, end + 1));
  const name = read(json, "name");
  const draft = {
    name: typeof name === "string" ? name.trim() : "",
    aliases: texts(read(json, "aliases")).map((alias) => alias.toLowerCase()),
    facts: texts(read(json, "facts")),
    check: texts(read(json, "check")),
    questions: texts(read(json, "questions")).slice(0, 15),
  };
  if (draft.name === "" || draft.aliases.length === 0 || draft.facts.length === 0) {
    throw new Error("The model's puzzle was missing its answer, guesses, or facts");
  }
  return draft;
}

/** Drafts puzzles with a chat model on the ScottyLabs AI gateway. Only ever runs when an admin asks. */
export function gatewayDrafter(
  baseUrl: string,
  apiKey: string,
  model: string,
  fetchFn: typeof fetch = fetch,
): Drafter {
  const url = `${baseUrl.replace(/\/+$/u, "")}/v1/chat/completions`;
  return async (request) => {
    const res = await fetchFn(url, {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        model,
        max_tokens: 4000,
        reasoning_effort: "low",
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: userMessage(request) },
        ],
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      throw new Error(`The drafting model answered ${res.status}`);
    }
    const body: unknown = await res.json();
    const choices = read(body, "choices");
    const content = read(
      read(Array.isArray(choices) ? (choices[0] as unknown) : null, "message"),
      "content",
    );
    if (typeof content !== "string") {
      throw new TypeError("The drafting model sent no text");
    }
    return parseDraft(content);
  };
}
