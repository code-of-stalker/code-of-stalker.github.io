import { Animated, Easing } from './RustAnimated';
import { useEffect, useState } from 'react';
import type { PropsWithChildren } from 'react';

import type { StyleProp, ViewStyle } from 'react-native';

export function Reveal({ children, delay = 0, reducedMotion = false, style }: PropsWithChildren<{
  delay?: number; reducedMotion?: boolean; style?: StyleProp<ViewStyle>;
}>) {
  const [value] = useState(() => new Animated.Value(reducedMotion ? 1 : 0));
  useEffect(() => {
    const motion = Animated.timing(value, { toValue: 1, delay: reducedMotion ? 0 : delay,
      duration: reducedMotion ? 0 : 640, easing: Easing.bezier(.22, .8, .2, 1), useNativeDriver: true });
    motion.start(); return () => motion.stop();
  }, [value, delay, reducedMotion]);
  return <Animated.View style={[style, { opacity: value, transform: [{ translateY: value.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] }]}>{children}</Animated.View>;
}
