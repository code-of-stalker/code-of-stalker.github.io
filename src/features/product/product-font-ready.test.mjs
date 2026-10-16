import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const exports = {};
vm.runInNewContext(ts.transpileModule(readFileSync(new URL('./product-font-ready.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText, { exports, Promise, Error });

test('registered Safari faces are not ready until the actual Bold font has loaded', async () => {
  let releaseBold, finished = false;
  const calls = [];
  const bold = new Promise(resolve => { releaseBold = resolve; });
  const waiting = exports.waitForProductFonts({ load(font, text) {
    calls.push({ font, text });
    return font.includes('DisketMonoBold') ? bold : Promise.resolve([{}]);
  } }).then(() => { finished = true; });
  await Promise.resolve(); await Promise.resolve();
  assert.equal(finished, false);
  assert.equal(calls.length, 5);
  assert.ok(calls.every(({ text }) => text.includes('СЕГОДНЯ') && text.includes('Ёё')));
  releaseBold([{}]); await waiting;
  assert.equal(finished, true);
});

test('missing or rejected Bold faces do not count as successfully loaded', async () => {
  await assert.rejects(exports.waitForProductFonts({ load: font => Promise.resolve(font.includes('DisketMonoBold') ? [] : [{}]) }), /DisketMonoBold/);
  const failure = new Error('font download failed');
  await assert.rejects(exports.waitForProductFonts({ load: font => font.includes('DisketMonoBold') ? Promise.reject(failure) : Promise.resolve([{}]) }), failure);
});
