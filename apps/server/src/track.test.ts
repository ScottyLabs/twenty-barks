import assert from "node:assert/strict";
import { test } from "node:test";
import type { Judge } from "./jev.ts";
import { at, odds, testApp } from "./testing.ts";
import { type GameEvent, posthogTracker } from "./track.ts";

const judge: Judge = (_secret, question) =>
  Promise.resolve(odds({ yes: 1, guessed: /fence/u.test(question) ? 0.95 : 0 }));

const ask = (question: string, gameId?: unknown) => ({
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ question, gameId }),
});

await test("each counted question is tracked by game, and the end says how it went", async () => {
  const sent: { gameId: string; event: GameEvent }[] = [];
  const { app, store } = await testApp({
    judge,
    now: () => new Date("2026-11-18T17:00:00Z"),
    track: (gameId, event) => {
      sent.push({ gameId, event });
    },
  });
  const admin = await store.upsertUser({ sub: "x", username: "x", name: null, email: null });
  await store.savePuzzle(
    { day: "2026-11-18", name: "the Fence", aliases: ["fence"], facts: ["Painted."] },
    admin.id,
  );
  const first: unknown = await (await app.request("/api/today/ask", ask("is it red?"))).json();
  const gameId = at(first, "game", "id");
  await app.request("/api/today/ask", ask("is it the fence?", gameId));

  assert.deepEqual(
    sent.map(({ event }) => event.event),
    ["game_started", "question_asked", "question_asked", "game_finished"],
  );
  assert.ok(sent.every((one) => one.gameId === gameId));
  const finished = sent.at(-1)?.event.properties;
  assert.equal(finished?.won, true);
  assert.equal(finished?.questions, 2);
  assert.equal(typeof finished?.seconds, "number");
  assert.equal(sent[1]?.event.properties.verdict, "yes");
});

await test("PostHog gets the event under the game's id, without a person profile", async () => {
  const calls: { url: unknown; body: unknown }[] = [];
  const send: typeof fetch = (url, init) => {
    const body = init?.body;
    calls.push({ url, body: typeof body === "string" ? (JSON.parse(body) as unknown) : null });
    return Promise.resolve(new Response(null, { status: 200 }));
  };
  posthogTracker(
    "phc_test",
    "https://us.i.posthog.com/",
    send,
  )("game-1", {
    event: "game_started",
    properties: { day: "2026-11-18" },
  });
  await Promise.resolve();
  assert.equal(calls[0]?.url, "https://us.i.posthog.com/i/v0/e/");
  const body = calls[0]?.body;
  assert.equal(at(body, "api_key"), "phc_test");
  assert.equal(at(body, "event"), "game_started");
  assert.equal(at(body, "distinct_id"), "game-1");
  assert.deepEqual(at(body, "properties"), { day: "2026-11-18", $process_person_profile: false });
  assert.equal(typeof at(body, "timestamp"), "string");
});
