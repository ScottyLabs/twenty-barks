import assert from "node:assert/strict";
import { test } from "node:test";
import { createApp } from "./app.ts";
import { Store } from "./store.ts";
import { memoryDb } from "./testing.ts";
import { decide } from "./ask.ts";
import { jevJudge, type Judge, type Judgment } from "./jev.ts";
import { PRACTICE } from "./secret.ts";

const store = new Store(await memoryDb());

const odds = (partial: Partial<Judgment>): Judgment => ({
  yes: 0,
  no: 0,
  sortof: 0,
  unanswerable: 0,
  guessed: 0,
  ...partial,
});

await test("the likeliest answer wins when Jev is sure enough", () => {
  assert.equal(decide(PRACTICE, "do people paint it", odds({ yes: 1 })).verdict, "yes");
  assert.equal(decide(PRACTICE, "is it red", odds({ sortof: 0.71, no: 0.21 })).verdict, "sortof");
});

await test("a muddled or open question is unsure, which costs nothing", () => {
  const near = odds({ yes: 0.49, unanswerable: 0.35, guessed: 0.13 });
  assert.equal(decide(PRACTICE, "is it near the fence?", near).verdict, "unsure");
  assert.equal(decide(PRACTICE, "what's up dog", odds({ unanswerable: 0.92 })).verdict, "unsure");
});

await test("a win needs the question to name the answer and Jev to read it as a guess", () => {
  const guess = odds({ yes: 1, guessed: 0.96 });
  assert.equal(decide(PRACTICE, "Is it the Fence?", guess).verdict, "correct");
  assert.equal(decide(PRACTICE, "is it the thing you're thinking of?", guess).verdict, "yes");
  assert.notEqual(
    decide(PRACTICE, "is it near the fence", odds({ guessed: 0.13 })).verdict,
    "correct",
  );
  assert.notEqual(decide(PRACTICE, "is it fenced in?", guess).verdict, "correct");
});

await test("the same question always gets the same line", () => {
  const a = decide(PRACTICE, "Is it made of wood?", odds({ yes: 1 }));
  const b = decide(PRACTICE, "  is it MADE of wood? ", odds({ yes: 1 }));
  assert.equal(a.reply, b.reply);
});

await test("the judge sends the facts and question to Jev under /typesafe", async () => {
  const sent: { url: string; body: unknown; auth: string | null }[] = [];
  const fakeFetch: typeof fetch = (input, init) => {
    sent.push({
      url: input instanceof Request ? input.url : input.toString(),
      body: typeof init?.body === "string" ? (JSON.parse(init.body) as unknown) : null,
      auth: new Headers(init?.headers).get("authorization"),
    });
    const answers = { answer: { probabilities: { yes: 0.9, no: 0.1 } }, guessed: { noul: 0.2 } };
    return Promise.resolve(Response.json({ answers }));
  };
  const judgment = await jevJudge("https://gateway.test/", "k", fakeFetch)(PRACTICE, "is it red");
  assert.deepEqual(judgment, { yes: 0.9, no: 0.1, sortof: 0, unanswerable: 0, guessed: 0.2 });
  assert.equal(sent[0]?.url, "https://gateway.test/typesafe/v1/systemone");
  assert.equal(sent[0]?.auth, "Bearer k");
  assert.match(JSON.stringify(sent[0]?.body), /"player_question":"is it red"/u);
});

const ask = (app: ReturnType<typeof createApp>, body: unknown) =>
  app.request("/api/practice/ask", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

const appWith = (judge: Judge | null, questionsPerMinute = 30) =>
  createApp({
    store,
    staticDir: null,
    pingDatabase: () => Promise.resolve(),
    commitHash: null,
    judge,
    questionsPerMinute,
  });

await test("asking returns Bark's verdict and reply, without the answer", async () => {
  const res = await ask(
    appWith(() => Promise.resolve(odds({ no: 1 }))),
    { question: "can you eat it" },
  );
  assert.equal(res.status, 200);
  const body = JSON.stringify(await res.json());
  assert.match(body, /"verdict":"no"/u);
  assert.doesNotMatch(body, /fence/iu);
});

await test("bad questions, a missing gateway, a failing judge, and floods are refused", async () => {
  const fine = appWith(() => Promise.resolve(odds({ yes: 1 })), 2);
  assert.equal((await ask(fine, { question: "" })).status, 400);
  assert.equal((await ask(fine, { question: "x".repeat(121) })).status, 400);
  assert.equal((await ask(fine, { nope: 1 })).status, 400);
  assert.equal((await ask(appWith(null), { question: "is it red" })).status, 503);
  const broken = appWith(() => Promise.reject(new Error("down")));
  assert.equal((await ask(broken, { question: "is it red" })).status, 502);
  assert.equal((await ask(fine, { question: "a?" })).status, 200);
  assert.equal((await ask(fine, { question: "b?" })).status, 200);
  assert.equal((await ask(fine, { question: "c?" })).status, 429);
});
