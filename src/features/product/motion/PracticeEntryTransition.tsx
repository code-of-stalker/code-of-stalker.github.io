import { Animated, Easing } from './RustAnimated';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useThemeColors } from '../ProductTheme';
import { practiceEntryScan as scan, type PracticeEntryTransitionProps } from './PracticeEntryTransition.types';

/** Native adapter clips translated layers, without scaling the panel contour. */
export function PracticeEntryTransition({ intro, children, showTask, scanning, height, reducedMotion, onComplete }: PracticeEntryTransitionProps) {
  const colors = useThemeColors();
  const [reveal] = useState(() => new Animated.Value(1));
  const [fade] = useState(() => new Animated.Value(1)), [clock] = useState(() => new Animated.Value(0));
  const latestComplete = useRef(onComplete);
  useLayoutEffect(() => { latestComplete.current = onComplete; });
  useEffect(() => {
    if (!scanning) { reveal.setValue(1); fade.setValue(1); return; }
    reveal.setValue(0); fade.setValue(1); clock.setValue(0);
    const ms = (value: number) => reducedMotion ? 0 : value;
    const motion = Animated.parallel([
      Animated.timing(reveal, { toValue: 1, duration: ms(scan.reveal), easing: Easing.linear, useNativeDriver: true }),
      Animated.timing(fade, { toValue: 0, duration: ms(scan.fade), delay: ms(scan.fadeDelay), useNativeDriver: true }),
      Animated.timing(clock, { toValue: 1, duration: ms(scan.complete), useNativeDriver: true }),
    ]);
    motion.start(({ finished }) => { if (finished) latestComplete.current(); });
    return () => motion.stop();
  }, [scanning, reducedMotion, reveal, fade, clock]);
  return <View style={styles.fill}>
    {(!showTask || scanning) && <Animated.View pointerEvents={showTask ? 'none' : 'auto'} accessibilityElementsHidden={showTask}
      style={[StyleSheet.absoluteFill, { opacity: fade }]}>{intro}</Animated.View>}
    {showTask && <Animated.View pointerEvents={scanning ? 'none' : 'auto'} style={[styles.fill, { overflow: 'hidden',
      transform: [{ translateY: scanning ? reveal.interpolate({ inputRange: [0,1], outputRange: [-height,0] }) : 0 }] }]}>
      <Animated.View style={[styles.fill, { backgroundColor: colors.background,
        transform: [{ translateY: scanning ? reveal.interpolate({ inputRange: [0,1], outputRange: [height,0] }) : 0 }] }]}>{children}</Animated.View>
    </Animated.View>}
    {scanning && !reducedMotion && <Animated.View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, height: scan.band,
      opacity: reveal.interpolate({ inputRange: [0,.08,.92,1], outputRange: [0,1,1,0] }),
      transform: [{ translateY: reveal.interpolate({ inputRange: [0,1], outputRange: [-scan.band/2,height-scan.band/2] }) }] }}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.accent, opacity: .08 }]} />
      <View style={{ position: 'absolute', top: 8, left: 0, right: 0, height: 16, backgroundColor: colors.accent, opacity: .14 }} />
      <View style={{ position: 'absolute', top: 15, left: 0, right: 0, height: 2, backgroundColor: colors.accent, opacity: .8 }} />
    </Animated.View>}
  </View>;
}
const styles = StyleSheet.create({ fill: { flex: 1, minHeight: 0, position: 'relative' } });
