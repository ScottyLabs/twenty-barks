import { useState } from "react";
import type { Mood } from "../bark/moods.ts";
import { askBark, type Heard } from "../api.ts";
import {
  ask,
  interpret,
  isOver,
  loadPractice,
  MAX_QUESTION_LENGTH,
  moodFor,
  NEW_ROUND,
  normalize,
  previousTurn,
  questionsLeft,
  savePractice,
  shareText,
  SUGGESTIONS,
  type Answer,
  type Round,
} from "../practice.ts";
import { AskForm } from "./AskForm.tsx";
import { BarkDog } from "./BarkDog.tsx";
import { Bones } from "./Bones.tsx";
import { Bubble, HELLO, Log, type Speech, THINKING } from "./RoundParts.tsx";

const UNSURE =
  "Hmm, I can only answer yes or no, and practice Bark only knows a few things. Try asking whether it's a place, or what people do with it.";

function Won({ round, onReset }: { readonly round: Round; readonly onReset: () => void }) {
  const [copied, setCopied] = useState(false);
  const count = round.turns.length;
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <p className="text-lg font-bold">
        {round.won
          ? `Solved in ${count} ${count === 1 ? "question" : "questions"}!`
          : "Out of bones! It was the Fence."}
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        {round.won && (
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
        )}
        <button type="button" className="pill" onClick={onReset}>
          Play again
        </button>
      </div>
    </div>
  );
}

interface Step {
  readonly round: Round;
  readonly speech: Speech;
  readonly mood: Mood;
}

/** The next step once an answer is known, from the judge or the page's own rules. */
function settle(round: Round, asked: string, answer: Answer): Step {
  const before = previousTurn(round, answer);
  if (before !== undefined) {
    const text = `You already asked that one ("${before.asked}"). No bone used.`;
    return { round, speech: { verdict: answer.verdict, text }, mood: moodFor(answer.verdict) };
  }
  return {
    round: ask(round, asked, answer),
    speech: { verdict: answer.verdict, text: answer.reply },
    mood: moodFor(answer.verdict),
  };
}

function afterHearing(round: Round, asked: string, heard: Heard): Step {
  if (heard.kind === "answer") {
    return settle(round, asked, heard.answer);
  }
  if (heard.kind !== "offline") {
    return { round, speech: { verdict: null, text: heard.reply }, mood: "sortof" };
  }
  // No judge to ask, so the page's own practice rules answer instead.
  const answer = interpret(asked);
  return answer === null
    ? { round, speech: { verdict: null, text: UNSURE }, mood: "sortof" }
    : settle(round, asked, answer);
}

function useRound() {
  const [step, setStep] = useState<Step>(() => {
    const round = loadPractice();
    const speech =
      round.turns.length === 0 ? HELLO : { verdict: null, text: "Welcome back! Keep sniffing." };
    return { round, speech, mood: "idle" };
  });
  const [beat, setBeat] = useState(0);
  const [thinking, setThinking] = useState(false);
  const show = (next: Step): void => {
    setStep(next);
    savePractice(next.round);
    setBeat((b) => b + 1);
  };
  const { round } = step;

  const onAsk = (asked: string): void => {
    const repeat = round.turns.find((turn) => normalize(turn.asked) === normalize(asked));
    if (repeat !== undefined) {
      show(settle(round, asked, repeat.answer));
      return;
    }
    setThinking(true);
    show({ round, speech: THINKING, mood: "think" });
    void askBark(asked).then((heard) => {
      setThinking(false);
      show(afterHearing(round, asked, heard));
    });
  };
  const onReset = (): void => {
    show({ round: NEW_ROUND, speech: HELLO, mood: "idle" });
  };
  return { ...step, beat, thinking, onAsk, onReset };
}

/** A practice round you can play now, to get the feel of the game. */
export function PracticeRound() {
  const { round, speech, mood, beat, thinking, onAsk, onReset } = useRound();

  return (
    <section className="card" aria-labelledby="practice-title">
      <h2 id="practice-title" className="eyebrow">
        Practice round
      </h2>
      <div className="stage">
        <BarkDog key={beat} mood={mood} className="stage__dog" />
        <Bubble key={`bubble-${beat}`} speech={speech} />
      </div>
      {isOver(round) ? (
        <Won round={round} onReset={onReset} />
      ) : (
        <AskForm
          maxLength={MAX_QUESTION_LENGTH}
          busy={thinking}
          suggestions={round.turns.length === 0 ? SUGGESTIONS : []}
          onAsk={onAsk}
        />
      )}
      <Log
        rows={round.turns.map((turn) => ({
          key: turn.answer.topic,
          asked: turn.asked,
          verdict: turn.answer.verdict,
        }))}
      />
      <Bones left={questionsLeft(round)} />
    </section>
  );
}
