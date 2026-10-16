import { Animated, Easing } from './RustAnimated';
import { useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

/** Only the changing content has two layers. Its surrounding controls stay mounted. */
export function ContentSwap<T extends string | number>({ value, render, reducedMotion = false, dissolve = false, delay = 0, duration, exitDuration, waitForReady = false, fill = false, style, onComplete }: {
  value: T; render(value: T, ready: () => void): ReactNode; reducedMotion?: boolean; dissolve?: boolean;
  delay?: number; duration?: number; exitDuration?: number; waitForReady?: boolean; fill?: boolean; style?: StyleProp<ViewStyle>;
  onComplete?(value: T): void;
}) {
  const [layers, setLayers] = useState<{ current: T; previous: T | null; ready: boolean }>({ current: value, previous: null, ready: !waitForReady });
  const [blend] = useState(() => new Animated.Value(reducedMotion ? 1 : 0));
  const [departure] = useState(() => new Animated.Value(1));
  const completion = useRef(onComplete);
  useLayoutEffect(() => { completion.current = onComplete; });
  if (layers.current !== value) setLayers({ current: value, previous: reducedMotion ? null : layers.current, ready: !waitForReady });
  useLayoutEffect(() => {
    blend.setValue(reducedMotion && layers.ready ? 1 : 0);
    if (!layers.ready) return;
    const motion = Animated.timing(blend, { toValue: 1, delay: reducedMotion ? 0 : delay,
      duration: reducedMotion ? 0 : duration ?? (dissolve ? 600 : 460), easing: duration ? Easing.inOut(Easing.cubic) : Easing.bezier(.22, .8, .2, 1), useNativeDriver: true });
    motion.start(({ finished }) => { if (finished) { setLayers(previous => ({ ...previous, previous: null })); completion.current?.(value); } });
    return () => motion.stop();
  }, [value, blend, reducedMotion, dissolve, delay, duration, layers.ready]);
  useLayoutEffect(() => {
    if (layers.previous === null || exitDuration === undefined) return;
    departure.setValue(1);
    const motion = Animated.timing(departure, { toValue: 0, duration: reducedMotion ? 0 : exitDuration,
      easing: Easing.out(Easing.cubic), useNativeDriver: true });
    motion.start(); return () => motion.stop();
  }, [layers.previous, exitDuration, departure, reducedMotion]);
  return <Animated.View style={[fill && styles.fill, style]}>
    {layers.previous !== null && <Animated.View key={`content-${layers.previous}`} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" aria-hidden
      style={[StyleSheet.absoluteFill, { opacity: exitDuration === undefined ? blend.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) : departure,
        transform: [{ translateY: dissolve ? 0 : blend.interpolate({ inputRange: [0, 1], outputRange: [0, -6] }) }] }]}>
      {render(layers.previous, () => {})}
    </Animated.View>}
    <Animated.View key={`content-${layers.current}`} style={[fill && styles.fill, { opacity: blend, transform: [{ translateY: dissolve ? 0 : blend.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] }]}>
      {render(layers.current, () => setLayers(state => state.current === layers.current && !state.ready ? { ...state, ready: true } : state))}
    </Animated.View>
  </Animated.View>;
}
const styles = StyleSheet.create({ fill: { flex: 1, minHeight: 0 } });
