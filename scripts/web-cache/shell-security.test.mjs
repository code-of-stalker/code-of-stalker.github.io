import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import vm from 'node:vm';
import { contentSecurityPolicy, diaryEditorScript, secureShell, shellGuard } from './shell-security.mjs';

const hash = text => `'sha256-${crypto.createHash('sha256').update(text).digest('base64')}'`;
function guard(url, { framed = false } = {}) {
  const address = new URL(url), replaced = [], root = { style: null, setAttribute(name, value) { if (name === 'style') this.style = value; } };
  const self = {};
  vm.runInNewContext(shellGuard, {
    location: { pathname: address.pathname, search: address.search, hash: address.hash },
    history: { replaceState: (_state, _title, next) => replaced.push(next) },
    document: { documentElement: root }, window: { self, top: framed ? {} : self }, decodeURIComponent,
  });
  return { replaced, style: root.style };
}

test('the shell starts with the policy and guard, and repeated preparation keeps one copy', async () => {
  const html = await secureShell(await secureShell('<html><head><title>x</title></head><body></body></html>'));
  assert.match(html, /^<html><head>\n<meta id="watcher-csp" http-equiv="Content-Security-Policy" content="[^"]+">\n<script id="watcher-shell-guard">/);
  assert.equal(html.match(/watcher-csp/g).length, 1);
  assert.equal(html.match(/watcher-shell-guard/g).length, 1);
  const policy = html.match(/content="([^"]+)"/)[1];
  assert.ok(policy.includes(hash(shellGuard)));
  assert.ok(policy.includes(hash(await diaryEditorScript())));
  await assert.rejects(secureShell('<html><body></body></html>'), /no HTML head/);
});

test('the policy keeps data on this origin and allows no foreign or injected script', () => {
  const policy = contentSecurityPolicy(['a']);
  for (const directive of ["default-src 'self'", "connect-src 'self' blob:", "object-src 'none'", "base-uri 'none'", "form-action 'none'"]) assert.ok(policy.includes(directive), directive);
  const scripts = policy.split('; ').find(item => item.startsWith('script-src'));
  assert.equal(scripts, `script-src 'self' 'unsafe-eval' ${hash('a')}`);
  assert.doesNotMatch(policy, /https?:|\*|'unsafe-inline'[^;]*script|script-src[^;]*'unsafe-inline'/);
});

test('the diary editor script is fixed and reads its entry from a JSON element', async () => {
  const script = await diaryEditorScript();
  assert.ok(script.endsWith("textEditorRuntime(JSON.parse(document.getElementById('diary-editor-config').textContent));\n"));
});

test('a malformed address is trimmed before the router parses it; a valid one is untouched', () => {
  assert.deepEqual(guard('https://watcher.test/practice?preview=cooldown&from=%D0%B4%D0%BD%D0%B5%D0%B2%D0%BD%D0%B8%D0%BA#top').replaced, []);
  assert.deepEqual(guard('https://watcher.test/settings?x=' + '%C0'.repeat(3000)).replaced, ['/settings']);
  assert.deepEqual(guard('https://watcher.test/diary#%E0%A4%A').replaced, ['/diary']);
  assert.deepEqual(guard('https://watcher.test/%C0%C0?x=1').replaced, ['/']);
});

test('a copy framed by another page stays hidden', () => {
  assert.equal(guard('https://watcher.test/settings').style, null);
  const framed = guard('https://watcher.test/settings', { framed: true });
  assert.equal(framed.style, 'display:none!important');
  assert.deepEqual(framed.replaced, []);
});
