import type { PropsWithChildren } from 'react';
import { StyleSheet } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { RustMotion, shown } from './RustMotion.web';
import { uiCurve, uiDuration, useUiReduced } from './uiMotion';

/** Something is loading: it fades in after a short wait (a quick load never flashes)
 * and breathes softly until it is replaced. */
export function Breathe({ children, style }: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  const reduced = useUiReduced();
  return <RustMotion initial={reduced ? shown : [0, 0, 0, 1, 0, 100]} target={shown} duration={reduced ? 0 : uiDuration} delay={reduced ? 0 : 160} curve={uiCurve}
    breathe={reduced ? undefined : { period: 1400, low: .4 }}
    style={{ display: 'flex', flexDirection: 'column', ...StyleSheet.flatten(style) } as React.CSSProperties}>{children}</RustMotion>;
}
