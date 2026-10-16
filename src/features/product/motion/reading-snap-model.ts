/** Only the approach is scroll driven. Once the title starts changing, the
 * transition owns its runway until one complete state has been reached. */
export function createReadingSnap(distance: number) {
  const threshold = Math.min(48, distance * .14);
  let state: 'preview' | 'reading' = 'preview';
  let previous = 0;
  let target: number | null = null;
  return {
    observe(offset: number): number | null {
      if (target !== null) return null;
      const delta = offset - previous;
      previous = offset;
      // Large scroll jumps can already land at an endpoint. Preserve the
      // article position rather than pulling it backwards onto the runway.
      if (offset >= distance) { state = 'reading'; return null; }
      if (offset <= 0) { state = 'preview'; return null; }
      if (state === 'preview' && delta > 0 && offset >= threshold) target = distance;
      if (state === 'reading' && delta < 0 && offset <= distance - threshold) target = 0;
      return target;
    },
    finish() {
      if (target === null) return;
      previous = target;
      state = target === 0 ? 'preview' : 'reading';
      target = null;
    },
  };
}
