import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const model = {}, repository = {};
const compile = name => ts.transpileModule(readFileSync(new URL(name, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
vm.runInNewContext(compile('./model.ts'), { exports: model, require: () => ({}), Error, Number, Set, JSON });
vm.runInNewContext(compile('./repository.ts'), { exports: repository, require: () => model, Date, JSON, Error, Promise });
function fixture(initial = model.emptyProduct()) {
  let saved = structuredClone(initial);
  const ports = { readState: async () => saved, writeState: async value => { saved = structuredClone(value); } };
  return { store: new repository.ProductRepository(ports), reopen: () => new repository.ProductRepository(ports), read: () => saved };
}

test('reading stage and second question survive separate repository lifetimes', async () => {
  const { store, reopen } = fixture();
  await store.updateProgress({ selectedLevel: 'basic', practiceStage: 2 });
  assert.equal(model.resumePracticeStage((await reopen().read()).progress), 2);
  await store.updateProgress({ practiceStage: 4, questionIndex: 1 });
  const resumed = (await reopen().read()).progress;
  assert.equal(model.resumePracticeStage(resumed), 4);
  assert.equal(resumed.questionIndex, 1);
});

test('backtracking and same-exercise selection preserve the actual position', async () => {
  const { store, read } = fixture();
  await store.updateProgress({ selectedLevel: 'basic', practiceStage: 4, questionIndex: 2 });
  await Promise.all([store.updateProgress({ questionIndex: 1 }), store.updateProgress({ questionIndex: 0 }), store.updateProgress({ practiceStage: 3 })]);
  await store.updateProgress({ selectedLevel: 'basic' });
  assert.equal(read().progress.practiceStage, 3);
  assert.equal(read().progress.questionIndex, 0);
});

test('step two restores its prompts, answer index and closing block across reloads', async () => {
  const { store, reopen } = fixture();
  await store.updateProgress({ selectedLevel: 'basic', step: 2, practiceStage: 2 });
  assert.equal(model.resumePracticeStage((await reopen().read()).progress), 2);
  await store.updateProgress({ practiceStage: 3, questionIndex: 2 });
  const answering = (await reopen().read()).progress;
  assert.equal(model.resumePracticeStage(answering), 3);
  assert.equal(answering.questionIndex, 2);
  await store.updateProgress({ practiceStage: 4 });
  assert.equal(model.resumePracticeStage((await reopen().read()).progress), 4);
});

test('different steps/levels reset position; explicit diary/question entry wins', async () => {
  const { store, read } = fixture();
  await store.updateProgress({ selectedLevel: 'basic', practiceStage: 4, questionIndex: 2 });
  await store.updateProgress({ step: 2 });
  assert.equal(model.resumePracticeStage(read().progress), 0);
  assert.equal(read().progress.questionIndex, 0);
  await store.updateProgress({ step: 1, questionIndex: 3, practiceStage: 4 });
  assert.equal(model.resumePracticeStage(read().progress), 4);
  assert.equal(read().progress.questionIndex, 3);
  await store.updateProgress({ selectedLevel: 'guidance' });
  assert.equal(model.resumePracticeStage(read().progress), 0);
  assert.equal(read().progress.questionIndex, 0);
});

test('legacy snapshots stay readable and resume known later questions', () => {
  const old = model.emptyProduct();
  delete old.progress.practiceStage;
  assert.equal(model.validateSnapshot(old), old);
  assert.equal(model.resumePracticeStage(old.progress), 0);
  old.progress.questionIndex = 1;
  assert.equal(model.resumePracticeStage(old.progress), 4);
  old.progress.step = 2;
  assert.equal(model.resumePracticeStage(old.progress), 0);
});

test('invalid stage is rejected without replacing persisted progress', async () => {
  for (const practiceStage of [-1, 5, 1.5, '4', null]) {
    const { store, read } = fixture();
    await assert.rejects(store.updateProgress({ practiceStage }), /настройки/);
    assert.equal(read().progress.practiceStage, 0);
  }
});
