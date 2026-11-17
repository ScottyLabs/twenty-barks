// Adapted from ScottyLabs/tartanhacks-landing-2027 (src/bark), where Bark was first drawn from the ScottyLabs mark.

/**
 * Bark, the ScottyLabs dog, drawn the way the ScottyLabs mark draws him:
 * three strokes of one weight, with flat ends and one sharp corner at the nose.
 *
 *   back   nose, top of the head, ear, neck, back, rump, outside of the hind leg
 *   front  beard, chest, outside of the foreleg
 *   belly  inside of the foreleg, belly, inside of the hind leg
 *
 * The curves were fitted to the mark itself and agree with it to within a
 * fraction of a stroke's width. Change them only against the mark.
 *
 * Units are the mark's own. The origin is on the ground under the middle of
 * the body; x runs toward the nose and y runs down, so everything above the
 * ground is negative. Bark faces right.
 */

/** Stroke weight, and the miter limit that bevels the ear and beard but not the nose. */
export const STROKE = 40.86;
export const MITER_LIMIT = 1.6;

/** The ink's extent: from the ground to the tip of the ear, and from rump to nose. */
export const HEIGHT = 692;
export const LEFT = -356;
export const RIGHT = 447;
/** The middle of his body, between rump and nose. */
export const MIDDLE = (LEFT + RIGHT) / 2;

/** Each feature turns about its own point. */
export const NECK = { x: 70, y: -470 } as const;
export const EAR_BASE = { x: 52, y: -592 } as const;
export const EAR_TIP = { x: -14.3, y: -668.8 } as const;
export const BEARD_CORNER = { x: 267.2, y: -390.4 } as const;
export const BEARD_TIP = { x: 390.9, y: -348.6 } as const;
/** Height of the belly line: the legs showing below it are this long. */
export const BELLY = -89;

/*
 * Each stroke is listed in sections that meet at a corner. A section is a
 * start point followed by cubic Bezier segments, three points each
 * (control, control, end), flattened to x, y pairs.
 */

// nose end -> corner of the nose -> tip of the ear -> rump -> hind foot
const BACK: readonly (readonly number[])[] = [
  [408.6, -428.7, 413, -446.5, 419.8, -467, 422.4, -486, 429, -534.8, 424.9, -568.1, 418.4, -617.1],
  [
    418.4, -617.1, 391.5, -612.7, 364.6, -605.8, 338, -600.4, 296.7, -591.9, 255, -586.2, 213,
    -582.4, 188.9, -580.2, 163.2, -575.3, 140, -584.8, 102.3, -600.3, 68.5, -624.8, 34, -646, 30.2,
    -648.3, 26.2, -649.6, 22, -650.6, 9.2, -653.8, -2.3, -663.4, -14.3, -668.8,
  ],
  [
    -14.3, -668.8, -9.9, -649.9, -4.9, -627.4, 0.8, -608, 5.6, -591.7, 10, -575.3, 14.8, -559, 19.6,
    -542.8, 25.6, -526.1, 26, -509, 26.6, -483.8, 13.1, -457.1, 2.5, -435, -33.1, -360.3, -105.1,
    -303, -184, -279.7, -212.1, -271.4, -239.4, -266, -268.3, -261.6,
  ],
  [
    -268.3, -261.6, -280.4, -236.3, -293.7, -212.1, -303.8, -186, -320.8, -141.9, -332.9, -86.2,
    -335, -39, -335.6, -26.1, -335.6, -12.9, -336, 0,
  ],
];

// tip of the beard -> corner of the beard -> forefoot
const FRONT: readonly (readonly number[])[] = [
  [
    390.9, -348.6, 366.4, -358.6, 342.4, -369.2, 318, -378.6, 314.8, -379.9, 311.4, -380.9, 308,
    -381.5, 293.4, -383.8, 281.3, -385.8, 267.2, -390.4,
  ],
  [
    267.2, -390.4, 276.4, -357.8, 285.7, -331.4, 295.3, -299, 303.1, -272.4, 308.6, -245, 314.7,
    -218, 318.4, -201.9, 320.4, -185.4, 322.6, -169, 330.4, -112, 333.5, -57.5, 334.7, 0,
  ],
];

// inside of the forefoot -> belly -> inside of the hind foot
const BELLY_ARCH: readonly (readonly number[])[] = [
  [
    224.1, 0, 221.5, -12, 218.8, -24, 216, -36, 211.5, -55.5, 201, -71, 185, -79.5, 173, -86, 157,
    -88.6, 143, -89, 46.3, -89, -50.3, -89, -147, -89, -163.4, -88.6, -181.2, -85.8, -196, -77,
    -211.8, -67.6, -220.4, -51.6, -224, -34, -226.4, -22.6, -228.5, -11.3, -230.3, 0,
  ],
];

/** Where the level part of the belly ends, toward the tail and toward the chest. */
const BELLY_REAR = -147;
const BELLY_FRONT = 143;

const smooth = (from: number, to: number, value: number): number => {
  const t = Math.min(1, Math.max(0, (value - from) / (to - from)));
  return t * t * (3 - 2 * t);
};

/**
 * One stroke, ready to pose: its points at rest, and how strongly each point
 * follows each moving part of the body (0 not at all, 1 fully).
 */
