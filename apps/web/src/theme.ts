// Light or dark. The moon in the header flips the look; a signed-in player also keeps a default on their account.
//
// Signed out, a flip is remembered on this device. Signed in, a flip lasts for this visit only, and the next visit opens in the account's default again.
// The same rules run once more in index.html before the page paints, so it never flashes the wrong colours: keep the two in step.
import { useSyncExternalStore } from "react";

export type Theme = "system" | "light" | "dark";
export type Look = "light" | "dark";
export const THEMES: readonly Theme[] = ["system", "light", "dark"];

const LOOK_KEY = "twenty-barks:look";
const ACCOUNT_KEY = "twenty-barks:account-theme";
const VISIT_KEY = "twenty-barks:visit-look";

/** The page colour in each look, for the browser's own bars. */
const BAR_COLOUR: Record<Look, string> = { light: "#ffffff", dark: "#0c0c10" };

type Shelf = "local" | "session";

function read(shelf: Shelf, key: string): string | null {
  try {
    return (shelf === "local" ? localStorage : sessionStorage).getItem(key);
  } catch {
    return null;
  }
}

function write(shelf: Shelf, key: string, value: string | null): void {
  try {
    const storage = shelf === "local" ? localStorage : sessionStorage;
    if (value === null) {
      storage.removeItem(key);
    } else {
      storage.setItem(key, value);
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
  const saved = read("local", ACCOUNT_KEY);
  return saved === null ? null : themeOf(saved);
}

export function currentLook(): Look {
  const account = accountTheme();
  const flipped = asLook(account === null ? read("local", LOOK_KEY) : read("session", VISIT_KEY));
  if (flipped !== null) {
    return flipped;
  }
  const theme = account ?? "system";
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

/** The moon (or sun) in the header. */
export function flipLook(): void {
  const next: Look = currentLook() === "dark" ? "light" : "dark";
  if (accountTheme() === null) {
    write("local", LOOK_KEY, next);
  } else {
    write("session", VISIT_KEY, next);
  }
  changed();
}

/** Called whenever we learn who is signed in: their default, or null once nobody is. */
export function rememberAccount(theme: Theme | null): void {
  if (theme === accountTheme()) {
    return;
  }
  write("local", ACCOUNT_KEY, theme);
  if (theme === null) {
    write("session", VISIT_KEY, null);
  }
  changed();
}

/** Picking a default in the account menu also undoes any flip made this visit. */
export function chooseDefault(theme: Theme): void {
  write("session", VISIT_KEY, null);
  write("local", ACCOUNT_KEY, theme);
  changed();
}
