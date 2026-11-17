import { REST, draw } from "../bark/pose.ts";
import { MITER_LIMIT } from "../bark/shape.ts";

const RESTING = draw(REST);

/** The ScottyLabs mark: Bark standing still, with a heavier line so it reads small. */
export function Mark({ className = "" }: { readonly className?: string }) {
  return (
    <svg viewBox="-430 -730 860 760" aria-hidden="true" focusable="false" className={className}>
      <defs>
        <clipPath id="mark-ground">
          <rect x="-430" y="-730" width="860" height="730" />
        </clipPath>
      </defs>
      <g
        clipPath="url(#mark-ground)"
        fill="none"
        stroke="currentColor"
        strokeWidth="56"
        strokeMiterlimit={MITER_LIMIT}
      >
        {RESTING.lines.map((d) => (
          <path key={d.slice(0, 24)} d={d} />
        ))}
      </g>
    </svg>
  );
}
