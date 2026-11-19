// Login through ScottyLabs' Keycloak, following the approach in ScottyLabs/cmugpt-surface: openid-client runs the protocol (discovery, PKCE, code exchange, id_token checks), so none of it is hand-rolled here.
import * as client from "openid-client";
import type { User } from "./store.ts";

export type Claims = Omit<User, "id" | "theme">;

/** The parts of OpenID Connect the app uses, so tests can stand in for Keycloak. */
export interface Oidc {
  readonly authorizeUrl: (params: {
    redirectUri: string;
    state: string;
    nonce: string;
    verifier: string;
  }) => Promise<string>;
  readonly exchange: (params: {
    callbackUrl: URL;
    state: string;
    nonce: string;
    verifier: string;
  }) => Promise<Claims>;
}

export interface OidcSettings {
  readonly keycloakUrl: string;
  readonly realm: string;
  readonly clientId: string;
  readonly clientSecret: string;
}

const text = (value: unknown): string | null => (typeof value === "string" ? value : null);

export function keycloak(settings: OidcSettings): Oidc {
  const issuer = new URL(
    `${settings.keycloakUrl.replace(/\/+$/u, "")}/realms/${encodeURIComponent(settings.realm)}`,
  );
  let config: Promise<client.Configuration> | null = null;
  const discover = (): Promise<client.Configuration> => {
    config ??= client
      .discovery(issuer, settings.clientId, settings.clientSecret)
      .catch((error: unknown) => {
        // Never cache a failed discovery, so the next login tries again.
        config = null;
        throw error;
      });
    return config;
  };

  return {
    authorizeUrl: async ({ redirectUri, state, nonce, verifier }) =>
      client.buildAuthorizationUrl(await discover(), {
        redirect_uri: redirectUri,
        scope: "openid profile email",
        response_type: "code",
        state,
        nonce,
        code_challenge: await client.calculatePKCECodeChallenge(verifier),
        code_challenge_method: "S256",
      }).href,
    exchange: async ({ callbackUrl, state, nonce, verifier }) => {
      const tokens = await client.authorizationCodeGrant(await discover(), callbackUrl, {
        expectedState: state,
        expectedNonce: nonce,
        pkceCodeVerifier: verifier,
        idTokenExpected: true,
      });
      const claims = tokens.claims();
      if (claims === undefined || claims.sub === "") {
        throw new Error("id_token has no subject");
      }
      return {
        sub: claims.sub,
        username: text(claims.preferred_username),
        name: text(claims.name) ?? text(claims.given_name),
        email: text(claims.email),
      };
    },
  };
}

export const randomState = (): string => client.randomState();
export const randomNonce = (): string => client.randomNonce();
export const randomVerifier = (): string => client.randomPKCECodeVerifier();
