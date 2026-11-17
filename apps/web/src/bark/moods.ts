import { clamp, smooth01 } from "./motion.ts";
import { REST, type Pose } from "./pose.ts";
import { HEIGHT } from "./shape.ts";

/** How Bark is reacting. Each answer the game gives has its own. */
export type Mood = "idle" | "yes" | "no" | "sortof" | "win";

/** Everything the drawing needs for one moment of a reaction. */
export interface Frame {
  readonly pose: Pose;
  /** Vertical squash about the ground, 1 at rest. */
  readonly squash: number;
  /** Height of his feet above the ground, in the mark's units. */
  readonly lift: number;
  /** Sideways shiver, in the mark's units. */
  readonly shiver: number;
  /** How far through a bark he is: 0 silent, rising to 1 as the strokes fly out. */
  readonly woof: number;
  /** Whether the question mark shows over his head. */
  readonly wonder: number;
}

const TAU = Math.PI * 2;
const BREATH_S = 3.6;
const HOP_S = 0.5;
const CROUCH_S = 0.1;
const HOP_HEIGHT = HEIGHT * 0.22;

/** A rise and fall from 0 to 1 and back over `length` seconds, starting at `start`. */
function pulse(t: number, start: number, length: number): number {
  const u = (t - start) / length;
  return u <= 0 || u >= 1 ? 0 : Math.sin(u * Math.PI);
}

/** One hop: a crouch, a parabola, and a squash on landing. */
function hop(t: number): { lift: number; squash: number } {
  if (t < 0) {
    return { lift: 0, squash: 1 };
  }
  if (t < CROUCH_S) {
    return { lift: 0, squash: 1 - 0.12 * smooth01(t / CROUCH_S) };
  }
  const air = (t - CROUCH_S) / HOP_S;
  if (air < 1) {
    return { lift: HOP_HEIGHT * 4 * air * (1 - air), squash: 1 + 0.06 * Math.sin(air * Math.PI) };
  }
  return { lift: 0, squash: 1 - 0.08 * pulse(t, CROUCH_S + HOP_S, 0.18) };
}

function breathing(clock: number): number {
  return 1 - 0.012 * (1 - Math.cos((clock / BREATH_S) * TAU));
}

/** Now and then his ear flicks. */
function earFlick(clock: number, every: number): number {
  return -0.22 * pulse(clock % every, 0, 0.28);
}

function idle(clock: number): Frame {
  return {
    pose: { ...REST, ear: earFlick(clock, 4.2) },
    squash: breathing(clock),
    lift: 0,
    shiver: 0,
    woof: 0,
    wonder: 0,
  };
}

function yes(t: number, clock: number): Frame {
  const jump = hop(t);
  const nod = t < 1.2 ? -0.1 * Math.sin(t * TAU * 1.6) * (1 - t / 1.2) : 0;
  return {
    pose: {
      ...REST,
      head: nod - 0.05,
      ear: -0.3 * pulse(t, 0.05, 0.6),
      beard: 0.12 * pulse(t, 0.1, 0.5),
    },
    squash: jump.squash * (t > 1.2 ? breathing(clock) : 1),
    lift: jump.lift,
    shiver: 0,
    woof: clamp((t - 0.12) / 0.35, 0, 1) * (t < 0.75 ? 1 : 0),
    wonder: 0,
  };
}

function no(t: number, clock: number): Frame {
  const droop = smooth01(t / 0.35);
  const shake = t < 0.9 ? Math.sin(t * TAU * 7) * (1 - t / 0.9) : 0;
  return {
    pose: { ...REST, head: 0.16 * droop, ear: 0.32 * droop, beard: 0.06 * shake },
    squash: breathing(clock) - 0.02 * droop,
    lift: 0,
    shiver: 14 * shake,
    woof: 0,
    wonder: 0,
  };
}

function sortOf(t: number, clock: number): Frame {
  const tilt = smooth01(t / 0.45);
  return {
    pose: { ...REST, head: -0.13 * tilt, ear: -0.28 * tilt + earFlick(clock, 2.4) },
    squash: breathing(clock),
    lift: 0,
    shiver: 0,
    woof: 0,
    wonder: smooth01((t - 0.2) / 0.3),
  };
}

function win(t: number, clock: number): Frame {
  const cycle = HOP_S + CROUCH_S + 0.12;
  const n = Math.floor(t / cycle);
  const jump = n < 3 ? hop(t - n * cycle) : { lift: 0, squash: breathing(clock) };
  const local = t - n * cycle;
  return {
    pose: { ...REST, head: -0.08, ear: -0.32 * pulse(local, 0, cycle) },
    squash: jump.squash,
    lift: jump.lift,
    shiver: 0,
    woof: n < 3 ? clamp((local - 0.12) / 0.3, 0, 1) * (local < 0.6 ? 1 : 0) : 0,
    wonder: 0,
  };
}

const REACTIONS: Readonly<Record<Mood, (since: number, clock: number) => Frame>> = {
  idle: (_since, clock) => idle(clock),
  yes,
  no,
  sortof: sortOf,
  win,
};

/**
 * Bark at a moment of a reaction.
 *
 * `since` is the time since the reaction began and `clock` the time since he appeared, both in seconds.
 */
export function frameAt(mood: Mood, since: number, clock: number): Frame {
  return REACTIONS[mood](since, clock);
}
