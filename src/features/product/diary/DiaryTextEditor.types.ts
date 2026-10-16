import type { DiaryTextRun } from './text-format';
export type DiaryTextEditorProps = { text: string; runs: DiaryTextRun[]; onChange(text: string, runs: DiaryTextRun[]): void; size: number };
