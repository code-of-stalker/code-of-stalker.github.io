import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { prepareAppExport } from './prepare-app-export.mjs';
import { prepareWebCache } from '../prepare-web-cache.mjs';

const files = {
  'index.html': '<html><head></head><body>Watcher\n</body></html>',
  'graphics/pkg/engine.wasm': 'engine-v1',
  '_expo/static/js/web/entry.js': 'application-v1',
  'assets/node_modules/expo-router/error.png': 'router-icon',
};
async function fixture(t, prefix) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  for (const [name, value] of Object.entries(files)) {
    await fs.mkdir(path.dirname(path.join(root, name)), { recursive: true });
    await fs.writeFile(path.join(root, name), value);
  }
  return root;
}
const csp = html => html.match(/http-equiv="Content-Security-Policy" content="([^"]*)"/)?.[1];

test('the app export has no release worker, update probe or cache aliases', async t => {
  const root = await fixture(t, 'watcher-android-');
  // Leftovers of a site build in the same folder must not reach the APK.
  await fs.writeFile(path.join(root, 'graphics-cache-worker.js'), 'worker');
  await fs.writeFile(path.join(root, '404.html'), 'shell');
  await prepareAppExport(root);
  const html = await fs.readFile(path.join(root, 'index.html'), 'utf8');
  assert.doesNotMatch(html, /graphics-cache-updates|serviceWorker|watcher-graphics-cache/);
  for (const name of ['graphics-cache-worker.js', 'graphics-cache-updates.js', 'graphics-cache-manifest.json', 'graphics-cache-version.json', '404.html', 'graphics-cache-assets']) {
    await assert.rejects(fs.stat(path.join(root, name)), { code: 'ENOENT' }, name);
  }
  // The exported files themselves are untouched.
  assert.equal(await fs.readFile(path.join(root, 'graphics/pkg/engine.wasm'), 'utf8'), 'engine-v1');
  assert.equal(await fs.readFile(path.join(root, 'assets/node_modules/expo-router/error.png'), 'utf8'), 'router-icon');
});

test('the app script cache lists only the page scripts and follows their bytes', async t => {
  const root = await fixture(t, 'watcher-android-');
  await prepareAppExport(root);
  const html = await fs.readFile(path.join(root, 'index.html'), 'utf8');
  // Registered from a same-origin file after load: no inline script, CSP unchanged.
  assert.match(html, /<script src="\/app-script-cache-register\.js" defer><\/script><\/body>/);
  assert.match(await fs.readFile(path.join(root, 'app-script-cache-register.js'), 'utf8'), /register\('\/app-script-cache\.js', \{ scope: '\/' \}\)/);
  const worker = await fs.readFile(path.join(root, 'app-script-cache.js'), 'utf8');
  assert.match(worker, /const SCRIPTS = \["\/_expo\/static\/js\/web\/entry\.js"\];/);
  assert.doesNotMatch(worker, /wasm|index\.html|graphics/);
  // Stored during install, a script gets an eager code cache that runs ~4x slower on the phone.
  const install = worker.slice(worker.indexOf("addEventListener('install'"), worker.indexOf("addEventListener('activate'"));
  assert.ok(install.length > 0);
  assert.doesNotMatch(install, /fill|caches|cache\.add/);
  assert.match(worker, /addEventListener\('activate'[^]*\.then\(fill\)/);
  const cacheName = source => source.match(/const CACHE = '(app-scripts-[0-9a-f]{16})'/)?.[1];
  assert.ok(cacheName(worker));
  // Same names, new bytes: a new cache, so an update never serves an old script.
  const next = await fixture(t, 'watcher-android-');
  await fs.writeFile(path.join(next, '_expo/static/js/web/entry.js'), 'application-v2');
  await prepareAppExport(next);
  assert.notEqual(cacheName(await fs.readFile(path.join(next, 'app-script-cache.js'), 'utf8')), cacheName(worker));
});

test('the app keeps exactly the site policy apart from the worker bootstrap', async t => {
  const app = await fixture(t, 'watcher-android-');
  const site = await fixture(t, 'watcher-site-');
  await prepareAppExport(app);
  await prepareWebCache(site);
  const appHtml = await fs.readFile(path.join(app, 'index.html'), 'utf8');
  const siteHtml = await fs.readFile(path.join(site, 'index.html'), 'utf8');
  assert.ok(csp(appHtml), 'app CSP present');
  assert.equal(csp(appHtml), csp(siteHtml));
  assert.match(csp(appHtml), /connect-src 'self' blob: https:\/\/[a-z0-9]+\.supabase\.co wss:\/\/[a-z0-9]+\.supabase\.co/);
  assert.match(csp(appHtml), /object-src 'none'; base-uri 'none'; form-action 'none'/);
});
