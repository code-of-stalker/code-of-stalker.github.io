import { Animated, Easing } from './RustAnimated';
import { useEffect, useState } from 'react';
import type { PropsWithChildren } from 'react';

export function ScreenTransition({ children, reducedMotion = false }: PropsWithChildren<{ reducedMotion?: boolean }>) {
  const [position] = useState(() => new Animated.Value(reducedMotion ? 0 : 24));
  useEffect(() => { const motion = Animated.timing(position, { toValue: 0, duration: reducedMotion ? 0 : 800, easing: Easing.out(Easing.cubic), useNativeDriver: true }); motion.start(); return () => motion.stop(); }, [position, reducedMotion]);
  return <Animated.View style={{ flex: 1, transform: [{ translateX: position }] }}>{children}</Animated.View>;
}
