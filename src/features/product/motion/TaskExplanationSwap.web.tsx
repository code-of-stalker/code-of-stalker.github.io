import { useLayoutEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { View, StyleSheet } from 'react-native';
import { Animated } from './RustAnimated';
import { RustMotion, hidden, shown } from './RustMotion.web';
import type { Presentation } from './TaskExplanationSwap';

type Layer = { value: number; ready: boolean; textHeight: number; text: Animated.Value; artwork: Animated.Value };
const makeLayer = (value: number): Layer => ({ value, ready: false, textHeight: 0, text: new Animated.Value(0), artwork: new Animated.Value(0) });
/** Prepared explanations retain parents, dimensions and scroll positions. Only
 * Rust-owned transition channels change, including the quick outgoing dissolve. */
export function TaskExplanationSwap({ value, active, leavingScale, reducedMotion, pulledBack = false, onTextHeight, render }: {
  value: number; active: boolean; scale: number | Animated.AnimatedInterpolation<number>; leavingScale: number;
  reducedMotion: boolean; pulledBack?: boolean; onTextHeight(height: number): void; render(value: number, presentation: Presentation): ReactNode;
}) {
  const [state, setState] = useState(() => ({ value, layers: [makeLayer(value)], leaving: null as number | null, frozenScale: 1 }));
  if (state.value !== value) { const outgoing = state.layers.find(layer => layer.value === state.value)!;
    const incoming = state.layers.find(layer => layer.value === value) ?? makeLayer(value);
    setState({ value, layers: [outgoing, incoming], leaving: outgoing.value, frozenScale: leavingScale });
  }
  const current = state.layers.find(layer => layer.value === state.value)!;
  useLayoutEffect(() => { onTextHeight(current.textHeight); }, [current.textHeight, onTextHeight]);
  function report(value: number, update: Partial<Pick<Layer, 'ready' | 'textHeight'>>) {
    setState(previous => { const layer = previous.layers.find(item => item.value === value);
      if (!layer || Object.entries(update).every(([key, amount]) => layer[key as 'ready' | 'textHeight'] === amount)) return previous;
      return { ...previous, layers: previous.layers.map(item => item.value === value ? { ...item, ...update } : item) };
    });
  }
  const prepare = (index: number) => { if (index >= 3) return;
    setState(previous => previous.value !== index || previous.layers.some(layer => layer.value === index + 1) ? previous : { ...previous, layers: [...previous.layers, makeLayer(index + 1)] }); };
  return <View style={styles.fill}>{state.layers.map(layer => {
    const selected = layer.value === state.value, leaving = layer.value === state.leaving, scale = selected ? reducedMotion || !pulledBack ? 1 : .965 : leaving ? state.frozenScale : 1;
    return <RustMotion key={layer.value} initial={layer.value === value ? shown : hidden} freezeScale={leaving}
      target={[selected ? 1 : 0, 0, 0, scale, 0, 100]} duration={reducedMotion ? 0 : leaving ? 200 : 360}
      curve={leaving ? [.215, .61, .355, 1] : [.215, .61, .355, 1]} aria-hidden={!selected}
      data-testid={`task-panel-${layer.value}-${selected ? 'current' : leaving ? 'leaving' : 'prepared'}`}
      onComplete={() => { if (leaving) setState(previous => previous.leaving === layer.value ? { ...previous, leaving: null, layers: previous.layers.filter(item => item.value !== layer.value) } : previous); }}
      style={{ position: 'absolute', inset: 0, pointerEvents: selected && active ? 'auto' : 'none', display: 'flex', flexDirection: 'column' }}>
      {render(layer.value, { active: selected && active, text: layer.text, artwork: layer.artwork,
        textWrapper: children => <RustMotion initial={[0, 0, 10, 1, 0, 100]} target={selected || leaving ? shown : hidden} duration={reducedMotion ? 0 : 460} delay={reducedMotion ? 0 : 80}>{children}</RustMotion>,
        artworkWrapper: children => <RustMotion initial={hidden} target={(selected || leaving) && layer.ready ? shown : hidden}
          duration={reducedMotion ? 0 : 1800} curve={[.25, .46, .45, .94]} onComplete={() => { if (selected && layer.ready) prepare(layer.value); }}>{children}</RustMotion>,
        onReady: () => report(layer.value, { ready: true }), onTextHeight: height => report(layer.value, { textHeight: height }) })}
    </RustMotion>;
  })}</View>;
}
const styles = StyleSheet.create({ fill: { flex: 1, minHeight: 0 } });
