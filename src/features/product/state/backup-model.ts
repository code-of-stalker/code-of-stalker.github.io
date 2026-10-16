import { audioByteLimit, observationAad, validateSnapshot } from './model';
import type { AudioRecord, DiaryAudio, ProductSnapshot } from './model';

export type BackupAudio = { id: string; bytes: Uint8Array<ArrayBuffer> };
export type BackupData = { createdAt: number; snapshot: ProductSnapshot; audio: BackupAudio[] };
export const BACKUP_MAX_MEGABYTES = 512;
export const BACKUP_MAX_BYTES = BACKUP_MAX_MEGABYTES * 1024 * 1024;
export const BACKUP_METADATA_MAX_BYTES = 8 * 1024 * 1024;
export const backupAudioRecords = (snapshot: ProductSnapshot): AudioRecord[] => [
  ...snapshot.observations, ...(snapshot.diaryEntries ?? []).filter((entry): entry is DiaryAudio => entry.kind === 'audio'),
];
export function validateBackup(data: BackupData) {
  validateSnapshot(data.snapshot);
  if (!Number.isSafeInteger(data.createdAt) || data.createdAt < 1 || !Array.isArray(data.audio) || data.audio.length > 10000) throw new Error('Некорректная резервная копия.');
  const records = new Map(backupAudioRecords(data.snapshot).map(record => [record.id, record]));
  let size = 0;
  for (const item of data.audio) {
    const record = records.get(item.id);
    if (!record || !(item.bytes instanceof Uint8Array) || item.bytes.byteLength < 32 || item.bytes.byteLength > audioByteLimit(record)) throw new Error('В копии отсутствует или повреждена голосовая запись.');
    records.delete(item.id); size += item.bytes.byteLength;
    if (size > BACKUP_MAX_BYTES) throw new Error('Копия превышает 512 МБ.');
  }
  if (records.size) throw new Error('В копии отсутствуют голосовые записи.');
}
export function mergeBackup(current: ProductSnapshot, data: BackupData): ProductSnapshot {
  validateBackup(data); validateSnapshot(current);
  const existing = new Map([...current.observations, ...(current.diaryEntries ?? [])].map(record => [record.id, record]));
  for (const record of [...data.snapshot.observations, ...(data.snapshot.diaryEntries ?? [])]) {
    const previous = existing.get(record.id);
    if (!previous) continue;
    const previousAudio = !('kind' in previous) || previous.kind === 'audio';
    const incomingAudio = !('kind' in record) || record.kind === 'audio';
    if (previousAudio !== incomingAudio || (previousAudio && incomingAudio && observationAad(previous as AudioRecord) !== observationAad(record as AudioRecord))) throw new Error('В копии есть запись с конфликтующим идентификатором. Текущие данные не изменены.');
  }
  // A new installation recovers the complete snapshot. An existing diary keeps
  // its current settings/progress and newer records; repeated imports are safe.
  const populated = existing.size > 0 || current.progress.selectedLevel !== null || current.progress.completedAt !== null;
  const base = populated ? current : data.snapshot;
  const next: ProductSnapshot = { ...base,
    // Rendering preferences belong to the current device, even on an empty diary.
    settings: current.settings.effectQuality === undefined ? base.settings : { ...base.settings,
      effectQuality: current.settings.effectQuality, effectTargetFps: current.settings.effectTargetFps, smoothness: current.settings.smoothness },
    observations: [...current.observations, ...data.snapshot.observations.filter(record => !existing.has(record.id))].sort((a, b) => b.createdAt - a.createdAt),
    diaryEntries: [...(current.diaryEntries ?? []), ...(data.snapshot.diaryEntries ?? []).filter(record => !existing.has(record.id))].sort((a, b) => b.createdAt - a.createdAt),
    listenLater: [...new Set([...(current.listenLater ?? []), ...(data.snapshot.listenLater ?? [])])],
  };
  return validateSnapshot(next);
}
export function clearBackup(data: BackupData | null) { data?.audio.forEach(item => item.bytes.fill(0)); }
