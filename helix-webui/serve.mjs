// Static server for the built Web UI with SPA fallback (stdlib only, replaces nginx for the npx stack).
// ponytail: single-threaded, no caching/gzip; fine for a local single-user app.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(process.argv[2] ?? 'dist');
const port = Number(process.env.PORT ?? 80);
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
};

async function send(res, file) {
  const body = await readFile(file); // throws for missing files and directories
  res.writeHead(200, { 'Content-Type': types[path.extname(file)] ?? 'application/octet-stream' });
  res.end(body);
}

createServer(async (req, res) => {
  // path.normalize resolves ".." segments, so the joined path always stays under root.
  const rel = path.normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname));
  try {
    await send(res, path.join(root, rel));
  } catch {
    await send(res, path.join(root, 'index.html')).catch(() => res.writeHead(404).end());
  }
}).listen(port, () => console.log(`Web UI listening on ${port}`));
