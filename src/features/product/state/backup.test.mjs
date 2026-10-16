import assert from 'node:assert/strict';
import test from 'node:test';
import { registerHooks } from 'node:module';
registerHooks({ resolve(specifier, context, next) {
  return next(specifier.startsWith('.') && !/\.(ts|mjs|js)(\?|$)/.test(specifier) ? specifier + '.ts' : specifier, context);
} });
const { emptyProduct } = await import('./model.ts');
const { BACKUP_MAX_BYTES, mergeBackup, validateBackup } = await import('./backup-model.ts');
const { readBackupFile } = await import('./backup-files.web.ts');
const { encryptBackup, decryptBackup } = await import('./backup-crypto.ts');
const { storageProtection } = await import('./storage-protection.ts');
const password = 'Проверка копии 12345';
function sample() {
  const snapshot = emptyProduct(), id = '1'.repeat(32), voiceId = '2'.repeat(32), textId = '3'.repeat(32);
  snapshot.settings.theme = 'neutral'; snapshot.progress.selectedLevel = 'basic'; snapshot.progress.questionIndex = 3;
  snapshot.observations = [{ id, localRef: id, level: 'basic', step: 1, questionIndex: 0, questionText: 'Вопрос', createdAt: 100, durationMs: 1200, waveform: [0.2, 0.8], mimeType: 'audio/webm;codecs=opus' }];
  snapshot.diaryEntries = [{ id: voiceId, localRef: voiceId, category: 'dynamics', kind: 'audio', createdAt: 110, durationMs: 900000, waveform: [0.5], mimeType: 'audio/mp4;codecs=mp4a.40.2' }, { id: textId, category: 'observation', kind: 'text', createdAt: 120, text: 'Личная запись' }];
  snapshot.listenLater = [id, voiceId];
  return { createdAt: 12345, snapshot, audio: [{ id, bytes: new Uint8Array(128).fill(42) }, { id: voiceId, bytes: new Uint8Array(128).fill(73) }] };
}
test('portable password-encrypted copy recovers all metadata and exact audio without a device key', async () => {
  const data = sample(); data.snapshot.settings.theme = 'violet';
  const one = await encryptBackup(data, password), two = await encryptBackup(data, password);
  assert.notDeepEqual(one, two, 'Fresh salt and nonce for every file');
  assert.equal(new TextDecoder().decode(one).includes('Личная запись'), false);
  assert.deepEqual(await decryptBackup(one, password), data);
});
test('restoring onto a calibrated empty device keeps its rendering preferences', () => {
  const current = emptyProduct(), data = sample();
  current.settings.effectQuality = 'economy'; current.settings.effectTargetFps = 60; current.settings.smoothness = false;
  data.snapshot.settings.effectQuality = 'high'; data.snapshot.settings.effectTargetFps = 120; data.snapshot.settings.smoothness = true;
  const restored = mergeBackup(current, data);
  assert.equal(restored.settings.effectQuality, 'economy'); assert.equal(restored.settings.effectTargetFps, 60); assert.equal(restored.settings.smoothness, false);
  assert.deepEqual(restored.observations, data.snapshot.observations); assert.deepEqual(restored.diaryEntries, [...data.snapshot.diaryEntries].sort((a, b) => b.createdAt - a.createdAt));
});
test('wrong password, altered ciphertext, truncated file and unsupported headers never produce import data', async () => {
  const file = await encryptBackup(sample(), password);
  await assert.rejects(decryptBackup(file, 'Неправильный пароль'), /Пароль не подходит/);
  const changed = file.slice(); changed[changed.length - 3] ^= 1;
  await assert.rejects(decryptBackup(changed, password), /файл повреждён/);
  await assert.rejects(decryptBackup(file.slice(0, 50), password), /повреждён/);
  const headerChanged = file.slice(); headerChanged[0] ^= 1;
  await assert.rejects(decryptBackup(headerChanged, password), /Выбери файл/);
  await assert.rejects(encryptBackup(sample(), 'short'), /12/);
});
test('incomplete audio and duplicate attachments are rejected', () => {
  const data = sample(); data.audio.pop(); assert.throws(() => validateBackup(data), /отсутствуют/);
  const duplicate = sample(); duplicate.audio.push(duplicate.audio[0]); assert.throws(() => validateBackup(duplicate), /повреждена/);
});

