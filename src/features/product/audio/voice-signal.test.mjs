import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const exports = {}, silentBands = { low: 0, mid: 0, high: 0, contour: [] };
const source = ts.transpileModule(readFileSync(new URL('./voice-signal.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
vm.runInNewContext(source, { exports, require: () => ({ silentBands }) });
test('metering delivers every measured sample directly, and silence clears the previous take', () => {
  const signal = exports.createVoiceSignal(), seen = [];
  const unsubscribe = signal.subscribe(() => seen.push(signal.read()));
  assert.equal(signal.read(), silentBands);
  for (let i = 1; i <= 30; i++) signal.publish({ low: i / 30, mid: .2, high: .1, contour: [.3, .4] });
  assert.equal(seen.length, 30); assert.equal(signal.read().low, 1);
  signal.publish(silentBands); assert.equal(seen.at(-1), silentBands);
  unsubscribe(); signal.publish({ low: .5, mid: 0, high: 0, contour: [] });
  assert.equal(seen.length, 31);
});
