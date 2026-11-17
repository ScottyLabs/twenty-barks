import { useState } from "react";
import type { Mood } from "../bark/moods.ts";
import {
  ask,
  hasAsked,
  moodFor,
  NEW_ROUND,
  PRACTICE,
  questionsLeft,
  shareText,
  type Question,
  type Round,
  type Verdict,
} from "../practice.ts";
import { BarkDog } from "./BarkDog.tsx";
import { Bones } from "./Bones.tsx";

const VERDICT_LABEL: Readonly<Record<Verdict, string>> = {
  yes: "Yes",
  no: "No",
  sortof: "Sort of",
  correct: "You got it",
};

function Bubble({ last }: { readonly last: Question | null }) {
  return (
    <div className="bubble" aria-live="polite">
      {last === null ? (
        <p>
          {"I'm thinking of something at CMU. "}
          <strong>Ask me yes-or-no questions!</strong>
        </p>
      ) : (
        <>
          <span className={`verdict verdict--${last.verdict}`}>{VERDICT_LABEL[last.verdict]}</span>
          <p>{last.reply}</p>
        </>
      )}
    </div>
  );
}

function Won({ round, onReset }: { readonly round: Round; readonly onReset: () => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <p className="text-lg font-bold">
        Solved in {round.turns.length} {round.turns.length === 1 ? "question" : "questions"}!
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <button
          type="button"
          className="pill pill--solid"
          onClick={() => {
            void navigator.clipboard.writeText(shareText(round)).then(() => {
              setCopied(true);
            });
          }}
        >
          {copied ? "Copied!" : "Share result"}
        </button>
        <button type="button" className="pill" onClick={onReset}>
          Play again
        </button>
      </div>
    </div>
  );
}

/** A scripted round you can play now, to get the feel of the game. */
export function PracticeRound() {
  const [round, setRound] = useState<Round>(NEW_ROUND);
  const [mood, setMood] = useState<Mood>("idle");
  const [beat, setBeat] = useState(0);
  const last = round.turns.at(-1)?.question ?? null;

  const onAsk = (question: Question): void => {
    setRound(ask(round, question));
    setMood(moodFor(question.verdict));
    setBeat((b) => b + 1);
  };
  const onReset = (): void => {
    setRound(NEW_ROUND);
    setMood("idle");
    setBeat((b) => b + 1);
  };

  return (
    <section className="card" aria-labelledby="practice-title">
      <h2 id="practice-title" className="eyebrow">
        Practice round
      </h2>
      <div className="stage">
        <BarkDog key={beat} mood={mood} className="stage__dog" />
        <Bubble last={last} />
      </div>
      {round.won ? (
        <Won round={round} onReset={onReset} />
      ) : (
        <ul className="flex flex-wrap justify-center gap-2" aria-label="Questions you can ask">
          {PRACTICE.map((question) => (
            <li key={question.id}>
              <button
                type="button"
                className="pill"
                disabled={hasAsked(round, question.id)}
                onClick={() => {
                  onAsk(question);
                }}
              >
                {question.text}
              </button>
            </li>
          ))}
        </ul>
      )}
      <Bones left={questionsLeft(round)} />
    </section>
  );
}
