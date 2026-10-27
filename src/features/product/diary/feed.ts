import { questionsForStep, hintForStep, stepDescriptions } from '../content';
import type { AudioRecord, DiaryEntry, Observation, ProductLevel } from '../state/model';

export type FeedEntry = DiaryEntry | Observation;
export type DiaryFilter = {
  category: 'all' | 'observation' | 'dynamics' | 'architecture';
  media: 'all' | 'audio' | 'text';
  level: 'all' | ProductLevel;
  step: number;
  from: string;
  to: string;
};
export const emptyDiaryFilter: DiaryFilter = { category: 'all', media: 'all', level: 'all', step: 0, from: '', to: '' };
export function isArchitecture(entry: FeedEntry): entry is Observation { return !('kind' in entry); }
export function isAudioEntry(entry: FeedEntry): entry is AudioRecord { return isArchitecture(entry) || entry.kind === 'audio'; }
export function diaryDay(time: number) {
  const date = new Date(time);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function parseDiaryDate(value: string): string | null {
  if (!value.trim()) return '';
  const match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(value.trim());
  if (!match) return null;
  const [, day, month, year] = match, date = new Date(Number(year), Number(month) - 1, Number(day), 12);
  const key = `${year}-${month}-${day}`;
  return diaryDay(date.getTime()) === key ? key : null;
}
export function filterDiary(entries: FeedEntry[], filter: DiaryFilter, showArchitecture: boolean, newest: boolean, listenLater?: readonly string[]) {
  const marked = listenLater ? new Set(listenLater) : null;
  return entries.filter(entry => {
    const architecture = isArchitecture(entry), audio = isAudioEntry(entry), day = diaryDay(entry.createdAt);
    if (marked && !marked.has(entry.id)) return false;
    if (architecture && !showArchitecture && !marked) return false;
    if (filter.category !== 'all' && filter.category !== (architecture ? 'architecture' : entry.category)) return false;
    if (filter.media !== 'all' && filter.media !== (audio ? 'audio' : 'text')) return false;
    if (filter.level !== 'all' && (!architecture || entry.level !== filter.level)) return false;
    if (filter.step && (!architecture || entry.step !== filter.step)) return false;
    return (!filter.from || day >= filter.from) && (!filter.to || day <= filter.to);
  }).sort((a, b) => (newest ? b.createdAt - a.createdAt : a.createdAt - b.createdAt) || a.id.localeCompare(b.id));
}
export function diaryQuestion(entry: Observation) {
  // Old recordings came from the existing four-question flow. New records
  // carry a question snapshot so later content edits don't rewrite history.
  return entry.questionText ?? questionsForStep(entry.step)[entry.questionIndex] ?? 'Текст этого вопроса не сохранён.';
}
export function diaryMaterial(entry: Observation): string | null {
  if (entry.level !== 'basic') return null;
  if (entry.step === 1 || entry.step === 2 || entry.step === 4) return hintForStep(entry.step);
  return stepDescriptions[entry.step as keyof typeof stepDescriptions] ?? null;
}
export function diaryClock(ms: number) {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}
