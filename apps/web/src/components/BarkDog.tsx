import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { GROUNDED, leapAt, press, settle, type Leap, type Leaps } from "../bark/jump.ts";
import { frameAt, type Frame, type Mood } from "../bark/moods.ts";
import { buildFor, draw } from "../bark/pose.ts";
import { HEIGHT, MIDDLE, MITER_LIMIT, STROKE } from "../bark/shape.ts";

/** His white reaches this far past his line, so he stays whole in front of anything behind him. */
const HALO = 22;
/** Far enough to cover the drawing in every pose. */
const FAR = 4000;
/** The three strokes of a bark fan out this far apart, in radians, aimed a little upward. */
const SPREAD = 0.44;
const AIM = 0.18;
/** Room for his hops and barks around the mark itself. */
const VIEW_BOX = "-430 -930 1120 960";
/** A backflip turns him about this point, near the middle of his body. */
const PIVOT = `${MIDDLE} ${-0.45 * HEIGHT}`;

interface Parts {
  readonly body: RefObject<SVGGElement | null>;
  readonly fill: RefObject<SVGPathElement | null>;
  readonly back: RefObject<SVGPathElement | null>;
  readonly front: RefObject<SVGPathElement | null>;
  readonly belly: RefObject<SVGPathElement | null>;
  readonly woof: RefObject<SVGPathElement | null>;
  readonly wonder: RefObject<SVGTextElement | null>;
}

function woofPath(frame: Frame, mouth: { x: number; y: number }): string {
  if (frame.woof <= 0 || frame.woof >= 1) {
    return "";
  }
  const from = (0.06 + 0.2 * frame.woof) * HEIGHT;
  const to = from + (0.04 + 0.14 * (1 - frame.woof)) * HEIGHT;
  return [-SPREAD, 0, SPREAD]
    .map((spread) => {
      const dx = Math.cos(AIM + spread);
      const dy = -Math.sin(AIM + spread);
      return (
        `M${(mouth.x + dx * from).toFixed(1)},${(mouth.y + dy * from).toFixed(1)}` +
        `L${(mouth.x + dx * to).toFixed(1)},${(mouth.y + dy * to).toFixed(1)}`
      );
    })
    .join("");
}

/** A jump played over whatever reaction he is in. */
function withLeap(frame: Frame, leap: Leap | null): Frame {
  if (leap === null) {
    return frame;
  }
  return {
    ...frame,
    pose: { ...frame.pose, ear: frame.pose.ear + leap.ear, beard: frame.pose.beard + leap.beard },
    squash: leap.squash,
    lift: frame.lift + leap.lift,
  };
}

/** Writes one frame straight into the SVG, so animating never re-renders React. */
function paint(parts: Parts, frame: Frame, spin: number): void {
  const drawing = draw(frame.pose, buildFor(1, frame.squash));
  const degrees = ((spin * 180) / Math.PI).toFixed(1);
  parts.body.current?.setAttribute(
    "transform",
    `translate(${frame.shiver.toFixed(1)} ${(-frame.lift).toFixed(1)}) rotate(${degrees} ${PIVOT})`,
  );
  parts.fill.current?.setAttribute("d", drawing.fill);
  parts.back.current?.setAttribute("d", drawing.lines[0]);
  parts.front.current?.setAttribute("d", drawing.lines[1]);
  parts.belly.current?.setAttribute("d", drawing.lines[2]);
  parts.woof.current?.setAttribute("d", woofPath(frame, drawing.mouth));
  const wonder = parts.wonder.current;
  if (wonder !== null) {
    wonder.setAttribute("opacity", frame.wonder.toFixed(2));
    wonder.setAttribute("transform", `translate(250 ${(-760 - 30 * frame.wonder).toFixed(1)})`);
  }
}

/**
 * Runs the reaction for `mood` until the component unmounts. The parent gives each answer a new `key`, so a fresh reaction always starts from the beginning.
 */
function useBarkAnimation(parts: Parts, mood: Mood, leaps: RefObject<Leaps>): void {
  useEffect(() => {
    const started = performance.now();
    const still = globalThis.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const frame = { request: 0 };
    const tick = (now: number): void => {
      const since = still ? 3 : (now - started) / 1000;
      leaps.current = settle(leaps.current, now / 1000);
      const leap = still ? null : leapAt(leaps.current, now / 1000);
      paint(parts, withLeap(frameAt(mood, since, since), leap), leap?.spin ?? 0);
      if (!still) {
        frame.request = requestAnimationFrame(tick);
      }
    };
    frame.request = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame.request);
    };
  }, [parts, mood, leaps]);
}

/**
 * Bark, the ScottyLabs dog, reacting to the game.
 *
 * Give it a new `key` for each answer, so the same answer twice in a row still gets a fresh hop. Pressing him makes him jump, and five quick presses earn a backflip. The drawing is decorative: every answer is also given in text.
 */
export function BarkDog({
  mood,
  className = "",
}: {
  readonly mood: Mood;
  readonly className?: string;
}) {
  const body = useRef<SVGGElement>(null);
  const fill = useRef<SVGPathElement>(null);
  const back = useRef<SVGPathElement>(null);
  const front = useRef<SVGPathElement>(null);
  const belly = useRef<SVGPathElement>(null);
  const woof = useRef<SVGPathElement>(null);
  const wonder = useRef<SVGTextElement>(null);
  const [parts] = useState<Parts>(() => ({ body, fill, back, front, belly, woof, wonder }));
  const leaps = useRef<Leaps>(GROUNDED);
  useBarkAnimation(parts, mood, leaps);
  const line = { strokeWidth: STROKE, strokeMiterlimit: MITER_LIMIT };

  return (
    <button
      type="button"
      className={`bark-button ${className}`}
      aria-label="Bark. Press to make him jump."
      onClick={() => {
        leaps.current = press(leaps.current, performance.now() / 1000);
      }}
    >
      <svg viewBox={VIEW_BOX} aria-hidden="true" focusable="false" className="bark">
        <defs>
          <clipPath id="bark-above-ground">
            <rect x={-FAR} y={-FAR} width={FAR * 2} height={FAR} />
          </clipPath>
        </defs>
        <g ref={body}>
          <g clipPath="url(#bark-above-ground)">
            <path ref={fill} className="bark__fill" strokeWidth={STROKE + 2 * HALO} />
            <path ref={back} className="bark__line" {...line} />
            <path ref={front} className="bark__line" {...line} />
            <path ref={belly} className="bark__line" {...line} />
          </g>
          <path ref={woof} className="bark__line bark__woof" {...line} />
          <text ref={wonder} className="bark__wonder" opacity="0">
            ?
          </text>
        </g>
      </svg>
    </button>
  );
}
