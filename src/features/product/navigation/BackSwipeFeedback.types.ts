import type { PropsWithChildren, RefObject } from 'react';
export type BackSwipeFeedbackHandle = {
  move(distance: number, progress: number, y: number): void;
  finish(commit: boolean, action?: () => void): void;
};
export type BackSwipeFeedbackProps = PropsWithChildren<{ feedbackRef: RefObject<BackSwipeFeedbackHandle | null>; reducedMotion: boolean }>;
