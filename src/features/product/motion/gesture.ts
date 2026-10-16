import architecture from '../../../../assets/product/motion/laboratory-architecture.json';
import diary from '../../../../assets/product/motion/laboratory-diary.json';
import type { ArtKind } from './types';

export type ArtInteraction = { type: 'watcher-art-interaction'; action: 'hold' | 'release' | 'move' | 'tap' | 'glass-press' | 'glass-move' | 'glass-release' | 'benchmark'; x?: number; y?: number; at?: number };
export function artHoldDelay(kind: ArtKind) {
  return (kind === 'diary' ? diary.settings.holdDelay : architecture.settings.holdDelay) * 1000;
}

/** Native/web adapter for Laboratory's 10 px drag and exported hold threshold. */
export function createArtGesture(send: (value: ArtInteraction) => void, tap: () => void) {
  let session: { started: number; held: boolean; moved: boolean; width: number; height: number; delay: number } | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const hold = () => { if (session && !session.held) { session.held = true; send({ type: 'watcher-art-interaction', action: 'hold' }); } };
  const cancel = () => {
    clearTimeout(timer); timer = undefined;
    if (session) send({ type: 'watcher-art-interaction', action: 'release' });
    session = undefined;
  };
  return {
    begin(width: number, height: number, delay: number) {
      cancel(); session = { started: Date.now(), held: false, moved: false, width, height, delay };
      timer = setTimeout(hold, delay);
    },
    move(dx: number, dy: number) {
      if (!session) return;
      if (Math.hypot(dx, dy) > 10) { session.moved = true; hold(); }
      if (session.held) send({ type: 'watcher-art-interaction', action: 'move', x: Math.max(-1, Math.min(1, dx / Math.max(1, session.width * .3))), y: Math.max(-1, Math.min(1, dy / Math.max(1, session.height * .3))) });
    },
    end(inside = true) {
      const shouldOpen = !!session && !session.held && !session.moved && inside && Date.now() - session.started < session.delay;
      cancel(); if (shouldOpen) { send({ type: 'watcher-art-interaction', action: 'tap' }); tap(); }
    },
    activate() { cancel(); send({ type: 'watcher-art-interaction', action: 'tap' }); tap(); },
    cancel,
  };
}
