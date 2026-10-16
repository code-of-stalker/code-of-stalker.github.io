import { createRecordingHold } from '../audio/recording-hold';

type HoldPorts = Parameters<typeof createRecordingHold>[0];
/** Diary gestures use layout pixels: the small lips button must not shrink the
 * lock distance. Horizontal cancellation is independent of the upward lock. */
export function createDiaryRecordingGesture(ports: HoldPorts & { cancelProgress(value: number): void }) {
  let originX = 0, cancelled = false, fixed = false, held = false;
  const hold = createRecordingHold({ ...ports, progress(value, locked) { fixed = locked; ports.progress(value, locked); } });
  return {
    begin(x: number, y: number) { originX = x; cancelled = false; held = true; ports.cancelProgress(0); return hold.begin(y, 1); },
    move(x: number, y: number) {
      if (!held || fixed) return;
      const progress = Math.max(0, Math.min(1, (originX - x) / 80));
      cancelled = progress === 1; ports.cancelProgress(progress);
      if (!cancelled) hold.move(y);
    },
    end() { held = false; ports.cancelProgress(0); return cancelled && !fixed ? hold.cancel() : hold.end(); },
    cancel() { held = false; ports.cancelProgress(0); return hold.cancel(); },
    lock() { cancelled = false; ports.cancelProgress(0); hold.lock(); },
    reset() { held = false; cancelled = false; ports.cancelProgress(0); hold.reset(); },
  };
}
