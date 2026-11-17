import assert from "node:assert/strict";
import { test } from "node:test";
import { frameAt } from "./bark/moods.ts";
import { ask, moodFor, NEW_ROUND, PRACTICE, questionsLeft, shareText } from "./practice.ts";

const byId = (id: string) => {
  const question = PRACTICE.find((q) => q.id === id);
  assert.ok(question !== undefined);
  return question;
};

await test("each question uses one of the twenty", () => {
  const round = ask(ask(NEW_ROUND, byId("place")), byId("eat"));
  assert.equal(questionsLeft(round), 18);
  assert.equal(round.won, false);
});

await test("asking the same question twice costs nothing", () => {
  const once = ask(NEW_ROUND, byId("place"));
  assert.equal(ask(once, byId("place")), once);
});

await test("guessing the answer wins, and the round then stops", () => {
  const won = ask(ask(NEW_ROUND, byId("place")), byId("fence"));
  assert.equal(won.won, true);
  assert.equal(ask(won, byId("eat")), won);
});

await test("the share text shows the pattern but not the questions", () => {
  const round = ask(ask(ask(NEW_ROUND, byId("place")), byId("same")), byId("fence"));
  assert.equal(shareText(round), "Twenty Barks practice 3/20\n\u{1F7E9}\u{1F7E8}\u{1F9B4}");
  assert.doesNotMatch(shareText(round), /Fence/u);
});

await test("a correct guess makes Bark celebrate", () => {
  assert.equal(moodFor("correct"), "win");
  assert.equal(moodFor("sortof"), "sortof");
});

await test("Bark stays on his ground and settles after each reaction", () => {
  for (const mood of ["idle", "yes", "no", "sortof", "win"] as const) {
    for (let t = 0; t < 4; t += 0.05) {
      const frame = frameAt(mood, t, t);
      assert.ok(frame.lift >= 0, `${mood} sinks below the ground at ${t}s`);
      assert.ok(frame.squash > 0.8 && frame.squash < 1.1, `${mood} squashes too far at ${t}s`);
    }
    assert.equal(frameAt(mood, 4, 4).lift, 0, `${mood} is still in the air after 4s`);
  }
});
