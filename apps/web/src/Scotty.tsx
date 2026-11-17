export type ScottyMood = "idle" | "yes" | "no" | "tilt";

const MOOD_CLASS: Record<ScottyMood, string> = {
  idle: "scotty-idle",
  yes: "scotty-yes",
  no: "scotty-no",
  tilt: "scotty-tilt",
};

function ScottyHead() {
  return (
    <g className="scotty-head" style={{ transformOrigin: "34px 46px" }}>
      <path
        d="M14 34 Q14 24 26 22 L40 22 Q46 24 46 34 L46 50 L36 52 L30 58 L22 52 L12 50 Q8 48 10 42 Z"
        fill="currentColor"
      />
      <path
        className="scotty-ear"
        d="M26 22 L28 8 L34 22 Z"
        fill="currentColor"
        style={{ transformOrigin: "30px 22px" }}
      />
      <path
        className="scotty-ear"
        d="M36 22 L40 8 L44 24 Z"
        fill="currentColor"
        style={{ transformOrigin: "40px 22px" }}
      />
      <circle cx="24" cy="32" r="2.2" fill="var(--color-paper)" />
      <circle cx="11" cy="41" r="2.6" fill="var(--color-paper)" opacity="0.35" />
    </g>
  );
}

/**
 * The game's Scottish terrier. Each mood maps to a CSS animation in index.css.
 *
 * Decorative only: the surrounding UI states every verdict in text, so screen readers skip the drawing.
 */
export function Scotty({
  mood,
  className = "",
}: {
  readonly mood: ScottyMood;
  readonly className?: string;
}) {
  return (
    <svg viewBox="0 0 120 100" aria-hidden="true" className={`${MOOD_CLASS[mood]} ${className}`}>
      <g className="scotty-tail" style={{ transformOrigin: "98px 52px" }}>
        <path d="M96 54 L110 34 L104 56 Z" fill="currentColor" />
      </g>
      <g className="scotty-body">
        <path
          d="M30 50 Q32 42 44 42 L92 42 Q102 42 102 54 L102 70 L96 70 L96 84 L88 84 L88 70 L52 70 L52 84 L44 84 L44 70 Q34 70 30 62 Z"
          fill="currentColor"
        />
        {/* Skirt of fur along the belly */}
        <path
          d="M44 70 L48 76 L54 70 L60 76 L66 70 L72 76 L78 70 L84 76 L90 70 Z"
          fill="currentColor"
        />
        <ScottyHead />
        {/* Tartan collar */}
        <rect x="36" y="44" width="10" height="5" rx="1.5" fill="var(--color-tartan)" />
      </g>
    </svg>
  );
}
