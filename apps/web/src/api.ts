import { normalize, type Answer, type Verdict } from "./practice.ts";

/** What came back from asking the server. */
export type Heard =
  | { readonly kind: "answer"; readonly answer: Answer }
  /** Bark could not answer it with a yes or no; no bone is used. */
  | { readonly kind: "unsure"; readonly reply: string }
  /** Asked too fast; no bone is used. */
  | { readonly kind: "busy"; readonly reply: string }
  /** The judge is not reachable, so the page answers from its own rules. */
  | { readonly kind: "offline" };

const VERDICTS = new Set<string>(["yes", "no", "sortof", "correct", "unsure"]);

function field(body: unknown, key: string): string | undefined {
  if (typeof body !== "object" || body === null || !(key in body)) {
    return undefined;
  }
  const value = Reflect.get(body, key) as unknown;
  return typeof value === "string" ? value : undefined;
}

function isVerdict(value: string | undefined): value is Verdict | "unsure" {
  return value !== undefined && VERDICTS.has(value);
}

/** Asks the server's judge, which answers from facts the page never sees. */
export async function askBark(question: string): Promise<Heard> {
  try {
    const res = await fetch("/api/practice/ask", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ question }),
    });
    const body: unknown = await res.json();
    if (res.status === 429) {
      return {
        kind: "busy",
        reply: field(body, "error") ?? "Too many questions. Give Bark a minute!",
      };
    }
    const verdict = field(body, "verdict");
    const reply = field(body, "reply");
    if (!res.ok || !isVerdict(verdict) || reply === undefined) {
      return { kind: "offline" };
    }
    if (verdict === "unsure") {
      return { kind: "unsure", reply };
    }
    return { kind: "answer", answer: { topic: `q:${normalize(question)}`, verdict, reply } };
  } catch {
    return { kind: "offline" };
  }
}
