import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useThemeColors } from '../ProductTheme';
import { fonts } from '../theme';
import { ProductText } from '../ui';
import { Art } from './Art';
import { ContentSwap } from './ContentSwap';
import { DreamConclusion } from './DreamConclusion';
import { DreamRealityText } from './DreamRealityText';
import { StepOneConclusion } from './StepOneConclusion';
import { ScrollGate } from './ScrollGate';
import type { ReadingLayout } from './ReadingExpansion';
import { readingPages } from './readingPages';

export type ReadingPagePosition = { index: number; count: number };
export function EconomyReadingPages({ step, chapter, active, enabled, canAdvance, startAtEnd, reading, width, viewportHeight, reducedMotion, onReady, onProgress, onAdvance, onRetreat, onPageChange }: {
  step: 1 | 2; chapter: 0 | 1; active: boolean; enabled: boolean; canAdvance: boolean; startAtEnd: boolean;
  reading: ReadingLayout; width: number; viewportHeight: number; reducedMotion: boolean;
  onReady(value: boolean): void; onProgress(value: number): void;
  onAdvance(): void; onRetreat(): void; onPageChange(value: ReadingPagePosition): void;
}) {
  const pages = readingPages(step, chapter), colors = useThemeColors();
  const [position, setPosition] = useState(() => ({ index: startAtEnd ? pages.length - 1 : 0, end: startAtEnd }));
  const [moving, setMoving] = useState(true), locked = useRef(true);
  const index = position.index;
  useLayoutEffect(() => { onPageChange({ index, count: pages.length }); }, [index, pages.length, onPageChange]);
  const finish = useCallback((value: number) => { if (value === index) { locked.current = false; setMoving(false); } }, [index]);
  function turn(direction: number) {
    if (locked.current || !active || !enabled) return;
    const next = index + direction;
    if (next < 0) { onRetreat(); return; }
    if (next >= pages.length) { if (canAdvance) onAdvance(); return; }
    locked.current = true; setMoving(true); onReady(false); onProgress(0);
    setPosition({ index: next, end: direction < 0 });
  }
  const textStyle = [styles.text, { fontSize: width >= 300 ? 20 : 18, lineHeight: width >= 300 ? 29 : 27 }];
  return <View testID="economy-reading-pages" style={styles.fill}>
    <ContentSwap value={index} fill reducedMotion={reducedMotion} duration={520} exitDuration={220} onComplete={finish}
      render={value => {
        const page = pages[value], selected = value === index, playing = selected && active;
        const wider = page.art === 'reflections' || page.art === 'single-hero' ? 1.25 : page.art === 'identity-imprints' ? 1.15 : 1;
        const artWidth = Math.max(1, width - 16) * wider, artHeight = Math.min(viewportHeight * .55, page.art === 'dreamer' ? artWidth * 0.92 : artWidth * (page.art === 'book' || page.art === 'dream-world' || page.art === 'dream-wake' ? 206 : page.art === 'cells' ? 156 : page.art === 'identity-imprints' || page.art === 'lived-paths' ? 176 : page.art.startsWith('dream') ? 136 : 104) / (page.art === 'reflections' || page.art === 'single-hero' || page.art === 'lived-paths' ? 248 : 288));
        return <View testID={`reading-page-${page.id}`} accessibilityElementsHidden={!selected} importantForAccessibility={selected ? 'auto' : 'no-hide-descendants'} aria-hidden={!selected} style={styles.fill}>
          <ScrollGate fill enabled={playing && enabled && !moving} allowAdvance={value < pages.length - 1 || canAdvance} guardEntryGesture
            startAtEnd={selected && position.end} onReady={selected ? onReady : () => {}} onProgress={selected ? onProgress : () => {}}
            onAdvance={() => turn(1)} onRetreat={() => turn(-1)} fadeTop={20} fadeBottom={20}
            controllerRef={selected ? reading.controllerRef : undefined}
            readingGesture={selected && value === 0 ? reading.readingGesture : undefined}
            onViewportChange={selected ? reading.onViewportChange : undefined}
            contentStyle={[reading.contentStyle, { paddingHorizontal: reading.contentInset + 8, paddingBottom: Math.max(Number(reading.contentStyle.paddingBottom), 28) }]}>
            <ProductText testID="reading-page-count" variant="label" style={[styles.count, { color: colors.muted }]}>{String(value + 1 + (step === 2 && chapter === 1 ? 3 : 0)).padStart(2, '0')} / {step === 1 ? '02' : '07'}</ProductText>
            {page.title && <ProductText testID="dream-chapter-title" accessibilityRole="header" variant="title" style={styles.title}>{page.title}</ProductText>}
            <View testID="reading-page-copy" style={styles.copy}>
              {page.paragraphs.map(text => <ProductText key={text} style={textStyle}>{text}</ProductText>)}
              {page.emphasis && <DreamRealityText text={page.emphasis} style={textStyle} active={playing} reducedMotion={reducedMotion} />}
              {page.conclusion && <DreamConclusion text={page.conclusion} style={[textStyle, { fontFamily: fonts.bodyBold }]} active={playing} reducedMotion={reducedMotion} />}
            </View>
            <View testID={`reading-page-art-${page.art}`} pointerEvents="none" style={[styles.art,
              (page.art === 'reflections' || page.art === 'single-hero') && styles.heroArt,
              page.art === 'dream-inward' && styles.stageArt,
              { marginHorizontal: -reading.contentInset - 8 }]}>
              <Art kind={page.art} width={artWidth} height={artHeight} active={playing} reducedMotion={reducedMotion} />
            </View>
            {page.firstStepConclusion && <StepOneConclusion active={playing} reducedMotion={reducedMotion} />}
          </ScrollGate>
        </View>;
      }} />
  </View>;
}
const styles = StyleSheet.create({
  fill: { flex: 1, minHeight: 0 },
  count: { fontSize: 9, lineHeight: 13, letterSpacing: 1.8, marginBottom: 20 },
  title: { fontSize: 22, lineHeight: 30, textTransform: 'uppercase', marginBottom: 26 },
  heroArt: { paddingTop: 64, paddingBottom: 64 },
  stageArt: { paddingTop: 64, paddingBottom: 64 },
  text: { textTransform: 'uppercase' }, copy: { gap: 24 },
  art: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', minHeight: 0, paddingTop: 40, paddingBottom: 36 },
});
