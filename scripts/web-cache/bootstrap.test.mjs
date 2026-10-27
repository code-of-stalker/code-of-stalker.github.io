import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
const script = await fs.readFile(new URL('./bootstrap.js', import.meta.url), 'utf8');
const flush = async () => { for (let i = 0; i < 100; i++) await Promise.resolve(); };
function fixture({ legacy = false, registered = true, readyState = 'complete', online = true, hangFirst = false, hangFirstBody = false, firstVisit = false } = {}) {
  let now = 100000, nextTimer = 0, remote = 'new-1', active = legacy ? 'old-9' : 'new-1', reloads = 0, dialog = false;
  const timers = new Map(), intervals = [], checks = [], registrations = [], pinned = [], events = [];
  const window = new EventTarget(), document = new EventTarget(), serviceWorker = new EventTarget();
  const root = { dataset: { watcherUpdateReady: 'true', watcherUpdateBusy: 'false' } };
  Object.assign(document, { documentElement: root, visibilityState: 'visible', readyState, activeElement: { tagName: 'BODY' },
    getElementById: () => ({ dataset: { release: 'new-1' } }), querySelector: () => dialog ? {} : null });
  const location = { href: 'https://watcher.test/diary', reload() { reloads++; } };
  Object.assign(window, { isSecureContext: true, location, requestIdleCallback: callback => { void callback(); },
    setTimeout: (callback, delay) => { const id = ++nextTimer; timers.set(id, { callback, at: now + delay }); return id; },
    clearTimeout: id => timers.delete(id), setInterval: (callback, delay) => { intervals.push({ callback, delay, at: now + delay }); return intervals.length; } });
  window.addEventListener('watcher-graphics-update', event => events.push(event.detail.available));
  class Channel {
    constructor() { this.port1 = { close() {} }; this.port2 = { postMessage: data => queueMicrotask(() => this.port1.onmessage?.({ data })) }; }
  }
  function controller() {
    return { postMessage(data, ports) {
      if (data.type === 'WATCHER_GRAPHICS_CLIENT_RELEASE') pinned.push(data.version);
      ports[0].postMessage({ version: active, clientRouting: !legacy || active !== 'old-9' });
    } };
  }
  const reg = { active: { scriptURL: 'https://watcher.test/graphics-cache-worker.js?release=new-1' }, update: async () => {} };
  serviceWorker.controller = firstVisit ? null : controller();
  serviceWorker.getRegistration = async () => registered ? reg : undefined;
  serviceWorker.register = async url => {
    registrations.push(url); registered = true; active = remote; reg.active.scriptURL = new URL(url, location.href).href;
    serviceWorker.controller = controller(); serviceWorker.dispatchEvent(new Event('controllerchange')); return reg;
  };
  const navigator = { serviceWorker, onLine: online };
  vm.runInNewContext(script, { window, document, navigator, location, URL, AbortController, MessageChannel: Channel, Event, CustomEvent,
    Date: class extends Date { static now() { return now; } },
    fetch: async (url, options) => { checks.push({ url, options }); const first = checks.length === 1; const stalled = () => new Promise((_, reject) => options.signal.addEventListener('abort', () => reject(Error('request timeout')), { once: true })); if (hangFirst && first) await stalled(); return { ok: true, json: async () => { if (hangFirstBody && first) await stalled(); return { version: remote }; } }; } });
  return { window, document, navigator, registrations, checks, events, pinned, reloads: () => reloads,
    remote: value => { remote = value; }, dialog: value => { dialog = value; }, busy: value => { root.dataset.watcherUpdateBusy = String(value); window.dispatchEvent(new Event('watcher-update-safety')); },
    async advance(ms) { now += ms; await flush(); const due = [...timers].filter(([, timer]) => timer.at <= now); for (const [id, timer] of due) { timers.delete(id); timer.callback(); } for (const timer of intervals) if (timer.at <= now) { timer.at = now + timer.delay; timer.callback(); } await flush(); } };
}

test('launch checks before load/idle, then every minute only while visible and online', async () => {
  const app = fixture({ readyState: 'loading' });
  assert.equal(app.checks.length, 1);
  await flush(); await app.advance(59999); assert.equal(app.checks.length, 1);
  await app.advance(1); assert.equal(app.checks.length, 2);
  app.document.visibilityState = 'hidden'; await app.advance(60000); assert.equal(app.checks.length, 2);
  app.document.visibilityState = 'visible'; app.navigator.onLine = false;
  await app.advance(60000); assert.equal(app.checks.length, 2);
  app.navigator.onLine = true; app.window.dispatchEvent(new Event('online')); await flush();
  assert.equal(app.checks.length, 3);
});

