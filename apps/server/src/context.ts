import type { Context } from "hono";
import type { User } from "./store.ts";

export interface AppEnv {
  Variables: { user: User | null };
}

export type AppContext = Context<AppEnv>;

export const SESSION_COOKIE = "tb_session";

/** Admins are listed by username or email in ADMIN_USERS, kept in the secret store rather than in this repository. */
export function isAdmin(user: User | null, admins: ReadonlySet<string>): boolean {
  if (user === null) {
    return false;
  }
  return [user.username, user.email].some(
    (name) => name !== null && admins.has(name.toLowerCase()),
  );
}

export function parseAdmins(list: string | null): ReadonlySet<string> {
  return new Set(
    (list ?? "")
      .split(",")
      .map((name) => name.trim().toLowerCase())
      .filter((name) => name !== ""),
  );
}

/** One cookie from the request, read by hand so it works in any middleware. */
export function readCookie(
  c: { req: { header: (name: string) => string | undefined } },
  name: string,
): string | null {
  for (const part of (c.req.header("cookie") ?? "").split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) {
      return decodeURIComponent(value.join("="));
    }
  }
  return null;
}

/** The parsed JSON body, or null when there is none or it does not parse. */
export async function jsonBody(c: AppContext): Promise<unknown> {
  try {
    return (await c.req.json()) as unknown;
  } catch {
    return null;
  }
}

export function field(body: unknown, key: string): unknown {
  return typeof body === "object" && body !== null
    ? (Reflect.get(body, key) as unknown)
    : undefined;
}

export function stringField(body: unknown, key: string): string | null {
  const value = field(body, key);
  return typeof value === "string" ? value : null;
}

export function stringList(body: unknown, key: string): string[] | null {
  const value = field(body, key);
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) {
    return null;
  }
  return value.map((item: string) => item.trim()).filter((item) => item !== "");
}
