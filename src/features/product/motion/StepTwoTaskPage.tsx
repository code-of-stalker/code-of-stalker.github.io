import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { secondStepClosing, secondStepTasks } from '../content';
import { ProductText } from '../ui';
import { StepSignature } from './StepSignature';
import { fonts } from '../theme';
import { Art } from './Art';
import { ContentSwap } from './ContentSwap';
import { ScrollGate } from './ScrollGate';
import { useProductLayout } from '../layout';

/** Application order only; the shared Rust transition and artwork own motion. */
export function StepTwoTaskPage({ part, active, enabled, width, reducedMotion, startAtEnd = false, onNext, onPrevious, onComplete, onReady, onProgress, onBackReady }: {
  part: 1 | 2 | 4; active: boolean; enabled: boolean; width: number; reducedMotion: boolean;
  startAtEnd?: boolean;
  onNext(): void; onPrevious(): void; onComplete(): Promise<void>;
  onReady(value: boolean): void; onProgress(value: number): void;
  onBackReady(value: (() => void) | null): void;
}) {
  const [position, setPosition] = useState({ index: part === 4 && startAtEnd ? secondStepClosing.length - 1 : 0, end: startAtEnd }), [moving, setMoving] = useState(true), [finishing, setFinishing] = useState(false);
  const index = position.index;
  const lock = useRef(true), saving = useRef(false);
  const pages = part === 4 ? secondStepClosing : [secondStepTasks[part - 1]];
  const finishMotion = useCallback((value: number) => { if (value === index) { lock.current = false; setMoving(false); } }, [index]);
  async function complete() {
    if (saving.current) return;
    saving.current = true; setFinishing(true);
    try { await onComplete(); }
    catch { /* The provider shows persistence errors; retain the current page. */ }
    finally { saving.current = false; setFinishing(false); }
  }
  function turn(direction: number) {
    if (lock.current || saving.current || !active || !enabled) return;
    const next = index + direction;
    if (next < 0) { onPrevious(); return; }
    if (next >= pages.length) { if (part === 4) void complete(); else onNext(); return; }
    lock.current = true; setMoving(true); onReady(false); onProgress(0); setPosition({ index: next, end: direction < 0 });
  }
  useLayoutEffect(() => {
    if (!active) return;
    onBackReady(() => turn(-1));
    return () => onBackReady(null);
  });
  const fontSize = width < 300 ? 16 : 18, extra = (useProductLayout().air - 1) * 48;
  // The art spans the page width at its phone proportions.
  const art = (kind: string) => ({ width, height: width * 210 / (kind === 'life-book' ? 272 : 288) });
  return <View testID={part === 4 ? 'step-two-closing' : `step-two-task-${part}`} style={styles.fill}>
    <ContentSwap value={index} fill duration={520} exitDuration={220} reducedMotion={reducedMotion} onComplete={finishMotion} render={value => {
      const block = pages[value], selected = value === index, playing = selected && active;
      return <View testID={`step-two-task-page-${part}-${value}`} aria-hidden={!selected} accessibilityElementsHidden={!selected} importantForAccessibility={selected ? 'auto' : 'no-hide-descendants'} style={styles.fill}>
        <ScrollGate fill enabled={playing && enabled && !moving && !finishing} startAtEnd={selected && position.end} guardEntryGesture
          fadeTop={12} fadeBottom={16} onAdvance={() => turn(1)} onRetreat={() => turn(-1)}
          onReady={selected ? onReady : () => {}} onProgress={selected ? onProgress : () => {}}
          contentStyle={styles.content}>
          {part === 4 && <ProductText variant="label" style={styles.count}>{value + 1} / {pages.length}</ProductText>}
          {!!block.title && <ProductText variant="title" style={styles.title}>{block.title}</ProductText>}
          <ProductText testID="step-two-task-copy" style={[styles.text, { fontSize, lineHeight: fontSize + 9 }, block.art === 'body-senses' && styles.emphasis]}>{block.text}</ProductText>
          <View style={[styles.art, { paddingTop: 24 + extra, paddingBottom: 12 + extra }]} pointerEvents="none"><Art kind={block.art} {...art(block.art)} active={playing} reducedMotion={reducedMotion} /></View>
          {part === 4 && value === pages.length - 1 && <StepSignature active={playing} reducedMotion={reducedMotion} style={styles.signature} />}
        </ScrollGate>
      </View>;
    }} />
  </View>;
}
const styles = StyleSheet.create({
  fill: { flex: 1, minHeight: 0 }, content: { flexGrow: 1, paddingTop: 18, paddingBottom: 12 },
  count: { fontSize: 9, lineHeight: 13, letterSpacing: 1.8, marginBottom: 16 },
  title: { fontSize: 21, lineHeight: 29, marginBottom: 20, textTransform: 'uppercase' },
  text: { textTransform: 'uppercase' }, emphasis: { fontFamily: fonts.bodyBold, fontSize: 24, lineHeight: 34 },
  art: { flexGrow: 1, minHeight: 0, justifyContent: 'center', paddingTop: 24, paddingBottom: 12 },
  signature: { marginTop: 12 },
});
