import assert from "node:assert/strict";
import { test } from "node:test";
import { frameAt } from "./bark/moods.ts";
import { ask, interpret, moodFor, NEW_ROUND, questionsLeft, shareText } from "./practice.ts";
import type { Round } from "./practice.ts";

const answer = (text: string) => {
  const found = interpret(text);
  assert.ok(found !== null, `practice Bark should understand "${text}"`);
  return found;
};
const play = (...questions: string[]): Round =>
  questions.reduce((round, text) => ask(round, text, answer(text)), NEW_ROUND);

await test("typed questions are understood however they are phrased", () => {
  assert.equal(answer("is it somewhere on campus").verdict, "yes");
  assert.equal(answer("Can I EAT it??").verdict, "no");
  assert.equal(answer("do students paint it at night").verdict, "yes");
  assert.equal(answer("does it change a lot?").verdict, "sortof");
  assert.equal(answer("is it the fence").verdict, "correct");
});

await test("a wrong guess is a no, and an unclear question gets no answer", () => {
  assert.deepEqual(answer("Is it the Cut?"), {
    topic: "guess:cut",
    verdict: "no",
    reply: "Nope, it's not the cut.",
  });
  assert.equal(interpret("what is the meaning of life, really, in general"), null);
  assert.equal(interpret("   "), null);
  assert.equal(interpret("what's up dog"), null, "open questions are not yes-or-no");
  assert.equal(interpret("is it bigger than a breadbox"), null, "only 'is it the ...' is a guess");
  assert.equal(answer("what about the fence?").verdict, "correct");
});

await test("each question uses one of the twenty", () => {
  const round = play("Is it a place?", "Can you eat it?");
  assert.equal(questionsLeft(round), 18);
  assert.equal(round.won, false);
});

await test("asking about the same thing twice costs nothing", () => {
  const once = play("Is it a place?");
  assert.equal(ask(once, "is it a location", answer("is it a location")), once);
});

await test("guessing the answer wins, and the round then stops", () => {
  const won = play("Is it a place?", "Is it the Fence?");
  assert.equal(won.won, true);
  assert.equal(ask(won, "Can you eat it?", answer("Can you eat it?")), won);
});

await test("the share text shows the pattern but not the questions", () => {
  const round = play("Is it a place?", "Does it look the same every day?", "the fence!");
  assert.equal(shareText(round), "Twenty Barks practice 3/20\n\u{1F7E9}\u{1F7E8}\u{1F9B4}");
  assert.doesNotMatch(shareText(round), /Fence/u);
});

await test("a correct guess makes Bark celebrate", () => {
  assert.equal(moodFor("correct"), "win");
  assert.equal(moodFor("sortof"), "sortof");
});

await test("Bark stays on his ground and settles after each reaction", () => {
  for (const mood of ["idle", "think", "yes", "no", "sortof", "win"] as const) {
    for (let t = 0; t < 4; t += 0.05) {
      const frame = frameAt(mood, t, t);
      assert.ok(frame.lift >= 0, `${mood} sinks below the ground at ${t}s`);
      assert.ok(frame.squash > 0.8 && frame.squash < 1.1, `${mood} squashes too far at ${t}s`);
    }
    assert.equal(frameAt(mood, 4, 4).lift, 0, `${mood} is still in the air after 4s`);
  }
});
