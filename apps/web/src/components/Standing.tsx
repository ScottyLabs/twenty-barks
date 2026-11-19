import { useEffect, useId, useState } from "react";
import { at, getJson, list } from "../server.ts";

const numberOr = (value: unknown): number | null => (typeof value === "number" ? value : null);

/** How a finished game compares with everyone who finished today. */
interface Standing {
  readonly players: number;
  /** Percent of the other players who did worse, or null when nobody else has finished. */
  readonly betterThan: number | null;
  /** Questions used to win, or one past the limit for a loss. */
  readonly score: number;
  /** Games ending on each score, from 1 question up to a loss. */
  readonly counts: readonly number[];
}

function standingOf(body: unknown): Standing | null {
  const players = numberOr(at(body, "players"));
  const score = numberOr(at(body, "score"));
  const counts = list(at(body, "counts")).map((count) => numberOr(count) ?? 0);
  if (players === null || score === null || counts.length === 0) {
    return null;
  }
  return { players, betterThan: numberOr(at(body, "betterThan")), score, counts };
}

function useStanding(gameId: string): Standing | null {
  const [standing, setStanding] = useState<Standing | null>(null);
  useEffect(() => {
    let live = true;
    void getJson(`/api/today/standing?game=${encodeURIComponent(gameId)}`)
      .then(({ status, body }) => (status === 200 ? standingOf(body) : null))
      .catch(() => null)
      .then((found) => {
        if (live) {
          setStanding(found);
        }
      });
    return () => {
      live = false;
    };
  }, [gameId]);
  return standing;
}

const WIDTH = 320;
const HEIGHT = 110;
const BASE = 92;
const TOP = 12;
/** How far each game spreads into its neighbours, so a handful of players still draws a smooth curve. */
const SPREAD = 1.6;
const STEPS = 96;

/** The curve's points: each game a small bell, all added up, then scaled to fit. */
function curveOf(counts: readonly number[]): { x: number; y: number }[] {
  const last = counts.length;
  const xOf = (score: number): number => ((score - 0.5) / last) * WIDTH;
  const heights = Array.from({ length: STEPS + 1 }, (_, step) => {
    const score = 0.5 + (step / STEPS) * last;
    return counts.reduce(
      (sum, count, index) =>
        sum + count * Math.exp(-((score - (index + 1)) ** 2) / (2 * SPREAD ** 2)),
      0,
    );
  });
  const tallest = Math.max(...heights, 1e-9);
  return heights.map((height, step) => ({
    x: xOf(0.5 + (step / STEPS) * last),
    y: BASE - (height / tallest) * (BASE - TOP),
  }));
}

function Curve({ standing }: { readonly standing: Standing }) {
  const id = useId();
  const points = curveOf(standing.counts);
  const line = points.map(({ x, y }) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" L");
  const area = `M0,${BASE} L${line} L${WIDTH},${BASE} Z`;
  const you = ((standing.score - 0.5) / standing.counts.length) * WIDTH;
  const youY = points.reduce((near, point) =>
    Math.abs(point.x - you) < Math.abs(near.x - you) ? point : near,
  ).y;
  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="standing__curve" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-fill`} x1="0" x2="1">
          <stop offset="0" stopColor="#38bdf8" />
          <stop offset="0.5" stopColor="#9b45c9" />
          <stop offset="1" stopColor="#f43f5e" />
        </linearGradient>
        <clipPath id={`${id}-beaten`}>
          <rect x={you} y="0" width={WIDTH - you} height={HEIGHT} />
        </clipPath>
      </defs>
      <path d={area} className="standing__area" />
      <path d={area} fill={`url(#${id}-fill)`} clipPath={`url(#${id}-beaten)`} opacity="0.45" />
      <path d={`M${line}`} className="standing__line" />
      <line x1={you} x2={you} y1={youY} y2={BASE} className="standing__marker" />
      <circle cx={you} cy={youY} r="4.5" className="standing__dot" />
      <text x={you} y={youY - 9} textAnchor="middle" className="standing__you">
        You
      </text>
      <line x1="0" x2={WIDTH} y1={BASE} y2={BASE} className="standing__axis" />
      <text x="0" y={HEIGHT - 2} className="standing__label">
        Fewer questions
      </text>
      <text x={WIDTH} y={HEIGHT - 2} textAnchor="end" className="standing__label">
        Out of bones
      </text>
    </svg>
  );
}

/** The bell curve at the end of a game: where you finished among today's players. */
export function StandingCard({ gameId }: { readonly gameId: string }) {
  const standing = useStanding(gameId);
  if (standing === null) {
    return null;
  }
  const others = standing.players - 1;
  return (
    <figure className="standing">
      {standing.betterThan === null ? (
        <figcaption className="text-sm">
          You are the first to finish today. Check back later to see how you compare.
        </figcaption>
      ) : (
        <figcaption>
          <span className="text-lg font-bold">
            You did better than {standing.betterThan}% of players
          </span>
          <span className="block text-sm text-muted">
            {others} other {others === 1 ? "player has" : "players have"} finished today
          </span>
        </figcaption>
      )}
      <Curve standing={standing} />
    </figure>
  );
}
