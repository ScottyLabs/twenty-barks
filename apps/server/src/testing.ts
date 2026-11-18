import { PGlite } from "@electric-sql/pglite";
import { createApp, type AppOptions } from "./app.ts";
import { type Db, migrate } from "./db.ts";
import type { Judgment } from "./jev.ts";
import type { Oidc } from "./oidc.ts";
import { Store } from "./store.ts";

/** A real Postgres, in memory, for tests. */
export async function memoryDb(): Promise<Db> {
  const pg = new PGlite();
  const db: Db = {
    async query<Row extends object>(sql: string, params: readonly unknown[] = []) {
      if (params.length === 0 && sql.includes(";")) {
        // Several statements at once, as migrations send; they return nothing the app reads.
        await pg.exec(sql);
        return [];
      }
      const result = await pg.query<Row>(sql, [...params]);
      return result.rows;
    },
  };
  await migrate(db);
  return db;
}

/** Follows a path into parsed JSON, for tests to check what came back. */
export function at(value: unknown, ...path: string[]): unknown {
  let here = value;
  for (const key of path) {
    here =
      typeof here === "object" && here !== null ? (Reflect.get(here, key) as unknown) : undefined;
  }
  return here;
}

export const odds = (partial: Partial<Judgment>): Judgment => ({
  yes: 0,
  no: 0,
  sortof: 0,
  unanswerable: 0,
  guessed: 0,
  ...partial,
});

/** Keycloak's part, played by whoever the test says is signing in. */
export function fakeOidc(who: { sub: string; username: string }): Oidc {
  return {
    authorizeUrl: ({ state }) => Promise.resolve(`https://keycloak.test/auth?state=${state}`),
    exchange: () =>
      Promise.resolve({ sub: who.sub, username: who.username, name: who.username, email: null }),
  };
}

export async function testApp(options: Partial<AppOptions> = {}) {
  const store = new Store(await memoryDb());
  const app = createApp({
    staticDir: null,
    pingDatabase: () => Promise.resolve(),
    commitHash: null,
    judge: null,
    store,
    ...options,
  });
  return { app, store };
}

/** Signs in through the whole login flow, and gives back the session cookie. */
export async function signIn(app: Awaited<ReturnType<typeof testApp>>["app"]): Promise<string> {
  const start = await app.request("/api/auth/login?returnTo=/scores");
  const state = new URL(start.headers.get("location") ?? "").searchParams.get("state") ?? "";
  const back = await app.request(`/api/auth/callback?code=c&state=${encodeURIComponent(state)}`);
  const cookie = back.headers.get("set-cookie") ?? "";
  return cookie.split(";")[0] ?? "";
}
