import type { Hono } from "hono";
import { MAX_QUESTION_LENGTH } from "../ask.ts";
import { type AppContext, type AppEnv, jsonBody, stringField } from "../context.ts";
import { campusDay, play, statsOf, viewOf } from "../game.ts";
import type { Judge } from "../jev.ts";
import type { RateLimit } from "../limit.ts";
import type { Game, Puzzle, Store, User } from "../store.ts";

export interface GameOptions {
  readonly store: Store;
  readonly judge: Judge | null;
  readonly limit: RateLimit;
  readonly now: () => Date;
}

/** Behind Kennel's proxy the client is the first forwarded address. */
export function clientOf(c: AppContext): string {
  return c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
}

/**
 * The game this request is playing today, if any. A signed-in player has one a day; someone not signed in carries its id. Signing in mid-game claims it.
 */
async function currentGame(
  store: Store,
  user: User | null,
  day: string,
  carried: string | null,
): Promise<Game | null> {
  const mine = user === null ? null : await store.userGame(user.id, day);
  if (mine !== null) {
    return mine;
  }
  const held = carried === null ? null : await store.game(carried);
  if (held === null || held.day !== day || held.userId !== null) {
    return null;
  }
  if (user === null) {
    return held;
  }
  const claimed = { ...held, userId: user.id };
  await store.saveGame(claimed);
  return claimed;
}

function today(options: GameOptions): Promise<Puzzle | null> {
  return options.store.puzzle(campusDay(options.now()));
}

function addAsk(app: Hono<AppEnv>, options: GameOptions): void {
  app.post("/api/today/ask", async (c) => {
    const { judge, store } = options;
    const puzzle = await today(options);
    if (judge === null || puzzle === null) {
      return c.json({ error: "There is no puzzle today" }, 404);
    }
    const body = await jsonBody(c);
    const question = stringField(body, "question")?.trim() ?? "";
    if (question === "" || question.length > MAX_QUESTION_LENGTH) {
      return c.json({ error: `Ask a question of up to ${MAX_QUESTION_LENGTH} characters` }, 400);
    }
    if (!options.limit.allow(clientOf(c), Date.now())) {
      return c.json({ error: "Too many questions. Give Bark a minute!" }, 429);
    }
    const user = c.get("user");
    const game =
      (await currentGame(store, user, puzzle.day, stringField(body, "gameId"))) ??
      (await store.createGame(puzzle.day, user?.id ?? null));
    if (game.finished) {
      return c.json({ error: "This game is over", game: viewOf(game, puzzle) }, 409);
    }
    try {
      const played = await play(game, puzzle, question, judge);
      if (played.counted) {
        await store.saveGame(played.game);
      }
      return c.json({ ...played.reply, game: viewOf(played.game, puzzle) });
    } catch (error) {
      console.error("judge failed:", error instanceof Error ? error.message : error);
      return c.json({ error: "Bark could not think of an answer" }, 502);
    }
  });
}

export function addGame(app: Hono<AppEnv>, options: GameOptions): void {
  app.get("/api/today", async (c) => {
    const puzzle = await today(options);
    if (puzzle === null) {
      return c.json({ day: campusDay(options.now()), puzzle: false, game: null });
    }
    const game = await currentGame(
      options.store,
      c.get("user"),
      puzzle.day,
      c.req.query("game") ?? null,
    );
    return c.json({
      day: puzzle.day,
      puzzle: options.judge !== null,
      game: game === null ? null : viewOf(game, puzzle),
    });
  });

  addAsk(app, options);

  app.get("/api/me/scores", async (c) => {
    const user = c.get("user");
    if (user === null) {
      return c.json({ error: "Sign in to see your scores" }, 401);
    }
    const history = await options.store.history(user.id);
    return c.json({ stats: statsOf(history, campusDay(options.now())), history });
  });
}
