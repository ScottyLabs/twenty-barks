import { useEffect, useState } from "react";
import { at, getJson, list, puzzleOf, sendJson, str, type Me, type Puzzle } from "../server.ts";
import { DraftPanel } from "./AdminDraft.tsx";
import { bodyOf, type Draft, draftOf, Editor, EMPTY, Tryout } from "./AdminEditor.tsx";

async function fetchPuzzles(): Promise<Puzzle[]> {
  const { body } = await getJson("/api/admin/puzzles");
  return list(at(body, "puzzles")).map((item) => puzzleOf(item));
}

/** The day after the latest scheduled puzzle, or tomorrow. */
function nextFreeDay(puzzles: readonly Puzzle[]): string {
  const latest = puzzles[0]?.day;
  const base = latest === undefined ? new Date() : new Date(`${latest}T12:00:00`);
  base.setDate(base.getDate() + 1);
  return base.toLocaleDateString("en-CA");
}

function Schedule({
  puzzles,
  selected,
  onPick,
}: {
  readonly puzzles: readonly Puzzle[];
  readonly selected: string;
  readonly onPick: (puzzle: Puzzle | null) => void;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="eyebrow">Schedule</h2>
        <button
          type="button"
          className="pill pill--small"
          onClick={() => {
            onPick(null);
          }}
        >
          New puzzle
        </button>
      </div>
      <ol className="log">
        {puzzles.map((puzzle) => (
          <li key={puzzle.day}>
            <button
              type="button"
              className={`admin-row ${puzzle.day === selected ? "admin-row--on" : ""}`}
              onClick={() => {
                onPick(puzzle);
              }}
            >
              <span className="w-24 font-mono text-sm text-muted">{puzzle.day}</span>
              <span>{puzzle.name}</span>
            </button>
          </li>
        ))}
        {puzzles.length === 0 && <li className="text-muted">Nothing scheduled yet.</li>}
      </ol>
    </section>
  );
}

function useAdmin(enabled: boolean) {
  const [puzzles, setPuzzles] = useState<Puzzle[]>([]);
  const [typed, setDraft] = useState<Draft>(EMPTY);
  const [status, setStatus] = useState("");
  const draft = typed.day === "" ? { ...typed, day: nextFreeDay(puzzles) } : typed;
  const load = (): void => {
    void fetchPuzzles().then(setPuzzles);
  };
  useEffect(() => {
    if (enabled) {
      void fetchPuzzles().then(setPuzzles);
    }
  }, [enabled]);

  const onSave = (): void => {
    void sendJson(`/api/admin/puzzles/${draft.day}`, "PUT", bodyOf(draft)).then(
      ({ status: code, body }) => {
        setStatus(code === 200 ? "Saved." : (str(at(body, "error")) ?? "Could not save."));
        setDraft(draft);
        load();
      },
    );
  };
  const onDelete = (): void => {
    if (globalThis.confirm(`Delete the puzzle for ${draft.day}? Games played on it go too.`)) {
      void sendJson(`/api/admin/puzzles/${draft.day}`, "DELETE").then(() => {
        setStatus("Deleted.");
        setDraft(EMPTY);
        load();
      });
    }
  };
  const onPick = (puzzle: Puzzle | null): void => {
    setStatus("");
    setDraft(puzzle === null ? EMPTY : draftOf(puzzle));
  };
  return { puzzles, draft, setDraft, status, onSave, onDelete, onPick };
}

export function AdminPage({ me }: { readonly me: Me | null }) {
  const isAdmin = me?.user?.admin === true;
  const admin = useAdmin(isAdmin);
  if (!isAdmin) {
    return <p className="text-muted">Nothing to see here.</p>;
  }
  return (
    <div className="grid w-full gap-8 text-left lg:grid-cols-[18rem_1fr]">
      <Schedule puzzles={admin.puzzles} selected={admin.draft.day} onPick={admin.onPick} />
      <div className="card items-stretch">
        <DraftPanel
          onDraft={(drafted) => {
            admin.setDraft({ ...admin.draft, ...drafted });
          }}
        />
        <hr className="border-line" />
        <Editor
          draft={admin.draft}
          onChange={admin.setDraft}
          onSave={admin.onSave}
          onDelete={admin.onDelete}
          status={admin.status}
        />
        <Tryout draft={admin.draft} />
      </div>
    </div>
  );
}
