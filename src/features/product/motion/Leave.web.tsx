import { useEffect, useState, type PropsWithChildren } from 'react';
import { View } from 'react-native';
import { RustMotion, shown } from './RustMotion.web';
import { uiCurve, uiFoldDuration, useUiReduced } from './uiMotion';

/** A removed item fades, drifts up a little and closes its gap; `onGone` fires once it is
 * closed, so the caller deletes the data only after the motion. Remount (key) to bring it back. */
export function Leave({ children, leaving, onGone }: PropsWithChildren<{ leaving: boolean; onGone(): void }>) {
  const reduced = useUiReduced();
  const [measured, setMeasured] = useState(0), [phase, setPhase] = useState<'here' | 'pinned' | 'closing'>('here');
  if (leaving && phase === 'here') setPhase('pinned');
  // Pin the measured height first, then close it on the next frame.
  useEffect(() => {
    if (phase !== 'pinned') return;
    const frame = requestAnimationFrame(() => setPhase('closing'));
    return () => cancelAnimationFrame(frame);
  }, [phase]);
  const closing = phase === 'closing';
  return <RustMotion height={phase === 'here' ? undefined : closing ? 0 : measured} duration={closing && !reduced ? uiFoldDuration : 0} curve={uiCurve}
    target={closing ? [0, 0, -6, 1, 0, 100] : shown} onComplete={closing ? onGone : undefined}
    style={{ display: 'flex', flexDirection: 'column', overflow: phase === 'here' ? undefined : 'hidden', pointerEvents: phase === 'here' ? undefined : 'none' }}>
    <View onLayout={event => setMeasured(event.nativeEvent.layout.height)}>{children}</View>
  </RustMotion>;
}
