import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { prepareWebCache, isCacheAsset, ROUTES } from '../prepare-web-cache.mjs';
import { isCoreAsset } from './selection.mjs';

const ENGINE = '/graphics/pkg/watcher_graphics_bg.wasm';
const ENTRY = '/_expo/static/js/web/entry.js';
const GALLERY = '/graphics/gallery.webp', SCENE = '/graphics/scene-a/runtime.js', ATLAS = '/graphics/pkg/assets/atlas.0123456789ab.png';
const SCENES = [GALLERY, SCENE, ATLAS];
const at = url => 'https://watcher.test' + url;
const CELLULAR = () => ({ type: 'cellular', effectiveType: '4g', saveData: false });

async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'watcher-cache-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const files = {
    'index.html': '<html><body>Watcher\n</body></html>',
    'graphics/pkg/watcher_graphics_bg.wasm': 'engine-v1',
    '_expo/static/js/web/entry.js': 'application-v1',
    'assets/font.ttf': 'font-v1',
    'assets/icon@2x.png': 'retina-icon',
    'assets/node_modules/expo-router/error.png': 'router-icon',
    'assets/private-answer.webm': 'not-for-cache',
    'graphics/gallery.webp': 'illustration-v1',
    'graphics/scene-a/runtime.js': 'scene-a-v1',
    'graphics/pkg/assets/atlas.0123456789ab.png': 'atlas-v1',
  };
  for (const [name, value] of Object.entries(files)) await write(root, name, value);
  const release = await prepareWebCache(root);
  return { root, release };
}
async function write(root, name, value) {
  await fs.mkdir(path.dirname(path.join(root, name)), { recursive: true });
  await fs.writeFile(path.join(root, name), value);
}
function storage() {
  const buckets = new Map();
  const key = url => new URL(typeof url === 'string' ? url : url.url, 'https://watcher.test').href;
  const result = {
    failPut: false,
    async keys() { return [...buckets.keys()]; },
    async delete(name) { return buckets.delete(name); },
    async open(name) {
      if (!buckets.has(name)) buckets.set(name, new Map());
      const bucket = buckets.get(name);
      return {
        async match(url) { return bucket.get(key(url))?.clone(); },
        async put(url, response) { if (result.failPut) throw new Error('QuotaExceededError'); bucket.set(key(url), response.clone()); },
        async keys() { return [...bucket.keys()].map(url => ({ url })); },
        async delete(url) { return bucket.delete(key(url)); },
      };
    },
  };
  return result;
}
const snapshots = async caches => (await caches.keys()).filter(name => name.startsWith('watcher-graphics-v1-'));
async function kept(caches, version) {
  return (await (await caches.open('watcher-graphics-v1-' + version)).keys()).map(request => new URL(request.url).pathname).sort();
}
// `httpCache` is what the browser's HTTP cache holds; `requests` are real
// network downloads. `connection` is mutable so a test can leave Wi-Fi.
async function worker(root, caches, { estimate, clients = [], httpCache = new Map(), connection, agent, clock = { now: 1_000_000 }, onNetwork } = {}) {
  const listeners = new Map(), requests = [];
  let skipped = 0;
  const self = { location: { origin: 'https://watcher.test' }, skipWaiting: async () => { skipped++; }, clients: { claim: async () => {}, matchAll: async () => clients },
    addEventListener: (name, fn) => listeners.set(name, fn), navigator: { connection, userAgentData: agent } };
  if (estimate) self.navigator.storage = { estimate: async () => estimate };
  const context = { self, caches, crypto: webcrypto, URL, Response, Date: { now: () => clock.now },
    setTimeout: (callback, delay) => setTimeout(callback, delay).unref(),
    fetch: async (url, options = {}) => {
      const pathname = new URL(typeof url === 'string' ? url : url.url, self.location.origin).pathname;
      if (options.cache === 'only-if-cached') {
        if (httpCache.has(pathname)) return new Response(httpCache.get(pathname));
        throw new TypeError('Not in the HTTP cache');
      }
      if (options.cache === 'force-cache' && httpCache.has(pathname)) return new Response(httpCache.get(pathname));
      requests.push(pathname); onNetwork?.(pathname);
      try { return new Response(await fs.readFile(path.join(root, decodeURIComponent(pathname).slice(1)))); } catch { return new Response('', { status: 404 }); }
    } };
  for (const name of ['indexedDB', 'localStorage']) Object.defineProperty(context, name, { get() { throw new Error('Diary storage accessed'); } });
  vm.runInNewContext(await fs.readFile(path.join(root, 'graphics-cache-worker.js'), 'utf8'), context);
  async function lifecycle(name) {
    let promise;
    listeners.get(name)({ waitUntil(value) { promise = value; } });
    await promise;
  }
  function fetch(url, options = {}) {
    let promise;
    listeners.get('fetch')({ clientId: options.clientId, resultingClientId: options.resultingClientId, request: { url, method: 'GET', mode: 'cors', headers: new Headers(), ...options }, respondWith(value) { promise = value; } });
    return promise;
  }
  async function message(type, values = {}, id) {
    let promise, response;
    listeners.get('message')({ data: { type, ...values }, source: { id }, ports: [{ postMessage(value) { response = value; } }], waitUntil(value) { promise = value; } });
    await promise; return response;
  }
  return { lifecycle, fetch, requests, message, clients, skipped: () => skipped };
}
async function installed(root, caches, options) {
  const app = await worker(root, caches, options);
  await app.lifecycle('install'); await app.lifecycle('activate');
  return app;
}

