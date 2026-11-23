import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { prepareIosExport } from './prepare-ios-export.mjs';
import { prepareAppExport } from '../android/prepare-app-export.mjs';

const files = {
  'index.html': '<html><head></head><body>Watcher\n</body></html>',
  'graphics/pkg/engine.wasm': 'engine-v1',
  '_expo/static/js/web/entry.js': 'application-v1',
};
async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'watcher-ios-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  for (const [name, value] of Object.entries(files)) {
    await fs.mkdir(path.dirname(path.join(root, name)), { recursive: true });
    await fs.writeFile(path.join(root, name), value);
  }
  return root;
}
const csp = html => html.match(/http-equiv="Content-Security-Policy" content="([^"]*)"/)?.[1];

test('the iOS export has no worker of any kind and keeps the app CSP', async t => {
  const root = await fixture(t);
  // Leftovers of a site or Android build in the same folder must not reach the app.
  for (const name of ['graphics-cache-worker.js', '404.html', 'app-script-cache.js', 'app-script-cache-register.js']) await fs.writeFile(path.join(root, name), 'leftover');
  await prepareIosExport(root);
  const html = await fs.readFile(path.join(root, 'index.html'), 'utf8');
  assert.doesNotMatch(html, /serviceWorker|graphics-cache-updates|app-script-cache|watcher-graphics-cache/);
  for (const name of ['graphics-cache-worker.js', '404.html', 'app-script-cache.js', 'app-script-cache-register.js']) {
    await assert.rejects(fs.stat(path.join(root, name)), { code: 'ENOENT' }, name);
  }
  assert.equal(await fs.readFile(path.join(root, 'graphics/pkg/engine.wasm'), 'utf8'), 'engine-v1');
  // Same page policy as the Android app: only the export's own origin, no inline scripts beyond the hashed ones.
  const android = await fixture(t);
  await prepareAppExport(android);
  assert.ok(csp(html));
  assert.equal(csp(html), csp(await fs.readFile(path.join(android, 'index.html'), 'utf8')));
});
