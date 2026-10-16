import { Animated, Easing } from './RustAnimated';
import { useLayoutEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Platform, StyleSheet } from 'react-native';
import type { ViewStyle } from 'react-native';

type Layer = {
  value: number; ready: boolean; textHeight: number;
  text: Animated.Value; artwork: Animated.Value; exit: Animated.Value;
};
export type Presentation = {
  active: boolean; text: Animated.Value; artwork: Animated.Value;
  textStyle?: ViewStyle; artworkStyle?: ViewStyle;
  textWrapper?(children: ReactNode): ReactNode; artworkWrapper?(children: ReactNode): ReactNode;
  onReady(): void; onTextHeight(height: number): void;
};
const makeLayer = (value: number): Layer => ({ value, ready: false, textHeight: 0,
  text: new Animated.Value(0), artwork: new Animated.Value(0), exit: new Animated.Value(1) });

/** Each complete explanation keeps its own layout and scroll position while leaving. */
export function TaskExplanationSwap({ value, active, scale, leavingScale, reducedMotion, onTextHeight, render }: {
  value: number; active: boolean; scale: number | Animated.AnimatedInterpolation<number>;
  leavingScale: number; reducedMotion: boolean; onTextHeight(height: number): void;
  pulledBack?: boolean;
  render(value: number, presentation: Presentation): ReactNode;
}) {
  const [state, setState] = useState(() => ({ value, layers: [makeLayer(value)], leaving: null as number | null, frozenScale: 1 }));
  const [entered, setEntered] = useState<number | null>(null);
  if (state.value !== value) {
    // Reuse the prepared document. Neither it nor the leaving scroller changes parents.
    const outgoing = state.layers.find(layer => layer.value === state.value)!;
    const incoming = state.layers.find(layer => layer.value === value) ?? makeLayer(value);
    setState({ value, layers: [outgoing, incoming], leaving: outgoing.value, frozenScale: leavingScale });
  }
  const current = state.layers.find(layer => layer.value === state.value)!;
  const outgoing = state.layers.find(layer => layer.value === state.leaving);
  const outgoingExit = outgoing?.exit, outgoingValue = outgoing?.value;

  useLayoutEffect(() => {
    if (Platform.OS === 'web') {
      let nextFrame = 0;
      const frame = requestAnimationFrame(() => { nextFrame = requestAnimationFrame(() => setEntered(current.value)); });
      return () => { cancelAnimationFrame(frame); cancelAnimationFrame(nextFrame); };
    }
    current.text.setValue(reducedMotion ? 1 : 0);
    const motion = Animated.timing(current.text, { toValue: 1, delay: reducedMotion ? 0 : 80,
      duration: reducedMotion ? 0 : 460, easing: Easing.bezier(.22, .8, .2, 1), useNativeDriver: true });
    motion.start(); return () => motion.stop();
  }, [current.text, current.value, reducedMotion]);
  useLayoutEffect(() => {
    if (!current.ready) return;
    const prepareNext = () => {
      if (current.value >= 3) return;
      setState(previous => previous.value !== current.value || previous.layers.some(layer => layer.value === current.value + 1)
        ? previous : { ...previous, layers: [...previous.layers, makeLayer(current.value + 1)] });
    };
    if (Platform.OS === 'web') {
      // CSS owns opacity frames; this timer only prepares the following paused document.
      const timer = setTimeout(prepareNext, reducedMotion ? 0 : 1800);
      return () => clearTimeout(timer);
    }
    current.artwork.setValue(reducedMotion ? 1 : 0);
    const motion = Animated.timing(current.artwork, { toValue: 1, duration: reducedMotion ? 0 : 1800,
      easing: Easing.out(Easing.quad), useNativeDriver: true });
    motion.start(({ finished }) => {
      if (!finished) return;
      // Prepare only the next explanation after this reveal, with its animation paused.
      prepareNext();
    });
    return () => motion.stop();
  }, [current.artwork, current.ready, current.value, reducedMotion]);
  useLayoutEffect(() => {
    if (!outgoingExit || outgoingValue === undefined) return;
    const removeOutgoing = () => setState(previous => previous.leaving !== outgoingValue ? previous
      : { ...previous, leaving: null, layers: previous.layers.filter(layer => layer.value !== outgoingValue) });
    if (Platform.OS === 'web') {
      const timer = setTimeout(removeOutgoing, reducedMotion ? 0 : 220);
      return () => clearTimeout(timer);
    }
    // Departure starts at the switch, regardless of the incoming document's readiness.
    const motion = Animated.timing(outgoingExit, { toValue: 0, duration: reducedMotion ? 0 : 200,
      easing: Easing.out(Easing.cubic), useNativeDriver: true });
    motion.start(({ finished }) => {
      if (finished) removeOutgoing();
    });
    return () => motion.stop();
  }, [outgoingExit, outgoingValue, reducedMotion]);
  useLayoutEffect(() => { onTextHeight(current.textHeight); }, [current.textHeight, onTextHeight]);

  function report(value: number, update: Partial<Pick<Layer, 'ready' | 'textHeight'>>) {
    setState(previous => {
      const layer = previous.layers.find(item => item.value === value);
      if (!layer || Object.entries(update).every(([key, amount]) => layer[key as 'ready' | 'textHeight'] === amount)) return previous;
      return { ...previous, layers: previous.layers.map(item => item.value === value ? { ...item, ...update } : item) };
    });
  }
  return <Animated.View style={styles.fill}>
    {state.layers.map(layer => {
      const selected = layer.value === state.value, leaving = layer.value === state.leaving;
      return <Animated.View key={layer.value} pointerEvents={selected && active ? 'auto' : 'none'}
        aria-hidden={!selected} accessibilityElementsHidden={!selected}
        importantForAccessibility={selected ? 'auto' : 'no-hide-descendants'}
        testID={`task-panel-${layer.value}-${selected ? 'current' : leaving ? 'leaving' : 'prepared'}`}
        style={[StyleSheet.absoluteFill, { opacity: Platform.OS === 'web' ? selected ? 1 : 0 : selected || leaving ? layer.exit : 0,
          transform: [{ scale: selected ? scale : leaving ? state.frozenScale : 1 }] }, Platform.OS === 'web' && {
            transition: `opacity ${reducedMotion ? 0 : 200}ms cubic-bezier(.215,.61,.355,1)`,
          } as ViewStyle]}>
        {render(layer.value, { active: selected && active, text: layer.text, artwork: layer.artwork,
          ...(Platform.OS === 'web' && {
            textStyle: { opacity: leaving || selected && (reducedMotion || entered === layer.value) ? 1 : 0,
              transform: [{ translateY: leaving || selected && (reducedMotion || entered === layer.value) ? 0 : 10 }],
              transition: `opacity ${reducedMotion ? 0 : 460}ms cubic-bezier(.22,.8,.2,1) ${reducedMotion ? 0 : 80}ms, transform ${reducedMotion ? 0 : 460}ms cubic-bezier(.22,.8,.2,1) ${reducedMotion ? 0 : 80}ms` } as ViewStyle,
            artworkStyle: { opacity: (selected || leaving) && layer.ready ? 1 : 0,
              transition: `opacity ${reducedMotion ? 0 : 1800}ms cubic-bezier(.25,.46,.45,.94)` } as ViewStyle,
          }),
          onReady: () => report(layer.value, { ready: true }), onTextHeight: height => report(layer.value, { textHeight: height }) })}
      </Animated.View>;
    })}
  </Animated.View>;
}
const styles = StyleSheet.create({ fill: { flex: 1, minHeight: 0 } });
