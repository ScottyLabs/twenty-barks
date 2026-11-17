// Adapted from ScottyLabs/tartanhacks-landing-2027 (src/bark), where Bark was first drawn from the ScottyLabs mark.

import { BEARD_CORNER, EAR_BASE, MIDDLE, NECK, STROKES, type Stroke } from "./shape.ts";

/**
 * Everything that can move in Bark's drawing. At rest every value is zero
 * and the drawing is the ScottyLabs mark exactly.
 *
 * Lengths are in the mark's units. Angles are in radians and turn clockwise
 * on screen, so a positive head angle lowers the nose.
 */
export interface Pose {
  /** Each pair of feet: how far forward of rest, and how far off the ground. */
  hindReach: number;
  hindLift: number;
  foreReach: number;
  foreLift: number;
  /** The head about the neck, the ear about its base, the beard about its corner. */
  head: number;
  ear: number;
  beard: number;
  /** The head laid down to sleep: how far it is lowered, and how far pushed out ahead. */
  headDown: number;
  headOut: number;
}

/**
 * The whole body's proportions, applied to the drawing's points rather than
 * as a transform, so that stretching him never stretches his line.
 */
export interface Build {
  /** Horizontal scale about his middle. Negative faces him left; near zero he is mid-turn. */
  wide: number;
  /** Vertical scale from the ground. */
  tall: number;
}

export const UPRIGHT: Readonly<Build> = { wide: 1, tall: 1 };

/**
 * His build for the way he faces (1 right .. -1 left) and how far he is
 * squashed (1 at rest): what he loses in height he gains in width.
 */
export function buildFor(facing: number, squash: number): Build {
  return { wide: facing * (1 + (1 - squash) * 0.55), tall: squash };
}

export const REST: Readonly<Pose> = {
  hindReach: 0,
  hindLift: 0,
  foreReach: 0,
  foreLift: 0,
  head: 0,
  ear: 0,
  beard: 0,
  headDown: 0,
  headOut: 0,
};

/** How far a stroke runs on past a foot, so the foot can be cut flat. */
const OVERRUN = 30;

const scratch = new Float32Array(128);

/** Turns (x, y) about a pivot by an angle, writing back into scratch[i], scratch[i + 1]. */
function turn(i: number, pivot: { x: number; y: number }, angle: number): void {
  if (angle === 0) return;
  const dx = scratch[i] - pivot.x;
  const dy = scratch[i + 1] - pivot.y;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  scratch[i] = pivot.x + dx * cos - dy * sin;
  scratch[i + 1] = pivot.y + dx * sin + dy * cos;
}

/**
 * Moves a stroke's points into a pose and a build, leaving the result in
 * `scratch`, measured from the ground under his middle.
 */
function place(stroke: Stroke, pose: Pose, build: Build): number {
  const count = stroke.rest.length / 2;
  for (let p = 0; p < count; p++) {
    const i = p * 2;
    scratch[i] =
      stroke.rest[i] + pose.hindReach * stroke.hindReach[p] + pose.foreReach * stroke.foreReach[p];
    scratch[i + 1] =
      stroke.rest[i + 1] - pose.hindLift * stroke.hindLift[p] - pose.foreLift * stroke.foreLift[p];
    // Small parts first, so the head carries the ear and the beard with it.
    turn(i, EAR_BASE, pose.ear * stroke.ear[p]);
    turn(i, BEARD_CORNER, pose.beard * stroke.beard[p]);
    turn(i, NECK, pose.head * stroke.head[p]);
    // Laying his head down moves it whole, after it has turned.
    scratch[i] = scratch[i] + pose.headOut * stroke.lay[p];
    scratch[i + 1] = scratch[i + 1] + pose.headDown * stroke.lay[p];
    scratch[i] = (scratch[i] - MIDDLE) * build.wide;
    scratch[i + 1] = scratch[i + 1] * build.tall;
  }
  return count;
}

const n = (value: number): string => value.toFixed(1);

/** A point `OVERRUN` beyond (ax, ay), continuing the line from (bx, by) through it. */
function beyond(ax: number, ay: number, bx: number, by: number): string {
  const length = Math.hypot(ax - bx, ay - by) || 1;
  return `${n(ax + ((ax - bx) / length) * OVERRUN)},${n(ay + ((ay - by) / length) * OVERRUN)}`;
}

