import assert from 'node:assert/strict';
import test from 'node:test';
import { registerHooks } from 'node:module';
registerHooks({ resolve(specifier, context, next) {
  return next(specifier.startsWith('.') && !/\.(ts|mjs|js)$/.test(specifier) ? specifier + '.ts' : specifier, context);
} });
const { ProductRepository } = await import('../state/repository.ts');
const { emptyProduct, observationAad, validateSnapshot } = await import('../state/model.ts');
const { filterDiary, emptyDiaryFilter, parseDiaryDate, diaryQuestion, diaryMaterial } = await import('./feed.ts');
const { formatTextRuns, rebaseTextRuns, trimTextRuns, validateTextRuns } = await import('./text-format.ts');
function fixture() {
  let saved = null, sequence = 0, fail = false;
  const audio = new Map();
  const ports = {
    readState: async () => saved && structuredClone(saved),
    writeState: async next => { if (fail) throw Error('disk full'); saved = structuredClone(next); },
    randomId: async () => (++sequence).toString(16).padStart(32, '0'),
    saveAudio: async record => { audio.set(record.id, observationAad(record)); },
    loadAudio: async record => { assert.equal(audio.get(record.id), observationAad(record)); return 'blob:' + record.id; },
    removeAudio: async id => { audio.delete(id); }, discardPlayback() {}, resetStorage: async () => { saved = null; audio.clear(); },
  };
  return { repo: new ProductRepository(ports), reopen: () => new ProductRepository(ports), fail: value => { fail = value; }, audio };
}
const draft = { uri: 'blob:voice', durationMs: 1500, waveform: [.1, .6], mimeType: 'audio/webm;codecs=opus' };
const meta = { level: 'basic', step: 1, questionIndex: 0 };
test('selected-word formatting survives compact edits, trimming, persistence and reopen', async () => {
  const text = '  Заметил спокойствие сегодня  ', start = text.indexOf('спокойствие'), end = start + 'спокойствие'.length;
  const styled = formatTextRuns([{ text, style: {} }], start, end, { bold: true, italic: true, underline: true, size: 24, color: 'accent' });
  assert.equal(styled[1].text, 'спокойствие'); assert.equal(styled[0].style.bold, undefined); assert.equal(styled[2].style.bold, undefined);
  const changed = rebaseTextRuns(text, text.replace('сегодня', 'сегодня и вечером'), styled);
  assert.deepEqual(changed.find(run => run.text === 'спокойствие').style, styled[1].style);
  const f = fixture(), result = await f.repo.saveDiaryText(text, 'dynamics', styled);
  assert.equal(result.entry.text, text.trim()); assert.deepEqual(result.entry.format, trimTextRuns(text, styled));
  const snapshot = await f.reopen().read(); assert.deepEqual(snapshot.diaryEntries[0], result.entry); validateSnapshot(snapshot);
});
test('formatting accepts only bounded sizes and theme roles, with an exact text match', () => {
  const good = [{ text: 'Я здесь', style: { color: 'muted', size: 16 } }]; validateTextRuns(good, 'Я здесь');
  for (const color of ['secondary', 'faint']) validateTextRuns([{ text: 'Цвет из макета', style: { color } }], 'Цвет из макета');
  assert.throws(() => validateTextRuns(good, 'Я там'));
  assert.throws(() => validateTextRuns([{ text: 'Я здесь', style: { color: '#ff0000' } }], 'Я здесь'));
  assert.throws(() => validateTextRuns([{ text: 'Я здесь', style: { size: 3000 } }], 'Я здесь'));
  assert.throws(() => validateTextRuns([{ text: 'Я здесь', style: { html: '<script>' } }], 'Я здесь'));
});
test('legacy answers, diary text, long voice reports and bookmarks coexist and reopen without changing progress', async () => {
  const f = fixture(), legacy = await f.repo.save(draft, meta), progress = legacy.snapshot.progress;
  const oldAad = observationAad(legacy.observation);
  const text = await f.repo.saveDiaryText('  Моё наблюдение\nв две строки  ', 'observation');
  const voice = await f.repo.saveDiaryVoice({ ...draft, durationMs: 900000 }, 'dynamics');
  await f.repo.setListenLater(legacy.observation.id, true); await f.repo.setListenLater(voice.entry.id, true);
  const nextAnswer = await f.repo.save({ ...draft, durationMs: 180000 }, { ...meta, questionIndex: 1, questionText: 'Как реагирует ум?' });
  assert.equal(nextAnswer.observation.questionText, 'Как реагирует ум?');
  const reopened = f.reopen(), snapshot = await reopened.read();
  assert.deepEqual(snapshot.progress, progress); assert.equal(snapshot.diaryEntries.length, 2);
  assert.equal(text.entry.text, 'Моё наблюдение\nв две строки');
  assert.equal(observationAad(snapshot.observations.find(entry => entry.id === legacy.observation.id)), oldAad);
  await reopened.loadPlayback(legacy.observation.id); await reopened.loadPlayback(voice.entry.id);
  await reopened.delete(voice.entry.id); const next = await f.reopen().read();
  assert.deepEqual(next.listenLater, [legacy.observation.id]); assert.equal(next.diaryEntries.length, 1);
  assert.equal(f.audio.has(voice.entry.id), false); assert.equal(f.audio.has(legacy.observation.id), true);
});
test('failed writes and invalid drafts preserve existing entries; text cannot be bookmarked or played', async () => {
  const f = fixture(), result = await f.repo.saveDiaryText('Сохранённая запись', 'dynamics');
  f.fail(true); await assert.rejects(f.repo.saveDiaryText('Новая запись', 'observation'), /disk full/); f.fail(false);
  assert.equal((await f.reopen().read()).diaryEntries.length, 1);
  await assert.rejects(f.repo.saveDiaryText('   ', 'observation'));
  await assert.rejects(f.repo.saveDiaryVoice({ ...draft, durationMs: 902000 }, 'observation'));
  await assert.rejects(f.repo.save({ ...draft, durationMs: 182000 }, meta));
  await assert.rejects(f.repo.setListenLater(result.entry.id, true)); await assert.rejects(f.repo.loadPlayback(result.entry.id));
});
test('filters combine sources, media, levels, seven basic steps and inclusive local dates', () => {
  const entries = [
    { ...meta, id: 'a', createdAt: new Date(2026, 9, 10, 23, 59).getTime(), durationMs: 1000 },
    { ...meta, step: 7, id: 'b', createdAt: new Date(2026, 9, 11).getTime(), durationMs: 1000, questionText: 'Сохранённый вопрос' },
    { kind: 'text', category: 'dynamics', id: 'c', createdAt: new Date(2026, 9, 11, 10).getTime(), text: 'Изменение' },
    { kind: 'audio', category: 'observation', id: 'd', createdAt: new Date(2026, 9, 12).getTime(), durationMs: 30000 },
  ];
  assert.deepEqual(filterDiary(entries, emptyDiaryFilter, false, true).map(x => x.id), ['d','c']);
  assert.deepEqual(filterDiary(entries, emptyDiaryFilter, false, true, ['a','d']).map(x => x.id), ['d','a']);
  assert.deepEqual(filterDiary(entries, { ...emptyDiaryFilter, from: '2026-10-11', to: '2026-10-11' }, true, false).map(x => x.id), ['b','c']);
  assert.deepEqual(filterDiary(entries, { ...emptyDiaryFilter, level: 'basic', step: 7 }, true, true).map(x => x.id), ['b']);
  assert.deepEqual(filterDiary(entries, { ...emptyDiaryFilter, category: 'dynamics', media: 'text' }, true, true).map(x => x.id), ['c']);
  assert.equal(diaryQuestion(entries[1]), 'Сохранённый вопрос');
  assert.ok(diaryMaterial(entries[0]).startsWith('Сегодня заметь, как работает механизм сравнения.'));
  assert.equal(diaryMaterial(entries[1]), null);
  assert.equal(diaryMaterial({ ...entries[0], level: 'intensive' }), null);
  assert.match(diaryQuestion({ ...entries[0], step: 2, questionIndex: 0 }), /^Если все вокруг были бы главными героями/);
  assert.match(diaryMaterial({ ...entries[0], step: 2 }), /Присмотрись к телу|Ты знаешь только это тело/);
  assert.equal(parseDiaryDate('29.02.2024'), '2024-02-29'); assert.equal(parseDiaryDate('29.02.2025'), null);
  assert.equal(parseDiaryDate('31.04.2026'), null); assert.equal(parseDiaryDate(''), '');
});
test('legacy snapshots need no migration and invalid references cannot enter the playlist', () => {
  assert.deepEqual(validateSnapshot(emptyProduct()), emptyProduct());
  assert.throws(() => validateSnapshot({ ...emptyProduct(), listenLater: ['missing'] }));
});
