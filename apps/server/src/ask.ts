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

/** Edits (insertions, deletions, substitutions, or swaps of neighbours) between two words, stopping early once past `most`. */
export function editDistance(a: string, b: string, most: number): number {
  if (Math.abs(a.length - b.length) > most) {
    return most + 1;
  }
  let before: number[] = [];
  let previous = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      const swap = a[i - 1] === b[j - 1] ? 0 : 1;
      let best = Math.min(
        (previous[j] ?? 0) + 1,
        (current[j - 1] ?? 0) + 1,
        (previous[j - 1] ?? 0) + swap,
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        best = Math.min(best, (before[j - 2] ?? 0) + 1);
      }
      current.push(best);
    }
    if (Math.min(...current) > most) {
      return most + 1;
    }
    before = previous;
    previous = current;
  }
  return previous[b.length] ?? most + 1;
}

/** Typos forgiven in a word this long: none for short words, where one letter makes another word. */
function slack(word: string): number {
  if (word.length >= 8) {
    return 2;
  }
  return word.length >= 4 ? 1 : 0;
}

/** A plural's singular, roughly: "buggies" to "buggy", "fences" to "fence". */
function singular(word: string): string {
  if (word.length > 4 && word.endsWith("ies")) {
    return `${word.slice(0, -3)}y`;
  }
  return word.length > 3 && word.endsWith("s") && !word.endsWith("ss") ? word.slice(0, -1) : word;
}

/** A longer word built on `part`, like "fenced" from "fence", is a different word. A held-down last letter, like "huntt", is still a typo. */
function buildsOn(form: string, part: string): boolean {
  const extra = form.slice(part.length);
  return form.startsWith(part) && extra !== (part.at(-1) ?? "").repeat(extra.length);
}

/** Whether `word` is `part`, allowing a typo or two and a plural. */
function close(word: string, part: string): boolean {
  const most = slack(part);
  return [word, singular(word)].some(
    (form) => !buildsOn(form, part) && editDistance(form, part, most) <= most,
  );
}

/** Whether `words` contain `alias`, allowing a typo or two in each of its words. */
function near(words: readonly string[], alias: string): boolean {
  const parts = alias.split(" ");
  return words.some((_, start) =>
    parts.every((part, k) => {
      const word = words[start + k];
      return word !== undefined && close(word, part);
    }),
  );
}

/** Whether the question names the answer, typos allowed. Jev must still read it as a guess at the answer itself, so "is it a hall?" does not win when the answer is the Mall. */
function mentions(secret: Secret, question: string): boolean {
  const words = normalize(question)
    .replaceAll(/[^a-z0-9]+/gu, " ")
    .split(" ")
    .filter((word) => word !== "");
  return secret.aliases.some((alias) => near(words, alias));
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
