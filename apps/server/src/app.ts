import { Hono } from "hono";
import { decide, MAX_QUESTION_LENGTH } from "./ask.ts";
import { type AppEnv, jsonBody, stringField } from "./context.ts";
import type { Drafter } from "./draft.ts";
import type { Judge } from "./jev.ts";
import { RateLimit } from "./limit.ts";
import type { Oidc } from "./oidc.ts";
import { addAdmin } from "./routes/admin.ts";
import { type Analytics, addAuth } from "./routes/auth.ts";
import { addGame, clientOf } from "./routes/game.ts";
import { PRACTICE } from "./secret.ts";
import { serveWebApp } from "./static.ts";
import type { Store } from "./store.ts";

export interface AppOptions {
  /** Directory holding the built web app, or null to serve only the API. */
  readonly staticDir: string | null;
  /** Resolves when the database answers a trivial query, and rejects otherwise. */
  readonly pingDatabase: () => Promise<void>;
  readonly commitHash: string | null;
  readonly store: Store;
  /** Answers questions, or null when the AI gateway is not configured. */
  readonly judge: Judge | null;
  /** Drafts puzzles for admins, or null when the AI gateway is not configured. */
  readonly drafter?: Drafter | null;
  /** Signs players in, or null when login is not configured. */
  readonly oidc?: Oidc | null;
  readonly appUrl?: string;
  readonly relayUrl?: string | null;
  /** Usernames or emails allowed into the admin pages. */
  readonly admins?: ReadonlySet<string>;
  /** PostHog settings for counting page views, or null to count nothing. */
  readonly analytics?: Analytics | null;
  /** Questions allowed per client per minute. */
  readonly questionsPerMinute?: number;
  readonly now?: () => Date;
}

function addPractice(app: Hono<AppEnv>, judge: Judge | null, limit: RateLimit): void {
  app.post("/api/practice/ask", async (c) => {
    if (judge === null) {
      return c.json({ error: "Bark is not taking questions right now" }, 503);
    }
    const question = stringField(await jsonBody(c), "question")?.trim() ?? "";
    if (question === "" || question.length > MAX_QUESTION_LENGTH) {
      return c.json({ error: `Ask a question of up to ${MAX_QUESTION_LENGTH} characters` }, 400);
    }
    if (!limit.allow(clientOf(c), Date.now())) {
      return c.json({ error: "Too many questions. Give Bark a minute!" }, 429);
    }
    try {
      return c.json(decide(PRACTICE, question, await judge(PRACTICE, question)));
    } catch (error) {
      console.error("judge failed:", error instanceof Error ? error.message : error);
      return c.json({ error: "Bark could not think of an answer" }, 502);
    }
  });
}

function addHealth(app: Hono<AppEnv>, options: AppOptions): void {
  // Kennel holds traffic back until this returns 200, so it only does once the database is reachable.
  app.get("/api/health", async (c) => {
    try {
      await options.pingDatabase();
    } catch {
      return c.json({ status: "unavailable", database: false }, 503);
    }
    return c.json({ status: "ok", database: true, commit: options.commitHash });
  });
}

export function createApp(options: AppOptions): Hono<AppEnv> {
  const app = new Hono<AppEnv>();
  const { store, judge } = options;
  const admins = options.admins ?? new Set<string>();
  const limit = new RateLimit(options.questionsPerMinute ?? 30, 60_000);

  app.use(async (c, next) => {
    await next();
    c.header("x-content-type-options", "nosniff");
    c.header("referrer-policy", "strict-origin-when-cross-origin");
    c.header("x-frame-options", "DENY");
  });

  addHealth(app, options);
  addAuth(app, {
    store,
    oidc: options.oidc ?? null,
    appUrl: options.appUrl ?? "http://localhost:4173",
    relayUrl: options.relayUrl ?? null,
    admins,
    analytics: options.analytics ?? null,
  });
  addPractice(app, judge, limit);
  addGame(app, { store, judge, limit, now: options.now ?? (() => new Date()) });
  addAdmin(app, { store, judge, drafter: options.drafter ?? null, admins });

  app.all("/api/*", (c) => c.json({ error: "Not found" }, 404));

  app.get("*", (c) => {
    if (options.staticDir === null) {
      return c.text("Not found", 404);
    }
    return serveWebApp(options.staticDir, c.req.path);
  });

  return app;
}
