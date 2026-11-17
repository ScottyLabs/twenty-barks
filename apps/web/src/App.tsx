import { useState } from "react";
import { Scotty } from "./Scotty.tsx";
import type { ScottyMood } from "./Scotty.tsx";

const QUESTIONS = 20;

const DEMO: readonly { readonly mood: ScottyMood; readonly reply: string }[] = [
  { mood: "yes", reply: "Yes!" },
  { mood: "no", reply: "No." },
  { mood: "tilt", reply: "Sort of..." },
];

export function App() {
  const [step, setStep] = useState(-1);
  const current = step === -1 ? null : DEMO[step % DEMO.length];

  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col items-center justify-center gap-8 px-4 py-12 text-center">
      <header className="space-y-2">
        <p className="text-sm font-semibold tracking-widest text-tartan uppercase">
          A daily game from Bark
        </p>
        <h1 className="font-display text-5xl font-bold text-ink sm:text-6xl">Twenty Barks</h1>
      </header>

      <button
        type="button"
        onClick={() => {
          setStep((s) => s + 1);
        }}
        className="group rounded-3xl p-2 focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-tartan"
        aria-label="Ask Scotty a practice question"
      >
        <Scotty
          key={step}
          mood={current?.mood ?? "idle"}
          className="h-40 w-48 text-ink sm:h-48 sm:w-56"
        />
      </button>

      <p className="min-h-7 text-lg font-semibold text-ink" aria-live="polite">
        {current?.reply ?? "Bark is thinking of something at CMU..."}
      </p>

      <p className="max-w-md text-base text-muted">
        Each day, Bark picks a place, course, food, or tradition from campus. You get {QUESTIONS}{" "}
        yes-or-no questions to figure out what it is. The first puzzle is coming soon.
      </p>

      <ol className="flex flex-wrap justify-center gap-1.5" aria-label={`${QUESTIONS} questions`}>
        {Array.from({ length: QUESTIONS }, (_, i) => (
          <li
            key={i}
            className="bone"
            style={{ animationDelay: `${i * 40}ms` }}
            aria-hidden="true"
          />
        ))}
      </ol>
    </main>
  );
}
