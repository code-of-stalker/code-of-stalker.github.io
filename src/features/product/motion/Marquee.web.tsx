import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { StyleProp, TextStyle, ViewStyle } from 'react-native';
import { ProductText } from '../ui';
import { RustMotion } from './RustMotion.web';

/** React measures the text; Rust owns the continuous, time-based position. */
export function Marquee({ text, active, reducedMotion, style, textStyle }: {
  text: string; active: boolean; reducedMotion: boolean; style?: StyleProp<ViewStyle>; textStyle?: StyleProp<TextStyle>;
}) {
  const [{ width: copyWidth, height }, setSize] = useState({ width: 560, height: 12 });
  // Enough copies to cover a wide window: one copy scrolls out while the rest fill it.
  const [viewport, setViewport] = useState(0), copies = Math.max(2, Math.ceil(viewport / Math.max(1, copyWidth)) + 1);
  if (reducedMotion) return <ProductText variant="label" style={[styles.staticText, textStyle]}>{text}</ProductText>;
  return <View style={[styles.viewport, { height }, style]} accessible accessibilityLabel={text} onLayout={event => setViewport(event.nativeEvent.layout.width)}>
    <RustMotion aria-hidden active={active} loop={{ width: copyWidth, speed: 28 }} style={{ position: 'absolute', left: 0, top: 0, display: 'flex', width: 'max-content', willChange: 'transform' }}>
      <ProductText variant="label" numberOfLines={1} style={[styles.copy, textStyle]} onLayout={event => {
        const { width, height } = event.nativeEvent.layout;
        setSize(old => old.width === width && old.height === height ? old : { width, height });
      }}>{text} · </ProductText>
      {Array.from({ length: copies - 1 }, (_, index) => <ProductText key={index} variant="label" numberOfLines={1} style={[styles.copy, textStyle]}>{text} · </ProductText>)}
    </RustMotion>
  </View>;
}
const styles = StyleSheet.create({ viewport: { width: '100%', height: 12, overflow: 'hidden', marginTop: 18, marginBottom: 8 }, copy: { flexShrink: 0, fontSize: 8, lineHeight: 12, letterSpacing: 3.5, paddingRight: 28 }, staticText: { fontSize: 8, lineHeight: 14, letterSpacing: 2, marginVertical: 8 } });
