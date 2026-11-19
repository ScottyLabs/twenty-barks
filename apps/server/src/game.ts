import { decide, normalize, type Reply } from "./ask.ts";
import type { Judge } from "./jev.ts";
import type { Game, HistoryRow, Puzzle } from "./store.ts";

export const QUESTION_LIMIT = 20;
/** Puzzles change at midnight on campus. */
const CAMPUS_TIME_ZONE = "America/New_York";

/** Today's date on campus, as YYYY-MM-DD. */
export function campusDay(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: CAMPUS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function dayNumber(day: string): number {
  return Math.round(Date.parse(`${day}T00:00:00Z`) / 86_400_000);
}

/** What a player may see of a game. The answer only once it is over. */
export interface GameView {
  readonly id: string;
  readonly day: string;
  readonly turns: Game["turns"];
  readonly won: boolean;
  readonly finished: boolean;
  readonly questionsLeft: number;
  readonly answer: string | null;
}

export function viewOf(game: Game, puzzle: Puzzle): GameView {
  return {
    id: game.id,
    day: game.day,
    turns: game.turns,
    won: game.won,
    finished: game.finished,
    questionsLeft: QUESTION_LIMIT - game.turns.length,
    answer: game.finished ? puzzle.name : null,
  };
}

export interface Played {
  readonly game: Game;
  readonly reply: Reply;
  /** Whether it used up a question. */
  readonly counted: boolean;
}

/** Plays one question. Repeats and questions Bark cannot answer cost nothing. */
export async function play(
  game: Game,
  puzzle: Puzzle,
  question: string,
  judge: Judge,
): Promise<Played> {
  const before = game.turns.find((turn) => normalize(turn.question) === normalize(question));
  if (before !== undefined) {
    const reply = { verdict: before.verdict, reply: `You already asked that one. No bone used.` };
    return { game, reply, counted: false };
  }
  const secret = { name: puzzle.name, aliases: puzzle.aliases, facts: puzzle.facts };
  const reply = decide(secret, question, await judge(secret, question));
  if (reply.verdict === "unsure") {
    return { game, reply, counted: false };
  }
  const turns = [...game.turns, { question, verdict: reply.verdict, reply: reply.reply }];
  const won = reply.verdict === "correct";
  const next = { ...game, turns, won, finished: won || turns.length >= QUESTION_LIMIT };
  return { game: next, reply, counted: true };
}

export interface Stats {
  readonly played: number;
  readonly won: number;
  readonly averageQuestions: number | null;
  /** Days solved in a row, up to today, or yesterday if today is not solved yet. */
  readonly currentStreak: number;
  readonly bestStreak: number;
}

export function statsOf(history: readonly HistoryRow[], today: string): Stats {
  const solved = history.filter((row) => row.won);
  const days: number[] = [...new Set(solved.map((row) => dayNumber(row.day)))];
  days.sort((a, b) => a - b);
  let best = 0;
  let run = 0;
  for (const [i, day] of days.entries()) {
    run = i > 0 && days[i - 1] === day - 1 ? run + 1 : 1;
    best = Math.max(best, run);
  }
  const last = days.at(-1);
  const alive = last !== undefined && dayNumber(today) - last <= 1;
  const total = solved.reduce((sum, row) => sum + row.questions, 0);
  return {
    played: history.length,
    won: solved.length,
    averageQuestions: solved.length === 0 ? null : Math.round((total / solved.length) * 10) / 10,
    currentStreak: alive ? run : 0,
    bestStreak: best,
  };
}

/** Where a finished game sits among everyone's that day. */
export interface Standing {
  /** Finished games today, this one included. */
  readonly players: number;
  /** Percent of the other players who did worse, or null when nobody else has finished. */
  readonly betterThan: number | null;
  /** This game's score: questions used to win, or LOST_SCORE. */
  readonly score: number;
  /** How many games ended on each score, from 1 question up to LOST_SCORE. */
  readonly counts: readonly number[];
}

/** A loss scores one more than the most questions a win can take. */
export const LOST_SCORE = QUESTION_LIMIT + 1;

export function scoreOf(game: {
  readonly won: boolean;
  readonly turns: readonly unknown[];
}): number {
  return game.won ? game.turns.length : LOST_SCORE;
}

export function standingOf(scores: readonly number[], score: number): Standing {
  const counts = Array.from(
    { length: LOST_SCORE },
    (_, index) => scores.filter((each) => each === index + 1).length,
  );
  const others = scores.length - 1;
  const worse = scores.filter((each) => each > score).length;
  return {
    players: scores.length,
    betterThan: others <= 0 ? null : Math.round((100 * worse) / others),
    score,
    counts,
  };
}
