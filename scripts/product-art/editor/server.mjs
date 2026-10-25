import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const run = promisify(execFile);
const here = path.dirname(fileURLToPath(import.meta.url));
const projectArg = process.argv.indexOf('--project');
const project = path.resolve(projectArg >= 0 ? process.argv[projectArg + 1] : path.join(here, '../../..'));
const assets = path.join(project, 'graphics/product-engine/engine/assets');
const engine = path.join(project, 'graphics/product-engine/engine');
const localRust = path.join(project, '.local-rust');
const backups = path.join(project, '.local-preview/animation-editor/backups');
const port = Number(process.env.PORT || 4179);
const scenes = ['hero-discernment', 'life-book', 'body-breath', 'body-senses', 'author-intention'];
const hash = data => createHash('sha256').update(data).digest('hex');
const json = (res, status, body) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(body)); };
const fail = (res, error) => json(res, error.status || 500, { error: error.message });
async function assetNames() { return (await fs.readdir(assets)).filter(name => /^task-[a-z0-9-]+\.svg$/.test(name)).sort(); }
async function assetPath(name) { if (!(await assetNames()).includes(name)) throw Object.assign(new Error('Unknown asset'), {status: 404}); return path.join(assets, name); }
async function readBody(req) {
  let raw = '';
  for await (const chunk of req) { raw += chunk; if (raw.length > 1_000_000) throw Object.assign(new Error('Request too large'), {status: 413}); }
  return JSON.parse(raw);
}
async function backup(name, source) {
  await fs.mkdir(backups, {recursive: true});
  const filename = `${name}.${new Date().toISOString().replaceAll(':', '-')}.${hash(source).slice(0, 8)}.bak`;
  await fs.writeFile(path.join(backups, filename), source, {flag: 'wx'});
}
async function writeAsset(name, source, previous) {
  const filename = await assetPath(name);
  await backup(name, previous);
  const temporary = `${filename}.${process.pid}.tmp`;
  try { await fs.writeFile(temporary, source, 'utf8'); await fs.rename(temporary, filename); }
  finally { await fs.rm(temporary, {force: true}); }
}
function replacePaths(source, changes) {
  const replacements = new Map();
  for (const {index, d} of changes) {
    if (!Number.isInteger(index) || index < 0 || typeof d !== 'string' || d.length > 20000 || !/^[MmLlHhVvCcSsQqTtAaZz0-9eE+.,\s-]+$/.test(d)) throw Object.assign(new Error('Invalid path edit'), {status: 400});
    replacements.set(index, d);
  }
  let index = 0;
  const updated = source.replace(/<path\b[^>]*>/g, tag => {
    const newPath = replacements.get(index++);
    if (newPath === undefined) return tag;
    if (!/\bd="[^"]*"/.test(tag)) throw Object.assign(new Error('Path has no d attribute'), {status: 400});
    return tag.replace(/\bd="[^"]*"/, `d="${newPath}"`);
  });
  if ([...replacements.keys()].some(key => key >= index)) throw Object.assign(new Error('Path index out of range'), {status: 400});
  return updated;
}
async function route(req, res) {
  const url = new URL(req.url, `http://127.0.0.1:${port}`);
  if (req.method === 'GET' && url.pathname === '/') { res.writeHead(200, {'Content-Type': 'text/html; charset=utf-8'}); return res.end(await fs.readFile(path.join(here, 'index.html'))); }
  if (req.method === 'GET' && url.pathname === '/editor.mjs') { res.writeHead(200, {'Content-Type': 'text/javascript; charset=utf-8'}); return res.end(await fs.readFile(path.join(here, 'editor.mjs'))); }
  if (req.method === 'GET' && url.pathname === '/path-data.mjs') { res.writeHead(200, {'Content-Type': 'text/javascript; charset=utf-8'}); return res.end(await fs.readFile(path.join(here, 'path-data.mjs'))); }
  if (req.method === 'GET' && url.pathname === '/api/catalog') return json(res, 200, {assets: await assetNames(), scenes});
  if (req.method === 'GET' && url.pathname === '/api/asset') { const name = url.searchParams.get('name'); const source = await fs.readFile(await assetPath(name), 'utf8'); return json(res, 200, {name, source, hash: hash(source)}); }
  if (req.method === 'GET' && url.pathname === '/api/preview') {
    const kind = url.searchParams.get('kind');
    if (!scenes.includes(kind)) throw Object.assign(new Error('Unknown scene'), {status: 404});
    const localCargo = path.join(localRust, 'cargo/bin/cargo.exe');
    const cargo = await fs.access(localCargo).then(() => localCargo).catch(() => 'cargo');
    const env = cargo === localCargo ? {...process.env, CARGO_HOME:path.join(localRust,'cargo'), RUSTUP_HOME:path.join(localRust,'rustup')} : process.env;
    const {stdout} = await run(cargo, ['run', '--quiet', '--offline', '--example', 'animation_editor_preview', '--', kind], {cwd: engine, env, maxBuffer: 16_000_000, timeout: 120_000});
    res.writeHead(200, {'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store'}); return res.end(stdout);
  }
  if (req.method === 'POST' && url.pathname === '/api/save') {
    const {name, baseHash, changes} = await readBody(req);
    const filename = await assetPath(name), old = await fs.readFile(filename, 'utf8');
    if (baseHash !== hash(old)) throw Object.assign(new Error('Asset changed on disk. Reload before saving.'), {status: 409});
    if (!Array.isArray(changes) || !changes.length) throw Object.assign(new Error('No path edits'), {status: 400});
    const source = replacePaths(old, changes);
    if (source !== old) await writeAsset(name, source, old);
    return json(res, 200, {name, source, hash: hash(source)});
  }
  if (req.method === 'GET' && url.pathname === '/api/backups') { const name = url.searchParams.get('name'); await assetPath(name); const files = await fs.readdir(backups).catch(() => []); return json(res, 200, {backups: files.filter(file => file.startsWith(`${name}.`) && file.endsWith('.bak')).sort().reverse()}); }
  if (req.method === 'POST' && url.pathname === '/api/restore') {
    const {name, baseHash, backupName} = await readBody(req); const filename = await assetPath(name), old = await fs.readFile(filename, 'utf8');
    if (baseHash !== hash(old)) throw Object.assign(new Error('Asset changed on disk. Reload before restoring.'), {status: 409});
    if (typeof backupName !== 'string' || !backupName.startsWith(`${name}.`) || !backupName.endsWith('.bak') || path.basename(backupName) !== backupName) throw Object.assign(new Error('Invalid backup'), {status: 400});
    const source = await fs.readFile(path.join(backups, backupName), 'utf8'); await writeAsset(name, source, old);
    return json(res, 200, {name, source, hash: hash(source)});
  }
  throw Object.assign(new Error('Not found'), {status: 404});
}
export function start() { return http.createServer((req, res) => void route(req, res).catch(error => fail(res, error))).listen(port, '127.0.0.1', () => console.log(`Animation editor: http://127.0.0.1:${port}`)); }
if (process.argv[1] === fileURLToPath(import.meta.url)) start();
