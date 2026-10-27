/* global self */
// Owns static releases and client routing only. Never opens diary storage.
const RELEASE = /* __WATCHER_RELEASE__ */ null;
const CACHE_PREFIX = 'watcher-graphics-v1-';
const CACHE_NAME = CACHE_PREFIX + RELEASE.version;
const META_NAME = 'watcher-graphics-clients-v1';
const metaUrl = (kind, id) => self.location.origin + '/.watcher-graphics/' + kind + '/' + encodeURIComponent(id);
const releases = new Map([[CACHE_NAME, Promise.resolve(RELEASE)]]);
const clientVersions = new Map();
const assetMap = release => new Map(release.assets.flatMap(asset => [asset.url, ...(asset.aliases ?? [])].map(url => [url, asset])));
const assets = new Map([[CACHE_NAME, assetMap(RELEASE)]]);

async function validResponse(response, asset) {
  if (!response?.ok || response.type === 'opaque') return false;
  const bytes = await response.clone().arrayBuffer();
  if (bytes.byteLength !== asset.bytes) return false;
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), byte => byte.toString(16).padStart(2, '0')).join('');
  return hash === asset.sha256;
}
async function verifiedResponse(asset) {
  if (asset.url === '/index.html') return new Response(RELEASE.shellHtml, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  // Reuse unchanged verified graphics instead of downloading them each release.
  const names = (await caches.keys()).filter(name => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME);
  for (const name of names.reverse()) {
    const hit = await (await caches.open(name)).match(asset.url);
    if (await validResponse(hit, asset)) return hit;
  }
  // The page has usually just downloaded the same bytes; take them from the HTTP
  // cache when they still match, and only then go to the network for a fresh copy.
  const cached = await fetch(asset.url, { cache: 'force-cache', credentials: 'same-origin' }).catch(() => null);
  if (await validResponse(cached, asset)) return cached;
  const response = await fetch(asset.url, { cache: 'reload', credentials: 'same-origin' });
  if (!await validResponse(response, asset)) throw new Error('Incomplete asset or release changed while downloading: ' + asset.url);
  return response;
}
async function installRelease() {
  const existing = await caches.keys();
  if (existing.includes(CACHE_NAME) && existing.includes(META_NAME)
    && await (await caches.open(META_NAME)).match(metaUrl('release', CACHE_NAME))) return;
  // Re-registering the same complete release must never rewrite/delete the
  // current cache if storage fills up while several tabs resume together.
  const estimate = self.navigator?.storage?.estimate;
  if (estimate) {
    const { usage, quota } = await estimate.call(self.navigator.storage);
    if (Number.isFinite(quota) && quota > 0 && Number.isFinite(usage) && quota - usage < RELEASE.bytes + 32 * 1024 * 1024) {
      throw new Error('Not enough free storage for a graphics snapshot');
    }
  }
  const cache = await caches.open(CACHE_NAME);
  try {
    for (let i = 0; i < RELEASE.assets.length; i += 2) {
      const results = await Promise.allSettled(RELEASE.assets.slice(i, i + 2).map(async asset => {
        await cache.put(asset.url, await verifiedResponse(asset));
      }));
      const failure = results.find(result => result.status === 'rejected');
      if (failure) throw failure.reason;
    }
    await (await caches.open(META_NAME)).put(metaUrl('release', CACHE_NAME), new Response(JSON.stringify(RELEASE)));
  } catch (error) {
    const complete = (await caches.keys()).includes(META_NAME)
      && await (await caches.open(META_NAME)).match(metaUrl('release', CACHE_NAME));
    if (!complete) await caches.delete(CACHE_NAME);
    throw error;
  }
}
async function setClient(id, name) {
  if (!id) return;
  clientVersions.set(id, name);
  await (await caches.open(META_NAME)).put(metaUrl('client', id), new Response(name));
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
async function cleanup() {
  const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  const required = new Set([CACHE_NAME]);
  for (const client of clients) required.add(await clientCache(client.id));
  const names = (await caches.keys()).filter(name => name.startsWith(CACHE_PREFIX));
  const previous = names.filter(name => name !== CACHE_NAME).at(-1);
  // One previous snapshot also covers a navigation/claim race and a rollback.
  if (previous) required.add(previous);
  const metadata = await caches.open(META_NAME), live = new Set(clients.map(client => metaUrl('client', client.id)));
  for (const request of await metadata.keys()) if (new URL(request.url).pathname.startsWith('/.watcher-graphics/client/') && !live.has(request.url)) await metadata.delete(request);
  for (const name of names) if (!required.has(name)) {
    await caches.delete(name); await metadata.delete(metaUrl('release', name));
    releases.delete(name); assets.delete(name);
  }
}
self.addEventListener('install', event => {
  event.waitUntil((async () => { await installRelease(); await self.skipWaiting(); })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = (await caches.keys()).filter(name => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME);
    const previous = names.at(-1);
    if (previous) {
      for (const client of await self.clients.matchAll({ type: 'window', includeUncontrolled: true })) {
        const saved = await (await caches.open(META_NAME)).match(metaUrl('client', client.id));
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
  if (name === CACHE_NAME && asset) {
    const response = await verifiedResponse(asset);
    try { await cache.put(asset.url, response.clone()); } catch { /* Network remains available when full. */ }
    return response;
  }
  return fetch(event.request);
}
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || request.headers.has('range')) return;
  const url = new URL(request.url), pathname = url.pathname.replace(/%40/ig, '@');
  if (url.origin !== self.location.origin || !['https:', 'http:'].includes(url.protocol)) return;
  const navigation = request.mode === 'navigate' && RELEASE.routes.includes(pathname);
  const staticPath = pathname === '/graphics-cache-updates.js' || pathname === '/graphics-cache-bootstrap.js' || pathname === '/favicon.ico'
    || /^(?:\/graphics\/|\/graphics-cache-assets\/|\/assets\/|\/_expo\/static\/).*\.(?:js|css|wasm|bin|z|svg|png|jpe?g|webp|gif|avif|ico|ttf|otf|woff2?)$/i.test(pathname);
  if (!navigation && !staticPath) return; // Audio, APIs and the version probe pass through.
  event.respondWith(staticResponse(event, pathname));
});
self.addEventListener('message', event => {
  if (!['WATCHER_GRAPHICS_CACHE_STATUS', 'WATCHER_GRAPHICS_CLIENT_RELEASE', 'WATCHER_GRAPHICS_CACHE_CLEANUP'].includes(event.data?.type)) return;
  event.waitUntil((async () => {
    if (event.data.type === 'WATCHER_GRAPHICS_CLIENT_RELEASE') {
      const name = CACHE_PREFIX + event.data.version;
      if ((await caches.keys()).includes(name)) await setClient(event.source?.id, name);
    }
    if (event.data.type === 'WATCHER_GRAPHICS_CACHE_CLEANUP') await cleanup();
    event.ports[0]?.postMessage({ version: RELEASE.version, cacheName: CACHE_NAME, assets: RELEASE.assets.length, bytes: RELEASE.bytes, clientRouting: true });
  })());
});

