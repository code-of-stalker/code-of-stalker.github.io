import { useSyncExternalStore } from 'react';

let query: MediaQueryList | undefined;
const media = () => typeof window === 'undefined' ? undefined
  : query ??= window.matchMedia('(prefers-reduced-motion: reduce)');
const snapshot = () => media()?.matches ?? false;
const subscribe = (notify: () => void) => {
  const value = media();
  value?.addEventListener('change', notify);
  return () => value?.removeEventListener('change', notify);
};

/** A system preference affects presentation without changing saved app settings. */
export function useSystemReducedMotion() {
  return useSyncExternalStore(subscribe, snapshot, () => false);
}
