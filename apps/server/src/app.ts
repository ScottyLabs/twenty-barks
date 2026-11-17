import { Hono } from "hono";
import { serveWebApp } from "./static.ts";

export interface AppOptions {
  /** Directory holding the built web app, or null to serve only the API. */
  readonly staticDir: string | null;
  /** Resolves when the database answers a trivial query, and rejects otherwise. */
  readonly pingDatabase: () => Promise<void>;
  readonly commitHash: string | null;
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

  app.all("/api/*", (c) => c.json({ error: "Not found" }, 404));

  app.get("*", (c) => {
    if (options.staticDir === null) {
      return c.text("Not found", 404);
    }
    return serveWebApp(options.staticDir, c.req.path);
  });

  return app;
}
