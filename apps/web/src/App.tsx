import { Mark } from "./components/Mark.tsx";
import { PracticeRound } from "./components/PracticeRound.tsx";

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
    body: "Fewer questions is better. Come back tomorrow for a new one.",
  },
] as const;

function Header() {
  return (
    <header className="hairline-b">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-8">
        <a href="https://scottylabs.org" className="flex items-center gap-2 font-medium">
          <Mark className="h-6 w-7" />
          ScottyLabs
        </a>
        <a href="#how" className="text-sm font-medium hover:underline">
          How to play
        </a>
      </div>
    </header>
  );
}

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

export function App() {
  return (
    <div className="flex min-h-dvh flex-col">
      <div className="glow" aria-hidden="true" />
      <Header />
      <main className="flex flex-1 flex-col gap-16 pb-16">
        <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-8 px-4 pt-12 text-center sm:pt-16">
          <div className="space-y-4">
            <p className="eyebrow">A daily game from Bark</p>
            <h1 className="text-5xl font-black tracking-tight sm:text-7xl">
              Twenty <span className="gradient-text">Barks</span>
            </h1>
            <p className="mx-auto max-w-md text-lg text-muted">
              Bark is thinking of something at CMU. You get twenty yes-or-no questions to sniff it
              out.
            </p>
          </div>
          <PracticeRound />
        </div>
        <HowToPlay />
      </main>
      <footer className="hairline-t">
        <p className="mx-auto max-w-5xl px-4 py-6 text-sm text-muted sm:px-8">
          Made with treats by <a href="https://scottylabs.org">ScottyLabs</a>. The first daily
          puzzle is coming soon.
        </p>
      </footer>
    </div>
  );
}
