import { Animated, Easing } from './RustAnimated';
import { useEffect, useState } from 'react';
import type { PropsWithChildren } from 'react';
import { uiCurve, uiScreenDuration } from './uiMotion';

export function ScreenTransition({ children, reducedMotion = false }: PropsWithChildren<{ reducedMotion?: boolean }>) {
  const [amount] = useState(() => new Animated.Value(reducedMotion ? 1 : 0));
  useEffect(() => { const motion = Animated.timing(amount, { toValue: 1, duration: reducedMotion ? 0 : uiScreenDuration, easing: Easing.bezier(...uiCurve), useNativeDriver: true }); motion.start(); return () => motion.stop(); }, [amount, reducedMotion]);
  return <Animated.View style={{ flex: 1, opacity: amount, transform: [{ translateY: amount.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }}>{children}</Animated.View>;
}
