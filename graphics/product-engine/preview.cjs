/** Production export preview with cached compression, no source or user files. */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const root = path.resolve(__dirname, '../../.expo-rust-web-export');
const port = Number(process.env.GRAPHICS_PREVIEW_PORT || 8088);
const cache = new Map();
const mime = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.wasm':'application/wasm', '.css':'text/css', '.json':'application/json', '.svg':'image/svg+xml', '.png':'image/png', '.jpg':'image/jpeg', '.webp':'image/webp', '.ttf':'font/ttf', '.woff2':'font/woff2' };
function asset(filename) {
  const stat = fs.statSync(filename), old = cache.get(filename);
  if (old && old.mtime === stat.mtimeMs && old.raw.length === stat.size) return old;
  const raw = fs.readFileSync(filename), compress = /\.(html|js|wasm|css|json|svg)$/.test(filename);
  const value = { mtime:stat.mtimeMs, raw,
    br:compress ? zlib.brotliCompressSync(raw, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]:5 } }) : null,
    gzip:compress ? zlib.gzipSync(raw, { level:6 }) : null };
  cache.set(filename,value); return value;
}
const server = http.createServer((req,res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    const filename = path.resolve(root, '.' + decodeURIComponent(url.pathname));
    if (filename !== root && !filename.startsWith(root + path.sep)) { res.writeHead(403); return res.end(); }
    let file = filename;
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      if (path.extname(url.pathname)) { res.writeHead(404); return res.end(); }
      file = path.join(root,'index.html');
    }
    const data = asset(file), accepted = req.headers['accept-encoding'] || '';
    const encoding = /\bbr\b/.test(accepted) && data.br ? 'br' : /\bgzip\b/.test(accepted) && data.gzip ? 'gzip' : null;
    const body = encoding ? data[encoding] : data.raw;
    res.writeHead(200, { 'Content-Type':mime[path.extname(file)] || 'application/octet-stream',
      'Content-Length':body.length, 'Cache-Control':'no-store', 'Vary':'Accept-Encoding', ...(encoding ? {'Content-Encoding':encoding} : {}) });
    res.end(req.method === 'HEAD' ? undefined : body);
  } catch { res.writeHead(500); res.end('Preview asset could not be loaded'); }
});
server.listen(port,'127.0.0.1',() => console.log(`Rust production preview http://127.0.0.1:${port}`));
