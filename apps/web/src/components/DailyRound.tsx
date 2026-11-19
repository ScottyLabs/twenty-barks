import { useState } from "react";
import type { Mood } from "../bark/moods.ts";
import {
  MAX_QUESTION_LENGTH,
  moodFor,
  QUESTION_LIMIT,
  SQUARES,
  type Verdict,
} from "../practice.ts";
import { at, gameOf, loginHref, sendJson, str, type GameView } from "../server.ts";
import { AskForm } from "./AskForm.tsx";
import { BarkDog } from "./BarkDog.tsx";
import { Bones } from "./Bones.tsx";
import { Bubble, HELLO, Log, type Speech, THINKING } from "./RoundParts.tsx";
import { StandingCard } from "./Standing.tsx";

/** Where a game played without signing in is remembered, so a reload picks it up. The server ignores it once the day is over. */
const CARRIED = "twenty-barks:game";

export function carriedGame(): string | null {
  try {
    return globalThis.localStorage.getItem(CARRIED);
  } catch {
    return null;
  }
}

function remember(id: string): void {
  try {
    globalThis.localStorage.setItem(CARRIED, id);
  } catch {
    // Private windows may refuse; the game still works until the page closes.
  }
}

function shareText(game: GameView): string {
  const squares = game.turns.map((turn) => SQUARES[turn.verdict]).join("");
  const score = game.won ? `${game.turns.length}/${QUESTION_LIMIT}` : `X/${QUESTION_LIMIT}`;
  return `Twenty Barks ${game.day} ${score}\n${squares}`;
}

function Done({ game, signedIn }: { readonly game: GameView; readonly signedIn: boolean }) {
  const [copied, setCopied] = useState(false);
  const count = game.turns.length;
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <p className="text-lg font-bold">
        {game.won
          ? `Solved in ${count} ${count === 1 ? "question" : "questions"}!`
          : `Out of bones! It was ${game.answer ?? "a mystery"}.`}
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <button
          type="button"
          className="pill pill--solid"
          onClick={() => {
            void navigator.clipboard.writeText(shareText(game)).then(() => {
              setCopied(true);
            });
          }}
        >
          {copied ? "Copied!" : "Share result"}
        </button>
        {!signedIn && (
          <a className="pill" href={loginHref("/")}>
            Sign in to keep your streak
          </a>
        )}
      </div>
      <StandingCard gameId={game.id} />
      <p className="text-sm text-muted">Come back tomorrow for a new one.</p>
    </div>
  );
}

const VERDICTS: readonly Verdict[] = ["yes", "no", "sortof", "correct"];

/** What Bark says when the page opens: hello, or welcome back to a game under way. */
function greeting(game: GameView | null): Speech {
  if (game === null || game.turns.length === 0) {
    return HELLO;
  }
  if (game.finished) {
    return { verdict: null, text: "Welcome back! Today's puzzle is done. See you tomorrow!" };
  }
  const left = game.questionsLeft;
  return {
    verdict: null,
    text: `Welcome back! You have ${left} ${left === 1 ? "question" : "questions"} left.`,
  };
}

interface Heard {
  readonly game: GameView | null;
  readonly speech: Speech;
  readonly mood: Mood;
}

async function askToday(question: string, gameId: string | null): Promise<Heard> {
  try {
    const { status, body } = await sendJson("/api/today/ask", "POST", { question, gameId });
    const game = gameOf(at(body, "game"));
    const said = str(at(body, "verdict"));
    const verdict = VERDICTS.find((known) => known === said);
    const reply = str(at(body, "reply")) ?? str(at(body, "error")) ?? "Hmm, something went wrong.";
    if (status !== 200 || verdict === undefined) {
      return { game, speech: { verdict: null, text: reply }, mood: "sortof" };
    }
    return { game, speech: { verdict, text: reply }, mood: moodFor(verdict) };
  } catch {
    return {
      game: null,
      speech: { verdict: null, text: "Bark lost his connection. Try again?" },
      mood: "no",
    };
  }
}

function useDaily(initial: GameView | null) {
  const [game, setGame] = useState(initial);
  const [speech, setSpeech] = useState<Speech>(() => greeting(initial));
  const [mood, setMood] = useState<Mood>("idle");
  const [beat, setBeat] = useState(0);
  const [thinking, setThinking] = useState(false);
  const show = (next: Speech, nextMood: Mood): void => {
    setSpeech(next);
    setMood(nextMood);
    setBeat((b) => b + 1);
  };
  const onAsk = (question: string): void => {
    setThinking(true);
    show(THINKING, "think");
    void askToday(question, game?.id ?? null).then((heard) => {
      setThinking(false);
      if (heard.game !== null) {
        setGame(heard.game);
        remember(heard.game.id);
      }
      show(heard.speech, heard.game?.won === true ? "win" : heard.mood);
    });
  };
  return { game, speech, mood, beat, thinking, onAsk };
}

/** Today's puzzle, judged and scored by the server. */
export function DailyRound({
  day,
  initial,
  signedIn,
}: {
  readonly day: string;
  readonly initial: GameView | null;
  readonly signedIn: boolean;
}) {
  const { game, speech, mood, beat, thinking, onAsk } = useDaily(initial);
  const turns = game?.turns ?? [];
  return (
    <section className="card" aria-labelledby="daily-title">
      <h2 id="daily-title" className="eyebrow">
        Today&apos;s puzzle &middot; {day}
      </h2>
      <div className="stage">
        <BarkDog key={beat} mood={mood} className="stage__dog" />
        <Bubble key={`bubble-${beat}`} speech={speech} />
      </div>
      {game?.finished === true ? (
        <Done game={game} signedIn={signedIn} />
      ) : (
        <AskForm maxLength={MAX_QUESTION_LENGTH} busy={thinking} onAsk={onAsk} />
      )}
      <Log
        rows={turns.map((turn) => ({
          key: turn.question,
          asked: turn.question,
          verdict: turn.verdict,
        }))}
      />
      <Bones left={game?.questionsLeft ?? QUESTION_LIMIT} />
    </section>
  );
}
