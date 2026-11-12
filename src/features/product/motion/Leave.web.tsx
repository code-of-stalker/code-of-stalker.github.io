import { useEffect, useLayoutEffect, useRef, useState, type PropsWithChildren } from 'react';
import { RustMotion, shown } from './RustMotion.web';
import { uiCurve, uiFoldDuration, useUiReduced } from './uiMotion';

/** A removed item fades, drifts up a little and closes its gap; `onGone` fires once it is
 * closed, so the caller deletes the data only after the motion. Remount (key) to bring it back. */
export function Leave({ children, leaving, onGone }: PropsWithChildren<{ leaving: boolean; onGone(): void }>) {
  const reduced = useUiReduced();
  const root = useRef<HTMLDivElement>(null);
  const [measured, setMeasured] = useState<number>(), [phase, setPhase] = useState<'here' | 'pinned' | 'closing'>('here');
  if (leaving && phase === 'here') setPhase('pinned');
  // Pin the real height before paint (onLayout is not reliable for a wrapper that never
  // resizes), then close it on the next frame.
  useLayoutEffect(() => {
    if (phase === 'pinned' && measured === undefined) setMeasured(root.current?.firstElementChild?.getBoundingClientRect().height ?? 0);
  }, [phase, measured]);
  useEffect(() => {
    if (phase !== 'pinned' || measured === undefined) return;
    const frame = requestAnimationFrame(() => setPhase('closing'));
    return () => cancelAnimationFrame(frame);
  }, [phase, measured]);
  const closing = phase === 'closing';
  return <div ref={root} style={{ display: 'flex', flexDirection: 'column' }}>
    <RustMotion height={phase === 'here' ? undefined : closing ? 0 : measured} duration={closing && !reduced ? uiFoldDuration : 0} curve={uiCurve}
      target={closing ? [0, 0, -6, 1, 0, 100] : shown} onComplete={closing ? onGone : undefined}
      style={{ display: 'flex', flexDirection: 'column', overflow: phase === 'here' ? undefined : 'hidden', pointerEvents: phase === 'here' ? undefined : 'none' }}>
      {children}
    </RustMotion>
  </div>;
}