export interface Stroke {
  /** x, y pairs: a start point, then three points per cubic segment. */
  readonly rest: Float32Array;
  readonly head: Float32Array;
  readonly ear: Float32Array;
  readonly beard: Float32Array;
  /** How far each point goes down with his head when he lays it on the ground. */
  readonly lay: Float32Array;
  /** How far each point follows a pair of feet forward and back, and up. */
  readonly hindReach: Float32Array;
  readonly foreReach: Float32Array;
  readonly hindLift: Float32Array;
  readonly foreLift: Float32Array;
  /** Whether the stroke starts, or ends, at a foot standing on the ground. */
  readonly startsAtFoot: boolean;
  readonly endsAtFoot: boolean;
}

type Weigh = (x: number, y: number, section: number) => number;

interface Weights {
  head: Weigh;
  ear: Weigh;
  beard: Weigh;
  lay: Weigh;
  /** How far a point follows the feet on its own side of the body. */
  leg: Weigh;
  /** Set when reaching is shared out differently from lifting. */
  reach?: { hind: Weigh; fore: Weigh };
}

function build(
  sections: readonly (readonly number[])[],
  weights: Weights,
  startsAtFoot: boolean,
): Stroke {
  const xs: number[] = [];
  const ys: number[] = [];
  const from: number[] = [];
  sections.forEach((section, index) => {
    // A section starts where the last one ended; keep that point once.
    for (let i = index === 0 ? 0 : 2; i < section.length; i += 2) {
      xs.push(section[i]);
      ys.push(section[i + 1]);
      from.push(index);
    }
  });

  const count = xs.length;
  const stroke = {
    rest: new Float32Array(count * 2),
    head: new Float32Array(count),
    ear: new Float32Array(count),
    beard: new Float32Array(count),
    lay: new Float32Array(count),
    hindReach: new Float32Array(count),
    foreReach: new Float32Array(count),
    hindLift: new Float32Array(count),
    foreLift: new Float32Array(count),
    startsAtFoot,
    endsAtFoot: true,
  };
  for (let i = 0; i < count; i++) {
    const x = xs[i];
    const y = ys[i];
    const section = from[i];
    stroke.rest[i * 2] = x;
    stroke.rest[i * 2 + 1] = y;
    stroke.head[i] = weights.head(x, y, section);
    stroke.ear[i] = weights.ear(x, y, section);
    stroke.beard[i] = weights.beard(x, y, section);
    stroke.lay[i] = weights.lay(x, y, section);
    const leg = weights.leg(x, y, section);
    if (x < 0) stroke.hindLift[i] = leg;
    else stroke.foreLift[i] = leg;
    stroke.hindReach[i] = weights.reach ? weights.reach.hind(x, y, section) : stroke.hindLift[i];
    stroke.foreReach[i] = weights.reach ? weights.reach.fore(x, y, section) : stroke.foreLift[i];
  }
  return stroke;
}

const none: Weigh = () => 0;
const distance = (x: number, y: number, to: { x: number; y: number }): number =>
  Math.hypot(x - to.x, y - to.y);

export const STROKES: readonly [Stroke, Stroke, Stroke] = [
  build(
    BACK,
    {
      // The nose, the top of the head and the ear turn with the head; down the back of the neck the hold fades, so the neck bends rather than breaks.
      head: (_x, y, section) => (section < 2 ? 1 : section === 2 ? smooth(-430, -570, y) : 0),
      // The ear is its tip and a little of each side.
      ear: (x, y, section) =>
        section === 1 || section === 2 ? 1 - smooth(45, 165, distance(x, y, EAR_TIP)) : 0,
      beard: none,
      // Laid down, the head goes as one piece; the back of the neck stretches from it to the shoulders, which stay where the body is.
      lay: (_x, y, section) => (section < 2 ? 1 : section === 2 ? smooth(-435, -560, y) : 0),
      // The outside of the hind leg bends from the haunch down.
      leg: (_x, y, section) => (section === 3 ? smooth(-175, -8, y) : 0),
    },
    false,
  ),
  build(
    FRONT,
    {
      head: (_x, y, section) => (section === 0 ? 1 : smooth(-285, -385, y)),
      ear: none,
      beard: (x, y, section) => (section === 0 ? 1 - smooth(0, 125, distance(x, y, BEARD_TIP)) : 0),
      // The chest and foreleg go down under the chin, and out of sight.
      lay: () => 1,
      leg: (_x, y, section) => (section === 1 ? smooth(-175, -8, y) : 0),
    },
    false,
  ),
  build(
    BELLY_ARCH,
    {
      head: none,
      ear: none,
      beard: none,
      lay: none,
      // The belly stays at its height; only what hangs below it lifts.
      leg: (_x, y) => smooth(BELLY + 6, -6, y),
      // Each inner leg travels with its rounded corner as one piece, and the level belly between them stretches or shortens to stay joined. A leg that only bent below a fixed corner would curl under itself.
      reach: {
        hind: (x) => Math.min(1, Math.max(0, (BELLY_FRONT - x) / (BELLY_FRONT - BELLY_REAR))),
        fore: (x) => Math.min(1, Math.max(0, (x - BELLY_REAR) / (BELLY_FRONT - BELLY_REAR))),
      },
    },
    true,
  ),
];
