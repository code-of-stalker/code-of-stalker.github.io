import { Animated, Easing } from './RustAnimated';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { StyleProp, TextStyle, ViewStyle } from 'react-native';
import { ProductText } from '../ui';

export function Marquee({ text, active, reducedMotion, style, textStyle }: {
  text: string; active: boolean; reducedMotion: boolean; style?: StyleProp<ViewStyle>; textStyle?: StyleProp<TextStyle>;
}) {
  const [{ width, height }, setSize] = useState({ width: 0, height: 12 }), [offset] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (!width || !active || reducedMotion) return;
    offset.setValue(0);
    const motion = Animated.loop(Animated.timing(offset, { toValue: -width, duration: Math.round(width / 28 * 1000), easing: Easing.linear, useNativeDriver: true, isInteraction: false }));
    motion.start(); return () => motion.stop();
  }, [width, active, reducedMotion, offset]);
  if (reducedMotion) return <ProductText variant="label" style={[styles.staticText, textStyle]}>{text}</ProductText>;
  return <View style={[styles.viewport, { height }, style]} accessible accessibilityLabel={text}>
    <Animated.View style={[styles.row, { transform: [{ translateX: offset }] }]} aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <ProductText variant="label" numberOfLines={1} style={[styles.copy, textStyle]} onLayout={event => {
        const { width, height } = event.nativeEvent.layout;
        setSize(old => old.width === width && old.height === height ? old : { width, height });
      }}>{text} · </ProductText>
      <ProductText variant="label" numberOfLines={1} style={[styles.copy, textStyle]}>{text} · </ProductText>
    </Animated.View>
  </View>;
}
const styles = StyleSheet.create({ viewport: { width: '100%', height: 12, overflow: 'hidden', marginTop: 18, marginBottom: 8 }, row: { position: 'absolute', top: 0, left: 0, width: 10000, flexDirection: 'row' }, copy: { flexShrink: 0, fontSize: 8, lineHeight: 12, letterSpacing: 3.5, paddingRight: 28 }, staticText: { fontSize: 8, lineHeight: 14, letterSpacing: 2, marginVertical: 8 } });
