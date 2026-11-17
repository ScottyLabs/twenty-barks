import { QUESTION_LIMIT } from "../practice.ts";

const BONE =
  "M7 5.5a3 3 0 1 1 4.6-2.4h12.8A3 3 0 1 1 29 5.5a3 3 0 1 1-4.6 2.4H11.6A3 3 0 1 1 7 5.5Z";

/** The question counter: one bone per question, eaten as they are used. */
export function Bones({ left }: { readonly left: number }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <ol className="grid grid-cols-10 gap-x-1.5 gap-y-2 sm:grid-cols-20" aria-hidden="true">
        {Array.from({ length: QUESTION_LIMIT }, (_, i) => (
          <li key={i} className={i < left ? "bone" : "bone bone--eaten"}>
            <svg viewBox="0 0 36 11" width="22" height="7">
              <path d={BONE} />
            </svg>
          </li>
        ))}
      </ol>
      <p className="text-sm font-medium text-muted">
        <span className="font-bold text-ink tabular-nums">{left}</span> of {QUESTION_LIMIT}{" "}
        questions left
      </p>
    </div>
  );
}
