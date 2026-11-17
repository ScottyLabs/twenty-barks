import type { Mood } from "./bark/moods.ts";

export const QUESTION_LIMIT = 20;

export type Verdict = "yes" | "no" | "sortof" | "correct";

export interface Question {
  readonly id: string;
  readonly text: string;
  readonly verdict: Verdict;
  readonly reply: string;
}

/**
 * A scripted round, so the page can show how the game feels before the real daily puzzles exist. The answer is the Fence.
 */
export const PRACTICE: readonly Question[] = [
  { id: "place", text: "Is it a place?", verdict: "yes", reply: "Yes! You can go there." },
  { id: "building", text: "Is it a building?", verdict: "no", reply: "Nope. No walls, no roof." },
  { id: "eat", text: "Can you eat it?", verdict: "no", reply: "Please don't eat it." },
  {
    id: "same",
    text: "Does it look the same every day?",
    verdict: "sortof",
    reply: "Sort of... it gets a new coat almost every night.",
  },
  {
    id: "paint",
    text: "Do people paint it?",
    verdict: "yes",
    reply: "Yes! Under cover of darkness.",
  },
  { id: "fence", text: "Is it the Fence?", verdict: "correct", reply: "WOOF! It's the Fence!" },
];

export interface Turn {
  readonly question: Question;
}

export interface Round {
  readonly turns: readonly Turn[];
  readonly won: boolean;
}

export const NEW_ROUND: Round = { turns: [], won: false };

export function questionsLeft(round: Round): number {
  return QUESTION_LIMIT - round.turns.length;
}

export function hasAsked(round: Round, id: string): boolean {
  return round.turns.some((turn) => turn.question.id === id);
}

/** The round after asking a question. Asking twice, or after the round is over, changes nothing. */
export function ask(round: Round, question: Question): Round {
  if (round.won || questionsLeft(round) === 0 || hasAsked(round, question.id)) {
    return round;
  }
  return {
    turns: [...round.turns, { question }],
    won: question.verdict === "correct",
  };
}

export function moodFor(verdict: Verdict): Mood {
  return verdict === "correct" ? "win" : verdict;
}

/** Green, red, and yellow squares, and a bone for the right guess. Escaped, since the repository keeps source ASCII. */
const SQUARES: Readonly<Record<Verdict, string>> = {
  yes: "\u{1F7E9}",
  no: "\u{1F7E5}",
  sortof: "\u{1F7E8}",
  correct: "\u{1F9B4}",
};

/** The result to share, with no spoilers: one square per question. */
export function shareText(round: Round): string {
  const squares = round.turns.map((turn) => SQUARES[turn.question.verdict]).join("");
  return `Twenty Barks practice ${round.turns.length}/${QUESTION_LIMIT}\n${squares}`;
}
