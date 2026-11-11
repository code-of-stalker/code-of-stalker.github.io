import { useState, type PropsWithChildren } from 'react';
import { useIsFocused } from 'expo-router';
import { RustMotion, shown, type MotionValues } from './RustMotion.web';
import { uiCurve, uiScreenDuration } from './uiMotion';

/** A screen fades in and settles from a few px below, both when it opens and when the
 * user comes back to it (the stack keeps it mounted, so it replays on refocus). */
export function ScreenTransition({ children, reducedMotion = false }: PropsWithChildren<{ reducedMotion?: boolean }>) {
  const focused = useIsFocused();
  const [start] = useState<MotionValues>(() => reducedMotion ? shown : [0, 0, 8, 1, 0, 100]);
  // While away the screen drops back to the start pose at once; on return it plays again.
  return <RustMotion initial={start} target={focused ? shown : start} duration={reducedMotion || !focused ? 0 : uiScreenDuration}
    curve={uiCurve} style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>{children}</RustMotion>;
}
