import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');
const publicRoot = path.join(root, 'public');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.wasm': 'application/wasm', '.png': 'image/png', '.webp': 'image/webp' };
const port = Number(process.env.PORT || 9015);
http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://localhost');
    const file = url.pathname === '/' ? path.join(here, 'index.html') : path.resolve(publicRoot, '.' + decodeURIComponent(url.pathname));
    if (file !== path.join(here, 'index.html') && !file.startsWith(publicRoot + path.sep)) throw Error('Outside public');
    const data = await readFile(file);
    response.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
    response.end(data);
  } catch { response.writeHead(404); response.end('Not found'); }
}).listen(port, '127.0.0.1', () => console.log(`Witnessing preview: http://127.0.0.1:${port}`));
