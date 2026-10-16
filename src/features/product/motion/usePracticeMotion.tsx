import { Animated, Easing } from './RustAnimated';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';

import type { StyleProp, ViewStyle } from 'react-native';

/** Native presentation remains isolated until the Android Rust surface is ready. */
export function usePracticeMotion(ready: boolean, reduced: boolean, height: number) {
  const [pull] = useState(() => new Animated.Value(0)), [exit] = useState(() => new Animated.Value(0));
  useEffect(() => { const motion = Animated.timing(pull, { toValue: ready ? 1 : 0, duration: reduced ? 0 : 360, easing: Easing.out(Easing.cubic), useNativeDriver: true }); motion.start(); return () => motion.stop(); }, [pull, ready, reduced]);
  useEffect(() => () => { exit.stopAnimation(); }, [exit]);
  return {
    scale: pull.interpolate({ inputRange: [0, 1], outputRange: [1, reduced ? 1 : .965] }), clock: null,
    reset: () => { pull.setValue(0); exit.setValue(0); },
    freeze: (complete: (scale: number) => void) => pull.stopAnimation(value => complete(reduced ? 1 : 1 - .035 * value)),
    lock: (complete: () => void) => { exit.setValue(0); Animated.timing(exit, { toValue: 1, duration: reduced ? 0 : 600, useNativeDriver: true }).start(({ finished }) => { if (finished) { exit.setValue(0); complete(); } }); },
    leave: (complete: () => void) => Animated.timing(exit, { toValue: 1, duration: reduced ? 0 : 420, easing: Easing.bezier(.55, 0, .3, 1), useNativeDriver: true }).start(({ finished }) => { if (finished) complete(); }),
    frame: (children: ReactNode, style: StyleProp<ViewStyle>, changing: boolean) => <Animated.View pointerEvents={changing ? 'none' : 'auto'} style={[style, { opacity: exit.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }), transform: [{ scale: pull.interpolate({ inputRange: [0, 1], outputRange: [1, reduced ? 1 : .965] }) }] }]}>{children}</Animated.View>,
    panel: (children: ReactNode, style: StyleProp<ViewStyle>) => <Animated.View style={[style, { transform: [{ translateY: exit.interpolate({ inputRange: [0, 1], outputRange: [0, height * .6] }) }] }]}>{children}</Animated.View>,
  };
}
