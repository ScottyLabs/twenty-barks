import process from "node:process";
import { serve } from "@hono/node-server";
import pg from "pg";
import { createApp } from "./app.ts";
import { parseAdmins } from "./context.ts";
import { migrate, poolDb } from "./db.ts";
import { jevJudge } from "./jev.ts";
import { keycloak } from "./oidc.ts";
import { Store } from "./store.ts";

// Node APIs rather than the Deno namespace, since the type-aware linter cannot see Deno's global types. Deno runs them natively.
function readEnv(name: string): string | null {
  const value = process.env[name];
  return value === undefined || value === "" ? null : value;
}

const databaseUrl = readEnv("DATABASE_URL");
if (databaseUrl === null) {
  throw new Error(
    "DATABASE_URL is required. Run the server from the Nix dev shell, which provides a local database.",
  );
}

const port = Number(readEnv("PORT") ?? "3001");
const pool = new pg.Pool({ connectionString: databaseUrl, max: 5 });

const db = poolDb(pool);
await migrate(db);

const gatewayUrl = readEnv("LITELLM_BASE_URL");
const gatewayKey = readEnv("LITELLM_API_KEY");
if (gatewayUrl === null || gatewayKey === null) {
  console.warn(
    "LITELLM_BASE_URL or LITELLM_API_KEY is missing, so Bark will not answer questions.",
  );
}

const keycloakUrl = readEnv("KEYCLOAK_URL");
const realm = readEnv("KEYCLOAK_REALM");
const clientId = readEnv("OIDC_CLIENT_ID");
const clientSecret = readEnv("OIDC_CLIENT_SECRET");
const oidc =
  keycloakUrl === null || realm === null || clientId === null || clientSecret === null
    ? null
    : keycloak({ keycloakUrl, realm, clientId, clientSecret });
if (oidc === null) {
  console.warn("Keycloak settings are missing, so nobody can sign in. The game still works.");
}

const app = createApp({
  staticDir: readEnv("STATIC_DIR"),
  pingDatabase: async () => {
    await pool.query("select 1");
  },
  commitHash: readEnv("COMMIT_HASH"),
  store: new Store(db),
  judge: gatewayUrl === null || gatewayKey === null ? null : jevJudge(gatewayUrl, gatewayKey),
  oidc,
  appUrl: readEnv("APP_URL") ?? "http://localhost:4173",
  relayUrl: readEnv("OAUTH_RELAY_URL"),
  admins: parseAdmins(readEnv("ADMIN_USERS")),
});

const quiet = readEnv("LOG_LEVEL") === "error";
const server = serve({ fetch: app.fetch, port }, (info) => {
  if (!quiet) {
    console.log(`twenty-barks listening on port ${info.port}`);
  }
});

process.on("SIGTERM", () => {
  server.close(() => {
    void pool.end();
  });
});
