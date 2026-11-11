import { Animated, Easing } from './RustAnimated';
import { useEffect, useState, type PropsWithChildren } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { uiCurve, uiDuration, uiShift, useUiReduced } from './uiMotion';

export function Appear({ children, rise = uiShift, delay = 0, duration = uiDuration, style }: PropsWithChildren<{
  rise?: number; delay?: number; duration?: number; style?: StyleProp<ViewStyle>;
}>) {
  const reduced = useUiReduced();
  const [amount] = useState(() => new Animated.Value(reduced ? 1 : 0));
  useEffect(() => {
    const motion = Animated.timing(amount, { toValue: 1, duration: reduced ? 0 : duration, delay: reduced ? 0 : delay, easing: Easing.bezier(...uiCurve), useNativeDriver: true });
    motion.start(); return () => motion.stop();
  }, [amount, reduced, duration, delay]);
  return <Animated.View style={[style, { opacity: amount, transform: [{ translateY: amount.interpolate({ inputRange: [0, 1], outputRange: [rise, 0] }) }] }]}>{children}</Animated.View>;
}
