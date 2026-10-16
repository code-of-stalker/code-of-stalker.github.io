import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const exports = {};
vm.runInNewContext(ts.transpileModule(readFileSync(new URL('./reading-snap-model.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText, { exports, Math });

test('a short approach does not change the header; crossing the threshold commits the expansion', () => {
  const snap = exports.createReadingSnap(230);
  assert.equal(snap.observe(0), null);
  assert.equal(snap.observe(12), null);
  assert.equal(snap.observe(28), null);
  assert.equal(snap.observe(40), 230);
  // Releasing, reversing or sending extra input cannot interrupt that transition.
  assert.equal(snap.observe(15), null);
  assert.equal(snap.observe(180), null);
  snap.finish();
  assert.equal(snap.observe(230), null);
  assert.equal(snap.observe(500), null);
});

test('reading has a reverse approach, then commits fully back to the preview', () => {
  const snap = exports.createReadingSnap(230);
  snap.observe(40); snap.finish();
  assert.equal(snap.observe(218), null);
  assert.equal(snap.observe(205), null);
  assert.equal(snap.observe(180), 0);
  assert.equal(snap.observe(210), null);
  snap.finish();
  assert.equal(snap.observe(0), null);
  assert.equal(snap.observe(20), null);
  assert.equal(snap.observe(40), 230);
});

test('large scroll jumps keep their article position instead of rewinding onto the transition', () => {
  const snap = exports.createReadingSnap(280);
  assert.equal(snap.observe(700), null);
  assert.equal(snap.observe(650), null);
  assert.equal(snap.observe(270), null);
  assert.equal(snap.observe(220), 0);
  snap.finish();
  assert.equal(snap.observe(0), null);
});

test('layout notifications at rest and endpoint jumps do not start unwanted transitions', () => {
  const snap = exports.createReadingSnap(340);
  assert.equal(snap.observe(0), null);
  assert.equal(snap.observe(0), null);
  assert.equal(snap.observe(340), null);
  assert.equal(snap.observe(340), null);
  assert.equal(snap.observe(0), null);
  assert.equal(snap.observe(0), null);
});
