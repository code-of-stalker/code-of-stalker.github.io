import { StyleSheet } from 'react-native';
import type { PropsWithChildren } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { RustMotion, shown } from './RustMotion.web';
import { uiCurve, uiDuration, uiShift, useUiReduced } from './uiMotion';

/** New content fades in and settles from a short `rise` (px, negative comes from above). Key it to replay. */
export function Appear({ children, rise = uiShift, delay = 0, duration = uiDuration, style }: PropsWithChildren<{
  rise?: number; delay?: number; duration?: number; style?: StyleProp<ViewStyle>;
}>) {
  const reduced = useUiReduced();
  return <RustMotion initial={reduced ? shown : [0, 0, rise, 1, 0, 100]} target={shown} duration={reduced ? 0 : duration} delay={reduced ? 0 : delay} curve={uiCurve}
    style={{ display: 'flex', flexDirection: 'column', ...StyleSheet.flatten(style) } as React.CSSProperties}>{children}</RustMotion>;
}