test('a stalled launch request times out and the periodic check can recover', async () => {
  const app = fixture({ hangFirst: true }); await flush();
  assert.equal(app.checks.length, 1); await app.advance(10001);
  assert.equal(app.checks[0].options.signal.aborted, true);
  await app.advance(60000); assert.equal(app.checks.length, 2);
});

test('the same deadline covers a response whose JSON body stops arriving', async () => {
  const app = fixture({ hangFirstBody: true }); await flush();
  await app.advance(10001); assert.equal(app.checks[0].options.signal.aborted, true);
  await app.advance(60000); assert.equal(app.checks.length, 2);
});
test('resume requests the new worker version while dirty text/recording defers reload', async () => {
  const app = fixture(); await flush(); app.busy(true); app.remote('new-2'); app.window.dispatchEvent(new Event('focus')); await flush();
  assert.deepEqual(app.registrations, ['/graphics-cache-worker.js?release=new-2']);
  assert.ok(app.checks.every(check => check.options.cache === 'no-store'));
  assert.equal(app.window.watcherGraphicsUpdates.available(), true);
  assert.ok(app.pinned.includes('new-1'));
  await app.advance(10000); assert.equal(app.reloads(), 0);
  app.busy(false); await app.advance(1); assert.equal(app.reloads(), 1);
  await app.advance(10000); assert.equal(app.reloads(), 1);
});
test('launch and reconnect can register after an offline first attempt', async () => {
  const app = fixture({ registered: false, online: false }); await flush();
  assert.equal(app.registrations.length, 0); app.navigator.onLine = true; app.window.dispatchEvent(new Event('online')); await flush();
  assert.deepEqual(app.registrations, ['/graphics-cache-worker.js?release=new-1']); assert.equal(app.reloads(), 0);
  app.document.visibilityState = 'hidden'; app.remote('new-2'); app.window.dispatchEvent(new Event('focus')); await flush(); assert.equal(app.registrations.length, 1);
  app.document.visibilityState = 'visible'; app.document.dispatchEvent(new Event('visibilitychange')); await flush(); assert.equal(app.registrations.length, 2);
});

test('a closing sheet and focused text defer updates until their DOM guards clear', async () => {
  const app = fixture(); await flush(); app.busy(true); app.dialog(true); app.remote('new-2');
  app.window.dispatchEvent(new Event('focus')); await flush(); app.busy(false);
  await app.advance(10000); assert.equal(app.reloads(), 0);
  app.dialog(false); app.document.activeElement = { tagName: 'TEXTAREA' };
  await app.advance(10000); assert.equal(app.reloads(), 0);
  app.document.activeElement = { tagName: 'BODY' };
  await app.advance(1000); await app.advance(1); assert.equal(app.reloads(), 1);
});
test('legacy migration aligns new shell and engine only after the new worker takes over', async () => {
  const app = fixture({ legacy: true, registered: false }); app.busy(true); await flush();
  assert.equal(app.window.watcherGraphicsUpdates.available(), true); assert.equal(app.reloads(), 0);
  await app.advance(10000); assert.equal(app.reloads(), 0); app.busy(false); await app.advance(1); assert.equal(app.reloads(), 1);
});

test('a first visit installs the offline snapshot only after the engine and device tuning', async () => {
  const app = fixture({ registered: false, firstVisit: true }); app.dialog(true); await flush();
  assert.equal(app.checks.length, 1); assert.equal(app.registrations.length, 0);
  app.window.dispatchEvent(new Event('watcher-graphics-ready')); await flush();
  await app.advance(2000); assert.equal(app.registrations.length, 0);
  app.dialog(false); await app.advance(2000);
  assert.deepEqual(app.registrations, ['/graphics-cache-worker.js?release=new-1']);
});
test('a first visit still installs offline support when graphics never become ready', async () => {
  const app = fixture({ registered: false, firstVisit: true }); await flush();
  await app.advance(89999); assert.equal(app.registrations.length, 0);
  await app.advance(1); assert.deepEqual(app.registrations, ['/graphics-cache-worker.js?release=new-1']);
});
