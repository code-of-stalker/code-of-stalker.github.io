import { useCallback, useEffect, useRef, useState } from 'react';
import { motionCommand, nextMotionId, subscribeReadingFocus } from './nativeMotionBridge';

/** Only measured rectangles and quality/lifecycle inputs cross this adapter. */
export function useReadingPlayback<K extends string>(kinds: readonly K[], economy: boolean, enabled: boolean) {
  const [id] = useState(nextMotionId);
  const geometry = useRef<{ bounds: number[]; offset: number; height: number } | null>(null);
  const [playing, setPlaying] = useState(() => Object.fromEntries(kinds.map(k => [k, false])) as Record<K, boolean>);
  useEffect(() => {
    const unsubscribe = subscribeReadingFocus(id, flags => setPlaying(previous => {
      const next = Object.fromEntries(kinds.map((k, i) => [k, flags[i] === 1])) as Record<K, boolean>;
      return kinds.every(k => previous[k] === next[k]) ? previous : next;
    }));
    motionCommand('register_reading_focus', id, kinds.length);
    const value = geometry.current;
    if (value) motionCommand('reading_focus_geometry', id, value.bounds, value.offset, value.height);
    return unsubscribe;
  }, [id, kinds]);
  useEffect(() => { motionCommand('configure_reading_focus', id, economy, enabled); }, [id, economy, enabled]);
  const update = useCallback((bounds: Partial<Record<K, { top: number; height: number }>>, viewport: { offset: number; height: number }) => {
    const value = { bounds: kinds.flatMap(k => [bounds[k]?.top ?? 0, bounds[k]?.height ?? 0]), ...viewport };
    geometry.current = value;
    motionCommand('reading_focus_geometry', id, value.bounds, value.offset, value.height);
  }, [id, kinds]);
  return { playing, update };
}
