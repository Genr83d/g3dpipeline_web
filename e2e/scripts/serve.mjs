#!/usr/bin/env node
/**
 * Serves the built app for the E2E suite.
 *
 * This exists because `vite preview` did not survive a full WebKit run: the
 * process disappeared partway through, and Playwright waits on a webServer
 * that dies rather than failing, so the run hung instead of reporting. A
 * dependency-free static server keeps the app's availability under our own
 * control, and there is nothing here to crash — it reads files off disk and
 * falls back to index.html for client-side routes.
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';

const ROOT = resolve(process.env.E2E_SERVE_ROOT ?? 'dist');
const PORT = Number(process.env.E2E_PORT ?? 5174);
const HOST = '127.0.0.1';

const TYPES = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.ico', 'image/x-icon'],
  ['.webmanifest', 'application/manifest+json'],
  ['.woff', 'font/woff'],
  ['.woff2', 'font/woff2'],
  ['.txt', 'text/plain; charset=utf-8'],
]);

/** Resolves a URL path inside ROOT, refusing anything that escapes it. */
function resolveWithinRoot(urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0]);
  const candidate = resolve(join(ROOT, normalize(decoded)));
  return candidate === ROOT || candidate.startsWith(ROOT + '/') ? candidate : null;
}

async function readIfFile(path) {
  try {
    const stats = await stat(path);
    if (!stats.isFile()) return null;
    return await readFile(path);
  } catch {
    return null;
  }
}

const server = createServer(async (request, response) => {
  const path = resolveWithinRoot(request.url ?? '/');
  if (!path) {
    response.writeHead(403).end('Forbidden');
    return;
  }

  let body = await readIfFile(path);
  let file = path;

  // Client-side routes have no file of their own; the SPA shell answers them.
  if (body === null) {
    file = join(ROOT, 'index.html');
    body = await readIfFile(file);
  }

  if (body === null) {
    response.writeHead(404).end('Not found');
    return;
  }

  // The suite rebuilds every run, so the shell must never be cached: a stale
  // index.html would point at the old bundle. Files under /assets/ carry a
  // content hash in their name, so a rebuild changes their URLs and caching
  // them can never hide new code. They are served immutable, as production
  // serves them. Without that, Firefox re-fetches the bundled JetBrains Mono
  // on every navigation, a test that navigates in a loop cancels one fetch
  // mid-flight, and the console error ("downloadable font: download failed …
  // status=2152398850") fails the test. serveInterFromDisk fixes the same
  // problem for Inter.
  const hashedAsset = file.startsWith(join(ROOT, 'assets') + '/');
  response.writeHead(200, {
    'Content-Type': TYPES.get(extname(file)) ?? 'application/octet-stream',
    'Cache-Control': hashedAsset ? 'public, max-age=31536000, immutable' : 'no-store',
  });
  response.end(body);
});

server.listen(PORT, HOST, () => {
  console.log(`[serve] ${ROOT} on http://${HOST}:${PORT}`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