test('manifest is deterministic, excludes audio and versions any asset/engine changes', async t => {
  const { root, release } = await fixture(t);
  assert.equal((await prepareWebCache(root)).version, release.version);
  assert.equal((await fs.readFile(path.join(root, 'index.html'), 'utf8')).match(/id="watcher-graphics-cache"/g).length, 1);
  assert.ok(!release.assets.some(asset => asset.url.endsWith('.webm')));
  assert.ok(!release.assets.some(asset => asset.url.includes('graphics-cache-version')));
  assert.equal(JSON.parse(await fs.readFile(path.join(root, 'graphics-cache-version.json'), 'utf8')).version, release.version);
  assert.match(await fs.readFile(path.join(root, 'index.html'), 'utf8'), new RegExp(`data-release="${release.version}"`));
  assert.ok(isCacheAsset('_expo/static/js/web/voice-files.js'));
  assert.ok(isCacheAsset('graphics/pkg/assets/insight.5cd3d1e53c3b.tracks.xml.z'));
  const app = JSON.parse(await fs.readFile(path.join(root, 'watcher.webmanifest'), 'utf8'));
  assert.equal(app.scope, '/'); assert.equal(app.start_url, '/'); assert.equal(app.display, 'standalone');
  for (const route of release.routes) assert.ok(new URL(route, 'https://watcher.test').href.startsWith(new URL(app.scope, 'https://watcher.test').href));
  assert.ok(release.assets.some(asset => asset.url === '/watcher.webmanifest'));
  assert.ok(release.assets.some(asset => asset.url === '/watcher-app-icon.png'));
  const html = await fs.readFile(path.join(root, 'index.html'), 'utf8');
  assert.equal((html.match(/rel="manifest"/g) ?? []).length, 1);
  assert.match(html, /name="apple-mobile-web-app-capable" content="yes"/);
  assert.match(html, /name="apple-mobile-web-app-status-bar-style" content="black-translucent"/);
  assert.equal((html.match(/id="watcher-app-page"/g) ?? []).length, 1);
  assert.equal((html.match(/name="viewport"[^>]*viewport-fit=cover/g) ?? []).length, 1);
  assert.ok(!isCacheAsset('graphics/audio.mp3'));
  // The selection rules are inlined into a classic worker script.
  const source = await fs.readFile(path.join(root, 'graphics-cache-worker.js'), 'utf8');
  assert.doesNotMatch(source, /^export /m); assert.match(source, /function networkAllowsFull/); assert.doesNotMatch(source, /__WATCHER_/);
  assert.doesNotThrow(() => new vm.Script(source));
  await fs.writeFile(path.join(root, 'graphics/pkg/watcher_graphics_bg.wasm'), 'engine-v2');
  assert.notEqual((await prepareWebCache(root)).version, release.version);
});
test('every app screen, Intensive and Admin included, opens from the cached shell', async () => {
  const screens = new Set();
  async function walk(directory, prefix) {
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      if (entry.isDirectory()) { await walk(path.join(directory, entry.name), /^\(.*\)$/.test(entry.name) ? prefix : `${prefix}/${entry.name}`); continue; }
      const name = entry.name.replace(/(?:\.web)?\.tsx?$/, '');
      if (name === entry.name || name.startsWith('_') || name.startsWith('+')) continue;
      screens.add(name === 'index' ? prefix || '/' : `${prefix}/${name}`);
    }
  }
  await walk(fileURLToPath(new URL('../../src/app', import.meta.url)), '');
  assert.ok(screens.has('/intensive') && screens.has('/admin'));
  for (const screen of screens) assert.ok(ROUTES.includes(screen), `${screen} is missing from the offline routes`);
});
test('warm core: engine, app code and navigation need no further network fetch', async t => {
  const { root } = await fixture(t), app = await worker(root, storage());
  await app.lifecycle('install');
  const count = app.requests.length;
  assert.ok(!SCENES.some(url => app.requests.includes(url)), 'install keeps to the part');
  assert.equal(await (await app.fetch(at(ENGINE))).text(), 'engine-v1');
  assert.equal(await (await app.fetch(at(ENTRY))).text(), 'application-v1');
  assert.match(await (await app.fetch(at('/diary'), { mode: 'navigate' })).text(), /Watcher/);
  for (const route of ['/intensive', '/admin']) assert.match(await (await app.fetch(at(route), { mode: 'navigate' })).text(), /Watcher/);
  assert.equal(app.requests.length, count);
});
test('audio, blobs, APIs, external URLs, Range and non-GET pass through untouched', async t => {
  const { root } = await fixture(t), app = await worker(root, storage());
  for (const url of ['blob:https://watcher.test/123', at('/audio/a.webm'), at('/api/diary'), 'https://elsewhere.test' + ENGINE, at('/graphics-cache-version.json?check=123')]) assert.equal(app.fetch(url), undefined);
  assert.equal(app.fetch(at('/index.html'), { method: 'POST' }), undefined);
  assert.equal(app.fetch(at(ENGINE), { headers: new Headers({ Range: 'bytes=0-20' }) }), undefined);
  assert.equal(app.requests.length, 0);
});
test('corrupt/interrupted update deletes staging only; previous release still opens', async t => {
  const { root, release } = await fixture(t), caches = storage(), old = await worker(root, caches);
  await old.lifecycle('install');
  await fs.writeFile(path.join(root, 'graphics/pkg/watcher_graphics_bg.wasm'), 'engine-v2');
  const next = await prepareWebCache(root), update = await worker(root, caches);
  await fs.writeFile(path.join(root, 'graphics/pkg/watcher_graphics_bg.wasm'), 'corrupted');
  await assert.rejects(update.lifecycle('install'), /Incomplete asset|Release changed/);
  assert.deepEqual((await caches.keys()).sort(), ['watcher-graphics-v1-' + release.version, 'watcher-graphics-clients-v1'].sort());
  assert.equal(update.skipped(), 0);
  assert.ok(!((await caches.keys()).includes('watcher-graphics-v1-' + next.version)));
  assert.equal(await (await old.fetch(at(ENGINE))).text(), 'engine-v1');
});
test('complete update activates without closing tabs, and each client retains a consistent runtime', async t => {
  const { root, release } = await fixture(t), caches = storage(), clients = [{ id: 'recording-tab' }], old = await worker(root, caches, { clients });
  await caches.open('unrelated-audio-cache');
  await old.lifecycle('install');
  await old.message('WATCHER_GRAPHICS_CLIENT_RELEASE', { version: release.version }, clients[0].id);
  await fs.writeFile(path.join(root, 'graphics/pkg/watcher_graphics_bg.wasm'), 'engine-v2');
  await fs.writeFile(path.join(root, '_expo/static/js/web/entry.js'), 'application-v2');
  const next = await prepareWebCache(root), update = await worker(root, caches, { clients });
  await update.lifecycle('install');
  assert.equal(update.skipped(), 1);
  assert.ok((await caches.keys()).includes('watcher-graphics-v1-' + release.version));
  assert.equal(await (await old.fetch(at(ENGINE))).text(), 'engine-v1');
  await update.lifecycle('activate');
  assert.deepEqual((await caches.keys()).sort(), ['unrelated-audio-cache', 'watcher-graphics-clients-v1', 'watcher-graphics-v1-' + release.version, 'watcher-graphics-v1-' + next.version].sort());
  assert.equal(await (await update.fetch(at(ENGINE), { clientId: clients[0].id })).text(), 'engine-v1');
  assert.equal(await (await update.fetch(at(ENTRY), { clientId: clients[0].id })).text(), 'application-v1');
  assert.equal(await (await update.fetch(at(ENGINE))).text(), 'engine-v2');
  const shell = await update.fetch(at('/diary'), { mode: 'navigate', resultingClientId: 'reloaded-tab' });
  assert.match(await shell.text(), new RegExp(next.version));
  assert.equal(await (await update.fetch(at(ENGINE), { clientId: 'reloaded-tab' })).text(), 'engine-v2');
  assert.equal(await (await update.fetch(at(ENTRY), { clientId: 'reloaded-tab' })).text(), 'application-v2');
  const restarted = await worker(root, caches, { clients });
  assert.equal(await (await restarted.fetch(at(ENGINE), { clientId: clients[0].id })).text(), 'engine-v1');
  assert.equal(await (await restarted.fetch(at('/assets/node_modules/expo-router/error.png'), { clientId: clients[0].id })).text(), 'router-icon');
});

