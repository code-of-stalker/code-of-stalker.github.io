import { Animated, Easing } from '../motion/RustAnimated';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { useThemeColors } from '../ProductTheme';

/** One small transform animation. No glass, canvas, shader or render loop. */
export function OptimizationMascot({ active, compact = false }: { active: boolean; compact?: boolean }) {
  const colors = useThemeColors(), [float] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (!active) return;
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(float, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: Platform.OS !== 'web', isInteraction: false }),
      Animated.timing(float, { toValue: 0, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: Platform.OS !== 'web', isInteraction: false }),
    ]));
    animation.start(); return () => animation.stop();
  }, [active, float]);
  return <View pointerEvents="none" accessibilityElementsHidden aria-hidden style={[styles.space, compact && { width: 96, height: 96, marginBottom: 20 }]}>
    <Animated.View style={[styles.face, { borderColor: colors.accent, backgroundColor: colors.surface,
      transform: [{ translateY: float.interpolate({ inputRange: [0, 1], outputRange: [4, -5] }) }, { rotate: float.interpolate({ inputRange: [0, 1], outputRange: ['-4deg', '4deg'] }) }] }]}>
      <View style={styles.eyes}><View style={[styles.eye, { backgroundColor: colors.accent }]} /><View style={[styles.eye, { backgroundColor: colors.accent }]} /></View>
      <View style={[styles.smile, { borderColor: colors.accent }]} />
    </Animated.View>
    <View style={[styles.spark, { backgroundColor: colors.accent, top: 18, right: 10 }]} />
    <View style={[styles.spark, { backgroundColor: colors.muted, bottom: 16, left: 10, width: 3, height: 3 }]} />
  </View>;
}
const styles = StyleSheet.create({
  space: { width: 112, height: 112, alignItems: 'center', justifyContent: 'center', marginBottom: 32 },
  face: { width: 72, height: 72, borderRadius: 36, borderWidth: .25, alignItems: 'center', justifyContent: 'center' },
  eyes: { flexDirection: 'row', gap: 18, marginTop: 4 }, eye: { width: 3, height: 6, borderRadius: 2 },
  smile: { width: 17, height: 9, borderBottomWidth: .75, borderBottomLeftRadius: 12, borderBottomRightRadius: 12, marginTop: 6 },
  spark: { position: 'absolute', width: 4, height: 4, borderRadius: 2 },
});
