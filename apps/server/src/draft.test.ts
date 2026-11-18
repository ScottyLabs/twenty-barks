import assert from "node:assert/strict";
import { test } from "node:test";
import { gatewayDrafter, parseDraft } from "./draft.ts";
import type { Judge } from "./jev.ts";
import { at, fakeOidc, odds, signIn, testApp } from "./testing.ts";

const DRAFT = {
  name: "Buggy",
  aliases: ["Buggy", "sweepstakes"],
  facts: ["A race at Spring Carnival.", "It is outdoors."],
  check: ["Races began around 1920."],
  questions: ["Is it outside?", "Can you eat it?"],
};

await test("a draft is read out of the model's reply, even inside a code fence", () => {
  const draft = parseDraft(`Here you go:\n\`\`\`json\n${JSON.stringify(DRAFT)}\n\`\`\``);
  assert.deepEqual(draft.aliases, ["buggy", "sweepstakes"]);
  assert.equal(draft.facts.length, 2);
  assert.throws(() => parseDraft("Sorry, I can't."), /did not return/u);
  assert.throws(() => parseDraft('{"name":"x","aliases":[],"facts":[]}'), /missing/u);
});

await test("the drafter asks the gateway's chat endpoint, passing past answers along", async () => {
  const seen: string[] = [];
  const fakeFetch: typeof fetch = (input, init) => {
    seen.push(
      input instanceof Request ? input.url : input.toString(),
      typeof init?.body === "string" ? init.body : "",
    );
    const message = { content: JSON.stringify(DRAFT) };
    return Promise.resolve(Response.json({ choices: [{ message }] }));
  };
  const draft = await gatewayDrafter(
    "https://gateway.test/",
    "k",
    "mid",
    fakeFetch,
  )({
    thing: "",
    notes: "",
    past: ["the Fence"],
  });
  assert.equal(draft.name, "Buggy");
  assert.equal(seen[0], "https://gateway.test/v1/chat/completions");
  assert.match(seen[1] ?? "", /Past answers: the Fence/u);
  assert.match(seen[1] ?? "", /"model":"mid"/u);
});

/** Says no to anything about eating, and yes to everything else. */
const judge: Judge = (_s, question) =>
  Promise.resolve(odds(question.includes("eat") ? { no: 1 } : { yes: 1 }));

await test("only admins can draft, and each draft question is tried against Jev", async () => {
  const { app } = await testApp({
    judge,
    drafter: () => Promise.resolve(DRAFT),
    oidc: fakeOidc({ sub: "s", username: "admin1" }),
    admins: new Set(["admin1"]),
  });
  const request = (cookie: string) =>
    app.request("/api/admin/draft", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ thing: "Buggy" }),
    });
  assert.equal((await request("")).status, 404);
  const body: unknown = await (await request(await signIn(app))).json();
  assert.equal(at(body, "draft", "name"), "Buggy");
  assert.equal(at(body, "tried", "0", "verdict"), "yes");
  assert.equal(at(body, "tried", "1", "verdict"), "no");
});
