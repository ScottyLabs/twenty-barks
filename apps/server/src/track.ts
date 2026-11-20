import type { Game } from "./store.ts";

type Properties = Readonly<Record<string, string | number | boolean>>;

export interface GameEvent {
  readonly event: "game_started" | "question_asked" | "game_finished";
  readonly properties: Properties;
}

/** Sends one game's event somewhere. Keyed by the game's random id, never by who is playing. */
export type Track = (gameId: string, event: GameEvent) => void;

export const noTracking: Track = () => {
  // Nothing to send outside production.
};

/** What happened in a game that just used up a question. */
export function eventsFor(game: Game, nowMs: number): GameEvent[] {
  const last = game.turns.at(-1);
  if (last === undefined) {
    return [];
  }
  const number = game.turns.length;
  const day = game.day;
  const events: GameEvent[] = [];
  if (number === 1) {
    events.push({ event: "game_started", properties: { day } });
  }
  events.push({ event: "question_asked", properties: { day, number, verdict: last.verdict } });
  if (game.finished) {
    const seconds = Math.max(0, Math.round((nowMs - game.startedMs) / 1000));
    events.push({
      event: "game_finished",
      properties: { day, won: game.won, questions: number, seconds },
    });
  }
  return events;
}

/**
 * Sends events to PostHog from the server, so ad blockers cannot hide any games.
 *
 * Sending never blocks or breaks a reply: failures are logged and dropped.
 */
export function posthogTracker(key: string, host: string, send: typeof fetch = fetch): Track {
  const url = `${host.replace(/\/+$/u, "")}/i/v0/e/`;
  return (gameId, { event, properties }) => {
    const body = {
      api_key: key,
      event,
      distinct_id: gameId,
      // No person profiles: each game stays an anonymous id.
      properties: { ...properties, $process_person_profile: false },
      timestamp: new Date().toISOString(),
    };
    void send(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    })
      .then((res) => {
        if (!res.ok) {
          console.warn(`PostHog refused ${event}: ${res.status}`);
        }
      })
      .catch((error: unknown) => {
        console.warn(
          `PostHog unreachable for ${event}:`,
          error instanceof Error ? error.message : error,
        );
      });
  };
}
