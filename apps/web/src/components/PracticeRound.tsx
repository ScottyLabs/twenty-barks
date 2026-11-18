import { useState } from "react";
import type { Mood } from "../bark/moods.ts";
import { askBark, type Heard } from "../api.ts";
import {
  ask,
  interpret,
  isOver,
  MAX_QUESTION_LENGTH,
  moodFor,
  NEW_ROUND,
  normalize,
  previousTurn,
  questionsLeft,
  shareText,
  SUGGESTIONS,
  type Answer,
  type Round,
  type Turn,
  type Verdict,
} from "../practice.ts";
import { AskForm } from "./AskForm.tsx";
import { BarkDog } from "./BarkDog.tsx";
import { Bones } from "./Bones.tsx";

const VERDICT_LABEL: Readonly<Record<Verdict, string>> = {
  yes: "Yes",
  no: "No",
  sortof: "Sort of",
  correct: "You got it",
};

const UNSURE =
  "Hmm, I can only answer yes or no, and practice Bark only knows a few things. Try asking whether it's a place, or what people do with it.";

/** What Bark is saying: an answer with its verdict, or a plain line. */
interface Speech {
  readonly verdict: Verdict | null;
  readonly text: string;
}

const HELLO: Speech = { verdict: null, text: "I'm thinking of something at CMU. Ask me anything!" };

function Bubble({ speech }: { readonly speech: Speech }) {
  return (
    <div className="bubble" aria-live="polite">
      {speech.verdict !== null && (
        <span className={`verdict verdict--${speech.verdict}`}>
          {VERDICT_LABEL[speech.verdict]}
        </span>
      )}
      <p>{speech.text}</p>
    </div>
  );
}

function Log({ turns }: { readonly turns: readonly Turn[] }) {
  if (turns.length === 0) {
    return null;
  }
  return (
    <ol className="log" aria-label="Your questions so far">
      {turns.map((turn, i) => (
        <li key={turn.answer.topic}>
          <span className="log__n">{i + 1}</span>
          <span className="log__q">{turn.asked}</span>
          <span className={`verdict verdict--${turn.answer.verdict}`}>
            {VERDICT_LABEL[turn.answer.verdict]}
          </span>
        </li>
      ))}
    </ol>
  );
}

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

const THINKING: Speech = { verdict: null, text: "Hmm, let me sniff that out..." };

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
  const [step, setStep] = useState<Step>({ round: NEW_ROUND, speech: HELLO, mood: "idle" });
  const [beat, setBeat] = useState(0);
  const [thinking, setThinking] = useState(false);
  const show = (next: Step): void => {
    setStep(next);
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
      <Log turns={round.turns} />
      <Bones left={questionsLeft(round)} />
    </section>
  );
}
