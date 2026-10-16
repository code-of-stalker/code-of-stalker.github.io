import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const compile = name => ts.transpileModule(fs.readFileSync(new URL(name, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
const holdModule = {}, diaryModule = {};
vm.runInNewContext(compile('../audio/recording-hold.ts'), { exports: holdModule, require: () => JSON.parse(fs.readFileSync(new URL('../../../../assets/product/motion/laboratory-voice.json', import.meta.url))), Math });
vm.runInNewContext(compile('./recording-gesture.ts'), { exports: diaryModule, require: () => holdModule, Math });
function fixture() {
  let phase = 'idle', fixed = false, progress = 0, cancelProgress = 0, starts = 0, cancels = 0;
  const gesture = diaryModule.createDiaryRecordingGesture({
    start: async () => { starts++; phase = 'recording'; }, stop: async () => { if (phase === 'recording') phase = 'ready'; }, cancel: async () => { cancels++; phase = 'idle'; },
    canBegin: () => phase === 'idle', phase: () => phase, permissionReady: () => true, requestPermission: async () => true,
    progress: (value, locked) => { progress = value; fixed = locked; }, cancelProgress: value => { cancelProgress = value; }, hint: () => {},
  });
  return { gesture, state: () => ({ phase, fixed, progress, cancelProgress, starts, cancels }) };
}
test('releasing an ordinary diary hold produces a reviewable take', async () => {
  const f = fixture(); await f.gesture.begin(300, 500); await f.gesture.end(); assert.equal(f.state().phase, 'ready');
});
test('small diary button keeps a 96 layout-pixel lock distance', async () => {
  const f = fixture(); await f.gesture.begin(300, 500); f.gesture.move(300, 480); assert.equal(f.state().fixed, false);
  f.gesture.move(300, 404); assert.equal(f.state().fixed, true); await f.gesture.end(); assert.equal(f.state().phase, 'recording');
  await f.gesture.begin(300, 500); assert.equal(f.state().phase, 'ready');
});
test('moving left cancels instead of saving; moving back restores normal release', async () => {
  const f = fixture(); await f.gesture.begin(300, 500); f.gesture.move(219, 500); assert.equal(f.state().cancelProgress, 1);
  await f.gesture.end(); assert.equal(f.state().phase, 'idle'); assert.equal(f.state().cancels, 1);
  await f.gesture.begin(300, 500); f.gesture.move(215, 500); f.gesture.move(290, 500); await f.gesture.end(); assert.equal(f.state().phase, 'ready');
});
test('locked recording ignores horizontal cancellation and pointer loss', async () => {
  const f = fixture(); await f.gesture.begin(300, 500); f.gesture.move(300, 400); f.gesture.move(100, 500);
  await f.gesture.cancel(); assert.equal(f.state().phase, 'recording'); assert.equal(f.state().cancels, 0);
});
test('accessible lock action keeps a recording running after release', async () => {
  const f = fixture(); await f.gesture.begin(300, 500); f.gesture.lock(); await f.gesture.end(); assert.equal(f.state().phase, 'recording');
  assert.equal(f.state().fixed, true);
});
