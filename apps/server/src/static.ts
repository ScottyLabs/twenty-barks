import { readFile as readFileBytes, stat } from "node:fs/promises";
import { extname, join, normalize, sep } from "node:path";

/** Content types for the files a Vite build emits. Anything else is served as a download. */
const CONTENT_TYPES: Readonly<Partial<Record<string, string>>> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
  ".webmanifest": "application/manifest+json",
};

/** Vite fingerprints everything under assets/, so those files never change at a given URL. */
const IMMUTABLE_PREFIX = "/assets/";

/**
 * Resolve a URL path to a file inside `root`, or null when it would escape `root`.
 *
 * The path is decoded and normalized before the containment check, so `..` segments and their percent-encoded forms cannot reach outside the directory.
 */
export function resolveInside(root: string, urlPath: string): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(urlPath);
  } catch {
    return null;
  }
  if (decoded.includes("\0")) {
    return null;
  }
  const base = normalize(root);
  const candidate = normalize(join(base, decoded));
  const prefix = base.endsWith(sep) ? base : base + sep;
  return candidate === base || candidate.startsWith(prefix) ? candidate : null;
}

function isMissingFileError(error: unknown): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    (error.code === "ENOENT" || error.code === "ENOTDIR")
  );
}

async function readFile(path: string): Promise<Uint8Array | null> {
  try {
    const info = await stat(path);
    return info.isFile() ? await readFileBytes(path) : null;
  } catch (error) {
    if (isMissingFileError(error)) {
      return null;
    }
    throw error;
  }
}

function fileResponse(body: Uint8Array, path: string, cacheControl: string): Response {
  return new Response(body.slice().buffer, {
    headers: {
      "content-type": CONTENT_TYPES[extname(path).toLowerCase()] ?? "application/octet-stream",
      "cache-control": cacheControl,
    },
  });
}

/**
 * Serve the built web app from `root`, falling back to index.html for client-side routes.
 *
 * A request for a missing file that has an extension gets a 404 instead of the app shell, so a broken asset link fails visibly rather than returning HTML.
 */
export async function serveWebApp(root: string, urlPath: string): Promise<Response> {
  const path = resolveInside(root, urlPath);
  if (path === null) {
    return new Response("Not found", { status: 404 });
  }

  const file = await readFile(path);
  if (file !== null) {
    const cacheControl = urlPath.startsWith(IMMUTABLE_PREFIX)
      ? "public, max-age=31536000, immutable"
      : "no-cache";
    return fileResponse(file, path, cacheControl);
  }

  if (extname(urlPath) !== "") {
    return new Response("Not found", { status: 404 });
  }

  const index = await readFile(join(root, "index.html"));
  if (index === null) {
    return new Response("Web app not built", { status: 503 });
  }
  return fileResponse(index, "index.html", "no-cache");
}
