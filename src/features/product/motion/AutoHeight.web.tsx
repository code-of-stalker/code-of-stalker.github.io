import { useState, type PropsWithChildren } from 'react';
import { StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { RustMotion } from './RustMotion.web';
import { uiCurve, uiFoldDuration, useUiReduced } from './uiMotion';

/** Follows its content's height: Rust glides the frame to each new measured height.
 * The first measurement lands at once, so a screen never opens with a growing plate. */
export function AutoHeight({ children, style }: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  const reduced = useUiReduced();
  const [height, setHeight] = useState<number>(), [glide, setGlide] = useState(false);
  return <RustMotion height={height} duration={glide && !reduced ? uiFoldDuration : 0} curve={uiCurve}
    style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', ...StyleSheet.flatten(style) } as React.CSSProperties}>
    <View onLayout={event => { const next = event.nativeEvent.layout.height; if (height !== undefined && next !== height) setGlide(true); setHeight(next); }}>{children}</View>
  </RustMotion>;
}
