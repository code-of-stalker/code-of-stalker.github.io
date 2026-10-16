export function decoderFrame(time: number, start: number, moving: boolean, duration: number) {
  const elapsed = time - start;
  const waiting = !Number.isFinite(start) || moving && elapsed < 0;
  const progress = waiting ? 0 : moving ? Math.max(0, Math.min(1, elapsed / duration)) : 1;
  const entrance = Math.max(0, Math.min(1, progress / .2));
  return { waiting, progress, opacity: entrance * entrance * (3 - 2 * entrance) };
}