test('unchanged files are reused; storage keeps one release once no page needs the previous one', async t => {
  const { root, release } = await fixture(t), caches = storage(), clients = [{ id: 'draft' }], clock = { now: 1_000_000 };
  const old = await worker(root, caches, { clients, clock });
  const audio = await caches.open('unrelated-audio-cache'); await audio.put('/voice.webm', new Response('my voice'));
  await old.lifecycle('install'); await old.message('WATCHER_GRAPHICS_CLIENT_RELEASE', { version: release.version }, 'draft');
  await fs.writeFile(path.join(root, 'graphics/pkg/watcher_graphics_bg.wasm'), 'engine-v2');
  const second = await prepareWebCache(root), update = await worker(root, caches, { clients, clock });
  await update.lifecycle('install'); await update.lifecycle('activate');
  assert.deepEqual(update.requests, [ENGINE]);
  await fs.writeFile(path.join(root, 'graphics/pkg/watcher_graphics_bg.wasm'), 'engine-v3');
  const third = await prepareWebCache(root), latest = await worker(root, caches, { clients, clock });
  await latest.lifecycle('install'); await latest.lifecycle('activate');
  assert.ok((await caches.keys()).includes('watcher-graphics-v1-' + release.version), 'an open page keeps its release');
  assert.equal(await (await latest.fetch(at(ENGINE), { clientId: 'draft' })).text(), 'engine-v1');
  clients.length = 0; await latest.message('WATCHER_GRAPHICS_CACHE_CLEANUP');
  // Within a minute of the update the previous release stays for pages the
  // browser has not listed yet; older ones go at once.
  assert.deepEqual(await snapshots(caches), ['watcher-graphics-v1-' + second.version, 'watcher-graphics-v1-' + third.version]);
  clock.now += 60_000; await latest.message('WATCHER_GRAPHICS_CACHE_CLEANUP');
  assert.deepEqual(await snapshots(caches), ['watcher-graphics-v1-' + third.version]);
  const pins = (await (await caches.open('watcher-graphics-clients-v1')).keys()).map(request => request.url);
  assert.ok(!pins.some(url => url.includes('/client/')), 'pins of closed pages are swept');
  assert.equal(await (await audio.match('/voice.webm')).text(), 'my voice');
});
test('quota failure leaves existing cache intact and rejects incomplete install', async t => {
  const { root } = await fixture(t), caches = storage();
  await caches.open('unrelated-audio-cache'); caches.failPut = true;
  const app = await worker(root, caches);
  await assert.rejects(app.lifecycle('install'), /QuotaExceeded/);
  assert.deepEqual(await caches.keys(), ['unrelated-audio-cache']);
});
test('re-registering a complete release with full storage keeps the current snapshot', async t => {
  const { root } = await fixture(t), caches = storage(), app = await worker(root, caches);
  await app.lifecycle('install'); const before = await caches.keys(); caches.failPut = true;
  const repeated = await worker(root, caches); await repeated.lifecycle('install');
  assert.deepEqual(await caches.keys(), before); assert.equal(repeated.requests.length, 0);
  assert.equal(await (await app.fetch(at(ENGINE))).text(), 'engine-v1');
});
test('low free space skips download and keeps space for voice data', async t => {
  const { root } = await fixture(t), caches = storage();
  await caches.open('unrelated-audio-cache');
  const app = await worker(root, caches, { estimate: { quota: 50 * 1024 * 1024, usage: 40 * 1024 * 1024 } });
  await assert.rejects(app.lifecycle('install'), /Not enough free storage/);
  assert.equal(app.requests.length, 0);
  assert.deepEqual(await caches.keys(), ['unrelated-audio-cache']);
});
test('hosting HTML injection cannot invalidate or pollute the cached exported shell', async t => {
  const { root } = await fixture(t), app = await worker(root, storage());
  await fs.appendFile(path.join(root, 'index.html'), '<script>hosting-injected-script()</script>');
  await app.lifecycle('install');
  const shell = await (await app.fetch(at('/diary'), { mode: 'navigate' })).text();
  assert.match(shell, /Watcher/);
  assert.ok(!shell.includes('hosting-injected-script'));
  assert.ok(!app.requests.includes('/index.html'));
});
test('router and Retina icons download from portable paths and retain app URL aliases', async t => {
  const { root, release } = await fixture(t), app = await worker(root, storage());
  assert.ok(release.assets.some(asset => asset.url.startsWith('/graphics-cache-assets/') && asset.aliases?.includes('/assets/icon@2x.png')));
  assert.ok(!release.assets.some(asset => asset.url.includes('/node_modules/') || asset.url.includes('@')));
  await app.lifecycle('install');
  assert.ok(app.requests.some(url => url.startsWith('/graphics-cache-assets/')));
  assert.equal(await (await app.fetch(at('/assets/icon%402x.png'))).text(), 'retina-icon');
  assert.equal(await (await app.fetch(at('/assets/node_modules/expo-router/error.png'))).text(), 'router-icon');
});
test('install reuses what the page already downloaded and refreshes only stale copies', async t => {
  const { root } = await fixture(t);
  const http = new Map([[ENTRY, 'application-v1'], [ENGINE, 'engine-v0']]);
  const app = await worker(root, storage(), { httpCache: http });
  await app.lifecycle('install');
  assert.ok(!app.requests.includes(ENTRY));
  assert.deepEqual(app.requests.filter(url => url === ENGINE), [ENGINE]);
  assert.equal(await (await app.fetch(at(ENGINE))).text(), 'engine-v1');
});

