/* global self */
// Owns static releases and client routing only. Never opens diary storage.
const RELEASE = /* __WATCHER_RELEASE__ */ null;
/* __WATCHER_SELECTION__ */
const CACHE_PREFIX = 'watcher-graphics-v1-';
const CACHE_NAME = CACHE_PREFIX + RELEASE.version;
const META_NAME = 'watcher-graphics-clients-v1';
// A page the previous worker has just served may not be listed as a client
// yet: its pin and its snapshot stay this long after an activation.
const GRACE_MS = 60000;
// Room left free for voice recordings.
const VOICE_RESERVE = 32 * 1024 * 1024;
const metaUrl = (kind, id) => self.location.origin + '/.watcher-graphics/' + kind + '/' + encodeURIComponent(id);
const releases = new Map([[CACHE_NAME, Promise.resolve(RELEASE)]]);
const clientVersions = new Map();
const assetMap = release => new Map(release.assets.flatMap(asset => [asset.url, ...(asset.aliases ?? [])].map(url => [url, asset])));
const assets = new Map([[CACHE_NAME, assetMap(RELEASE)]]);
const totalBytes = list => list.reduce((sum, asset) => sum + asset.bytes, 0);

async function validResponse(response, asset) {
  if (!response?.ok || response.type === 'opaque') return false;
  const bytes = await response.clone().arrayBuffer();
  if (bytes.byteLength !== asset.bytes) return false;
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), byte => byte.toString(16).padStart(2, '0')).join('');
  return hash === asset.sha256;
}
// A verified copy without the network: another release snapshot, then the HTTP
// cache (the page has usually just downloaded the same bytes).
async function localResponse(asset, target = CACHE_NAME) {
  if (target === CACHE_NAME && asset.url === '/index.html') return new Response(RELEASE.shellHtml, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  const names = (await caches.keys()).filter(name => name.startsWith(CACHE_PREFIX) && name !== target);
  for (const name of names.reverse()) {
    const hit = await (await caches.open(name)).match(asset.url);
    if (await validResponse(hit, asset)) return hit;
  }
  const cached = await fetch(asset.url, { cache: 'only-if-cached', mode: 'same-origin', credentials: 'same-origin' }).catch(() => null);
  return await validResponse(cached, asset) ? cached : null;
}
async function verifiedResponse(asset, target = CACHE_NAME) {
  const local = await localResponse(asset, target);
  if (local) return local;
  const cached = await fetch(asset.url, { cache: 'force-cache', credentials: 'same-origin' }).catch(() => null);
  if (await validResponse(cached, asset)) return cached;
  const response = await fetch(asset.url, { cache: 'reload', credentials: 'same-origin' });
  if (!await validResponse(response, asset)) throw new Error('Incomplete asset or release changed while downloading: ' + asset.url);
  return response;
}
const fullAllowed = () => networkAllowsFull(self.navigator?.connection, self.navigator?.userAgentData);
async function freeBytes() {
  const estimate = self.navigator?.storage?.estimate;
  if (!estimate) return Infinity;
  const { usage, quota } = await estimate.call(self.navigator.storage);
  return Number.isFinite(quota) && quota > 0 && Number.isFinite(usage) ? quota - usage - VOICE_RESERVE : Infinity;
}
const pathsOf = async cache => new Set((await cache.keys()).map(request => new URL(request.url).pathname));
async function heldPaths() {
  const held = [];
  for (const name of await caches.keys()) if (name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME) held.push(...await pathsOf(await caches.open(name)));
  return held;
}
const quotaError = error => /quota/i.test(`${error?.name} ${error?.message ?? error}`);
// Two files at a time. A required file that fails stops the run with its error;
// an optional one is skipped (the page fetches it when it needs it). Full
// storage stops every run; `proceed` returning false stops it quietly.
async function store(cache, list, { required, proceed = () => true }) {
  for (let i = 0; i < list.length; i += 2) {
    if (!proceed()) return false;
    const results = await Promise.allSettled(list.slice(i, i + 2).map(async asset => cache.put(asset.url, await verifiedResponse(asset))));
    for (const result of results) if (result.status === 'rejected' && (required || quotaError(result.reason))) throw result.reason;
  }
  return true;
}
async function isComplete(kind) {
  // Checked without opening, so a failed first install leaves no empty cache.
  if (!(await caches.keys()).includes(META_NAME)) return false;
  return !!await (await caches.open(META_NAME)).match(metaUrl(kind, CACHE_NAME));
}
async function markFull(cache) {
  const kept = await pathsOf(cache);
  if (RELEASE.assets.every(asset => kept.has(asset.url))) await (await caches.open(META_NAME)).put(metaUrl('full', CACHE_NAME), new Response('1'));
}
// Install keeps the part: the core plus every file the device kept from an
// earlier release (unchanged ones are copied, changed ones fetched). The rest
// of the release comes by `fill` on Wi-Fi.
async function installRelease() {
  if ((await caches.keys()).includes(CACHE_NAME) && await isComplete('release')) return;
  // Re-registering the same complete release must never rewrite/delete the
  // current cache if storage fills up while several tabs resume together.
  const room = await freeBytes();
  let selected = selectAssets(RELEASE.assets, { full: false, held: await heldPaths() });
  if (room < totalBytes(selected)) selected = selectAssets(RELEASE.assets, { full: false });
  if (room < totalBytes(selected)) throw new Error('Not enough free storage for a graphics snapshot');
  const cache = await caches.open(CACHE_NAME), order = downloadOrder(selected);
  try {
    await store(cache, order.filter(asset => isCoreAsset(asset.url)), { required: true });
    await (await caches.open(META_NAME)).put(metaUrl('release', CACHE_NAME), new Response(JSON.stringify(RELEASE)));
  } catch (error) {
    if (!await isComplete('release')) await caches.delete(CACHE_NAME);
    throw error;
  }
  try { await store(cache, order.filter(asset => !isCoreAsset(asset.url)), { required: false }); } catch { /* Storage full: pages fetch the rest. */ }
  await markFull(cache);
}
// Files the page loaded before this worker controlled it (a first visit's
// home and current step), taken from the HTTP cache only.
async function keepLoaded(paths) {
  if (!Array.isArray(paths) || !await isComplete('release')) return;
  const map = assets.get(CACHE_NAME), cache = await caches.open(CACHE_NAME), present = await pathsOf(cache);
  const wanted = [...new Set(paths.map(path => map.get(String(path).replace(/%40/ig, '@'))).filter(Boolean))].filter(asset => !present.has(asset.url));
  if (totalBytes(wanted) > await freeBytes()) return;
  for (const asset of wanted) {
    const response = await localResponse(asset);
    if (response) await cache.put(asset.url, response).catch(() => {});
  }
}
// On Wi-Fi or a wired link the rest of the release downloads. Leaving Wi-Fi
// stops it after the current files; the next page check resumes it.
let filling = null;
async function fillRelease() {
  if (!fullAllowed() || !await isComplete('release') || await isComplete('full')) return;
  const cache = await caches.open(CACHE_NAME), present = await pathsOf(cache);
  const missing = downloadOrder(RELEASE.assets.filter(asset => !present.has(asset.url)));
  if (totalBytes(missing) > await freeBytes()) return;
  if (await store(cache, missing, { required: false, proceed: fullAllowed })) await markFull(cache);
}
function fill() {
  // Storage full or offline: pages fetch what they need.
  filling ??= fillRelease().catch(() => {}).finally(() => { filling = null; });
  return filling;
}
async function setClient(id, name) {
  if (!id) return;
  clientVersions.set(id, name);
  await (await caches.open(META_NAME)).put(metaUrl('client', id), new Response(name, { headers: { 'x-watcher-pinned': String(Date.now()) } }));
}
async function clientCache(id) {
  if (!id) return CACHE_NAME;
  if (!clientVersions.has(id)) {
    const saved = await (await caches.open(META_NAME)).match(metaUrl('client', id));
    clientVersions.set(id, saved ? await saved.text() : CACHE_NAME);
  }
  return clientVersions.get(id);
}
async function releaseFor(name) {
  if (!releases.has(name)) releases.set(name, (async () => {
    const saved = await (await caches.open(META_NAME)).match(metaUrl('release', name));
    if (saved) return saved.json();
    // Migration: older snapshots have no metadata, but retain exact request URLs.
    return null;
  })());
  return releases.get(name);
}
// Keeps the current snapshot and the ones open pages use. The previous one
// stays only for a minute after an activation, so storage holds one release.
async function cleanup() {
  const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  const required = new Set([CACHE_NAME]);
  for (const client of clients) required.add(await clientCache(client.id));
  const metadata = await caches.open(META_NAME), now = Date.now();
  const activated = await metadata.match(metaUrl('activated', CACHE_NAME));
  const names = (await caches.keys()).filter(name => name.startsWith(CACHE_PREFIX));
  const previous = names.filter(name => name !== CACHE_NAME).at(-1);
  if (previous && (!activated || now - Number(await activated.text()) < GRACE_MS)) required.add(previous);
  const live = new Set(clients.map(client => metaUrl('client', client.id)));
  for (const request of await metadata.keys()) {
    if (!new URL(request.url).pathname.startsWith('/.watcher-graphics/client/') || live.has(request.url)) continue;
    const pinned = Number((await metadata.match(request))?.headers.get('x-watcher-pinned')) || 0;
    if (now - pinned >= GRACE_MS) { await metadata.delete(request); clientVersions.delete(decodeURIComponent(request.url.split('/').pop())); }
  }
  for (const name of names) if (!required.has(name)) {
    await caches.delete(name);
    for (const kind of ['release', 'full', 'activated']) await metadata.delete(metaUrl(kind, name));
    releases.delete(name); assets.delete(name);
  }
}
async function status() {
  const kept = await pathsOf(await caches.open(CACHE_NAME));
  const stored = RELEASE.assets.filter(asset => kept.has(asset.url));
  return { version: RELEASE.version, cacheName: CACHE_NAME, assets: RELEASE.assets.length, bytes: RELEASE.bytes, clientRouting: true,
    full: await isComplete('full'), keptAssets: stored.length, keptBytes: totalBytes(stored), fullAllowed: fullAllowed() };
}
self.addEventListener('install', event => {
  event.waitUntil((async () => { await installRelease(); await self.skipWaiting(); })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const metadata = await caches.open(META_NAME);
    await metadata.put(metaUrl('activated', CACHE_NAME), new Response(String(Date.now())));
    const names = (await caches.keys()).filter(name => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME);
    const previous = names.at(-1);
    if (previous) {
      for (const client of await self.clients.matchAll({ type: 'window', includeUncontrolled: true })) {
        const saved = await metadata.match(metaUrl('client', client.id));
        if (!saved) await setClient(client.id, previous);
      }
    }
    await self.clients.claim();
    await cleanup();
  })());
});
async function staticResponse(event, pathname) {
  if (event.request.mode === 'navigate') {
    await setClient(event.resultingClientId, CACHE_NAME);
    return (await caches.open(CACHE_NAME)).match('/index.html');
  }
  const name = await clientCache(event.clientId);
  if (!assets.has(name)) {
    const release = await releaseFor(name);
    if (release) assets.set(name, assetMap(release));
  }
  const asset = assets.get(name)?.get(pathname);
  const cache = await caches.open(name);
  const hit = await cache.match(asset?.url ?? pathname);
  if (hit) return hit;
  // Unknown files and legacy snapshots without metadata use the network.
  if (!asset) return fetch(event.request);
  // A file this snapshot has not kept yet: fetch exactly this release's bytes and
  // keep them. A page never gets a file of another release: after a deploy an
  // old page gets an error here and reloads into the new release.
  try {
    const response = await verifiedResponse(asset, name);
    try { await cache.put(asset.url, response.clone()); } catch { /* Network remains available when full. */ }
    return response;
  } catch {
    return new Response('', { status: 503, statusText: 'Release file unavailable', headers: { 'Cache-Control': 'no-store' } });
  }
}
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || request.headers.has('range')) return;
  const url = new URL(request.url), pathname = url.pathname.replace(/%40/ig, '@');
  if (url.origin !== self.location.origin || !['https:', 'http:'].includes(url.protocol)) return;
  const navigation = request.mode === 'navigate' && RELEASE.routes.includes(pathname);
  const staticPath = ['/graphics-cache-updates.js', '/graphics-cache-bootstrap.js', '/favicon.ico', '/watcher.webmanifest', '/watcher-app-icon.png'].includes(pathname)
    || /^(?:\/graphics\/|\/graphics-cache-assets\/|\/assets\/|\/branding\/|\/_expo\/static\/).*\.(?:js|css|wasm|bin|z|svg|png|jpe?g|webp|gif|avif|ico|ttf|otf|woff2?)$/i.test(pathname);
  if (!navigation && !staticPath) return; // Audio, APIs and the version probe pass through.
  event.respondWith(staticResponse(event, pathname));
});
const MESSAGES = ['WATCHER_GRAPHICS_CACHE_STATUS', 'WATCHER_GRAPHICS_CLIENT_RELEASE', 'WATCHER_GRAPHICS_CACHE_CLEANUP', 'WATCHER_GRAPHICS_CACHE_FILL'];
self.addEventListener('message', event => {
  if (!MESSAGES.includes(event.data?.type)) return;
  event.waitUntil((async () => {
    if (event.data.type === 'WATCHER_GRAPHICS_CLIENT_RELEASE') {
      const name = CACHE_PREFIX + event.data.version;
      if ((await caches.keys()).includes(name)) await setClient(event.source?.id, name);
    }
    if (event.data.type === 'WATCHER_GRAPHICS_CACHE_CLEANUP') await cleanup();
    if (event.data.type === 'WATCHER_GRAPHICS_CACHE_FILL') await keepLoaded(event.data.paths);
    event.ports[0]?.postMessage(await status());
    // The page asks again every minute, so a long download never holds one
    // event past the browser's limit; an interrupted one resumes.
    if (event.data.type === 'WATCHER_GRAPHICS_CACHE_FILL') await Promise.race([fill(), new Promise(resolve => setTimeout(resolve, 240000))]);
  })());
});
