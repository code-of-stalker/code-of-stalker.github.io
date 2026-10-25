import { useSyncExternalStore } from 'react';
import type { StepDestination } from '../stepSections';

type Request = StepDestination & { revision: number };
let current: Request | null = null, revision = 0;
let navigationGeneration = 0;
export const readingNavigationGeneration = () => navigationGeneration;
export function beginReadingNavigation() { navigationGeneration += 1; }
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
const snapshot = () => current;
export function requestReadingDestination(destination: StepDestination) {
  current = { ...destination, revision: ++revision }; listeners.forEach(listener => listener());
}
export function clearReadingDestination() { current = null; listeners.forEach(listener => listener()); }
export function useReadingDestination() { return useSyncExternalStore(subscribe, snapshot, snapshot); }
