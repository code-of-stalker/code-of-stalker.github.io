import { useEffect, useLayoutEffect, useRef, type PropsWithChildren } from 'react';

/** Illustration gestures drive expansion independently of article scrolling. */
export function ReadingDragSurface({ children, enabled, onDrag }: PropsWithChildren<{ enabled: boolean; onDrag(delta: number): void }>) {
  const root = useRef<HTMLDivElement>(null), latest = useRef({ enabled, onDrag });
  useLayoutEffect(() => { latest.current = { enabled, onDrag }; });
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    let lastY = 0;
    const wheel = (event: WheelEvent) => {
      if (!latest.current.enabled) return;
      event.preventDefault(); latest.current.onDrag(event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? el.clientHeight : 1));
    };
    const start = (event: TouchEvent) => { lastY = event.touches[0]?.clientY ?? 0; };
    const move = (event: TouchEvent) => {
      const y = event.touches[0]?.clientY ?? lastY;
      if (latest.current.enabled && event.touches.length === 1) { event.preventDefault(); latest.current.onDrag(lastY - y); }
      lastY = y;
    };
    el.addEventListener('wheel', wheel, { passive: false }); el.addEventListener('touchstart', start, { passive: true }); el.addEventListener('touchmove', move, { passive: false });
    return () => { el.removeEventListener('wheel', wheel); el.removeEventListener('touchstart', start); el.removeEventListener('touchmove', move); };
  }, []);
  return <div ref={root} style={{ position: 'absolute', inset: 0, touchAction: enabled ? 'pan-x pinch-zoom' : 'auto' }}>{children}</div>;
}
