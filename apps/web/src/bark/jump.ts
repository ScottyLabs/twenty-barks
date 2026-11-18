// Adapted from ScottyLabs/tartanhacks-landing-2027 (src/bark/mind.ts): the jump Bark makes when pressed, and the backflip he turns for five quick presses.
import { clamp, smooth01 } from "./motion.ts";
import { HEIGHT } from "./shape.ts";

const TAU = Math.PI * 2;

interface Kind {
  /** Time spent gathering before leaving the ground, and how low he gathers. */
  readonly crouchS: number;
  readonly crouch: number;
  /** How high he goes, in his own heights. */
  readonly height: number;
}

const JUMP: Kind = { crouchS: 0.1, crouch: 0.85, height: 1.12 };
const FLIP: Kind = { crouchS: 0.16, crouch: 0.78, height: 1.35 };
/** A jump's way up takes this long; gravity follows from it, and is the same for the flip. */
const JUMP_RISE_S = 0.27;
const GRAVITY = (2 * JUMP.height) / JUMP_RISE_S ** 2;
/** He lands, squashes, and springs back over this long. */
const LANDING_S = 0.32;

/** This many presses, each within this long of the last, earn a backflip. */
export const PRESSES_FOR_FLIP = 5;
const QUICK_S = 0.5;

function airTime(kind: Kind): number {
  return 2 * Math.sqrt((2 * kind.height) / GRAVITY);
}

function length(kind: Kind): number {
  return kind.crouchS + airTime(kind) + LANDING_S;
}

/** A jump under way, and the presses counted toward a backflip. */
export interface Leaps {
  readonly start: number;
  readonly flip: boolean;
  readonly presses: number;
  readonly pressedAt: number;
  /** A backflip earned in the air, taken as soon as he lands. */
  readonly flipDue: boolean;
}

export const GROUNDED: Leaps = {
  start: -Infinity,
  flip: false,
  presses: 0,
  pressedAt: -Infinity,
  flipDue: false,
};

/** Whether he is still crouching or in the air, so cannot take off again. */
function busy(leaps: Leaps, now: number): boolean {
  const kind = leaps.flip ? FLIP : JUMP;
  return now - leaps.start < kind.crouchS + airTime(kind);
}

/** After a press at `now` (seconds): he jumps if his feet are down, and a fifth quick press earns a backflip. */
export function press(leaps: Leaps, now: number): Leaps {
  const presses = now - leaps.pressedAt <= QUICK_S ? leaps.presses + 1 : 1;
  const flipDue = leaps.flipDue || presses >= PRESSES_FOR_FLIP;
  const counted = { ...leaps, presses: flipDue ? 0 : presses, pressedAt: now };
  if (busy(leaps, now)) {
    return { ...counted, flipDue };
  }
  return { ...counted, start: now, flip: flipDue, flipDue: false };
}

/** Takes a backflip owed from the air as soon as he is back on the ground. */
export function settle(leaps: Leaps, now: number): Leaps {
  if (!leaps.flipDue || busy(leaps, now)) {
    return leaps;
  }
  return { ...leaps, start: now, flip: true, flipDue: false };
}

/** How a jump moves him at one moment. */
export interface Leap {
  /** Height of his feet, in the mark's units. */
  readonly lift: number;
  readonly squash: number;
  /** How far over backwards he has turned, in radians. */
  readonly spin: number;
  readonly ear: number;
  readonly beard: number;
}

/** Where a jump has him at `now`, or null once it is over. */
export function leapAt(leaps: Leaps, now: number): Leap | null {
  const kind = leaps.flip ? FLIP : JUMP;
  const t = now - leaps.start;
  if (t < 0 || t >= length(kind)) {
    return null;
  }
  if (t < kind.crouchS) {
    const gather = smooth01(t / kind.crouchS);
    return {
      lift: 0,
      squash: 1 - (1 - kind.crouch) * gather,
      spin: 0,
      ear: 0.1 * gather,
      beard: 0,
    };
  }
  const air = airTime(kind);
  const u = (t - kind.crouchS) / air;
  if (u < 1) {
    // Rising is +1, falling -1: his ear trails behind and his beard lifts on the way up.
    const rising = 1 - 2 * u;
    const turned = leaps.flip ? u * u * u * (u * (6 * u - 15) + 10) : 0;
    return {
      lift: kind.height * HEIGHT * 4 * u * (1 - u),
      squash: 1 + 0.06 * Math.abs(rising),
      spin: -TAU * turned,
      ear: -0.2 * rising - 0.12,
      beard: 0.1 * rising,
    };
  }
  const landed = (t - kind.crouchS - air) / LANDING_S;
  const settling = Math.sin(clamp(landed, 0, 1) * Math.PI) * (1 - landed);
  return {
    lift: 0,
    squash: 1 - 0.14 * settling,
    spin: 0,
    ear: 0.3 * settling,
    beard: 0.08 * settling,
  };
}