test('on mobile data a first visit keeps the core and what the page loaded, without downloading it twice', async t => {
  const { root, release } = await fixture(t), caches = storage();
  // Before the worker existed, the page loaded the engine, app code and the current scene.
  const http = new Map([[ENGINE, 'engine-v1'], [ENTRY, 'application-v1'], [SCENE, 'scene-a-v1']]);
  const app = await installed(root, caches, { connection: CELLULAR(), httpCache: http });
  assert.ok(![ENGINE, ENTRY, ...SCENES].some(url => app.requests.includes(url)));
  const status = await app.message('WATCHER_GRAPHICS_CACHE_FILL', { paths: [SCENE, GALLERY, '/api/diary', 42] });
  assert.equal(status.fullAllowed, false); assert.equal(status.full, false);
  const core = release.assets.filter(asset => isCoreAsset(asset.url)).map(asset => asset.url);
  assert.deepEqual(await kept(caches, release.version), [...core, SCENE].sort());
  assert.ok(!SCENES.some(url => app.requests.includes(url)), 'nothing else downloads on mobile data');
  // A page that opens the gallery downloads it once and keeps it.
  for (let i = 0; i < 2; i++) assert.equal(await (await app.fetch(at(GALLERY))).text(), 'illustration-v1');
  assert.deepEqual(app.requests.filter(url => SCENES.includes(url)), [GALLERY]);
  assert.equal((await app.message('WATCHER_GRAPHICS_CACHE_STATUS')).keptAssets, core.length + 2);
});
test('on Wi-Fi the rest downloads after install; leaving Wi-Fi pauses it and the next check resumes', async t => {
  const { root, release } = await fixture(t), caches = storage(), connection = { type: 'wifi', effectiveType: '4g', saveData: false };
  let scenes = 0;
  const app = await installed(root, caches, { connection, onNetwork: url => { if (SCENES.includes(url) && ++scenes === 2) connection.type = 'cellular'; } });
  assert.equal(scenes, 0, 'install keeps to the part, so the first page opens sooner');
  assert.equal((await app.message('WATCHER_GRAPHICS_CACHE_FILL', { paths: [] })).fullAllowed, true);
  assert.equal(scenes, 2, 'the files in flight finish; no new ones start on mobile data');
  let status = await app.message('WATCHER_GRAPHICS_CACHE_STATUS');
  assert.equal(status.full, false); assert.equal(status.keptAssets, release.assets.length - 1);
  connection.type = 'wifi';
  await app.message('WATCHER_GRAPHICS_CACHE_FILL');
  status = await app.message('WATCHER_GRAPHICS_CACHE_STATUS');
  assert.equal(status.full, true); assert.equal(status.keptBytes, release.bytes);
  assert.equal(scenes, 3, 'no file downloads twice');
  const count = app.requests.length;
  for (const url of SCENES) await app.fetch(at(url));
  assert.equal(app.requests.length, count, 'everything opens offline');
});
test('Data Saver and an unknown link keep to the part; desktop Chrome without a link type downloads everything', async t => {
  const { root } = await fixture(t);
  for (const connection of [{ type: 'wifi', effectiveType: '4g', saveData: true }, undefined, { effectiveType: '4g' }]) {
    const app = await installed(root, storage(), { connection });
    await app.message('WATCHER_GRAPHICS_CACHE_FILL', { paths: [] });
    assert.ok(!SCENES.some(url => app.requests.includes(url)), JSON.stringify(connection));
  }
  const desktop = await installed(root, storage(), { connection: { effectiveType: '4g', saveData: false }, agent: { mobile: false } });
  await desktop.message('WATCHER_GRAPHICS_CACHE_FILL', { paths: [] });
  assert.equal((await desktop.message('WATCHER_GRAPHICS_CACHE_STATUS')).full, true);
});
test('full storage stops the Wi-Fi download quietly and keeps the snapshot', async t => {
  const { root } = await fixture(t), caches = storage();
  const app = await installed(root, caches, { connection: { type: 'wifi' } });
  caches.failPut = true;
  assert.equal((await app.message('WATCHER_GRAPHICS_CACHE_FILL', { paths: [] })).full, false);
  assert.equal((await app.message('WATCHER_GRAPHICS_CACHE_STATUS')).full, false);
  assert.equal(await (await app.fetch(at(ENGINE))).text(), 'engine-v1');
});
test('an update on mobile data downloads only the changed files the device kept', async t => {
  const { root } = await fixture(t), caches = storage(), connection = CELLULAR(), clock = { now: 1_000_000 };
  const old = await installed(root, caches, { connection, clock });
  for (const url of [SCENE, ATLAS]) await old.fetch(at(url));
  // New engine, a redrawn atlas under a new hash and a new gallery; scene A unchanged.
  await write(root, 'graphics/pkg/watcher_graphics_bg.wasm', 'engine-v2');
  await fs.rm(path.join(root, 'graphics/pkg/assets/atlas.0123456789ab.png'));
  await write(root, 'graphics/pkg/assets/atlas.fedcba987654.png', 'atlas-v2');
  await write(root, 'graphics/gallery.webp', 'illustration-v2');
  const next = await prepareWebCache(root), update = await worker(root, caches, { connection, clock });
  await update.lifecycle('install');
  assert.deepEqual(update.requests.sort(), [ENGINE, '/graphics/pkg/assets/atlas.fedcba987654.png'].sort());
  const core = next.assets.filter(asset => isCoreAsset(asset.url)).map(asset => asset.url);
  assert.deepEqual(await kept(caches, next.version), [...core, SCENE, '/graphics/pkg/assets/atlas.fedcba987654.png'].sort());
  await update.lifecycle('activate');
  clock.now += 60_000; await update.message('WATCHER_GRAPHICS_CACHE_CLEANUP');
  assert.deepEqual(await snapshots(caches), ['watcher-graphics-v1-' + next.version]);
  assert.equal(await (await update.fetch(at(SCENE))).text(), 'scene-a-v1');
  assert.equal(update.requests.length, 2);
});
test('a page of the previous release never gets a file of the new one', async t => {
  const { root, release } = await fixture(t), caches = storage(), connection = CELLULAR(), clients = [{ id: 'old-tab' }];
  const old = await installed(root, caches, { connection, clients });
  await old.message('WATCHER_GRAPHICS_CLIENT_RELEASE', { version: release.version }, 'old-tab');
  await write(root, 'graphics/gallery.webp', 'illustration-v2');
  await prepareWebCache(root);
  const update = await installed(root, caches, { connection, clients });
  // The old page never opened the gallery, and the server now has only new bytes.
  const stale = await update.fetch(at(GALLERY), { clientId: 'old-tab' });
  assert.equal(stale.status, 503); assert.equal(await stale.text(), '');
  // Unchanged files it has not kept yet still come, checked against its own release.
  assert.equal(await (await update.fetch(at(SCENE), { clientId: 'old-tab' })).text(), 'scene-a-v1');
  // After its reload the page is on the new release.
  assert.equal(await (await update.fetch(at(GALLERY), { clientId: 'reloaded-tab' })).text(), 'illustration-v2');
});
