import { validateTextRuns, type DiaryTextRun } from '../diary/text-format';
export type ProductLevel = 'basic' | 'intensive' | 'guidance';
export type ProductSettings = {
  theme: 'system' | 'dark' | 'light' | 'neutral' | 'violet' | 'matrix' | 'mirage' | 'dawn';
  startAt: 'home' | 'architecture' | 'diary';
  microphoneCheck: boolean;
  microphoneDeviceId?: string;
  reducedMotion: boolean;
  smoothness?: boolean;
  effectTargetFps?: 60 | 90 | 120;
  effectQuality?: 'economy' | 'reduced' | 'balanced' | 'high';
  testUnlockAll?: boolean;
  diaryShowArchitecture?: boolean;
  diaryNewestFirst?: boolean;
  lastBackupAt?: number;
};
export type PracticeStage = 0 | 1 | 2 | 3 | 4;
export type StepThreeReading = { chapter: 0 | 1; page: number; offset: number; paged?: boolean };
export type StepFourReading = { page: number; offset: number };
export type ProductProgress = {
  selectedLevel: ProductLevel | null;
  step: number;
  questionIndex: number;
  // Optional so encrypted snapshots and backups from earlier versions still open.
  practiceStage?: PracticeStage;
  stepThreeReading?: StepThreeReading;
  stepFourReading?: StepFourReading;
  fourthStepUnlocked?: boolean;
  secondStepCompletedAt?: number;
  completedAt: number | null;
  availableAt: number | null;
};
export type ObservationDraft = { uri: string; durationMs: number; waveform: number[]; mimeType?: string };
export type ObservationMeta = { level: ProductLevel; step: number; questionIndex: number; questionText?: string };
export type Observation = ObservationMeta & {
  id: string;
  createdAt: number;
  durationMs: number;
  waveform: number[];
  localRef: string;
  mimeType: string;
};
export type DiaryCategory = 'observation' | 'dynamics';
type DiaryBase = { id: string; createdAt: number; category: DiaryCategory };
export type DiaryText = DiaryBase & { kind: 'text'; text: string; format?: DiaryTextRun[] };
export type DiaryAudio = DiaryBase & { kind: 'audio'; localRef: string; durationMs: number; waveform: number[]; mimeType: string };
export type DiaryEntry = DiaryText | DiaryAudio;
export type AudioRecord = Observation | DiaryAudio;
export type ProductSnapshot = {
  version: 1;
  settings: ProductSettings;
  progress: ProductProgress;
  observations: Observation[];
  // Additive fields keep the original encrypted architecture recordings readable.
  diaryEntries?: DiaryEntry[];
  listenLater?: string[];
};
export const OBSERVATION_LIMIT_SECONDS = 3 * 60;
export const DIARY_LIMIT_SECONDS = 15 * 60;
// Leave headroom for container overhead and platform encoder bitrate variation.
export const OBSERVATION_MAX_BYTES = 4 * 1024 * 1024;
export const DIARY_MAX_BYTES = 24 * 1024 * 1024;
export const DIARY_TEXT_LIMIT = 10000;
export const STEP_WAIT_MS = 24 * 60 * 60 * 1000;
export const defaultSettings: ProductSettings = { theme: 'neutral', startAt: 'home', microphoneCheck: false, reducedMotion: false, smoothness: true, effectTargetFps: 60, testUnlockAll: false };
export const defaultProgress: ProductProgress = { selectedLevel: null, step: 1, questionIndex: 0, practiceStage: 0, completedAt: null, availableAt: null };
export function resumePracticeStage(progress: ProductProgress): PracticeStage {
  if (progress.step !== 1 && progress.step !== 2) return 0;
  if (progress.step === 2) return progress.practiceStage ?? 0;
  return progress.practiceStage ?? (progress.questionIndex > 0 ? 4 : 0);
}
export function patchProgress(current: ProductProgress, patch: Partial<ProductProgress>): ProductProgress {
  const changedExercise = patch.step !== undefined && patch.step !== current.step ||
    patch.selectedLevel !== undefined && patch.selectedLevel !== current.selectedLevel;
  return { ...current, ...(changedExercise ? { practiceStage: 0 as const, questionIndex: 0 } : {}), ...patch };
}
/** Preview access never creates completion; turning it off restores an earned step. */
export function accessibleProgress(progress: ProductProgress, testUnlockAll = false): ProductProgress {
  if (testUnlockAll) return progress;
  if (progress.step === 4 && !canOpenFourthStep(progress)) {
    return accessibleProgress(patchProgress(progress, { step: 3 }), false);
  }
  if (progress.step === 3 && !progress.secondStepCompletedAt) {
    return patchProgress(progress, { step: progress.availableAt === null ? 1 : 2 });
  }
  return progress.step === 2 && progress.availableAt === null ? patchProgress(progress, { step: 1 }) : progress;
}
/** The final practice page is the existing completion boundary for step three. */
export function canOpenFourthStep(progress: ProductProgress, testUnlockAll = false) {
  return testUnlockAll || !!progress.fourthStepUnlocked || !!progress.secondStepCompletedAt && progress.stepThreeReading?.chapter === 1 && progress.stepThreeReading.page === 6;
}
export function emptyProduct(): ProductSnapshot {
  return { version: 1, settings: { ...defaultSettings }, progress: { ...defaultProgress }, observations: [] };
}
export function validLevel(value: unknown): value is ProductLevel {
  return value === 'basic' || value === 'intensive' || value === 'guidance';
}
function whole(value: unknown, min: number, max = Number.MAX_SAFE_INTEGER): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max;
}
export function validateMeta(value: ObservationMeta) {
  if (!validLevel(value.level) || !whole(value.step, 1, value.level === 'basic' ? 7 : 999) || !whole(value.questionIndex, 0, 999)) throw new Error('Не удалось определить упражнение для записи.');
}
// MediaRecorder can append codecs (Safari's AAC or Chromium's Opus). Keep the
// original string: it is also authenticated with the encrypted audio bytes.
export function validAudioMime(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 256 && !/[\r\n]/.test(value) &&
    /^audio\/(?:mp4|webm|ogg)(?:[ \t]*;[ \t]*[!#$%&'*+.^_`|~\w-]+[ \t]*=[ \t]*(?:[!#$%&'*+.^_`|~\w-]+|"[\x20-\x21\x23-\x5b\x5d-\x7e]*"))*[ \t]*$/i.test(value);
}
export function validateObservationDraft(draft: ObservationDraft, limitSeconds = OBSERVATION_LIMIT_SECONDS) {
  if (!draft || typeof draft.uri !== 'string' || !whole(draft.durationMs, 800, (limitSeconds + 1) * 1000) ||
      !Array.isArray(draft.waveform) || draft.waveform.length > 120 ||
      draft.waveform.some(value => typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1)) {
    throw new Error(`Запиши от 1 до ${limitSeconds} секунд.`);
  }
  if (draft.mimeType !== undefined && !validAudioMime(draft.mimeType)) {
    throw new Error('Браузер вернул неподдерживаемый формат звука. Запись не сохранена; попробуй записать ответ ещё раз.');
  }
}
export function validateSnapshot(value: ProductSnapshot): ProductSnapshot {
  const settings = value?.settings, progress = value?.progress;
  if (value?.version !== 1 || !settings || !progress ||
      !['system', 'dark', 'light', 'neutral', 'violet', 'matrix', 'mirage', 'dawn'].includes(settings.theme) ||
      !['home', 'architecture', 'diary'].includes(settings.startAt) ||
      typeof settings.microphoneCheck !== 'boolean' || typeof settings.reducedMotion !== 'boolean' ||
      (settings.microphoneDeviceId !== undefined && (typeof settings.microphoneDeviceId !== 'string' || settings.microphoneDeviceId.length > 1024)) ||
      (settings.smoothness !== undefined && typeof settings.smoothness !== 'boolean') ||
      (settings.effectTargetFps !== undefined && ![60,90,120].includes(settings.effectTargetFps)) ||
      (settings.effectQuality !== undefined && !['economy', 'reduced', 'balanced', 'high'].includes(settings.effectQuality)) ||
      (settings.testUnlockAll !== undefined && typeof settings.testUnlockAll !== 'boolean') ||
      (settings.diaryShowArchitecture !== undefined && typeof settings.diaryShowArchitecture !== 'boolean') ||
      (settings.diaryNewestFirst !== undefined && typeof settings.diaryNewestFirst !== 'boolean') ||
      (settings.lastBackupAt !== undefined && !whole(settings.lastBackupAt, 1)) ||
      (progress.selectedLevel !== null && !validLevel(progress.selectedLevel)) ||
      !whole(progress.step, 1, 7) || !whole(progress.questionIndex, 0, 999) ||
      (progress.practiceStage !== undefined && !whole(progress.practiceStage, 0, 4)) ||
      (progress.stepThreeReading !== undefined && (!progress.stepThreeReading ||
        !whole(progress.stepThreeReading.chapter, 0, 1) || !whole(progress.stepThreeReading.page, 0, progress.stepThreeReading.chapter === 1 ? 6 : 5) ||
        !whole(progress.stepThreeReading.offset, 0, 1000000) ||
        progress.stepThreeReading.paged !== undefined && typeof progress.stepThreeReading.paged !== 'boolean')) ||
      (progress.secondStepCompletedAt !== undefined && !whole(progress.secondStepCompletedAt, 1)) ||
      (progress.fourthStepUnlocked !== undefined && typeof progress.fourthStepUnlocked !== 'boolean') ||
      (progress.stepFourReading !== undefined && (!progress.stepFourReading ||
        !whole(progress.stepFourReading.page, 0, 14) || !whole(progress.stepFourReading.offset, 0, 1000000))) ||
      (progress.completedAt !== null && !whole(progress.completedAt, 1)) ||
      (progress.availableAt !== null && !whole(progress.availableAt, 1)) || !Array.isArray(value.observations)) {
    throw new Error('Локальные настройки не удалось прочитать. Сохранённые записи не изменены.');
  }
  const ids = new Set<string>();
  for (const record of value.observations) {
    validateMeta(record);
    validateObservationDraft({ ...record, uri: record.localRef });
    if (!/^[a-f0-9]{32}$/.test(record.id) || record.localRef !== record.id || ids.has(record.id) ||
        !whole(record.createdAt, 1) || !validAudioMime(record.mimeType)) {
      throw new Error('Список локальных записей повреждён. Сохранённые файлы не изменены.');
    }
    ids.add(record.id);
    if (record.questionText !== undefined && (typeof record.questionText !== 'string' || record.questionText.length > 2000)) throw new Error('Некорректный вопрос записи.');
  }
  if (value.diaryEntries !== undefined && !Array.isArray(value.diaryEntries)) throw new Error('Не удалось прочитать дневник.');
  for (const entry of value.diaryEntries ?? []) {
    if (!entry || !/^[a-f0-9]{32}$/.test(entry.id) || ids.has(entry.id) || !whole(entry.createdAt, 1)) throw new Error('Некорректная запись дневника.');
    validateDiaryCategory(entry.category);
    if (entry.kind === 'text') { validateDiaryText(entry.text); if (entry.format !== undefined) validateTextRuns(entry.format, entry.text); }
    else if (entry.kind === 'audio') {
      validateObservationDraft({ ...entry, uri: entry.localRef }, DIARY_LIMIT_SECONDS);
      if (entry.localRef !== entry.id || !validAudioMime(entry.mimeType)) throw new Error('Некорректная голосовая запись дневника.');
    } else throw new Error('Неизвестный тип записи дневника.');
    ids.add(entry.id);
  }
  const audioIds = new Set([...value.observations, ...(value.diaryEntries ?? []).filter(entry => entry.kind === 'audio')].map(entry => entry.id));
  if (value.listenLater !== undefined && (!Array.isArray(value.listenLater) || new Set(value.listenLater).size !== value.listenLater.length || value.listenLater.some(id => !audioIds.has(id)))) throw new Error('Не удалось прочитать подборку голосовых записей.');
  return value;
}
export function validateDiaryCategory(category: DiaryCategory) {
  if (category !== 'observation' && category !== 'dynamics') throw new Error('Неизвестный раздел дневника.');
}
export function validateDiaryText(text: string) {
  if (typeof text !== 'string' || !text.trim() || text.length > DIARY_TEXT_LIMIT) throw new Error(`Введи текст от 1 до ${DIARY_TEXT_LIMIT} символов.`);
}
export function audioByteLimit(record: AudioRecord) { return 'kind' in record ? DIARY_MAX_BYTES : OBSERVATION_MAX_BYTES; }
export function observationAad(record: AudioRecord) {
  if ('kind' in record) return JSON.stringify(['watcher.diary.audio.v1', record.id, record.createdAt, record.category, record.durationMs, record.waveform, record.mimeType]);
  // Do not add editable labels/bookmarks or questionText to the legacy AAD.
  return JSON.stringify(['watcher.observation.v1', record.id, record.createdAt, record.level, record.step,
    record.questionIndex, record.durationMs, record.waveform, record.mimeType]);
}
