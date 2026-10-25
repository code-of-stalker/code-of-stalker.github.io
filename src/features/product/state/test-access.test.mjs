import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const model = {}, repository = {};
const compile = name => ts.transpileModule(readFileSync(new URL(name, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
vm.runInNewContext(compile('./model.ts'), { exports: model, require: () => ({}), Error, Number, Set, JSON });
vm.runInNewContext(compile('./repository.ts'), { exports: repository, require: () => model, Date, JSON, Error, Promise });
const record = { id: 'b'.repeat(32), localRef: 'b'.repeat(32), level: 'basic', step: 2, questionIndex: 0, createdAt: 1000, durationMs: 1000, waveform: [.1], mimeType: 'audio/mp4' };
function fixture() {
  let saved = structuredClone(model.emptyProduct());
  const store = new repository.ProductRepository({ readState: async () => saved, writeState: async value => { saved = structuredClone(value); } });
  return { store, read: () => saved };
}
test('old settings remain readable; malformed test access cannot unlock content', () => {
  const old = structuredClone(model.emptyProduct()); delete old.settings.testUnlockAll;
  assert.equal(model.validateSnapshot(old), old);
  old.settings.testUnlockAll = 'true'; assert.throws(() => model.validateSnapshot(old), /настройки/);
});
test('test access leaves earned cooldown and recordings intact after disabling', async () => {
  const { store, read } = fixture();
  await store.updateProgress({ step: 2, completedAt: 1000, availableAt: Date.now() + 86400000 });
  read().observations.push(record);
  // Reload the repository so the initial saved record is authoritative.
  const reloaded = new repository.ProductRepository({ readState: async () => read(), writeState: async value => { Object.assign(read(), structuredClone(value)); } });
  const before = structuredClone(read());
  await reloaded.updateSettings({ testUnlockAll: true }); await reloaded.updateSettings({ testUnlockAll: false });
  assert.deepEqual(read().progress, before.progress); assert.deepEqual(read().observations, before.observations);
  assert.equal(read().settings.testUnlockAll, false);
});
test('disabling unearned test access returns to step one without deleting a recording', async () => {
  let saved = structuredClone(model.emptyProduct()); saved.observations = [record];
  const store = new repository.ProductRepository({ readState: async () => saved, writeState: async value => { saved = structuredClone(value); } });
  await store.updateSettings({ testUnlockAll: true }); await store.updateProgress({ step: 2, questionIndex: 3 });
  await store.updateSettings({ testUnlockAll: false });
  assert.equal(saved.progress.step, 1); assert.equal(saved.progress.availableAt, null);
  assert.deepEqual(saved.observations, [record]);
});
test('all-open mode and selected step survive a reload without earning completion', async () => {
  const { store, read } = fixture();
  await store.updateSettings({ testUnlockAll: true });
  await store.updateProgress({ selectedLevel: 'basic', step: 2 });
  const reloaded = new repository.ProductRepository({ readState: async () => read() });
  const snapshot = await reloaded.read();
  assert.equal(snapshot.settings.testUnlockAll, true);
  assert.equal(snapshot.progress.step, 2);
  assert.equal(snapshot.progress.completedAt, null);
  assert.equal(snapshot.progress.availableAt, null);
});

test('third-step preview survives reload without awarding either completion', async () => {
  const { store, read } = fixture();
  await store.updateSettings({ testUnlockAll: true });
  await store.updateProgress({ selectedLevel: 'basic', step: 3 });
  const reloaded = new repository.ProductRepository({ readState: async () => read() });
  const snapshot = await reloaded.read();
  assert.equal(model.accessibleProgress(snapshot.progress, snapshot.settings.testUnlockAll).step, 3);
  assert.equal(snapshot.progress.completedAt, null);
  assert.equal(snapshot.progress.secondStepCompletedAt, undefined);
  assert.equal(snapshot.progress.availableAt, null);
});

test('leaving third-step preview restores the earned step and keeps its cooldown', async () => {
  for (const availableAt of [null, Date.now() + 86400000]) {
    const { store, read } = fixture();
    await store.updateProgress({ availableAt });
    await store.updateSettings({ testUnlockAll: true });
    await store.updateProgress({ step: 3 });
    await store.updateSettings({ testUnlockAll: false });
    assert.equal(read().progress.step, availableAt === null ? 1 : 2);
    assert.equal(read().progress.availableAt, availableAt);
    assert.equal(read().progress.secondStepCompletedAt, undefined);
  }
});

test('earned third step remains accessible without preview access', () => {
  const progress = { ...model.defaultProgress, step: 3, secondStepCompletedAt: 1000 };
  assert.equal(model.accessibleProgress(progress, false), progress);
});
