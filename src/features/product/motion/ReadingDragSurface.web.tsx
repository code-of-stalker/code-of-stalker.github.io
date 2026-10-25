import { useEffect, useLayoutEffect, useMemo, useRef, type PropsWithChildren } from 'react';
import { createReadingBoundaryInput, type ReadingRetreat } from './reading-boundary-input';
import { useSwipeNavigationAllowed } from '../navigation/BackSwipeProvider';

/** Illustration gestures drive expansion independently of article scrolling. */
export function ReadingDragSurface({ children, enabled, onDrag, retreat }: PropsWithChildren<{ enabled: boolean; onDrag(delta: number): void; retreat?: ReadingRetreat }>) {
  const allowed = useSwipeNavigationAllowed();
  const root = useRef<HTMLDivElement>(null), latest = useRef({ enabled, onDrag, retreat, allowed });
  useLayoutEffect(() => { latest.current = { enabled, onDrag, retreat, allowed }; });
  // eslint-disable-next-line react-hooks/refs -- The model reads props only on input.
  const input = useMemo(() => createReadingBoundaryInput(() => ({ ...latest.current, enabled: latest.current.enabled && latest.current.allowed() })), []);
  useEffect(() => { if (!enabled) input.block(); }, [enabled, input]);
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const wheel = (event: WheelEvent) => {
      if (!latest.current.enabled || !latest.current.allowed() || event.ctrlKey) return;
      event.preventDefault(); input.wheel(event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? el.clientHeight : 1), event.timeStamp);
    };
    const start = (event: TouchEvent) => { if (event.touches.length === 1) input.start(event.touches[0].clientY); else input.end(true); };
    const move = (event: TouchEvent) => {
      if (event.touches.length !== 1) { input.end(true); return; }
      if (latest.current.enabled && latest.current.allowed()) { event.preventDefault(); input.move(event.touches[0].clientY); }
      else input.block();
    };
    const end = () => input.end(), cancel = () => input.end(true);
    el.addEventListener('wheel', wheel, { passive: false }); el.addEventListener('touchstart', start, { passive: true }); el.addEventListener('touchmove', move, { passive: false });
    el.addEventListener('touchend', end); el.addEventListener('touchcancel', cancel);
    return () => {
      el.removeEventListener('wheel', wheel); el.removeEventListener('touchstart', start); el.removeEventListener('touchmove', move);
      el.removeEventListener('touchend', end); el.removeEventListener('touchcancel', cancel);
    };
  }, [input]);
  return <div ref={root} style={{ position: 'absolute', inset: 0, touchAction: enabled ? 'pan-x pinch-zoom' : 'auto' }}>{children}</div>;
}
