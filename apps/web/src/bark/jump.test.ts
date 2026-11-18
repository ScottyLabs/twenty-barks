import assert from "node:assert/strict";
import { test } from "node:test";
import { GROUNDED, leapAt, press, settle, type Leaps } from "./jump.ts";
import { HEIGHT } from "./shape.ts";

/** Every frame of a leap at 60 fps, from `from` until it is over. */
function frames(leaps: Leaps, from: number) {
  const seen = [];
  for (let t = from; t < from + 3; t += 1 / 60) {
    const leap = leapAt(leaps, t);
    if (leap !== null) {
      seen.push(leap);
    }
  }
  return seen;
}

await test("a press makes him gather, jump about his own height, and land", () => {
  const leaps = press(GROUNDED, 10);
  const seen = frames(leaps, 10);
  const top = Math.max(...seen.map((f) => f.lift));
  assert.ok(top > HEIGHT && top < 1.2 * HEIGHT, `about his height: ${top / HEIGHT}`);
  assert.ok(
    seen.slice(0, 5).some((f) => f.squash < 0.9),
    "he gathers first",
  );
  assert.ok(
    seen.every((f) => f.lift >= 0 && f.spin === 0),
    "no flip, never below ground",
  );
  assert.equal(seen.at(-1)?.lift, 0, "he lands");
  assert.equal(leapAt(leaps, 13), null, "and the jump ends");
});

await test("a press in the air does not start another jump", () => {
  const first = press(GROUNDED, 10);
  assert.equal(press(first, 10.3).start, 10);
});

await test("five quick presses earn a backflip, right over backwards and higher", () => {
  let leaps = GROUNDED;
  for (let i = 0; i < 5; i += 1) {
    leaps = settle(press(leaps, 10 + 0.2 * i), 10 + 0.2 * i);
  }
  for (let t = 10.8; t < 13 && !leaps.flip; t += 1 / 60) {
    leaps = settle(leaps, t);
  }
  assert.equal(leaps.flip, true);
  const seen = frames(leaps, leaps.start);
  const top = Math.max(...seen.map((f) => f.lift));
  const turned = Math.min(...seen.map((f) => f.spin));
  assert.ok(top > 1.2 * HEIGHT, `higher than a jump: ${top / HEIGHT}`);
  assert.ok(Math.abs(turned + 2 * Math.PI) < 0.05, `once right over: ${turned}`);
  assert.equal(seen.at(-1)?.spin, 0, "feet first at the end");
});

await test("five slow presses are only jumps", () => {
  let leaps = GROUNDED;
  for (let i = 0; i < 5; i += 1) {
    leaps = settle(press(leaps, 10 + i), 10 + i);
    assert.equal(leaps.flip, false);
  }
});
