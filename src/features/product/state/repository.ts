import { accessibleProgress, DIARY_LIMIT_SECONDS, emptyProduct, patchProgress, STEP_WAIT_MS, validateDiaryCategory, validateDiaryText, validateMeta, validateObservationDraft, validateSnapshot } from './model';
import type { AudioRecord, DiaryAudio, DiaryCategory, DiaryEntry, Observation, ObservationDraft, ObservationMeta, ProductProgress, ProductSettings, ProductSnapshot } from './model';
import { trimTextRuns, validateTextRuns, type DiaryTextRun } from '../diary/text-format';
import { BACKUP_MAX_BYTES, BACKUP_METADATA_MAX_BYTES, backupAudioRecords, mergeBackup, validateBackup } from './backup-model';
import type { BackupAudio, BackupData } from './backup-model';

export type ProductPorts = {
  readState(): Promise<ProductSnapshot | null>;
  writeState(value: ProductSnapshot): Promise<void>;
  randomId(): Promise<string>;
  saveAudio(record: AudioRecord, draft: ObservationDraft): Promise<void>;
  loadAudio(record: AudioRecord): Promise<string>;
  removeAudio(id: string): Promise<void>;
  discardPlayback(uri: string): void;
  resetStorage(): Promise<void>;
  readAudioBytes?(record: AudioRecord): Promise<Uint8Array<ArrayBuffer>>;
  restoreBackup?(next: ProductSnapshot, audio: BackupAudio[], expected: ProductSnapshot): Promise<void>;
};
function clone(value: ProductSnapshot): ProductSnapshot { return JSON.parse(JSON.stringify(value)); }

