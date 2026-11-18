import { Hono } from "hono";
import type { Context } from "hono";
import { decide, MAX_QUESTION_LENGTH } from "./ask.ts";
import type { Judge } from "./jev.ts";
import { RateLimit } from "./limit.ts";
import { PRACTICE } from "./secret.ts";
import { serveWebApp } from "./static.ts";

export interface AppOptions {
  /** Directory holding the built web app, or null to serve only the API. */
  readonly staticDir: string | null;
  /** Resolves when the database answers a trivial query, and rejects otherwise. */
  readonly pingDatabase: () => Promise<void>;
  readonly commitHash: string | null;
  /** Answers questions, or null when the AI gateway is not configured. */
  readonly judge: Judge | null;
  /** Questions allowed per client per minute. */
  readonly questionsPerMinute?: number;
}

/** Behind Kennel's proxy the client is the first forwarded address. */
function clientOf(c: Context): string {
  return c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
}

async function readQuestion(c: Context): Promise<string | null> {
  try {
    const body: unknown = await c.req.json();
    if (typeof body !== "object" || body === null || !("question" in body)) {
      return null;
    }
    const { question } = body;
    if (typeof question !== "string") {
      return null;
    }
    const trimmed = question.trim();
    return trimmed === "" || trimmed.length > MAX_QUESTION_LENGTH ? null : trimmed;
  } catch {
    return null;
  }
}

function addAsk(app: Hono, options: AppOptions): void {
  const limit = new RateLimit(options.questionsPerMinute ?? 30, 60_000);
  app.post("/api/practice/ask", async (c) => {
    const { judge } = options;
    if (judge === null) {
      return c.json({ error: "Bark is not taking questions right now" }, 503);
    }
    const question = await readQuestion(c);
    if (question === null) {
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

export function createApp(options: AppOptions): Hono {
  const app = new Hono();

  app.use(async (c, next) => {
    await next();
    c.header("x-content-type-options", "nosniff");
    c.header("referrer-policy", "strict-origin-when-cross-origin");
    c.header("x-frame-options", "DENY");
  });

  // Kennel holds traffic back until this returns 200, so it only does once the database is reachable.
  app.get("/api/health", async (c) => {
    try {
      await options.pingDatabase();
    } catch {
      return c.json({ status: "unavailable", database: false }, 503);
    }
    return c.json({ status: "ok", database: true, commit: options.commitHash });
  });

  addAsk(app, options);

  app.all("/api/*", (c) => c.json({ error: "Not found" }, 404));

  app.get("*", (c) => {
    if (options.staticDir === null) {
      return c.text("Not found", 404);
    }
    return serveWebApp(options.staticDir, c.req.path);
  });

  return app;
}
