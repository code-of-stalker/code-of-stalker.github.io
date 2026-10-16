import { useLayoutEffect } from 'react';

const blockers = new Set<object>();
let ready = false;
function publish() {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.watcherUpdateReady = String(ready);
  document.documentElement.dataset.watcherUpdateBusy = String(blockers.size > 0);
  window.dispatchEvent(new Event('watcher-update-safety'));
}

/** Acquire before starting async work; release only when its result is durable. */
export function blockWebUpdate(): () => void {
  const token = {};
  blockers.add(token); publish();
  return () => { if (blockers.delete(token)) publish(); };
}
export function useWebUpdateBlock(blocked: boolean): void {
  useLayoutEffect(() => { if (blocked) return blockWebUpdate(); }, [blocked]);
}
export function useWebUpdateReady(value: boolean): void {
  useLayoutEffect(() => {
    ready = value; publish();
    return () => { ready = false; publish(); };
  }, [value]);
}
