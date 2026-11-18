import { useState } from "react";
import type { Mood } from "../bark/moods.ts";
import {
  ask,
  interpret,
  isOver,
  MAX_QUESTION_LENGTH,
  moodFor,
  NEW_ROUND,
  previousTurn,
  questionsLeft,
  shareText,
  SUGGESTIONS,
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

/** The next speech and round for a typed question. */
function reply(round: Round, asked: string): { round: Round; speech: Speech; mood: Mood } {
  const answer = interpret(asked);
  if (answer === null) {
    return { round, speech: { verdict: null, text: UNSURE }, mood: "sortof" };
  }
  const before = previousTurn(round, answer);
  if (before !== undefined) {
    const text = `You already asked that one ("${before.asked}"). No bone used.`;
    return { round, speech: { verdict: answer.verdict, text }, mood: moodFor(answer.verdict) };
  }
  const next = ask(round, asked, answer);
  return {
    round: next,
    speech: { verdict: answer.verdict, text: answer.reply },
    mood: moodFor(answer.verdict),
  };
}

/** A practice round you can play now, to get the feel of the game. */
export function PracticeRound() {
  const [round, setRound] = useState<Round>(NEW_ROUND);
  const [speech, setSpeech] = useState<Speech>(HELLO);
  const [mood, setMood] = useState<Mood>("idle");
  const [beat, setBeat] = useState(0);

  const show = (next: { round: Round; speech: Speech; mood: Mood }): void => {
    setRound(next.round);
    setSpeech(next.speech);
    setMood(next.mood);
    setBeat((b) => b + 1);
  };

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
        <Won
          round={round}
          onReset={() => {
            show({ round: NEW_ROUND, speech: HELLO, mood: "idle" });
          }}
        />
      ) : (
        <AskForm
          maxLength={MAX_QUESTION_LENGTH}
          suggestions={round.turns.length === 0 ? SUGGESTIONS : []}
          onAsk={(asked) => {
            show(reply(round, asked));
          }}
        />
      )}
      <Log turns={round.turns} />
      <Bones left={questionsLeft(round)} />
    </section>
  );
}
