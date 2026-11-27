import type { Secret } from "./secret.ts";

/** Jev's read of one question: how likely each answer is, and how likely it is a guess at the secret itself. */
export interface Judgment {
  readonly yes: number;
  readonly no: number;
  readonly sortof: number;
  readonly unanswerable: number;
  readonly guessed: number;
}

/** A question this player already asked, and how Bark answered it. */
export interface Earlier {
  readonly question: string;
  readonly answer: "yes" | "no" | "sortof";
}

/** Judges `question`, staying consistent with what this player was `earlier` told. */
export type Judge = (
  secret: Secret,
  question: string,
  earlier?: readonly Earlier[],
) => Promise<Judgment>;

/** Pinned, so the thresholds in ask.ts stay tuned to the model that answers. */
const MODEL = "jev-1.14.0";
const TIMEOUT_MS = 8000;

const QUESTIONS = {
  answer: {
    type: "choice",
    instructions:
      "A player is trying to guess the secret thing in a game of twenty questions. Judge the player_question about the secret thing, using its facts and common knowledge about it. If there are earlier_answers, this player was already given them: stay consistent with them, so a question that means the same as an earlier one, or follows from it, gets the matching answer. How should it be truthfully answered?",
    criteria: {
      yes: "True of the secret thing.",
      no: "False of the secret thing.",
      sortof: "Partly true, true only sometimes, or depends on how you look at it.",
      unanswerable:
        "Not a yes-or-no question about the secret thing, or impossible to tell from the facts and common knowledge.",
    },
  },
  guessed: {
    type: "noul",
    instructions:
      "Is the player making a final guess that the secret thing IS some specific thing, and is that guess the secret thing itself (not just something near it, part of it, or related to it)?",
  },
} as const;

/** Follows `path` through parsed JSON, or gives undefined where it does not lead anywhere. */
function dig(value: unknown, ...path: string[]): unknown {
  let here = value;
  for (const key of path) {
    if (typeof here !== "object" || here === null || !(key in here)) {
      return undefined;
    }
    here = Reflect.get(here, key) as unknown;
  }
  return here;
}

function probability(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

/** Statuses worth one more try: rate limited, overloaded, or a gateway hiccup. */
const RETRY_STATUSES = new Set([429, 502, 503, 529]);
const RETRY_DELAY_MS = 250;

const pause = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

/**
 * A judge that asks TypeSafe's Jev through the ScottyLabs AI gateway, which serves it under `/typesafe`. A dropped connection or a busy gateway gets one more try, as TypeSafe's docs advise.
 */
export function jevJudge(baseUrl: string, apiKey: string, fetchFn: typeof fetch = fetch): Judge {
  const url = `${baseUrl.replace(/\/+$/u, "")}/typesafe/v1/systemone`;
  const send = (state: object): Promise<Response> =>
    fetchFn(url, {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({ model: MODEL, state, questions: QUESTIONS }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  const sendWithRetry = async (state: object): Promise<Response> => {
    try {
      const first = await send(state);
      if (!RETRY_STATUSES.has(first.status)) {
        return first;
      }
    } catch {
      // A dropped connection; try once more below.
    }
    await pause(RETRY_DELAY_MS);
    return send(state);
  };
  return async (secret, question, earlier = []) => {
    const res = await sendWithRetry({
      secret: { name: secret.name, facts: secret.facts },
      player_question: question,
      ...(earlier.length > 0 && { earlier_answers: earlier }),
    });
    if (!res.ok) {
      throw new Error(`Jev answered ${res.status}`);
    }
    const body: unknown = await res.json();
    const odds = (name: string): number =>
      probability(dig(body, "answers", "answer", "probabilities", name));
    return {
      yes: odds("yes"),
      no: odds("no"),
      sortof: odds("sortof"),
      unanswerable: odds("unanswerable"),
      guessed: probability(dig(body, "answers", "guessed", "noul")),
    };
  };
}
