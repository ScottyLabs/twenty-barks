// Light or dark, flipped by the moon in the header. Until it is pressed, the page follows the device.
//
// Signed out, the choice is remembered on this device. Signed in, it is saved to the account, so it follows the player to any device.
// The same rules run once more in index.html before the page paints, so it never flashes the wrong colours: keep the two in step.
import { useSyncExternalStore } from "react";

export type Theme = "system" | "light" | "dark";
export type Look = "light" | "dark";
export const THEMES: readonly Theme[] = ["system", "light", "dark"];

const LOOK_KEY = "twenty-barks:look";
const ACCOUNT_KEY = "twenty-barks:account-theme";

/** The page colour in each look, for the browser's own bars. */
const BAR_COLOUR: Record<Look, string> = { light: "#ffffff", dark: "#0c0c10" };

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null): void {
  try {
    if (value === null) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, value);
    }
  } catch {
    // Private windows can refuse storage; the look then simply is not remembered.
  }
}

export function themeOf(value: unknown): Theme {
  return THEMES.find((theme) => theme === value) ?? "system";
}

const asLook = (value: string | null): Look | null =>
  value === "light" || value === "dark" ? value : null;

const darkQuery = (): MediaQueryList | undefined =>
  globalThis.matchMedia?.("(prefers-color-scheme: dark)");

function accountTheme(): Theme | null {
  const saved = read(ACCOUNT_KEY);
  return saved === null ? null : themeOf(saved);
}

export function currentLook(): Look {
  const account = accountTheme();
  const theme = account ?? asLook(read(LOOK_KEY)) ?? "system";
  if (theme !== "system") {
    return theme;
  }
  return darkQuery()?.matches === true ? "dark" : "light";
}

const listeners = new Set<() => void>();

export function applyLook(): void {
  const look = currentLook();
  document.documentElement.dataset.theme = look;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", BAR_COLOUR[look]);
}

function changed(): void {
  applyLook();
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  const query = darkQuery();
  query?.addEventListener("change", changed);
  return () => {
    listeners.delete(listener);
    query?.removeEventListener("change", changed);
  };
}

export function useLook(): Look {
  return useSyncExternalStore(subscribe, currentLook);
}

/** The moon (or sun) in the header. Returns the new look when it belongs on the account, so the caller can save it there. */
export function flipLook(): Look | null {
  const next: Look = currentLook() === "dark" ? "light" : "dark";
  const signedIn = accountTheme() !== null;
  write(signedIn ? ACCOUNT_KEY : LOOK_KEY, next);
  changed();
  return signedIn ? next : null;
}

/** Called whenever we learn who is signed in: their saved theme, or null once nobody is. */
export function rememberAccount(theme: Theme | null): void {
  if (theme === accountTheme()) {
    return;
  }
  write(ACCOUNT_KEY, theme);
  changed();
}
