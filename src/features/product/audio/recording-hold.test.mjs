import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const exports = {};
vm.runInNewContext(ts.transpileModule(readFileSync(new URL('./recording-hold.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
}).outputText, { exports, require: () => JSON.parse(readFileSync(new URL('../../../../assets/product/motion/laboratory-voice.json', import.meta.url))), Math });
function setup() {
  let phase = 'idle', starts = 0, stops = 0, cancels = 0, progress = 0, locked = false, granted = true, hint = '';
  let prepare = async () => {}, permission = async () => true;
  const hold = exports.createRecordingHold({
    canBegin: () => phase === 'idle', phase: () => phase, permissionReady: () => granted,
    requestPermission: async () => { const result = await permission(); granted = result; return result; },
    start: async () => { starts++; phase = 'preparing'; await prepare(); if (phase === 'preparing') phase = 'recording'; },
    stop: async () => { stops++; phase = phase === 'recording' ? 'ready' : 'idle'; },
    cancel: async () => { cancels++; phase = 'idle'; },
    progress: (value, fixed) => { progress = value; locked = fixed; }, hint: value => { hint = value; },
  });
  return { hold, prepare: value => { prepare = value; }, permission: value => { granted = false; permission = value; }, values: () => ({ phase, starts, stops, cancels, progress, locked, hint }) };
}

test('normal hold records and releasing saves the take', async () => {
  const s = setup(); await s.hold.begin(500, 1); await s.hold.end();
  assert.equal(s.values().phase, 'ready'); assert.equal(s.values().starts, 1); assert.equal(s.values().cancels, 0);
});
test('scaled slide fills the lock, releasing keeps recording, next press stops', async () => {
  const s = setup(); await s.hold.begin(500, 1.5); s.hold.move(428);
  assert.equal(s.values().progress, .5); assert.equal(s.values().locked, false);
  s.hold.move(355); assert.equal(s.values().locked, true);
  await s.hold.end(); assert.equal(s.values().phase, 'recording'); assert.equal(s.values().stops, 0);
  await s.hold.begin(400, 1.5); assert.equal(s.values().phase, 'ready'); assert.equal(s.values().starts, 1);
});
test('reversing a partial slide restores the arrow', async () => {
  const s = setup(); await s.hold.begin(500, 1); s.hold.move(452); s.hold.move(510);
  assert.equal(s.values().progress, 0); assert.equal(s.values().locked, false);
});
test('first hold starts capture even when the permission cache is unavailable', async () => {
  const s = setup(); s.permission(() => { throw new Error('separate permission capture is forbidden'); });
  await s.hold.begin(500, 1);
  assert.equal(s.values().starts, 1); assert.equal(s.values().phase, 'recording');
  await s.hold.end(); assert.equal(s.values().phase, 'ready');
});
test('release during preparation cannot produce a late recording', async () => {
  const s = setup(); let prepared; s.prepare(() => new Promise(resolve => { prepared = resolve; }));
  const first = s.hold.begin(500, 1); await s.hold.end(); prepared(); await first;
  assert.equal(s.values().phase, 'idle'); assert.equal(s.values().locked, false);
});
test('pointer cancellation leaves a locked recording running and cancels an ordinary hold', async () => {
  const s = setup(); await s.hold.begin(500, 1); s.hold.move(400); await s.hold.cancel();
  assert.equal(s.values().phase, 'recording');
  s.hold.reset(); await s.hold.cancel(); assert.equal(s.values().phase, 'idle');
});