// All saves share one queue. A stale screen cannot overwrite a newer setting or
// delete another recording while an encrypted write is still being committed.
export class ProductRepository {
  private tail: Promise<unknown> = Promise.resolve();
  private state: ProductSnapshot | null = null;
  constructor(private ports: ProductPorts) {}
  private serial<T>(work: () => Promise<T>): Promise<T> {
    const next = this.tail.then(work);
    this.tail = next.catch(() => {});
    return next;
  }
  private async current() {
    if (!this.state) this.state = validateSnapshot(await this.ports.readState() ?? emptyProduct());
    return clone(this.state);
  }
  private async commit(next: ProductSnapshot) {
    validateSnapshot(next);
    try { await this.ports.writeState(next); }
    catch (error) { this.state = null; throw error; }
    this.state = clone(next);
    return clone(next);
  }
  read() { return this.serial(() => this.current()); }
  createBackup() {
    return this.serial(async (): Promise<BackupData> => {
      if (!this.ports.readAudioBytes) throw new Error('Резервные копии пока доступны в веб-версии.');
      const snapshot = validateSnapshot(await this.ports.readState() ?? emptyProduct());
      this.state = clone(snapshot);
      const data: BackupData = { createdAt: Date.now(), snapshot: clone(snapshot), audio: [] };
      data.snapshot.settings.lastBackupAt = data.createdAt;
      try {
        const metadataSize = new TextEncoder().encode(JSON.stringify(snapshot)).byteLength;
        if (metadataSize > BACKUP_METADATA_MAX_BYTES) throw new Error('Список записей слишком велик для одной копии.');
        let size = metadataSize;
        for (const record of backupAudioRecords(snapshot)) {
          const bytes = await this.ports.readAudioBytes(record);
          data.audio.push({ id: record.id, bytes }); size += bytes.byteLength;
          if (size + 4096 > BACKUP_MAX_BYTES) throw new Error('Копия превышает 512 МБ.');
        }
        validateBackup(data); return data;
      } catch (error) { data.audio.forEach(item => item.bytes.fill(0)); throw error; }
    });
  }
  restoreBackup(data: BackupData) {
    return this.serial(async () => {
      if (!this.ports.restoreBackup) throw new Error('Восстановление копий пока доступно в веб-версии.');
      // Refresh from disk before merging, including changes from another tab.
      const current = validateSnapshot(await this.ports.readState() ?? emptyProduct());
      const next = mergeBackup(current, data);
      try { await this.ports.restoreBackup(next, data.audio, current); }
      catch (error) { this.state = null; throw error; }
      this.state = clone(next); return clone(next);
    });
  }
  reset() {
    return this.serial(async () => {
      // Clear the whole namespace, including orphaned audio from failed saves.
      // A reset must also work when the old snapshot cannot be decrypted.
      try { await this.ports.resetStorage(); }
      catch (error) { this.state = null; throw error; }
      this.state = emptyProduct();
      return clone(this.state);
    });
  }
  updateSettings(patch: Partial<ProductSettings>) {
    const copy = { ...patch };
    return this.serial(async () => {
      const next = await this.current();
      // Restore the normal route; keep earned deadlines and test observations.
      if (copy.testUnlockAll === false && next.settings.testUnlockAll) {
        next.progress = accessibleProgress(next.progress);
      }
      next.settings = { ...next.settings, ...copy };
      return this.commit(next);
    });
  }
  updateProgress(patch: Partial<ProductProgress>) {
    const copy = { ...patch };
    return this.serial(async () => { const next = await this.current(); next.progress = patchProgress(next.progress, copy); return this.commit(next); });
  }
  completeFirstStep() {
    return this.serial(async () => {
      const next = await this.current();
      if (next.progress.step !== 1) throw new Error('Завершение этого шага пока недоступно.');
      // A repeat save or completion click never restarts an earned cooldown.
      if (next.progress.completedAt !== null) return next;
      const level = next.progress.selectedLevel ?? 'basic';
      const missing = [0, 1, 2, 3].filter(index => !next.observations.some(record =>
        record.level === level && record.step === 1 && record.questionIndex === index));
      if (missing.length) throw new Error(`Сначала сохрани ответы на вопросы: ${missing.map(index => index + 1).join(', ')}.`);
      const completedAt = Date.now();
      next.progress = { ...next.progress, completedAt, availableAt: completedAt + STEP_WAIT_MS };
      return this.commit(next);
    });
  }
  completeSecondStep() {
    return this.serial(async () => {
      const next = await this.current();
      if (next.progress.step === 3 && next.progress.secondStepCompletedAt) return next;
      if (next.progress.step !== 2 || next.progress.practiceStage !== 4) throw new Error('Сначала пройди задания второго шага.');
      const level = next.progress.selectedLevel ?? 'basic';
      const missing = [0, 1, 2, 3].filter(index => !next.observations.some(record =>
        record.level === level && record.step === 2 && record.questionIndex === index));
      if (missing.length) throw new Error(`Сначала сохрани ответы на вопросы: ${missing.map(index => index + 1).join(', ')}.`);
      next.progress = { ...next.progress, secondStepCompletedAt: next.progress.secondStepCompletedAt ?? Date.now(), step: 3, practiceStage: 0, questionIndex: 0 };
      return this.commit(next);
    });
  }
  save(draft: ObservationDraft, metadata: ObservationMeta): Promise<{ snapshot: ProductSnapshot; observation: Observation }> {
    const capture = { ...draft, waveform: [...draft.waveform] }, meta = { ...metadata };
    return this.serial(async () => {
      validateObservationDraft(capture); validateMeta(meta);
      const next = await this.current();
      const observation: Observation = { ...meta, id: await this.ports.randomId(), localRef: '', createdAt: Date.now(),
        durationMs: capture.durationMs, waveform: [...capture.waveform], mimeType: capture.mimeType ?? 'audio/mp4' };
      observation.localRef = observation.id;
      validateSnapshot({ ...next, observations: [observation, ...next.observations] });
      await this.ports.saveAudio(observation, capture);
      // If metadata persistence is ambiguous, keep the encrypted file. A failed
      // commit must never remove audio that may already be referenced on disk.
      next.observations = [observation, ...next.observations];
      return { snapshot: await this.commit(next), observation };
    });
  }
  delete(id: string) {
    return this.serial(async () => {
      const next = await this.current();
      if (![...next.observations, ...(next.diaryEntries ?? [])].some(item => item.id === id)) return next;
      const audio = next.observations.some(item => item.id === id) || next.diaryEntries?.some(item => item.id === id && item.kind === 'audio');
      next.observations = next.observations.filter(item => item.id !== id);
      if (next.diaryEntries) next.diaryEntries = next.diaryEntries.filter(item => item.id !== id);
      if (next.listenLater) next.listenLater = next.listenLater.filter(item => item !== id);
      const saved = await this.commit(next);
      if (audio) try { await this.ports.removeAudio(id); } catch { /* Unreferenced encrypted bytes can be cleaned up later. */ }
      return saved;
    });
  }
  loadPlayback(id: string) {
    return this.serial(async () => {
      const state = await this.current(), record = [...state.observations, ...(state.diaryEntries ?? []).filter((entry): entry is DiaryAudio => entry.kind === 'audio')].find(item => item.id === id);
      if (!record) throw new Error('Эта запись уже удалена.');
      return this.ports.loadAudio(record);
    });
  }
  saveDiaryText(text: string, category: DiaryCategory, format?: DiaryTextRun[]) {
    const body = text.trim();
    if (format !== undefined) validateTextRuns(format, text);
    const styled = format ? trimTextRuns(text, format) : undefined;
    return this.serial(async () => {
      validateDiaryText(body); validateDiaryCategory(category);
      const next = await this.current();
      const entry: DiaryEntry = { id: await this.ports.randomId(), createdAt: Date.now(), category, kind: 'text', text: body, ...(styled?.some(run => Object.keys(run.style).length) ? { format: styled } : {}) };
      next.diaryEntries = [entry, ...(next.diaryEntries ?? [])];
      return { snapshot: await this.commit(next), entry };
    });
  }
  saveDiaryVoice(draft: ObservationDraft, category: DiaryCategory) {
    const capture = { ...draft, waveform: [...draft.waveform] };
    return this.serial(async () => {
      validateObservationDraft(capture, DIARY_LIMIT_SECONDS); validateDiaryCategory(category);
      const next = await this.current(), id = await this.ports.randomId();
      const entry: DiaryAudio = { id, localRef: id, createdAt: Date.now(), category, kind: 'audio', durationMs: capture.durationMs, waveform: capture.waveform, mimeType: capture.mimeType ?? 'audio/mp4' };
      validateSnapshot({ ...next, diaryEntries: [...(next.diaryEntries ?? []), entry] });
      await this.ports.saveAudio(entry, capture);
      next.diaryEntries = [entry, ...(next.diaryEntries ?? [])];
      return { snapshot: await this.commit(next), entry };
    });
  }
  setListenLater(id: string, marked: boolean) {
    return this.serial(async () => {
      const next = await this.current();
      const record = [...next.observations, ...(next.diaryEntries ?? [])].find(item => item.id === id);
      if (!record || ('kind' in record && record.kind !== 'audio')) throw new Error('В подборку можно добавить только голосовую запись.');
      const ids = new Set(next.listenLater ?? []);
      if (marked) ids.add(id); else ids.delete(id);
      next.listenLater = [...ids];
      return this.commit(next);
    });
  }
  discardPlayback(uri: string) { this.ports.discardPlayback(uri); }
}
