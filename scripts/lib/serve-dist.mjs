/**
 * Serve the built site (dist/) under its configured base, the way GitHub Pages
 * does: directories get index.html, and any missing path gets dist/404.html
 * with status 404. Used by scripts/verify.mjs and scripts/og.mjs.
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

export const dist = fileURLToPath(new URL('../../dist', import.meta.url));

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.pdf': 'application/pdf',
  '.xml': 'application/xml',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
};

/** The base the build was made for (e.g. "/portfolio/"), read from the homepage's canonical link. */
export async function buildBase() {
  const html = await readFile(join(dist, 'index.html'), 'utf8');
  const canonical = html.match(/<link rel="canonical" href="([^"]+)"/)?.[1];
  return canonical ? new URL(canonical).pathname.replace(/\/?$/, '/') : '/';
}

/** Start the server; resolves to { origin, base, close }. */
export async function serveDist(port) {
  const base = await buildBase();
  const notFound = async (res) => {
    try {
      res.writeHead(404, { 'content-type': TYPES['.html'] });
      res.end(await readFile(join(dist, '404.html')));
    } catch {
      res.writeHead(404).end('Not found');
    }
  };
  const server = createServer(async (req, res) => {
    const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (!path.startsWith(base)) return notFound(res);
    let file = normalize(join(dist, path.slice(base.length)));
    if (!file.startsWith(dist)) return res.writeHead(403).end();
    try {
      if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
      const body = await readFile(file);
      res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
      res.end(body);
    } catch {
      await notFound(res);
    }
  });
  await new Promise((resolve) => server.listen(port, resolve));
  return {
    origin: `http://localhost:${port}`,
    base,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}
