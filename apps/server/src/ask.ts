import type { Judgment } from "./jev.ts";
import type { Secret } from "./secret.ts";

export const MAX_QUESTION_LENGTH = 120;

/** What Bark says back. "unsure" costs the player nothing. */
export type Verdict = "yes" | "no" | "sortof" | "correct" | "unsure";

export interface Reply {
  readonly verdict: Verdict;
  readonly reply: string;
}

/** Below this, no answer is likely enough to give; Bark asks for another way of putting it. */
const SURE = 0.5;
/** How sure Jev must be that a question naming the answer is a real guess, not "is it near the fence?". */
const GUESSED = 0.7;

const LINES: Readonly<Record<"yes" | "no" | "sortof", readonly string[]>> = {
  yes: ["Yes!", "Yep! You're on the scent.", "Woof, yes!", "Yes indeed."],
  no: ["Nope.", "No. Sniff again!", "That's a no.", "Nope, wrong tree."],
  sortof: ["Sort of...", "Kind of, in a way.", "Hmm, sort of. It depends."],
};

const UNSURE =
  "Hmm, I can't answer that one with a yes or no. Try asking another way? No bone used.";

export function normalize(question: string): string {
  return question.toLowerCase().replaceAll(/\s+/gu, " ").trim();
}

/** The same question always gets the same line, so asking again does not look like a new answer. */
function lineFor(verdict: "yes" | "no" | "sortof", question: string): string {
  const lines = LINES[verdict];
  let hash = 0;
  for (const char of normalize(question)) {
    hash = (hash * 31 + (char.codePointAt(0) ?? 0)) % 1_000_003;
  }
  return lines[hash % lines.length] ?? lines[0] ?? "";
}

function mentions(secret: Secret, question: string): boolean {
  const words = ` ${normalize(question).replaceAll(/[^a-z0-9]+/gu, " ")} `;
  return secret.aliases.some((alias) => words.includes(` ${alias} `));
}

/**
 * Turns Jev's judgment into Bark's reply. A win needs both the code and the model to agree: the question must name the answer, and Jev must read it as a guess.
 */
export function decide(secret: Secret, question: string, judgment: Judgment): Reply {
  if (mentions(secret, question) && judgment.guessed >= GUESSED) {
    return { verdict: "correct", reply: `WOOF! It's ${secret.name}!` };
  }
  let best: "yes" | "no" | "sortof" = "yes";
  for (const verdict of ["no", "sortof"] as const) {
    if (judgment[verdict] > judgment[best]) {
      best = verdict;
    }
  }
  if (judgment[best] < SURE || judgment.unanswerable >= judgment[best]) {
    return { verdict: "unsure", reply: UNSURE };
  }
  return { verdict: best, reply: lineFor(best, question) };
}
