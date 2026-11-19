import type { Mood } from "./bark/moods.ts";

export const QUESTION_LIMIT = 20;
/** Long enough for any honest question, short enough to keep the judge prompt small later. */
export const MAX_QUESTION_LENGTH = 120;

export type Verdict = "yes" | "no" | "sortof" | "correct";

export interface Answer {
  /** Asking about the same thing twice costs nothing. */
  readonly topic: string;
  readonly verdict: Verdict;
  readonly reply: string;
}

interface Rule extends Answer {
  readonly match: RegExp;
}

/**
 * The practice round's answer is the Fence. Until the real judge is wired up, typed questions are matched against these rules, in order, so the first match wins.
 */
const RULES: readonly Rule[] = [
  {
    topic: "fence",
    match: /\bfence\b/u,
    verdict: "correct",
    reply: "WOOF! It's the Fence!",
  },
  {
    topic: "building",
    match: /\b(building|hall|inside|indoors?|roof|walls?|room)\b/u,
    verdict: "no",
    reply: "Nope. No walls, no roof.",
  },
  {
    topic: "eat",
    match: /\b(eat|food|edible|drink|taste|snack)\b/u,
    verdict: "no",
    reply: "Please don't eat it.",
  },
  {
    topic: "paint",
    match: /\b(paint\w*|colou?r\w*|decorat\w*|art|spray)\b/u,
    verdict: "yes",
    reply: "Yes! Under cover of darkness.",
  },
  {
    topic: "same",
    match: /\b(same|change\w*|different|every day)\b/u,
    verdict: "sortof",
    reply: "Sort of... it gets a new coat almost every night.",
  },
  {
    topic: "tradition",
    match: /\b(tradition\w*|old|history|historic\w*|famous)\b/u,
    verdict: "yes",
    reply: "Yes! It's one of the oldest traditions on campus.",
  },
  {
    topic: "big",
    match: /\b(big|large|huge|small|tiny|tall|long)\b/u,
    verdict: "sortof",
    reply: "Sort of. You could walk its whole length in a few seconds.",
  },
  {
    topic: "outside",
    match: /\b(outside|outdoors?|open air)\b/u,
    verdict: "yes",
    reply: "Yes! Rain or shine.",
  },
  {
    topic: "place",
    match: /\b(place|location|somewhere|spot|visit|go there|on campus)\b/u,
    verdict: "yes",
    reply: "Yes! You can go there.",
  },
  {
    topic: "alive",
    match: /\b(person|people|professor|someone|alive|living|animal|dog)\b/u,
    verdict: "no",
    reply: "Not a who. A what.",
  },
  {
    topic: "course",
    match: /\b(class|course|major|lecture|exam)\b/u,
    verdict: "no",
    reply: "Not a class. No homework here.",
  },
];

/** Questions Bark can't answer with a yes or a no, like "where is it?". */
const OPEN_QUESTION = /^(what|what's|whats|where|when|who|whose|why|how|which)\b/u;

/** A guess at some other thing, like "Is it the Cut?". */
const GUESS = /^(?:is it|it'?s|is this|it is) the ([a-z0-9' -]{2,40}?)\s*[?!.]*$/u;

export function normalize(text: string): string {
  return text.toLowerCase().replaceAll(/\s+/gu, " ").trim();
}

/**
 * Bark's answer to a typed question, or null when practice Bark can't tell. An unclear question costs nothing.
 */
export function interpret(text: string): Answer | null {
  const question = normalize(text);
  if (question === "") {
    return null;
  }
  const fence = RULES[0];
  if (OPEN_QUESTION.test(question) && !(fence?.match.test(question) ?? false)) {
    return null;
  }
  const rule = RULES.find((r) => r.match.test(question));
  if (rule !== undefined) {
    return { topic: rule.topic, verdict: rule.verdict, reply: rule.reply };
  }
  const guess = GUESS.exec(question)?.[1];
  if (guess !== undefined) {
    return { topic: `guess:${guess}`, verdict: "no", reply: `Nope, it's not the ${guess}.` };
  }
  return null;
}

export interface Turn {
  readonly asked: string;
  readonly answer: Answer;
}

export interface Round {
  readonly turns: readonly Turn[];
  readonly won: boolean;
}

export const NEW_ROUND: Round = { turns: [], won: false };

const SAVED_PRACTICE = "twenty-barks:practice";
const VERDICTS: readonly Verdict[] = ["yes", "no", "sortof", "correct"];

const read = (value: unknown, key: string): unknown =>
  typeof value === "object" && value !== null ? (Reflect.get(value, key) as unknown) : undefined;

function turnFrom(value: unknown): Turn | null {
  const asked = read(value, "asked");
  const answer = read(value, "answer");
  const topic = read(answer, "topic");
  const reply = read(answer, "reply");
  const verdict = VERDICTS.find((known) => known === read(answer, "verdict"));
  if (typeof asked !== "string" || typeof topic !== "string" || typeof reply !== "string") {
    return null;
  }
  return verdict === undefined ? null : { asked, answer: { topic, verdict, reply } };
}

/** The practice round saved in this browser, so a reload does not lose it. */
export function loadPractice(): Round {
  try {
    const saved: unknown = JSON.parse(globalThis.localStorage.getItem(SAVED_PRACTICE) ?? "null");
    const turns = read(saved, "turns");
    if (!Array.isArray(turns)) {
      return NEW_ROUND;
    }
    const kept = turns.map((turn: unknown) => turnFrom(turn)).filter((turn) => turn !== null);
    return {
      turns: kept.slice(0, QUESTION_LIMIT),
      won: kept.some((t) => t.answer.verdict === "correct"),
    };
  } catch {
    return NEW_ROUND;
  }
}

export function savePractice(round: Round): void {
  try {
    globalThis.localStorage.setItem(SAVED_PRACTICE, JSON.stringify(round));
  } catch {
    // Private windows may refuse; the round still works until the page closes.
  }
}

export function questionsLeft(round: Round): number {
  return QUESTION_LIMIT - round.turns.length;
}

export function isOver(round: Round): boolean {
  return round.won || questionsLeft(round) === 0;
}

export function previousTurn(round: Round, answer: Answer): Turn | undefined {
  return round.turns.find((turn) => turn.answer.topic === answer.topic);
}

/** The round after asking. Asking about the same thing twice, or after the round is over, changes nothing. */
export function ask(round: Round, asked: string, answer: Answer): Round {
  if (isOver(round) || previousTurn(round, answer) !== undefined) {
    return round;
  }
  return {
    turns: [...round.turns, { asked: asked.trim(), answer }],
    won: answer.verdict === "correct",
  };
}

export function moodFor(verdict: Verdict): Mood {
  return verdict === "correct" ? "win" : verdict;
}

/** Green, red, and yellow squares, and a bone for the right guess. Escaped, since the repository keeps source ASCII. */
export const SQUARES: Readonly<Record<Verdict, string>> = {
  yes: "\u{1F7E9}",
  no: "\u{1F7E5}",
  sortof: "\u{1F7E8}",
  correct: "\u{1F9B4}",
};

/** The result to share, with no spoilers: one square per question. */
export function shareText(round: Round): string {
  const squares = round.turns.map((turn) => SQUARES[turn.answer.verdict]).join("");
  return `Twenty Barks practice ${round.turns.length}/${QUESTION_LIMIT}\n${squares}`;
}
