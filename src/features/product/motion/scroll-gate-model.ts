// Reaching a boundary arms the pull from that point in the current touch.
// Only further finger movement fills the cue; reading momentum never advances.
export function createScrollGate(changed: (progress: number) => void, advance: () => void, retreat?: () => void, wheelActivity?: { current: number }) {
  let progress = 0, locked = false, touching = false, touchOrigin = 0, touchStartProgress = 0, touchArmed = false, touchBack = false, direction = 0;
  let lastWheel = -Infinity, wheelArmed = false, wheelBack = false;
  const publish = (value: number) => {
    if (locked) return;
    progress = Math.max(retreat ? -1 : 0, Math.min(1, value)); changed(progress);
    if (progress >= 1 || progress <= -1) { locked = true; if (progress > 0) advance(); else retreat?.(); }
  };
  return {
    wheel(delta: number, atEnd: boolean, now = Date.now(), atStart = false) {
      if (now - (wheelActivity?.current ?? lastWheel) > 180) { wheelArmed = atEnd; wheelBack = atStart && !!retreat; direction = 0; }
      lastWheel = now;
      if (wheelActivity) wheelActivity.current = now;
      if (!direction) direction = delta > 0 && wheelArmed ? 1 : delta < 0 && wheelBack ? -1 : 0;
      if (!direction || direction > 0 && !atEnd || direction < 0 && !atStart) { if (progress) publish(0); return; }
      const value = progress + Math.max(-80, Math.min(80, delta)) / 260;
      publish(direction > 0 ? Math.max(0, value) : Math.min(0, value));
    },
    start(y: number, atEnd: boolean, atStart = false) { touching = true; touchOrigin = y; touchStartProgress = progress; touchArmed = atEnd; touchBack = atStart && !!retreat; direction = 0; },
    move(y: number, atEnd = touchArmed, atStart = touchBack) {
      if (!touching || locked) return;
      const back = atStart && !!retreat;
      if (atEnd !== touchArmed || back !== touchBack) {
        // Do not count the distance that was used to read the text. Rebase at
        // the newly reached edge without requiring a second touchstart.
        touchOrigin = y; touchStartProgress = 0; direction = 0;
        if (progress) publish(0);
      }
      touchArmed = atEnd; touchBack = back;
      const delta = touchOrigin - y;
      if (!direction && Math.abs(delta) > 4) direction = delta > 0 && touchArmed ? 1 : delta < 0 && touchBack ? -1 : 0;
      if (!direction) return;
      const value = (Math.sign(touchStartProgress) === direction ? touchStartProgress : 0) + delta / 140;
      publish(direction > 0 ? Math.max(0, value) : Math.min(0, value));
    },
    end(cancelled = false) { touching = false; direction = 0; if (cancelled && progress) publish(0); },
    // Blocking a transition discards the pull, but remembers wheel activity so
    // an ongoing reading gesture cannot become navigation when content is ready.
    block() { locked = false; touching = false; touchArmed = false; touchBack = false; wheelArmed = false; wheelBack = false; direction = 0; progress = 0; changed(0); },
    reset() { progress = 0; locked = false; touching = false; touchArmed = false; touchBack = false; lastWheel = -Infinity; wheelArmed = false; direction = 0; changed(0); },
  };
}
