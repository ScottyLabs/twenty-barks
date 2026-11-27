import assert from "node:assert/strict";
import { test } from "node:test";
import type { Judge } from "./jev.ts";
import { campusDay, play, standingOf, statsOf } from "./game.ts";
import { at, fakeOidc, odds, signIn, testApp } from "./testing.ts";

const FENCE = {
  name: "the Fence",
  aliases: ["fence"],
  facts: ["A painted fence on the Cut."],
};
const NOON = new Date("2026-11-18T17:00:00Z");

/** Says yes to everything, and treats any mention of the fence as the winning guess. */
const judge: Judge = (_secret, question) =>
  Promise.resolve(odds({ yes: 1, guessed: /fence/u.test(question) ? 0.95 : 0 }));

const post = (path: string, body: unknown, cookie = "") => ({
  method: "POST",
  headers: { "content-type": "application/json", cookie },
  body: JSON.stringify(body),
});

const json = async (res: Response): Promise<Record<string, unknown>> => {
  const body: unknown = await res.json();
  assert.ok(typeof body === "object" && body !== null);
  return Object.fromEntries(Object.entries(body));
};

async function withPuzzle(options: Parameters<typeof testApp>[0] = {}) {
  const made = await testApp({
    judge,
    now: () => NOON,
    oidc: fakeOidc({ sub: "s-1", username: "admin1" }),
    admins: new Set(["admin1"]),
    ...options,
  });
  await made.store.savePuzzle(
    { day: "2026-11-18", ...FENCE },
    (await made.store.upsertUser({ sub: "x", username: "x", name: null, email: null })).id,
  );
  return made;
}

await test("Bark is reminded of what he already told this player", async () => {
  const heard: unknown[] = [];
  const remembering: Judge = (_secret, _question, earlier) => {
    heard.push(earlier);
    return Promise.resolve(odds({ yes: 1 }));
  };
  const puzzle = { day: "2026-11-18", ...FENCE };
  const fresh = {
    id: "g",
    day: puzzle.day,
    userId: null,
    turns: [],
    won: false,
    finished: false,
    startedMs: 0,
  };
  const first = await play(fresh, puzzle, "is it outside", remembering);
  await play(first.game, puzzle, "is it outdoors", remembering);
  assert.deepEqual(heard, [[], [{ question: "is it outside", answer: "yes" }]]);
});

await test("the day turns over at midnight on campus, not in UTC", () => {
  assert.equal(campusDay(new Date("2026-11-19T03:00:00Z")), "2026-11-18");
  assert.equal(campusDay(new Date("2026-11-19T05:30:00Z")), "2026-11-19");
});

await test("anyone can play without signing in, and the answer stays hidden until the end", async () => {
  const { app } = await withPuzzle();
  const first = await json(
    await app.request("/api/today/ask", post("", { question: "is it outside?" })),
  );
  assert.equal(first.verdict, "yes");
  assert.equal(at(first, "game", "questionsLeft"), 19);
  assert.equal(at(first, "game", "answer"), null);
  const gameId = at(first, "game", "id");
  const won = await json(
    await app.request("/api/today/ask", post("", { question: "is it the fence?", gameId })),
  );
  assert.equal(won.verdict, "correct");
  assert.equal(at(won, "game", "answer"), "the Fence");
  const after = await app.request("/api/today/ask", post("", { question: "again?", gameId }));
  assert.equal(after.status, 409);
});

await test("signing in saves the game, and scores and streaks follow it", async () => {
  const { app } = await withPuzzle();
  const anon = await json(
    await app.request("/api/today/ask", post("", { question: "is it red?" })),
  );
  const gameId = at(anon, "game", "id");
  const cookie = await signIn(app);
  assert.match(cookie, /^tb_session=/u);
  // The game started before signing in carries over.
  await app.request("/api/today/ask", post("", { question: "is it the fence", gameId }, cookie));
  const scores = await json(await app.request("/api/me/scores", { headers: { cookie } }));
  assert.deepEqual(scores.history, [
    { day: "2026-11-18", name: "the Fence", questions: 2, won: true },
  ]);
  assert.equal(at(scores, "stats", "currentStreak"), 1);
  assert.equal((await app.request("/api/me/scores")).status, 401);
});

