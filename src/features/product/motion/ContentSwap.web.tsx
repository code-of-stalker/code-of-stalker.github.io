import { useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { View, StyleSheet } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { RustMotion, hidden, shown, gentle } from './RustMotion.web';

export function ContentSwap<T extends string | number>({ value, render, reducedMotion = false, dissolve = false, delay = 0, duration, exitDuration, waitForReady = false, fill = false, style, onComplete }: {
  value: T; render(value: T, ready: () => void): ReactNode; reducedMotion?: boolean; dissolve?: boolean;
  delay?: number; duration?: number; exitDuration?: number; waitForReady?: boolean; fill?: boolean; style?: StyleProp<ViewStyle>;
  onComplete?(value: T): void;
}) {
  const [layers, setLayers] = useState({ current: value, previous: null as T | null, ready: !waitForReady });
  const completion = useRef(onComplete);
  useLayoutEffect(() => { completion.current = onComplete; });
  if (layers.current !== value) setLayers({ current: value, previous: reducedMotion ? null : layers.current, ready: !waitForReady });
  const enterDuration = reducedMotion ? 0 : duration ?? (dissolve ? 600 : 460);
  const curve = duration ? [.645, .045, .355, 1] : gentle;
  return <View style={[fill && styles.fill, style]}>
    {layers.previous !== null && <RustMotion key={`content-${layers.previous}`} initial={shown} target={[0, 0, dissolve ? 0 : -6, 1, 0, 100]}
      duration={reducedMotion ? 0 : exitDuration ?? enterDuration} curve={curve} aria-hidden
      onComplete={() => setLayers(previous => previous.previous === layers.previous ? { ...previous, previous: null } : previous)}
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none', display: 'flex', flexDirection: 'column' }}>
      {render(layers.previous, () => {})}
    </RustMotion>}
    <RustMotion key={`content-${layers.current}`} initial={[0, 0, dissolve ? 0 : 10, 1, 0, 100]} target={layers.ready ? shown : hidden}
      onComplete={() => { if (layers.ready) completion.current?.(layers.current); }}
      duration={enterDuration} delay={reducedMotion ? 0 : delay} curve={curve} style={fill ? { display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 } : undefined}>
      {render(layers.current, () => setLayers(state => state.current === layers.current && !state.ready ? { ...state, ready: true } : state))}
    </RustMotion>
  </View>;
}
const styles = StyleSheet.create({ fill: { flex: 1, minHeight: 0 } });
