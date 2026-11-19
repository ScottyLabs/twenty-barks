import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { Db } from "./db.ts";
import type { Verdict } from "./ask.ts";

/** How a signed-in player wants the site to look; "system" follows their device. */
export type Theme = "system" | "light" | "dark";
export const THEMES: readonly Theme[] = ["system", "light", "dark"];

export interface User {
  readonly id: number;
  readonly sub: string;
  readonly username: string | null;
  readonly name: string | null;
  readonly email: string | null;
  readonly theme: Theme;
}

export interface Puzzle {
  /** YYYY-MM-DD, in campus time. */
  readonly day: string;
  readonly name: string;
  readonly aliases: readonly string[];
  readonly facts: readonly string[];
}

export interface Turn {
  readonly question: string;
  readonly verdict: Exclude<Verdict, "unsure">;
  readonly reply: string;
}

export interface Game {
  readonly id: string;
  readonly day: string;
  readonly userId: number | null;
  readonly turns: readonly Turn[];
  readonly won: boolean;
  readonly finished: boolean;
}

export interface LoginState {
  readonly verifier: string;
  readonly nonce: string;
  readonly redirectUri: string;
  readonly returnTo: string;
}

const SESSION_DAYS = 30;
const LOGIN_STATE_MINUTES = 10;

const hash = (token: string): string => createHash("sha256").update(token).digest("hex");

interface GameRow {
  id: string;
  day: string;
  user_id: number | null;
  turns: Turn[];
  won: boolean;
  finished_at: string | null;
}

const GAME_COLUMNS = "id::text, day::text, user_id, turns, won, finished_at::text";

function toGame(row: GameRow): Game {
  return {
    id: row.id,
    day: row.day,
    userId: row.user_id,
    turns: row.turns,
    won: row.won,
    finished: row.finished_at !== null,
  };
}

/** Everything the app keeps in Postgres. */
export class Store {
  constructor(private readonly db: Db) {}

  async upsertUser(claims: Omit<User, "id" | "theme">): Promise<User> {
    const [user] = await this.db.query<User>(
      `insert into users (sub, username, name, email) values ($1, $2, $3, $4)
       on conflict (sub) do update set username = $2, name = $3, email = $4
       returning id, sub, username, name, email, theme`,
      [claims.sub, claims.username, claims.name, claims.email],
    );
    if (user === undefined) {
      throw new Error("could not save user");
    }
    return user;
  }

  async saveLoginState(state: string, login: LoginState): Promise<void> {
    await this.db.query(
      `delete from login_states where created_at < now() - interval '${LOGIN_STATE_MINUTES} minutes'`,
    );
    await this.db.query(
      "insert into login_states (state, verifier, nonce, redirect_uri, return_to) values ($1, $2, $3, $4, $5)",
      [state, login.verifier, login.nonce, login.redirectUri, login.returnTo],
    );
  }

  /** A login state can be used once, and only for a few minutes. */
  async takeLoginState(state: string): Promise<LoginState | null> {
    const [row] = await this.db.query<{
      verifier: string;
      nonce: string;
      redirect_uri: string;
      return_to: string;
    }>(
      `delete from login_states where state = $1
       and created_at > now() - interval '${LOGIN_STATE_MINUTES} minutes'
       returning verifier, nonce, redirect_uri, return_to`,
      [state],
    );
    return row === undefined
      ? null
      : {
          verifier: row.verifier,
          nonce: row.nonce,
          redirectUri: row.redirect_uri,
          returnTo: row.return_to,
        };
  }

  /** A new session; only its hash is stored, so a database leak cannot be replayed as logins. */
  async createSession(userId: number): Promise<string> {
    const token = randomBytes(32).toString("base64url");
    await this.db.query(
      `insert into sessions (token_hash, user_id, expires_at)
       values ($1, $2, now() + interval '${SESSION_DAYS} days')`,
      [hash(token), userId],
    );
    return token;
  }

  async sessionUser(token: string): Promise<User | null> {
    const [user] = await this.db.query<User>(
      `select u.id, u.sub, u.username, u.name, u.email, u.theme from sessions s join users u on u.id = s.user_id
       where s.token_hash = $1 and s.expires_at > now()`,
      [hash(token)],
    );
    return user ?? null;
  }

  async setTheme(userId: number, theme: Theme): Promise<void> {
    await this.db.query("update users set theme = $2 where id = $1", [userId, theme]);
  }

  async deleteSession(token: string): Promise<void> {
    await this.db.query("delete from sessions where token_hash = $1", [hash(token)]);
  }

  async puzzle(day: string): Promise<Puzzle | null> {
    const [row] = await this.db.query<Puzzle>(
      "select day::text, name, aliases, facts from puzzles where day = $1",
      [day],
    );
    return row ?? null;
  }

  puzzles(): Promise<Puzzle[]> {
    return this.db.query<Puzzle>(
      "select day::text, name, aliases, facts from puzzles order by day desc",
    );
  }

  async savePuzzle(puzzle: Puzzle, userId: number): Promise<void> {
    await this.db.query(
      `insert into puzzles (day, name, aliases, facts, updated_by) values ($1, $2, $3, $4, $5)
       on conflict (day) do update set name = $2, aliases = $3, facts = $4, updated_by = $5, updated_at = now()`,
      [puzzle.day, puzzle.name, [...puzzle.aliases], [...puzzle.facts], userId],
    );
  }

  async deletePuzzle(day: string): Promise<void> {
    await this.db.query("delete from puzzles where day = $1", [day]);
  }

  async game(id: string): Promise<Game | null> {
    if (!/^[0-9a-f-]{36}$/u.test(id)) {
      return null;
    }
    const [row] = await this.db.query<GameRow>(`select ${GAME_COLUMNS} from games where id = $1`, [
      id,
    ]);
    return row === undefined ? null : toGame(row);
  }

  async userGame(userId: number, day: string): Promise<Game | null> {
    const [row] = await this.db.query<GameRow>(
      `select ${GAME_COLUMNS} from games where user_id = $1 and day = $2`,
      [userId, day],
    );
    return row === undefined ? null : toGame(row);
  }

  async createGame(day: string, userId: number | null): Promise<Game> {
    const [row] = await this.db.query<GameRow>(
      `insert into games (id, day, user_id) values ($1, $2, $3) returning ${GAME_COLUMNS}`,
      [randomUUID(), day, userId],
    );
    if (row === undefined) {
      throw new Error("could not start a game");
    }
    return toGame(row);
  }

  async saveGame(game: Game): Promise<void> {
    await this.db.query(
      `update games set turns = $2, won = $3, user_id = $4,
       finished_at = case when $5::boolean then coalesce(finished_at, now()) else null end
       where id = $1`,
      [game.id, JSON.stringify(game.turns), game.won, game.userId, game.finished],
    );
  }

  /** A player's finished games, newest first, with each day's answer now that it is over. */
  history(userId: number): Promise<HistoryRow[]> {
    return this.db.query<HistoryRow>(
      `select g.day::text as day, p.name, jsonb_array_length(g.turns)::int as questions, g.won
       from games g join puzzles p on p.day = g.day
       where g.user_id = $1 and g.finished_at is not null order by g.day desc`,
      [userId],
    );
  }
}

export interface HistoryRow {
  readonly day: string;
  readonly name: string;
  readonly questions: number;
  readonly won: boolean;
}