/**
 * The SVG path of one stroke in a pose. Strokes run on a little past each
 * foot; the caller clips them level with the sole.
 */
function trace(
  stroke: Stroke,
  pose: Pose,
  build: Build,
  continued: boolean,
  reversed: boolean,
): string {
  const count = place(stroke, pose, build);
  const s = scratch;
  const last = (count - 1) * 2;
  let d = "";

  if (!reversed) {
    if (stroke.startsAtFoot) {
      d += `${continued ? "L" : "M"}${beyond(s[0], s[1], s[2], s[3])}L${n(s[0])},${n(s[1])}`;
    } else {
      d += `${continued ? "L" : "M"}${n(s[0])},${n(s[1])}`;
    }
    for (let i = 2; i <= last; i += 6) {
      d += `C${n(s[i])},${n(s[i + 1])} ${n(s[i + 2])},${n(s[i + 3])} ${n(s[i + 4])},${n(s[i + 5])}`;
    }
    if (stroke.endsAtFoot) d += `L${beyond(s[last], s[last + 1], s[last - 2], s[last - 1])}`;
    return d;
  }

  if (stroke.endsAtFoot) {
    d += `${continued ? "L" : "M"}${beyond(s[last], s[last + 1], s[last - 2], s[last - 1])}`;
    d += `L${n(s[last])},${n(s[last + 1])}`;
  } else {
    d += `${continued ? "L" : "M"}${n(s[last])},${n(s[last + 1])}`;
  }
  for (let i = last - 2; i >= 4; i -= 6) {
    d += `C${n(s[i])},${n(s[i + 1])} ${n(s[i - 2])},${n(s[i - 1])} ${n(s[i - 4])},${n(s[i - 3])}`;
  }
  if (stroke.startsAtFoot) d += `L${beyond(s[0], s[1], s[2], s[3])}`;
  return d;
}

/** Between the end of his nose and the tip of his beard, at rest. */
const MOUTH = { x: 400, y: -388 } as const;

/** Where his mouth is in a pose and a build: it turns with his head. */
export function mouthIn(pose: Pose, build: Build): { x: number; y: number } {
  const dx = MOUTH.x - NECK.x;
  const dy = MOUTH.y - NECK.y;
  const cos = Math.cos(pose.head);
  const sin = Math.sin(pose.head);
  return {
    x: (NECK.x + dx * cos - dy * sin + pose.headOut - MIDDLE) * build.wide,
    y: (NECK.y + dx * sin + dy * cos + pose.headDown) * build.tall,
  };
}

export interface Drawing {
  /** One path per stroke: back, front, belly. */
  lines: [string, string, string];
  /** The body's outline, closed, for the white that keeps Bark opaque. */
  fill: string;
  /** Height of each pair of soles above the ground (zero or more). */
  hindSole: number;
  foreSole: number;
  /** Which side of his middle the hind feet are on: -1 left, 1 right. */
  hindSide: -1 | 1;
  /** The middle of his mouth, where he can hold something. */
  mouth: { x: number; y: number };
}

/**
 * Draws Bark in a pose and a build. Coordinates are in the mark's units,
 * with the origin on the ground under his middle.
 */
export function draw(pose: Pose, build: Build = UPRIGHT): Drawing {
  const [back, front, belly] = STROKES;
  // Around the body: along the back from nose to hind foot, forward under the belly to the forefoot, then up the chest to the beard and across to the nose.
  const fill =
    trace(back, pose, build, false, false) +
    trace(belly, pose, build, true, true) +
    trace(front, pose, build, true, true) +
    "Z";
  return {
    lines: [
      trace(back, pose, build, false, false),
      trace(front, pose, build, false, false),
      trace(belly, pose, build, false, false),
    ],
    fill,
    hindSole: Math.max(0, pose.hindLift) * build.tall,
    foreSole: Math.max(0, pose.foreLift) * build.tall,
    hindSide: build.wide >= 0 ? -1 : 1,
    mouth: mouthIn(pose, build),
  };
}
