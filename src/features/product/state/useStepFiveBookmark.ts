import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useProduct } from './ProductProvider';
import type { StepFiveReading } from './model';
import { readingNavigationGeneration } from '../navigation/readingDestination';

/** Separate bookmark: work on step five never changes step four's reading place. */
export function useStepFiveBookmark() {
  const { progress, updateProgress } = useProduct();
  const [initial] = useState<StepFiveReading>(() => progress.stepFiveReading ?? { page: 0, offset: 0 });
  const [generation] = useState(readingNavigationGeneration);
  const current = useRef(initial), dirty = useRef(false), timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const flush = useCallback(() => {
    clearTimeout(timer.current);
    if (generation !== readingNavigationGeneration()) { dirty.current = false; return; }
    if (!dirty.current) return;
    dirty.current = false;
    void updateProgress({ stepFiveReading: current.current }).catch(() => { dirty.current = true; });
  }, [updateProgress, generation]);
  const record = useCallback((next: StepFiveReading, immediate = false) => {
    const value = { ...next, offset: Math.max(0, Math.round(next.offset)) };
    if (value.page === current.current.page && value.offset === current.current.offset) return;
    current.current = value; dirty.current = true; clearTimeout(timer.current);
    if (immediate) flush(); else timer.current = setTimeout(flush, 350);
  }, [flush]);
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => { if (state !== 'active') flush(); });
    return () => { sub.remove(); flush(); };
  }, [flush]);
  return { initial, record, flush };
}
