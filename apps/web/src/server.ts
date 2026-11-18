import type { Verdict } from "./practice.ts";

/* Small readers for parsed JSON, so nothing from the network is trusted by assertion. */

function at(value: unknown, key: string): unknown {
  return typeof value === "object" && value !== null
    ? (Reflect.get(value, key) as unknown)
    : undefined;
}
const str = (value: unknown): string | null => (typeof value === "string" ? value : null);
const num = (value: unknown): number => (typeof value === "number" ? value : 0);
const list = (value: unknown): unknown[] => (Array.isArray(value) ? (value as unknown[]) : []);
const strings = (value: unknown): string[] =>
  list(value).filter((item): item is string => typeof item === "string");

const VERDICTS: readonly Verdict[] = ["yes", "no", "sortof", "correct"];
const verdictOf = (value: unknown): Verdict | null =>
  VERDICTS.find((verdict) => verdict === value) ?? null;

export interface Me {
  readonly user: { readonly name: string; readonly admin: boolean } | null;
  readonly loginAvailable: boolean;
}

export interface DailyTurn {
  readonly question: string;
  readonly verdict: Verdict;
  readonly reply: string;
}

export interface GameView {
  readonly id: string;
  readonly day: string;
  readonly turns: readonly DailyTurn[];
  readonly won: boolean;
  readonly finished: boolean;
  readonly questionsLeft: number;
  readonly answer: string | null;
}

export interface Today {
  readonly day: string;
  readonly puzzle: boolean;
  readonly game: GameView | null;
}

export interface Puzzle {
  readonly day: string;
  readonly name: string;
  readonly aliases: readonly string[];
  readonly facts: readonly string[];
}

function turnOf(value: unknown): DailyTurn | null {
  const verdict = verdictOf(at(value, "verdict"));
  const question = str(at(value, "question"));
  return verdict === null || question === null
    ? null
    : { question, verdict, reply: str(at(value, "reply")) ?? "" };
}

export function gameOf(value: unknown): GameView | null {
  const id = str(at(value, "id"));
  if (id === null) {
    return null;
  }
  return {
    id,
    day: str(at(value, "day")) ?? "",
    turns: list(at(value, "turns"))
      .map((turn) => turnOf(turn))
      .filter((turn) => turn !== null),
    won: at(value, "won") === true,
    finished: at(value, "finished") === true,
    questionsLeft: num(at(value, "questionsLeft")),
    answer: str(at(value, "answer")),
  };
}

export function puzzleOf(value: unknown): Puzzle {
  return {
    day: str(at(value, "day")) ?? "",
    name: str(at(value, "name")) ?? "",
    aliases: strings(at(value, "aliases")),
    facts: strings(at(value, "facts")),
  };
}

export { at, list, num, str };

export async function getJson(path: string): Promise<{ status: number; body: unknown }> {
  const res = await fetch(path, { credentials: "same-origin" });
  return { status: res.status, body: (await res.json()) as unknown };
}

export async function sendJson(
  path: string,
  method: "POST" | "PUT" | "DELETE",
  body?: unknown,
): Promise<{ status: number; body: unknown }> {
  const res = await fetch(path, {
    method,
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: body === undefined ? null : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, body: text === "" ? null : (JSON.parse(text) as unknown) };
}

export async function fetchMe(): Promise<Me> {
  const { body } = await getJson("/api/me");
  const user = at(body, "user");
  return {
    user:
      user === null || user === undefined
        ? null
        : { name: str(at(user, "name")) ?? "Player", admin: at(user, "admin") === true },
    loginAvailable: at(body, "loginAvailable") === true,
  };
}

export async function fetchToday(carried: string | null): Promise<Today> {
  const query = carried === null ? "" : `?game=${encodeURIComponent(carried)}`;
  const { body } = await getJson(`/api/today${query}`);
  return {
    day: str(at(body, "day")) ?? "",
    puzzle: at(body, "puzzle") === true,
    game: gameOf(at(body, "game")),
  };
}

export function loginHref(returnTo: string): string {
  return `/api/auth/login?returnTo=${encodeURIComponent(returnTo)}`;
}

export async function logout(): Promise<void> {
  await sendJson("/api/auth/logout", "POST");
}

export async function fetchScores(): Promise<unknown> {
  const { status, body } = await getJson("/api/me/scores");
  return status === 200 ? body : null;
}
