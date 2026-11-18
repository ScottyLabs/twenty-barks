import { useEffect, useState } from "react";
import { QUESTION_LIMIT } from "../practice.ts";
import { at, fetchScores, list, loginHref, num, str, type Me } from "../server.ts";

interface Row {
  readonly day: string;
  readonly name: string;
  readonly questions: number;
  readonly won: boolean;
}

interface Scores {
  readonly played: number;
  readonly won: number;
  readonly averageQuestions: number | null;
  readonly currentStreak: number;
  readonly bestStreak: number;
  readonly history: readonly Row[];
}

function scoresOf(body: unknown): Scores {
  const stats = at(body, "stats");
  const average = at(stats, "averageQuestions");
  return {
    played: num(at(stats, "played")),
    won: num(at(stats, "won")),
    averageQuestions: typeof average === "number" ? average : null,
    currentStreak: num(at(stats, "currentStreak")),
    bestStreak: num(at(stats, "bestStreak")),
    history: list(at(body, "history")).map((row) => ({
      day: str(at(row, "day")) ?? "",
      name: str(at(row, "name")) ?? "",
      questions: num(at(row, "questions")),
      won: at(row, "won") === true,
    })),
  };
}

function Tile({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="bg-paper p-5">
      <p className="text-3xl font-black tabular-nums">{value}</p>
      <p className="text-sm text-muted">{label}</p>
    </div>
  );
}

function History({ rows }: { readonly rows: readonly Row[] }) {
  if (rows.length === 0) {
    return <p className="text-muted">No finished puzzles yet. Today&apos;s is waiting for you!</p>;
  }
  return (
    <ol className="log">
      {rows.map((row) => (
        <li key={row.day}>
          <span className="log__n w-24 font-mono">{row.day}</span>
          <span className="log__q">{row.name}</span>
          <span className={`verdict ${row.won ? "verdict--yes" : "verdict--no"}`}>
            {row.won ? `${row.questions}/${QUESTION_LIMIT}` : "Missed"}
          </span>
        </li>
      ))}
    </ol>
  );
}

export function ScoresPage({ me }: { readonly me: Me | null }) {
  const [scores, setScores] = useState<Scores | null>(null);
  const signedIn = me?.user !== null && me !== null;
  useEffect(() => {
    if (signedIn) {
      void fetchScores().then((body) => {
        setScores(body === null ? null : scoresOf(body));
      });
    }
  }, [signedIn]);

  if (!signedIn) {
    return (
      <div className="card max-w-md text-center">
        <p>Sign in to keep your scores and build a streak.</p>
        <a className="pill pill--solid" href={loginHref("/scores")}>
          Sign in
        </a>
      </div>
    );
  }
  if (scores === null) {
    return <p className="text-muted">Fetching your bones...</p>;
  }
  return (
    <div className="flex w-full flex-col gap-8">
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-3xl border border-line bg-line sm:grid-cols-4">
        <Tile label="Day streak" value={String(scores.currentStreak)} />
        <Tile label="Best streak" value={String(scores.bestStreak)} />
        <Tile label="Solved" value={`${scores.won}/${scores.played}`} />
        <Tile label="Avg. questions" value={scores.averageQuestions?.toString() ?? "-"} />
      </div>
      <section className="flex flex-col gap-3">
        <h2 className="eyebrow">Past puzzles</h2>
        <History rows={scores.history} />
      </section>
    </div>
  );
}
