import assert from 'node:assert/strict';
import test from 'node:test';
import { registerHooks } from 'node:module';
registerHooks({ resolve(specifier, context, next) {
  return next(specifier.startsWith('.') && !/\.(ts|mjs|js)(\?|$)/.test(specifier) ? specifier + '.ts' : specifier, context);
} });
let instance = 0;
const fresh = async () => (await import(`./storage.ts?backupInstance=${instance++}`)).productStorage;
function fixture() {
  const values = new Map(), result = { values, failCommit: false };
  globalThis.indexedDB = { open() {
    const connection = { close() {}, transaction(_name, mode) {
      const pending = new Map(values), transaction = {}; let jobs = 0, aborted = false;
      const abort = () => { if (aborted) return; aborted = true; queueMicrotask(() => transaction.onabort?.()); };
      transaction.abort = abort;
      function request(work) {
        jobs++; const req = {};
        queueMicrotask(() => {
          if (aborted) return;
          try { req.result = work(); req.onsuccess?.(); }
          catch { abort(); return; }
          jobs--;
          if (!jobs) queueMicrotask(() => {
            if (aborted || jobs) return;
            if (mode === 'readwrite') { values.clear(); pending.forEach((value, name) => values.set(name, value)); }
            transaction.oncomplete?.();
          });
        });
        return req;
      }
      transaction.objectStore = () => ({
        get: name => request(() => pending.get(name)),
        put: (value, name) => request(() => { if (result.failCommit && name === 'state') throw Error('quota'); pending.set(name, value); }),
        add: (value, name) => request(() => { if (pending.has(name)) throw Error('exists'); pending.set(name, value); }),
        delete: name => request(() => pending.delete(name)), clear: () => request(() => pending.clear()),
      }); return transaction;
    } };
    const req = { result: connection }; queueMicrotask(() => req.onsuccess?.()); return req;
  } }; return result;
}
function capture() { return { uri: URL.createObjectURL(new Blob([new Uint8Array(128).fill(42)], { type: 'audio/webm' })), durationMs: 1200, waveform: [0.4], mimeType: 'audio/webm' }; }
test('export is complete and restore re-encrypts audio and metadata with a different local key', async () => {
  fixture(); const original = await fresh(), draft = capture();
  let data;
  try {
    const answer = await original.save(draft, { level: 'basic', step: 1, questionIndex: 0 });
    const voice = await original.saveDiaryVoice(draft, 'dynamics');
    await original.saveDiaryText('Private text', 'observation'); await original.setListenLater(answer.observation.id, true);
    data = await original.createBackup();
    const target = fixture(), destination = await fresh();
    await destination.saveDiaryText('Newer local text', 'dynamics');
    const saved = await destination.restoreBackup(data);
    assert.equal(saved.diaryEntries.length, 3);
    for (const id of [answer.observation.id, voice.entry.id]) {
      const playback = await destination.loadPlayback(id);
      assert.deepEqual(new Uint8Array(await (await fetch(playback)).arrayBuffer()), new Uint8Array(128).fill(42)); destination.discardPlayback(playback);
    }
    const reopened = await fresh(); assert.deepEqual(await reopened.read(), saved);
    assert.deepEqual(await reopened.restoreBackup(data), saved);
    assert.equal(new TextDecoder().decode(target.values.get('state').bytes).includes('Private text'), false);
  } finally { URL.revokeObjectURL(draft.uri); }
});
test('quota failure rolls back all imported audio and metadata, then retry succeeds', async () => {
  fixture(); const source = await fresh(), draft = capture();
  try {
    await source.save(draft, { level: 'basic', step: 1, questionIndex: 0 }); const data = await source.createBackup();
    const target = fixture(), destination = await fresh();
    await destination.saveDiaryText('Keep me', 'observation'); const previous = new Map(target.values), snapshot = await destination.read();
    target.failCommit = true;
    await assert.rejects(destination.restoreBackup(data), /Текущие данные не изменены/);
    assert.deepEqual(target.values, previous); assert.deepEqual(await destination.read(), snapshot);
    target.failCommit = false; assert.equal((await destination.restoreBackup(data)).observations.length, 1);
  } finally { URL.revokeObjectURL(draft.uri); }
});
test('a missing source voice file prevents exporting a misleading partial copy', async () => {
  const db = fixture(), repo = await fresh(), draft = capture();
  try {
    const saved = await repo.save(draft, { level: 'basic', step: 1, questionIndex: 0 });
    db.values.delete(`audio-${saved.observation.id}`);
    await assert.rejects(repo.createBackup(), /Полная копия не создана/);
  } finally { URL.revokeObjectURL(draft.uri); }
});
test('export refreshes metadata committed by another tab and records its own creation date', async () => {
  fixture(); const first = await fresh(); await first.read();
  const second = await fresh(); await second.saveDiaryText('From another tab', 'observation');
  const copy = await first.createBackup(); assert.equal(copy.snapshot.diaryEntries[0].text, 'From another tab');
  assert.equal(copy.snapshot.settings.lastBackupAt, copy.createdAt);
});
