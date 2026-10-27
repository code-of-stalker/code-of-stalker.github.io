import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import { prepareWebCache, isCacheAsset } from '../prepare-web-cache.mjs';

async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'watcher-cache-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const files = {
    'index.html': '<html><body>Watcher\n</body></html>',
    'graphics/gallery.webp': 'illustration-v1',
    'graphics/pkg/engine.wasm': 'engine-v1',
    '_expo/static/js/web/entry.js': 'application-v1',
    'assets/font.ttf': 'font-v1',
    'assets/icon@2x.png': 'retina-icon',
    'assets/node_modules/expo-router/error.png': 'router-icon',
    'assets/private-answer.webm': 'not-for-cache',
  };
  for (const [name, value] of Object.entries(files)) {
    await fs.mkdir(path.dirname(path.join(root, name)), { recursive: true });
    await fs.writeFile(path.join(root, name), value);
  }
  const release = await prepareWebCache(root);
  return { root, release };
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
async function worker(root, caches, estimate, clients = [], httpCache = new Map()) {
  const listeners = new Map(), requests = [];
  let skipped = 0;
  const self = { location: { origin: 'https://watcher.test' }, skipWaiting: async () => { skipped++; }, clients: { claim: async () => {}, matchAll: async () => clients }, addEventListener: (name, fn) => listeners.set(name, fn) };
  if (estimate) self.navigator = { storage: { estimate: async () => estimate } };
  const context = { self, caches, crypto: webcrypto, URL, Response, fetch: async (url, options = {}) => {
    const pathname = new URL(typeof url === 'string' ? url : url.url, self.location.origin).pathname;
    if (options.cache === 'force-cache' && httpCache.has(pathname)) return new Response(httpCache.get(pathname));
    requests.push(pathname);
    return new Response(await fs.readFile(path.join(root, decodeURIComponent(pathname).slice(1))));
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
  assert.ok(!isCacheAsset('graphics/audio.mp3'));
  await fs.writeFile(path.join(root, 'graphics/pkg/engine.wasm'), 'engine-v2');
  assert.notEqual((await prepareWebCache(root)).version, release.version);
});
test('warm graphics, engine and app navigation need no further network fetch', async t => {
  const { root } = await fixture(t), caches = storage(), app = await worker(root, caches);
  await app.lifecycle('install');
  const count = app.requests.length;
  assert.equal(await (await app.fetch('https://watcher.test/graphics/pkg/engine.wasm')).text(), 'engine-v1');
  assert.match(await (await app.fetch('https://watcher.test/diary', { mode: 'navigate' })).text(), /Watcher/);
  assert.equal(app.requests.length, count);
});
test('audio, blobs, APIs, external URLs, Range and non-GET pass through untouched', async t => {
  const { root } = await fixture(t), app = await worker(root, storage());
  for (const url of ['blob:https://watcher.test/123', 'https://watcher.test/audio/a.webm', 'https://watcher.test/api/diary', 'https://elsewhere.test/graphics/pkg/engine.wasm', 'https://watcher.test/graphics-cache-version.json?check=123']) assert.equal(app.fetch(url), undefined);
  assert.equal(app.fetch('https://watcher.test/index.html', { method: 'POST' }), undefined);
  assert.equal(app.fetch('https://watcher.test/graphics/pkg/engine.wasm', { headers: new Headers({ Range: 'bytes=0-20' }) }), undefined);
  assert.equal(app.requests.length, 0);
});
test('corrupt/interrupted update deletes staging only; previous release still opens', async t => {
  const { root, release } = await fixture(t), caches = storage(), old = await worker(root, caches);
  await old.lifecycle('install');
  await fs.writeFile(path.join(root, 'graphics/pkg/engine.wasm'), 'engine-v2');
  const next = await prepareWebCache(root), update = await worker(root, caches);
  await fs.writeFile(path.join(root, 'graphics/pkg/engine.wasm'), 'corrupted');
  await assert.rejects(update.lifecycle('install'), /Incomplete asset|Release changed/);
  assert.deepEqual((await caches.keys()).sort(), ['watcher-graphics-v1-' + release.version, 'watcher-graphics-clients-v1'].sort());
  assert.equal(update.skipped(), 0);
  assert.ok(!((await caches.keys()).includes('watcher-graphics-v1-' + next.version)));
  assert.equal(await (await old.fetch('https://watcher.test/graphics/pkg/engine.wasm')).text(), 'engine-v1');
});
test('complete update activates without closing tabs, and each client retains a consistent runtime', async t => {
  const { root, release } = await fixture(t), caches = storage(), clients = [{ id: 'recording-tab' }], old = await worker(root, caches, undefined, clients);
  await caches.open('unrelated-audio-cache');
  await old.lifecycle('install');
  await old.message('WATCHER_GRAPHICS_CLIENT_RELEASE', { version: release.version }, clients[0].id);
  await fs.writeFile(path.join(root, 'graphics/pkg/engine.wasm'), 'engine-v2');
  await fs.writeFile(path.join(root, '_expo/static/js/web/entry.js'), 'application-v2');
  const next = await prepareWebCache(root), update = await worker(root, caches, undefined, clients);
  await update.lifecycle('install');
  assert.equal(update.skipped(), 1);
  assert.ok((await caches.keys()).includes('watcher-graphics-v1-' + release.version));
  assert.equal(await (await old.fetch('https://watcher.test/graphics/pkg/engine.wasm')).text(), 'engine-v1');
  await update.lifecycle('activate');
  assert.deepEqual((await caches.keys()).sort(), ['unrelated-audio-cache', 'watcher-graphics-clients-v1', 'watcher-graphics-v1-' + release.version, 'watcher-graphics-v1-' + next.version].sort());
  assert.equal(await (await update.fetch('https://watcher.test/graphics/pkg/engine.wasm', { clientId: clients[0].id })).text(), 'engine-v1');
  assert.equal(await (await update.fetch('https://watcher.test/_expo/static/js/web/entry.js', { clientId: clients[0].id })).text(), 'application-v1');
  assert.equal(await (await update.fetch('https://watcher.test/graphics/pkg/engine.wasm')).text(), 'engine-v2');
  const shell = await update.fetch('https://watcher.test/diary', { mode: 'navigate', resultingClientId: 'reloaded-tab' });
  assert.match(await shell.text(), new RegExp(next.version));
  assert.equal(await (await update.fetch('https://watcher.test/graphics/pkg/engine.wasm', { clientId: 'reloaded-tab' })).text(), 'engine-v2');
  assert.equal(await (await update.fetch('https://watcher.test/_expo/static/js/web/entry.js', { clientId: 'reloaded-tab' })).text(), 'application-v2');
  const restarted = await worker(root, caches, undefined, clients);
  assert.equal(await (await restarted.fetch('https://watcher.test/graphics/pkg/engine.wasm', { clientId: clients[0].id })).text(), 'engine-v1');
  assert.equal(await (await restarted.fetch('https://watcher.test/assets/node_modules/expo-router/error.png', { clientId: clients[0].id })).text(), 'router-icon');
});

test('unchanged files are reused, and cleanup preserves pinned clients and unrelated voice caches', async t => {
  const { root, release } = await fixture(t), caches = storage(), clients = [{ id: 'draft' }], old = await worker(root, caches, undefined, clients);
  const audio = await caches.open('unrelated-audio-cache'); await audio.put('/voice.webm', new Response('my voice'));
  await old.lifecycle('install'); await old.message('WATCHER_GRAPHICS_CLIENT_RELEASE', { version: release.version }, 'draft');
  await fs.writeFile(path.join(root, 'graphics/pkg/engine.wasm'), 'engine-v2');
  const second = await prepareWebCache(root), update = await worker(root, caches, undefined, clients);
  await update.lifecycle('install'); await update.lifecycle('activate');
  assert.deepEqual(update.requests, ['/graphics/pkg/engine.wasm']);
  await fs.writeFile(path.join(root, 'graphics/pkg/engine.wasm'), 'engine-v3'); await prepareWebCache(root);
  const third = await worker(root, caches, undefined, clients); await third.lifecycle('install'); await third.lifecycle('activate');
  assert.ok((await caches.keys()).includes('watcher-graphics-v1-' + release.version));
  assert.equal(await (await third.fetch('https://watcher.test/graphics/pkg/engine.wasm', { clientId: 'draft' })).text(), 'engine-v1');
  clients.length = 0; await third.message('WATCHER_GRAPHICS_CACHE_CLEANUP');
  assert.ok(!(await caches.keys()).includes('watcher-graphics-v1-' + release.version));
  assert.ok((await caches.keys()).includes('watcher-graphics-v1-' + second.version));
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
  assert.equal(await (await app.fetch('https://watcher.test/graphics/pkg/engine.wasm')).text(), 'engine-v1');
});
test('low free space skips download and keeps space for voice data', async t => {
  const { root } = await fixture(t), caches = storage();
  await caches.open('unrelated-audio-cache');
  const app = await worker(root, caches, { quota: 50 * 1024 * 1024, usage: 40 * 1024 * 1024 });
  await assert.rejects(app.lifecycle('install'), /Not enough free storage/);
  assert.equal(app.requests.length, 0);
  assert.deepEqual(await caches.keys(), ['unrelated-audio-cache']);
});
test('hosting HTML injection cannot invalidate or pollute the cached exported shell', async t => {
  const { root } = await fixture(t), app = await worker(root, storage());
  await fs.appendFile(path.join(root, 'index.html'), '<script>hosting-injected-script()</script>');
  await app.lifecycle('install');
  const shell = await (await app.fetch('https://watcher.test/diary', { mode: 'navigate' })).text();
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
  assert.equal(await (await app.fetch('https://watcher.test/assets/icon%402x.png')).text(), 'retina-icon');
  assert.equal(await (await app.fetch('https://watcher.test/assets/node_modules/expo-router/error.png')).text(), 'router-icon');
});
test('install reuses what the page already downloaded and refreshes only stale copies', async t => {
  const { root } = await fixture(t);
  const http = new Map([['/graphics/gallery.webp', 'illustration-v1'], ['/graphics/pkg/engine.wasm', 'engine-v0']]);
  const app = await worker(root, storage(), undefined, [], http);
  await app.lifecycle('install');
  assert.ok(!app.requests.includes('/graphics/gallery.webp'));
  assert.deepEqual(app.requests.filter(url => url === '/graphics/pkg/engine.wasm'), ['/graphics/pkg/engine.wasm']);
  assert.equal(await (await app.fetch('https://watcher.test/graphics/pkg/engine.wasm')).text(), 'engine-v1');
});
