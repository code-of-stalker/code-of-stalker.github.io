import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const exports = {};
vm.runInNewContext(ts.transpileModule(readFileSync(new URL('./spectrum.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText, { exports, Float32Array, Math, Number });
const measure = exports.measureVoiceSpectrum;
test('silence and low background noise do not animate as speech', () => {
  for (const noise of [-Infinity, -80]) {
    const frame = measure(new Float32Array(1024).fill(noise), 48000, 2048);
    assert.equal(frame.low + frame.mid + frame.high, 0);
    assert.ok(Array.from(frame.contour).every(value => value === 0));
  }
});
test('bass, speech and high frequencies drive independent Laboratory bands', () => {
  for (const [frequency, expected] of [[187.5, 'low'], [1000, 'mid'], [6000, 'high']]) {
    const bins = new Float32Array(1024).fill(-Infinity);
    bins[Math.round(frequency * 2048 / 48000)] = -28;
    const frame = measure(bins, 48000, 2048);
    assert.ok(frame[expected] > .1);
    assert.ok(['low', 'mid', 'high'].filter(band => band !== expected).every(band => frame[band] === 0));
  }
});
test('contour preserves syllable intensity instead of flattening it at one', () => {
  const quiet = new Float32Array(1024).fill(-Infinity), loud = new Float32Array(1024).fill(-Infinity);
  quiet[40] = -32; loud[40] = -18;
  const a = measure(quiet, 48000, 2048), b = measure(loud, 48000, 2048);
  assert.ok(Math.max(...b.contour) > Math.max(...a.contour) * 2);
  assert.ok(Array.from(b.contour).every(Number.isFinite));
});
