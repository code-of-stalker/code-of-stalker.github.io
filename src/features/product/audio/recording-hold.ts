import voicePreset from '../../../../assets/product/motion/laboratory-voice.json';

type Ports = {
  start(): Promise<void>; stop(): Promise<void>; cancel(): Promise<void>;
  canBegin(): boolean; phase(): string; permissionReady(): boolean; requestPermission(): Promise<boolean>;
  progress(value: number, locked: boolean): void; hint(message: string): void;
};
// Same scaled 96px threshold as Laboratory lockGestureProgress. A ref-owned
// gesture survives render updates; async permission cannot launch a stale hold.
export function createRecordingHold(ports: Ports) {
  let held = false, locked = false, generation = 0, origin = 0, scale = 1, preparing = false;
  const reset = () => { held = false; locked = false; ports.progress(0, false); };
  return {
    async begin(y: number, nextScale: number) {
      if (locked) { ++generation; reset(); await ports.stop(); return; }
      if (preparing || !ports.canBegin()) return;
      const token = ++generation; held = true; origin = y; scale = Math.max(.1, nextScale); ports.progress(0, false); ports.hint('');
      preparing = true;
      try {
        // Start capture in this gesture. A separate permission-only capture
        // used to close the input and require another hold. A released hold
        // still cancels the pending grant through stop/cancel below.
        await ports.start();
        if ((token !== generation || !held && !locked) && ['preparing', 'recording'].includes(ports.phase())) await ports.cancel();
      } finally { preparing = false; }
    },
    move(y: number) {
      if (!held || locked || !['preparing', 'recording'].includes(ports.phase())) return;
      const value = Math.max(0, Math.min(1, (origin - y) / (scale * voicePreset.appearance.lockDistance)));
      if (value === 1) locked = true;
      ports.progress(value, locked);
    },
    end() { held = false; if (!locked) { ++generation; ports.progress(0, false); return ports.stop(); } },
    cancel() { if (!locked) { ++generation; reset(); return ports.cancel(); } },
    lock() { if (['preparing', 'recording'].includes(ports.phase())) { locked = true; ports.progress(1, true); } },
    reset() { ++generation; reset(); },
  };
}
