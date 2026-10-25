import { createScrollGate } from './scroll-gate-model';
import type { ReadingGesture } from './ScrollGate.types';

export function consumesReadingInput(input: Pick<ReadingGesture, 'locked' | 'atRest'>, delta: number, atStart: boolean) {
  if (input.atRest && atStart && delta < 0) return false;
  return input.locked || atStart && delta < 0;
}
export type ReadingRetreat = {
  atRest: boolean; onRetreat(): void;
  onProgress?(progress: number): void; onReady?(ready: boolean): void;
};
type State = { enabled: boolean; onDrag(delta: number): void; retreat?: ReadingRetreat };
/** Same pull thresholds as the article gate. A collapsing gesture belongs to
 * reading until it ends; only a fresh gesture can leave the collapsed shell. */
export function createReadingBoundaryInput(current: () => State) {
  let lastY = 0, touchBack = false, touching = false;
  const gate = createScrollGate(value => {
    current().retreat?.onProgress?.(value); current().retreat?.onReady?.(value < 0);
  }, () => {}, () => current().retreat?.onRetreat());
  return {
    wheel(delta: number, now: number) {
      const state = current();
      if (!state.enabled || !state.retreat?.atRest || delta > 0) {
        gate.block(); gate.wheel(delta, false, now, false);
        if (state.enabled) state.onDrag(delta);
      } else gate.wheel(delta, false, now, true);
    },
    start(y: number) {
      const state = current(); touching = true; lastY = y;
      touchBack = state.enabled && !!state.retreat?.atRest;
      gate.start(y, false, touchBack);
    },
    move(y: number) {
      if (!touching) return;
      const state = current(), delta = lastY - y; lastY = y;
      if (!state.enabled) { gate.block(); touchBack = false; return; }
      if (touchBack && state.retreat?.atRest) gate.move(y, false, true);
      else { gate.block(); state.onDrag(delta); }
    },
    end(cancelled = false) { touching = false; touchBack = false; gate.end(cancelled); },
    block() { touching = false; touchBack = false; gate.block(); },
  };
}
