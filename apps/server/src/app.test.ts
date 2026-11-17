import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { test } from "node:test";
import { join } from "node:path";
import { createApp } from "./app.ts";
import { resolveInside } from "./static.ts";

async function makeWebRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "twenty-barks-web-"));
  await mkdir(join(root, "assets"));
  await writeFile(join(root, "index.html"), "<!doctype html><title>shell</title>");
  await writeFile(join(root, "assets", "app-abc123.js"), "console.log(1)");
  return root;
}

const healthyDatabase = async (): Promise<void> => {};

await test("health returns 200 with the commit once the database answers", async () => {
  const app = createApp({ staticDir: null, pingDatabase: healthyDatabase, commitHash: "abc" });
  const res = await app.request("/api/health");
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { status: "ok", database: true, commit: "abc" });
});

await test("health returns 503 when the database is unreachable", async () => {
  const app = createApp({
    staticDir: null,
    pingDatabase: () => Promise.reject(new Error("connection refused")),
    commitHash: null,
  });
  const res = await app.request("/api/health");
  assert.equal(res.status, 503);
  assert.deepEqual(await res.json(), { status: "unavailable", database: false });
});

await test("unknown API routes return a JSON 404 instead of the app shell", async () => {
  const app = createApp({
    staticDir: await makeWebRoot(),
    pingDatabase: healthyDatabase,
    commitHash: null,
  });
  const res = await app.request("/api/nope");
  assert.equal(res.status, 404);
  assert.deepEqual(await res.json(), { error: "Not found" });
});

await test("client-side routes fall back to index.html", async () => {
  const app = createApp({
    staticDir: await makeWebRoot(),
    pingDatabase: healthyDatabase,
    commitHash: null,
  });
  const res = await app.request("/stats");
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type") ?? "", /text\/html/u);
  assert.equal(res.headers.get("cache-control"), "no-cache");
  assert.match(await res.text(), /shell/u);
});

await test("fingerprinted assets are served with a long-lived cache", async () => {
  const app = createApp({
    staticDir: await makeWebRoot(),
    pingDatabase: healthyDatabase,
    commitHash: null,
  });
  const res = await app.request("/assets/app-abc123.js");
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type") ?? "", /javascript/u);
  assert.equal(res.headers.get("cache-control"), "public, max-age=31536000, immutable");
  assert.equal(res.headers.get("x-content-type-options"), "nosniff");
});

await test("a missing file with an extension is a 404, not the app shell", async () => {
  const app = createApp({
    staticDir: await makeWebRoot(),
    pingDatabase: healthyDatabase,
    commitHash: null,
  });
  const res = await app.request("/assets/missing.js");
  assert.equal(res.status, 404);
});

await test("paths cannot escape the web root", () => {
  const root = "/srv/web";
  assert.equal(resolveInside(root, "/index.html"), "/srv/web/index.html");
  assert.equal(resolveInside(root, "/assets/../index.html"), "/srv/web/index.html");
  assert.equal(resolveInside(root, "/../etc/passwd"), null);
  assert.equal(resolveInside(root, "/%2e%2e/%2e%2e/etc/passwd"), null);
  assert.equal(resolveInside(root, "/a/../../../etc/passwd"), null);
  assert.equal(resolveInside(root, "/..%2fweb-other/secret"), null);
  assert.equal(resolveInside(root, "/%00"), null);
  assert.equal(resolveInside(root, "/%E0%A4%A"), null);
});