await test("only listed admins see the admin API, and others are told it does not exist", async () => {
  const { app } = await withPuzzle();
  assert.equal((await app.request("/api/admin/puzzles")).status, 404);
  const cookie = await signIn(app);
  const me = await json(await app.request("/api/me", { headers: { cookie } }));
  assert.equal(at(me, "user", "admin"), true);
  const saved = await app.request("/api/admin/puzzles/2026-11-19", {
    method: "PUT",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ name: "Buggy", aliases: ["buggy"], facts: ["A race at Carnival."] }),
  });
  assert.equal(saved.status, 200);
  const list = await json(await app.request("/api/admin/puzzles", { headers: { cookie } }));
  assert.equal(at(list, "puzzles", "length"), 2);

  const { app: other } = await withPuzzle({ admins: new Set(["someone-else"]) });
  const theirs = await signIn(other);
  assert.equal(
    (await other.request("/api/admin/puzzles", { headers: { cookie: theirs } })).status,
    404,
  );
});

const row = (day: string, won = true) => ({ day, name: "x", questions: 5, won });

await test("streaks count days solved in a row, and survive until the day after", () => {
  const history = [
    row("2026-11-14"),
    row("2026-11-15"),
    row("2026-11-16"),
    row("2026-11-12"),
    row("2026-11-17", false),
  ];
  assert.deepEqual(statsOf(history, "2026-11-17"), {
    played: 5,
    won: 4,
    averageQuestions: 5,
    currentStreak: 3,
    bestStreak: 3,
  });
  assert.equal(statsOf(history, "2026-11-18").currentStreak, 0);
});

await test("a signed-in player's theme is saved to their account", async () => {
  const { app } = await withPuzzle();
  const cookie = await signIn(app);
  const themeOf = async () =>
    at(await json(await app.request("/api/me", { headers: { cookie } })), "user", "theme");
  const put = (theme: string, who = cookie) =>
    app.request("/api/me/theme", { ...post("", { theme }, who), method: "PUT" });
  assert.equal(await themeOf(), "system");
  assert.equal((await put("dark")).status, 200);
  assert.equal(await themeOf(), "dark");
  assert.equal((await put("purple")).status, 400);
  assert.equal((await put("light", "")).status, 401);
});

await test("a standing counts the other players who did worse", () => {
  const standing = standingOf([3, 5, 5, 21], 5);
  assert.equal(standing.players, 4);
  assert.equal(standing.betterThan, 33);
  assert.equal(standing.counts[4], 2);
  assert.equal(standing.counts[20], 1);
  assert.equal(standingOf([4], 4).betterThan, null);
});

await test("the standing is shown only once the game is over", async () => {
  const { app } = await withPuzzle();
  const ask = async (question: string, gameId?: unknown) =>
    json(await app.request("/api/today/ask", post("", { question, gameId })));
  const first = at(await ask("is it red?"), "game", "id");
  await ask("is it the fence?", first);
  const second = at(await ask("is it red?"), "game", "id");
  const early = await app.request(`/api/today/standing?game=${String(second)}`);
  assert.equal(early.status, 404);
  await ask("is it the fence?", second);
  const tied = await json(await app.request(`/api/today/standing?game=${String(first)}`));
  assert.equal(tied.players, 2);
  assert.equal(tied.betterThan, 0);
  assert.equal(tied.score, 2);
});

await test("the page learns where to count views only when a PostHog key is set", async () => {
  const analytics = { key: "phc_test", host: "https://us.i.posthog.com" };
  const off = await json(await (await testApp()).app.request("/api/me"));
  assert.equal(off.analytics, null);
  const on = await json(await (await testApp({ analytics })).app.request("/api/me"));
  assert.deepEqual(on.analytics, analytics);
});
