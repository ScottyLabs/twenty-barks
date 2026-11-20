import type { Analytics } from "./server.ts";

let started = false;

/**
 * Count page views in PostHog, and nothing else: no clicks, no recordings, no surveys.
 *
 * The server only hands out a key in production, so previews and local runs never load PostHog at all.
 */
export function countPageViews(analytics: Analytics | null): void {
  if (analytics === null || started) {
    return;
  }
  started = true;
  void import("posthog-js").then(({ posthog }) => {
    posthog.init(analytics.key, {
      api_host: analytics.host,
      capture_pageview: "history_change",
      capture_pageleave: false,
      autocapture: false,
      disable_session_recording: true,
      disable_surveys: true,
      persistence: "localStorage",
    });
  });
}
