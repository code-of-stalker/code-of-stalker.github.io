import assert from 'node:assert/strict';
import test from 'node:test';
import { registerHooks } from 'node:module';

registerHooks({ resolve(specifier, context, next) {
  if (specifier.startsWith('.') && !/\.(ts|mjs|js)(\?|$)/.test(specifier)) return next(specifier + '.ts', context);
  return next(specifier, context);
} });
const { emptyProduct, observationAad } = await import('./model.ts');

// Exercise the web adapter with real Web Crypto, blobs and preview URLs. Only
// the IndexedDB transport is in memory, so these tests never touch a diary.
let instance = 0;
function indexedDbFixture() {
  const values = new Map();
  const fixture = { values, failClear: false };
  globalThis.indexedDB = { open() {
    const connection = { createObjectStore() {}, close() {}, transaction() {
      const transaction = {};
      function request(work) {
        const result = {};
        queueMicrotask(() => {
          try { result.result = work(); transaction.oncomplete?.(); }
          catch { transaction.onabort?.(); }
        });
        return result;
      }
      transaction.objectStore = () => ({
        get: name => request(() => values.get(name)),
        put: (value, name) => request(() => values.set(name, value)),
        add: (value, name) => request(() => { if (values.has(name)) throw Error('exists'); values.set(name, value); }),
        delete: name => request(() => values.delete(name)),
        clear: () => request(() => { if (fixture.failClear) throw Error('clear rejected'); values.clear(); }),
      });
      return transaction;
    } };
    const request = { result: connection };
    queueMicrotask(() => request.onsuccess?.());
    return request;
  } };
  return fixture;
}
const fresh = async () => (await import(`./storage.ts?webInstance=${instance++}`)).productStorage;
const meta = { level: 'basic', step: 1, questionIndex: 0 };

test('fourth-step bookmark reopens without overwriting the third step', async () => {
  indexedDbFixture(); const repo = await fresh();
  const three = { chapter: 1, page: 2, offset: 187 }, four = { page: 6, offset: 240 };
  await repo.updateProgress({ stepThreeReading: three, stepFourReading: four });
  await repo.updateProgress({ step: 2 });
  const restored = await (await fresh()).read();
  assert.deepEqual(restored.progress.stepThreeReading, three);
  assert.deepEqual(restored.progress.stepFourReading, four);
  await assert.rejects(repo.updateProgress({ stepFourReading: { page: 99, offset: 0 } }));
  await assert.rejects(repo.updateProgress({ stepFourReading: { page: 1, offset: -1 } }));
});

test('step three reading location survives reload, other steps and a return to the beginning', async () => {
  indexedDbFixture(); const repo = await fresh();
  const location = { chapter: 1, page: 2, offset: 187 };
  await repo.updateProgress({ stepThreeReading: location });
  await repo.updateProgress({ step: 2 });
  const reopened = await fresh();
  assert.deepEqual((await reopened.read()).progress.stepThreeReading, location);
  await reopened.updateProgress({ stepThreeReading: { chapter: 0, page: 0, offset: 0 } });
  assert.deepEqual((await (await fresh()).read()).progress.stepThreeReading, { chapter: 0, page: 0, offset: 0 });
  await assert.rejects(reopened.updateProgress({ stepThreeReading: { chapter: 1, page: 99, offset: 0 } }));
});

test('web storage saves full-length assignment and diary files above the former byte limits', async () => {
  indexedDbFixture(); const repo = await fresh();
  for (const [durationMs, size, diary] of [[180000, 2 * 1024 * 1024, false], [900000, 9 * 1024 * 1024, true]]) {
    const bytes = new Uint8Array(size); bytes[0] = 42; bytes[size - 1] = 73;
    const voice = { ...capture(), durationMs };
    URL.revokeObjectURL(voice.uri); voice.uri = URL.createObjectURL(new Blob([bytes], { type: voice.mimeType }));
    try {
      const saved = diary ? await repo.saveDiaryVoice(voice, 'observation') : await repo.save(voice, meta);
      const record = saved.entry ?? saved.observation, reopened = await fresh();
      const uri = await reopened.loadPlayback(record.id);
      try { assert.deepEqual(new Uint8Array(await (await fetch(uri)).arrayBuffer()), bytes); }
      finally { reopened.discardPlayback(uri); }
    } finally { URL.revokeObjectURL(voice.uri); }
  }
});

