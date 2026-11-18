// Login is optional: anyone can play, and signing in only adds saved scores and streaks.
//
// The OAuth relay: when OAUTH_RELAY_URL is set, Keycloak redirects to the shared relay, which bounces the code to the callback carried in `state` as `return_to`. That lets preview hosts log in without each registering a redirect URI, as in ScottyLabs/cmugpt-surface.
import { Buffer } from "node:buffer";
import type { Hono } from "hono";
import { deleteCookie, setCookie } from "hono/cookie";
import { type AppEnv, isAdmin, readCookie, SESSION_COOKIE } from "../context.ts";
import { type Oidc, randomNonce, randomState, randomVerifier } from "../oidc.ts";
import type { Store } from "../store.ts";

export interface AuthOptions {
  readonly store: Store;
  readonly oidc: Oidc | null;
  /** Where players reach the app; the callback lives under it. */
  readonly appUrl: string;
  readonly relayUrl: string | null;
  readonly admins: ReadonlySet<string>;
}

const SESSION_SECONDS = 30 * 24 * 60 * 60;

/** Only ever send people back to a path on this site. */
function safeReturnTo(raw: string | undefined): string {
  return raw !== undefined && raw.startsWith("/") && !raw.startsWith("//") ? raw : "/";
}

function callbackUrl(appUrl: string): string {
  return `${appUrl.replace(/\/+$/u, "")}/api/auth/callback`;
}

function addLogin(app: Hono<AppEnv>, options: AuthOptions): void {
  app.get("/api/auth/login", async (c) => {
    const { oidc } = options;
    if (oidc === null) {
      return c.redirect("/?login_error=unavailable");
    }
    const callback = callbackUrl(options.appUrl);
    const state =
      options.relayUrl === null
        ? randomState()
        : Buffer.from(JSON.stringify({ return_to: callback, r: randomState() })).toString(
            "base64url",
          );
    const login = {
      verifier: randomVerifier(),
      nonce: randomNonce(),
      redirectUri: options.relayUrl ?? callback,
      returnTo: safeReturnTo(c.req.query("returnTo")),
    };
    await options.store.saveLoginState(state, login);
    return c.redirect(await oidc.authorizeUrl({ ...login, state }));
  });
}

function addCallback(app: Hono<AppEnv>, options: AuthOptions): void {
  app.get("/api/auth/callback", async (c) => {
    const state = c.req.query("state");
    const login = state === undefined ? null : await options.store.takeLoginState(state);
    if (options.oidc === null || state === undefined || login === null) {
      return c.redirect("/?login_error=expired");
    }
    if (c.req.query("error") !== undefined) {
      return c.redirect(`${login.returnTo}?login_error=denied`);
    }
    try {
      // The code was issued for the redirect URI the login used (the relay, if any), so the exchange must name that one.
      const callback = new URL(login.redirectUri);
      callback.search = new URL(c.req.url).search;
      const claims = await options.oidc.exchange({ callbackUrl: callback, state, ...login });
      const user = await options.store.upsertUser(claims);
      setCookie(c, SESSION_COOKIE, await options.store.createSession(user.id), {
        httpOnly: true,
        secure: options.appUrl.startsWith("https:"),
        sameSite: "Lax",
        path: "/",
        maxAge: SESSION_SECONDS,
      });
      return c.redirect(login.returnTo);
    } catch (error) {
      console.error("login failed:", error instanceof Error ? error.message : error);
      return c.redirect(`${login.returnTo}?login_error=failed`);
    }
  });
}

export function addAuth(app: Hono<AppEnv>, options: AuthOptions): void {
  // Who is asking, for every request: a signed-in player, or nobody.
  app.use("/api/*", async (c, next) => {
    const token = readCookie(c, SESSION_COOKIE);
    c.set("user", token === null ? null : await options.store.sessionUser(token));
    await next();
  });
  addLogin(app, options);
  addCallback(app, options);

  app.post("/api/auth/logout", async (c) => {
    const token = readCookie(c, SESSION_COOKIE);
    if (token !== null) {
      await options.store.deleteSession(token);
    }
    deleteCookie(c, SESSION_COOKIE, { path: "/" });
    return c.body(null, 204);
  });

  app.get("/api/me", (c) => {
    const user = c.get("user");
    if (user === null) {
      return c.json({ user: null, loginAvailable: options.oidc !== null });
    }
    return c.json({
      user: {
        name: user.name ?? user.username ?? "Player",
        username: user.username,
        admin: isAdmin(user, options.admins),
      },
      loginAvailable: true,
    });
  });
}
