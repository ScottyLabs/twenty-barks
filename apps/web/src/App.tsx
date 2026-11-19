import { useCallback, useEffect, useState } from "react";
import { carriedGame, DailyRound } from "./components/DailyRound.tsx";
import { Header } from "./components/Header.tsx";
import { PracticeRound } from "./components/PracticeRound.tsx";
import { AdminPage } from "./pages/Admin.tsx";
import { ScoresPage } from "./pages/Scores.tsx";
import { usePath } from "./router.tsx";
import { fetchMe, fetchToday, type Me, type Today } from "./server.ts";
import { rememberAccount } from "./theme.ts";

const STEPS = [
  {
    title: "Bark picks something",
    body: "Every day, a place, course, food, or tradition from around campus.",
  },
  {
    title: "You ask, he answers",
    body: "Yes, no, or sort of. Twenty questions, one bone each.",
  },
  {
    title: "Guess it, share it",
    body: "Fewer questions is better. Sign in to keep a streak going.",
  },
] as const;

function HowToPlay() {
  return (
    <section id="how" className="mx-auto w-full max-w-5xl px-4 sm:px-8">
      <h2 className="eyebrow mb-4">How to play</h2>
      <ol className="grid gap-px overflow-hidden rounded-3xl border border-line bg-line sm:grid-cols-3">
        {STEPS.map((step, i) => (
          <li key={step.title} className="bg-paper p-6">
            <p className="mb-3 font-mono text-xs text-muted">0{i + 1}</p>
            <h3 className="mb-1 text-lg font-bold">{step.title}</h3>
            <p className="text-muted">{step.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Hero({ title, subtitle }: { readonly title: React.ReactNode; readonly subtitle: string }) {
  return (
    <div className="space-y-4">
      <h1 className="text-5xl font-black tracking-tight sm:text-7xl">{title}</h1>
      <p className="mx-auto max-w-md text-lg text-muted">{subtitle}</p>
    </div>
  );
}

function Home({ me, today }: { readonly me: Me | null; readonly today: Today | null }) {
  const daily = today?.puzzle === true;
  return (
    <>
      <Hero
        title={
          <>
            Twenty <span className="gradient-text">Barks</span>
          </>
        }
        subtitle="Bark is thinking of something at CMU. You get twenty yes-or-no questions to sniff it out."
      />
      {today === null && <p className="text-muted">Waking Bark up...</p>}
      {today !== null && daily && (
        <DailyRound
          key={`${today.game?.id ?? "new"}-${String(me?.user !== null)}`}
          day={today.day}
          initial={today.game}
          signedIn={me?.user !== null && me !== null}
        />
      )}
      {today !== null && !daily && (
        <>
          <p className="text-muted">No puzzle today yet. Warm up with a practice round!</p>
          <PracticeRound />
        </>
      )}
    </>
  );
}

function useSession() {
  const [me, setMe] = useState<Me | null>(null);
  const [today, setToday] = useState<Today | null>(null);
  const refresh = useCallback(() => {
    void fetchMe()
      .then((found) => {
        rememberAccount(found.user?.theme ?? null);
        return found;
      })
      .catch(() => ({ user: null, loginAvailable: false }))
      .then(setMe);
    void fetchToday(carriedGame())
      .catch(() => ({ day: "", puzzle: false, game: null }))
      .then(setToday);
  }, []);
  useEffect(refresh, [refresh]);
  return { me, today, refresh };
}

function Page({
  path,
  me,
  today,
}: {
  readonly path: string;
  readonly me: Me | null;
  readonly today: Today | null;
}) {
  if (path === "/scores") {
    return (
      <>
        <Hero
          title="Your scores"
          subtitle="Every puzzle you have finished, and how long your streak is."
        />
        <ScoresPage me={me} />
      </>
    );
  }
  if (path === "/admin") {
    return (
      <>
        <Hero title="Admin" subtitle="Schedule puzzles and check how Bark answers them." />
        <AdminPage me={me} />
      </>
    );
  }
  return <Home me={me} today={today} />;
}

export function App() {
  const path = usePath();
  const { me, today, refresh } = useSession();
  const wide = path === "/admin";
  return (
    <div className="flex min-h-dvh flex-col">
      <div className="glow" aria-hidden="true" />
      <Header me={me} path={path} onChange={refresh} />
      <main className="flex flex-1 flex-col gap-16 pb-16">
        <div
          className={`mx-auto flex w-full ${wide ? "max-w-5xl" : "max-w-3xl"} flex-col items-center gap-8 px-4 pt-12 text-center sm:pt-16`}
        >
          <Page path={path} me={me} today={today} />
        </div>
        {path === "/" && <HowToPlay />}
      </main>
      <footer className="hairline-t">
        <p className="mx-auto max-w-5xl px-4 py-6 text-sm text-muted sm:px-8">
          Made with treats and {"\u2764\uFE0F"} by Krish Saxena at{" "}
          <a href="https://scottylabs.org">ScottyLabs</a>
        </p>
      </footer>
    </div>
  );
}
