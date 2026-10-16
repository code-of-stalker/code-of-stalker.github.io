import type { ReactNode } from 'react';

export type PracticeEntryTransitionProps = {
  intro: ReactNode;
  children: ReactNode;
  showTask: boolean;
  scanning: boolean;
  height: number;
  reducedMotion: boolean;
  onComplete(): void;
};

export const practiceEntryScan = {
  reveal: 820,
  fade: 820,
  fadeDelay: 100,
  complete: 1160,
  band: 32,
} as const;
