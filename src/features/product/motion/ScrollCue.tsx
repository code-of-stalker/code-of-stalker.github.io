import { Animated, Easing } from './RustAnimated';
import { useThemeStyles } from '../ProductTheme';
import type { ProductColors } from '../theme';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { ProductText } from '../ui';

export function ScrollCue({ visible, progress, reducedMotion, label, style }: { visible: boolean; progress: number; reducedMotion: boolean; label: string; style?: StyleProp<ViewStyle> }) {
  const styles = useThemeStyles(createStyles);
  const [opacity] = useState(() => new Animated.Value(0)), [fill] = useState(() => new Animated.Value(.03));
  useEffect(() => {
    const motion = Animated.timing(opacity, { toValue: visible ? 1 : 0, duration: reducedMotion ? 0 : 320, easing: Easing.inOut(Easing.cubic), useNativeDriver: true });
    motion.start(); return () => motion.stop();
  }, [visible, reducedMotion, opacity]);
  useEffect(() => {
    const toValue = Math.max(.03, Math.min(1, Math.abs(progress)));
    if (reducedMotion) { fill.stopAnimation(); fill.setValue(toValue); return; }
    // Retarget the running spring without stopping it first: preserve momentum.
    Animated.spring(fill, { toValue, stiffness: 144, damping: 24, mass: 1,
      restDisplacementThreshold: .0001, restSpeedThreshold: .001, isInteraction: false, useNativeDriver: true }).start();
  }, [progress, reducedMotion, fill]);
  useEffect(() => () => fill.stopAnimation(), [fill]);
  return <Animated.View testID="scroll-transition-progress" pointerEvents="none" style={[styles.cue, style, { opacity }]} accessibilityElementsHidden={!visible} aria-hidden={!visible}
    accessibilityRole="progressbar" accessibilityLabel={label} accessibilityValue={{ min: 0, max: 100, now: Math.round(Math.abs(progress) * 100) }}>
    <ProductText variant="label" style={styles.text}>{label}</ProductText>
    <View style={styles.track}><Animated.View style={[styles.fill, { transform: [{ scaleX: fill }] }]} /></View>
  </Animated.View>;
}
const createStyles = (colors: ProductColors) => StyleSheet.create({ cue: { position: 'absolute', left: 44, right: 44, bottom: 6, alignItems: 'center', gap: 5 }, text: { fontSize: 6, lineHeight: 8, letterSpacing: 2, color: colors.muted }, track: { width: '100%', height: 2, backgroundColor: `${colors.accent}24`, overflow: 'hidden' }, fill: { height: 2, width: '100%', backgroundColor: colors.accent, transformOrigin: 'left center' } });
