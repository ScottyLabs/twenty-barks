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
/** Above this, a question is too muddled to answer, even when no single reading wins. */
const MUDDLED = 0.2;
/** When no answer is sure, "sort of" plus one side must reach this, with the other side under TORN, to answer "sort of". */
const PARTLY = 0.7;
/** Odds at or above this on both yes and no mean Jev is torn, not leaning. */
const TORN = 0.25;
/** How sure Jev must be that a question naming the answer is a real guess, not "is it near the fence?". */
const GUESSED = 0.7;

const LINES: Readonly<Record<"yes" | "no" | "sortof", readonly string[]>> = {
  yes: ["Yes!", "Yep! You're on the scent.", "Woof, yes!", "Yes indeed."],
  no: ["Nope.", "No. Sniff again!", "That's a no.", "Nope, wrong tree."],
  sortof: ["Sort of...", "Kind of, in a way.", "Hmm, sort of. It depends."],
};

const UNSURE =
  "Hmm, I can't answer that one with a yes or no. Try asking another way? No bone used.";
const NOT_SURE = "Hmm, I'm honestly not sure about that one. Try asking another way? No bone used.";

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
  if (judgment.unanswerable >= judgment[best]) {
    return { verdict: "unsure", reply: UNSURE };
  }
  if (judgment[best] >= SURE) {
    return { verdict: best, reply: lineFor(best, question) };
  }
  return split(judgment, question);
}

/**
 * No answer is sure, but the question is answerable. Odds spread between one side and "sort of", like no 0.44 and sort of 0.41 for "is the Fence related to CFA?", are a partial answer, so say "sort of" rather than claim it is not a yes-or-no question. Odds spread between yes and no mean Jev is torn, so Bark admits he is not sure.
 */
function split(judgment: Judgment, question: string): Reply {
  if (judgment.unanswerable >= MUDDLED) {
    return { verdict: "unsure", reply: UNSURE };
  }
  const lean = Math.max(judgment.yes, judgment.no);
  const against = Math.min(judgment.yes, judgment.no);
  if (lean + judgment.sortof >= PARTLY && against < TORN) {
    return { verdict: "sortof", reply: lineFor("sortof", question) };
  }
  return { verdict: "unsure", reply: NOT_SURE };
}