test('backup accepts 504 MiB of diary audio and rejects aggregate audio above 512 MiB', () => {
  assert.equal(BACKUP_MAX_BYTES, 512 * 1024 * 1024);
  const snapshot = emptyProduct(), bytes = new Uint8Array(24 * 1024 * 1024);
  snapshot.diaryEntries = [];
  const data = { createdAt: 12345, snapshot, audio: [] };
  // Reuse a single buffer: exercise aggregate limits without allocating half a gigabyte.
  for (let index = 1; index <= 22; index++) {
    const id = index.toString(16).padStart(32, '0');
    snapshot.diaryEntries.push({ id, localRef: id, category: 'observation', kind: 'audio', createdAt: 100 + index, durationMs: 900000, waveform: [0.5], mimeType: 'audio/webm;codecs=opus' });
    data.audio.push({ id, bytes });
    if (index === 21) assert.doesNotThrow(() => validateBackup(data));
  }
  assert.throws(() => validateBackup(data), /512 МБ/);
});

test('file reader accepts the new size cap and rejects larger files before reading', async () => {
  let reads = 0;
  const file = { size: BACKUP_MAX_BYTES, arrayBuffer: async () => { reads++; return new ArrayBuffer(32); } };
  assert.equal((await readBackupFile(file)).byteLength, 32);
  assert.equal(reads, 1);
  await assert.rejects(readBackupFile({ ...file, size: BACKUP_MAX_BYTES + 1 }), /512 МБ/);
  assert.equal(reads, 1);
});
test('import preserves newer records and progress, deduplicates repeated imports and restores an empty installation', () => {
  const data = sample(), current = emptyProduct();
  current.progress.questionIndex = 1; current.progress.selectedLevel = 'basic'; current.settings.theme = 'light';
  current.diaryEntries = [{ id: '4'.repeat(32), category: 'dynamics', kind: 'text', createdAt: 500, text: 'Новая запись' }];
  const merged = mergeBackup(current, data);
  assert.equal(merged.diaryEntries.length, 3); assert.equal(merged.settings.theme, 'light'); assert.equal(merged.progress.questionIndex, 1);
  assert.deepEqual(mergeBackup(merged, data), merged);
  const restored = mergeBackup(emptyProduct(), data);
  assert.equal(restored.settings.theme, 'neutral'); assert.equal(restored.progress.questionIndex, 3);
  assert.deepEqual(restored.listenLater, data.snapshot.listenLater);
  const conflict = sample(); conflict.snapshot.observations[0].durationMs += 1;
  assert.throws(() => mergeBackup(merged, conflict), /конфликтующим/);
});
test('protection reports the actual grant, denial, unsupported API and optional capacity failures', async () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  try {
    let granted = false, calls = 0;
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { storage: { persisted: async () => granted, persist: async () => { calls++; return granted; }, estimate: async () => ({ usage: 12, quota: 100 }) } } });
    assert.equal((await storageProtection()).state, 'standard'); assert.equal(calls, 0);
    assert.equal((await storageProtection(true)).state, 'standard'); granted = true;
    assert.deepEqual(await storageProtection(true), { state: 'protected', usage: 12, quota: 100 });
    globalThis.navigator.storage.estimate = async () => { throw Error('Unavailable'); };
    assert.equal((await storageProtection()).state, 'protected');
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: {} });
    assert.equal((await storageProtection(true)).state, 'unsupported');
  } finally { if (previous) Object.defineProperty(globalThis, 'navigator', previous); else delete globalThis.navigator; }
});
