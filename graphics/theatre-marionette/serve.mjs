import http from 'node:http';
import fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const root = path.join(project, 'output/motion/theatre-marionette');
const videoPath = path.join(root, 'theatre-marionette-atmosphere.mp4');
const temporaryPath = path.join(root, '.theatre-marionette.mp4.incoming');
const LIMIT = 60 * 1024 * 1024, PORT = 8978;
const hosts = new Set([`127.0.0.1:${PORT}`, `localhost:${PORT}`]);
const mime = { '.html': 'text/html; charset=utf-8', '.mjs': 'text/javascript', '.js': 'text/javascript', '.wasm': 'application/wasm', '.png': 'image/png', '.svg': 'image/svg+xml', '.mp4': 'video/mp4', '.txt': 'text/plain; charset=utf-8' };
let writing = false;
const fail = (response, status, text) => { if (!response.headersSent) response.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); response.end(text); };

http.createServer(async (request, response) => {
  if (!hosts.has(request.headers.host)) { fail(response, 403, 'Local preview only'); return; }
  let url;
  try { url = new URL(request.url, `http://${request.headers.host}`); } catch { fail(response, 400, 'Invalid URL'); return; }
  if (url.pathname === '/export') {
    if (request.method !== 'POST') { fail(response, 405, 'POST required'); return; }
    if (request.headers.origin !== `http://${request.headers.host}` || (request.headers['sec-fetch-site'] && request.headers['sec-fetch-site'] !== 'same-origin')) { fail(response, 403, 'Same-origin export required'); return; }
    if (request.headers['content-type']?.split(';')[0].trim() !== 'video/mp4') { fail(response, 415, 'MP4 required'); return; }
    const declared = Number(request.headers['content-length']);
    if (request.headers['content-length'] && (!Number.isSafeInteger(declared) || declared <= 0 || declared > LIMIT)) { fail(response, 413, 'Video exceeds limit'); return; }
    if (writing) { fail(response, 409, 'An export is already being saved'); return; }
    writing = true;
    try {
      const chunks = []; let count = 0;
      for await (const chunk of request) {
        count += chunk.length;
        if (count > LIMIT) { fail(response, 413, 'Video exceeds limit'); return; }
        chunks.push(chunk);
      }
      const bytes = Buffer.concat(chunks);
      if (bytes.length < 24 || bytes.toString('ascii', 4, 8) !== 'ftyp') { fail(response, 400, 'Invalid MP4'); return; }
      await fs.mkdir(root, { recursive: true });
      await fs.writeFile(temporaryPath, bytes);
      let savedPath = videoPath;
      try { await fs.rename(temporaryPath, savedPath); }
      catch (error) {
        // Windows video players can hold the previous file open. Preserve it
        // and atomically publish a new version instead of losing the export.
        if (!['EACCES', 'EPERM', 'EEXIST', 'EBUSY'].includes(error.code)) throw error;
        savedPath = path.join(root, `theatre-marionette-atmosphere-${Date.now()}.mp4`);
        await fs.rename(temporaryPath, savedPath);
      }
      response.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
      response.end(JSON.stringify({ file: path.basename(savedPath), bytes: bytes.length }));
    } catch (error) { console.error('MP4 export:', error.message); fail(response, 500, 'Export could not be saved'); }
    finally { writing = false; }
    return;
  }
  if (!['GET', 'HEAD'].includes(request.method)) { fail(response, 405, 'GET or HEAD required'); return; }
  try {
    const name = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname.slice(1));
    const file = path.resolve(root, name);
    if (!file.startsWith(root + path.sep) || path.basename(file).startsWith('.')) { fail(response, 403, 'Forbidden'); return; }
    const { size } = await fs.stat(file);
    const headers = { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
    let start = 0, end = size - 1, status = 200;
    if (path.extname(file) === '.mp4') {
      headers['Accept-Ranges'] = 'bytes';
      if (request.headers.range) {
        const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.range);
        if (!range || (!range[1] && !range[2])) { response.writeHead(416, { ...headers, 'Content-Range': `bytes */${size}` }).end(); return; }
        if (range[1]) { start = Number(range[1]); end = range[2] ? Math.min(Number(range[2]), size - 1) : size - 1; }
        else { const suffix = Number(range[2]); start = Math.max(0, size - suffix); }
        if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= size) { response.writeHead(416, { ...headers, 'Content-Range': `bytes */${size}` }).end(); return; }
        headers['Content-Range'] = `bytes ${start}-${end}/${size}`; status = 206;
      }
    }
    headers['Content-Length'] = size === 0 ? 0 : end - start + 1;
    response.writeHead(status, headers);
    if (request.method === 'HEAD' || size === 0) { response.end(); return; }
    const stream = createReadStream(file, { start, end }); stream.on('error', () => response.destroy()); stream.pipe(response);
  } catch { fail(response, 404, 'Not found'); }
}).listen(PORT, '127.0.0.1', () => console.log(`Theatre motion: http://127.0.0.1:${PORT}/`));