test('web diary text and long report reopen encrypted; bookmarks do not invalidate old or new audio', async () => {
  const fixture = indexedDbFixture(), repo = await fresh(), voice = capture();
  try {
    const old = await repo.save(voice, meta);
    await repo.saveDiaryText('private diary report', 'dynamics');
    const report = await repo.saveDiaryVoice({ ...voice, durationMs: 900000 }, 'dynamics');
    await repo.setListenLater(old.observation.id, true); await repo.setListenLater(report.entry.id, true);
    const reopened = await fresh(), state = await reopened.read();
    assert.equal(state.diaryEntries.length, 2); assert.equal(state.listenLater.length, 2);
    const bytes = new TextDecoder().decode(fixture.values.get('state').bytes);
    assert.equal(bytes.includes('private diary report'), false);
    for (const id of state.listenLater) { const uri = await reopened.loadPlayback(id); assert.equal((await (await fetch(uri)).arrayBuffer()).byteLength, 128); reopened.discardPlayback(uri); }
    await reopened.delete(report.entry.id); assert.deepEqual((await (await fresh()).read()).listenLater, [old.observation.id]);
  } finally { URL.revokeObjectURL(voice.uri); }
});
function capture() {
  return { uri: URL.createObjectURL(new Blob([new Uint8Array(128)], { type: 'audio/webm' })),
    durationMs: 1200, waveform: [0.2, 0.5], mimeType: 'audio/webm' };
}

test('Safari AAC and Opus codec parameters survive save, reopen and authenticated playback', async () => {
  const fixture = indexedDbFixture(), repository = await fresh();
  const formats = ['audio/mp4;codecs=mp4a.40.2', 'audio/mp4; codecs="mp4a.40.2"', 'audio/webm;codecs=opus', 'audio/ogg; codecs=opus'];
  const saved = [];
  for (const mimeType of formats) {
    const bytes = new Uint8Array(128).fill(saved.length + 1);
    const draft = { ...capture(), mimeType };
    URL.revokeObjectURL(draft.uri);
    draft.uri = URL.createObjectURL(new Blob([bytes], { type: mimeType }));
    try {
      const { observation } = await repository.save(draft, meta);
      assert.equal(observation.mimeType, mimeType);
      const reopened = await fresh(), state = await reopened.read();
      const record = state.observations.find(item => item.id === observation.id);
      assert.equal(record.mimeType, mimeType);
      assert.equal(observationAad(record), observationAad(observation));
      const preview = await reopened.loadPlayback(observation.id);
      try { assert.deepEqual(new Uint8Array(await (await fetch(preview)).arrayBuffer()), bytes); }
      finally { reopened.discardPlayback(preview); }
      saved.push(observation);
    } finally { URL.revokeObjectURL(draft.uri); }
  }
  assert.equal((await (await fresh()).read()).observations.length, formats.length);
  assert.equal([...fixture.values.keys()].filter(key => key.startsWith('audio-')).length, formats.length);
});

test('an unsupported new audio format does not write files or modify an existing diary', async () => {
  const fixture = indexedDbFixture(), repository = await fresh(), draft = capture();
  try {
    const first = await repository.save(draft, meta), previousFiles = new Map(fixture.values);
    for (const mimeType of ['text/html', 'audio/mp4;codecs=', 'audio/webm\r\n', 'audio/wav']) {
      await assert.rejects(repository.save({ ...draft, mimeType }, meta), /неподдерживаемый формат/);
      assert.deepEqual(fixture.values, previousFiles);
      assert.deepEqual((await repository.read()).observations, first.snapshot.observations);
    }
  } finally { URL.revokeObjectURL(draft.uri); }
});
test('web reset deletes the encryption key, all audio and progress, and revokes opened audio', async () => {
  const fixture = indexedDbFixture(), repository = await fresh(), draft = capture();
  try {
    await repository.updateSettings({ startAt: 'diary', microphoneCheck: false });
    await repository.updateProgress({ selectedLevel: 'basic', questionIndex: 3 });
    const saved = await repository.save(draft, meta), preview = await repository.loadPlayback(saved.observation.id);
    assert.equal((await fetch(preview)).status, 200);
    fixture.values.set('audio-orphan', new Uint8Array([1]));
    assert.equal(fixture.values.has('key'), true);
    assert.deepEqual(await repository.reset(), emptyProduct());
    assert.equal(fixture.values.size, 0);
    await assert.rejects(fetch(preview));
    assert.deepEqual(await (await fresh()).read(), emptyProduct());
    const newSave = await repository.save(draft, meta);
    assert.deepEqual((await (await fresh()).read()).observations, newSave.snapshot.observations);
  } finally { URL.revokeObjectURL(draft.uri); }
});
test('failed browser reset reports an error and retains the readable diary', async () => {
  const fixture = indexedDbFixture(), repository = await fresh(), draft = capture();
  try {
    const saved = await repository.save(draft, meta);
    fixture.failClear = true;
    await assert.rejects(repository.reset(), /Не удалось сбросить/);
    assert.deepEqual((await repository.read()).observations, saved.snapshot.observations);
    fixture.failClear = false;
    await repository.reset();
    assert.equal(fixture.values.size, 0);
  } finally { URL.revokeObjectURL(draft.uri); }
});
test('browser reset clears a preceding write and never restores its cached settings', async () => {
  const fixture = indexedDbFixture(), repository = await fresh();
  const write = repository.updateSettings({ startAt: 'diary' }), reset = repository.reset();
  await write; await reset;
  assert.deepEqual(await repository.read(), emptyProduct());
  assert.equal(fixture.values.size, 0);
});
