import type { Hono } from "hono";
import { decide, MAX_QUESTION_LENGTH } from "../ask.ts";
import { type AppEnv, isAdmin, jsonBody, stringField, stringList } from "../context.ts";
import type { Drafter, PuzzleDraft } from "../draft.ts";
import type { Judge } from "../jev.ts";
import type { Puzzle, Store } from "../store.ts";

export interface AdminOptions {
  readonly store: Store;
  readonly judge: Judge | null;
  readonly drafter: Drafter | null;
  readonly admins: ReadonlySet<string>;
}

/** Each draft question asked of Jev against the draft's facts, so an admin sees how it will play. */
async function tryQuestions(judge: Judge | null, draft: PuzzleDraft) {
  if (judge === null) {
    return [];
  }
  const secret = { name: draft.name, aliases: draft.aliases, facts: draft.facts };
  const results = await Promise.allSettled(
    draft.questions.map(async (question) => ({
      question,
      ...decide(secret, question, await judge(secret, question)),
    })),
  );
  return results.flatMap((result) => (result.status === "fulfilled" ? [result.value] : []));
}

function addDraft(app: Hono<AppEnv>, options: AdminOptions): void {
  // Only when an admin presses the button: nothing drafts or schedules on its own.
  app.post("/api/admin/draft", async (c) => {
    if (options.drafter === null) {
      return c.json({ error: "The AI gateway is not configured" }, 503);
    }
    const body = await jsonBody(c);
    const thing = (stringField(body, "thing") ?? "").trim().slice(0, 120);
    const notes = (stringField(body, "notes") ?? "").trim().slice(0, 1000);
    const past = (await options.store.puzzles()).map((puzzle) => puzzle.name);
    try {
      const draft = await options.drafter({ thing, notes, past });
      return c.json({ draft, tried: await tryQuestions(options.judge, draft) });
    } catch (error) {
      console.error("draft failed:", error instanceof Error ? error.message : error);
      return c.json({ error: "The AI could not draft a puzzle. Try again?" }, 502);
    }
  });
}

const DAY = /^\d{4}-\d{2}-\d{2}$/u;
const MAX_FACTS = 40;
const MAX_FACT_LENGTH = 400;

/** A puzzle from an admin's form, or the reason it will not do. */
function readPuzzle(day: string, body: unknown): Puzzle | string {
  const name = stringField(body, "name")?.trim() ?? "";
  const aliases = (stringList(body, "aliases") ?? []).map((alias) => alias.toLowerCase());
  const facts = stringList(body, "facts") ?? [];
  if (!DAY.test(day) || Number.isNaN(Date.parse(day))) {
    return "The day must be a date like 2026-12-01";
  }
  if (name === "" || name.length > 80) {
    return "Give the answer a name of up to 80 characters";
  }
  if (aliases.length === 0) {
    return 'Add at least one name a guess can use, like "fence"';
  }
  if (
    facts.length === 0 ||
    facts.length > MAX_FACTS ||
    facts.some((f) => f.length > MAX_FACT_LENGTH)
  ) {
    return `Add between 1 and ${MAX_FACTS} facts, each up to ${MAX_FACT_LENGTH} characters`;
  }
  return { day, name, aliases, facts };
}

export function addAdmin(app: Hono<AppEnv>, options: AdminOptions): void {
  // Everything under /api/admin is for admins only, and says nothing about itself to anyone else.
  app.use("/api/admin/*", (c, next) => {
    if (!isAdmin(c.get("user"), options.admins)) {
      return Promise.resolve(c.json({ error: "Not found" }, 404));
    }
    return next();
  });

  addDraft(app, options);

  app.get("/api/admin/puzzles", async (c) => c.json({ puzzles: await options.store.puzzles() }));

  app.put("/api/admin/puzzles/:day", async (c) => {
    const user = c.get("user");
    const puzzle = readPuzzle(c.req.param("day"), await jsonBody(c));
    if (typeof puzzle === "string" || user === null) {
      return c.json({ error: puzzle }, 400);
    }
    await options.store.savePuzzle(puzzle, user.id);
    return c.json({ puzzle });
  });

  app.delete("/api/admin/puzzles/:day", async (c) => {
    await options.store.deletePuzzle(c.req.param("day"));
    return c.body(null, 204);
  });

  // Try a question against a draft, to check the facts answer it the way you expect.
  app.post("/api/admin/try", async (c) => {
    const body = await jsonBody(c);
    const draft = readPuzzle("2000-01-01", body);
    const question = stringField(body, "question")?.trim() ?? "";
    if (typeof draft === "string" || question === "" || question.length > MAX_QUESTION_LENGTH) {
      return c.json({ error: typeof draft === "string" ? draft : "Ask a question" }, 400);
    }
    if (options.judge === null) {
      return c.json({ error: "The AI gateway is not configured" }, 503);
    }
    const judgment = await options.judge(draft, question);
    return c.json({ ...decide(draft, question, judgment), judgment });
  });
}
