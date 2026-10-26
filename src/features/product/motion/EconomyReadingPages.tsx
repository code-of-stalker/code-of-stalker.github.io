import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import type { StyleProp, TextStyle } from 'react-native';
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
export function EconomyReadingPages({ step, chapter, active, enabled, canAdvance, startAtEnd, initialIndex = 0, initialOffset = 0, reading, width, viewportHeight, reducedMotion, onReady, onProgress, onAdvance, onRetreat, onPageChange, endContent }: {
  step: 1 | 2 | 3 | 4; chapter: 0 | 1; active: boolean; enabled: boolean; canAdvance: boolean; startAtEnd: boolean;
  endContent?: ReactNode;
  initialIndex?: number; initialOffset?: number;
  reading: ReadingLayout; width: number; viewportHeight: number; reducedMotion: boolean;
  onReady(value: boolean): void; onProgress(value: number): void;
  onAdvance(): void; onRetreat(): void; onPageChange(value: ReadingPagePosition): void;
}) {
  const pages = readingPages(step, chapter), colors = useThemeColors();
  const [position, setPosition] = useState(() => ({ index: startAtEnd ? pages.length - 1 : Math.min(initialIndex, pages.length - 1), end: startAtEnd, offset: initialOffset }));
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
    setPosition({ index: next, end: direction < 0, offset: 0 });
  }
  const textStyle = [styles.text, { fontSize: width >= 300 ? 20 : 18, lineHeight: width >= 300 ? 29 : 27 }];
  return <View testID="economy-reading-pages" style={styles.fill}>
    <ContentSwap value={index} fill reducedMotion={reducedMotion} duration={520} exitDuration={220} onComplete={finish}
      render={value => {
        const page = pages[value], kind = page.art, selected = value === index, playing = selected && active;
        const wider = kind === 'reflections' || kind === 'single-hero' ? 1.25 : kind === 'identity-imprints' ? 1.15 : 1;
        const artWidth = Math.max(1, width - 16) * wider, artHeight = kind ? Math.min(viewportHeight * .55, step === 4 ? artWidth * 2 / 3 : step === 3 ? artWidth * (kind === 'thought-loop' ? 210 / 288 : kind === 'practice-father' ? 240 / 320 : 192 / 320) : kind === 'dreamer' ? artWidth * 0.92 : artWidth * (kind === 'book' || kind === 'dream-world' || kind === 'dream-wake' ? 206 : kind === 'cells' ? 156 : kind === 'identity-imprints' || kind === 'lived-paths' ? 176 : kind.startsWith('dream') ? 136 : 104) / (kind === 'reflections' || kind === 'single-hero' || kind === 'lived-paths' ? 248 : 288)) : 0;
        return <View testID={`reading-page-${page.id}`} accessibilityElementsHidden={!selected} importantForAccessibility={selected ? 'auto' : 'no-hide-descendants'} aria-hidden={!selected} style={styles.fill}>
          <ScrollGate fill enabled={playing && enabled && !moving} allowAdvance={value < pages.length - 1 || canAdvance} guardEntryGesture
            startAtEnd={selected && position.end} initialOffset={selected ? position.offset : 0} onReady={selected ? onReady : () => {}} onProgress={selected ? onProgress : () => {}}
            onAdvance={() => turn(1)} onRetreat={() => turn(-1)} fadeTop={20} fadeBottom={20}
            controllerRef={selected ? reading.controllerRef : undefined}
            readingGesture={selected && value === 0 ? reading.readingGesture : undefined}
            onViewportChange={selected ? reading.onViewportChange : undefined}
            contentStyle={[reading.contentStyle, { paddingHorizontal: reading.contentInset + 8, paddingBottom: Math.max(Number(reading.contentStyle.paddingBottom), 28) }]}>
            <ProductText testID="reading-page-count" variant="label" style={[styles.count, { color: colors.muted }]}>{String(value + 1 + (step === 2 && chapter === 1 ? 3 : 0)).padStart(2, '0')} / {step >= 3 ? String(pages.length).padStart(2, '0') : step === 1 ? '02' : '07'}</ProductText>
            {page.title && <ProductText testID="dream-chapter-title" accessibilityRole="header" variant="title" style={styles.title}>{page.title}</ProductText>}
            <View testID="reading-page-copy" style={styles.copy}>
              {page.paragraphs.map(text => <Paragraph key={text} text={text} style={textStyle} />)}
              {page.spoken?.map(text => <ProductText key={text} style={[textStyle, { fontFamily: fonts.bodyBold }]}>{text}</ProductText>)}
              {page.after?.map(text => <ProductText key={text} style={textStyle}>{text}</ProductText>)}
              {page.statement && <ProductText style={[textStyle, { fontFamily: fonts.bodyBold }]}>{page.statement}</ProductText>}
              {page.emphasis && <DreamRealityText text={page.emphasis} style={textStyle} active={playing} reducedMotion={reducedMotion} />}
              {page.conclusion && <DreamConclusion text={page.conclusion} style={[textStyle, { fontFamily: fonts.bodyBold }]} active={playing} reducedMotion={reducedMotion} />}
            </View>
            {kind && <View testID={`reading-page-art-${kind}`} pointerEvents="none" style={[styles.art,
              (kind === 'reflections' || kind === 'single-hero') && styles.heroArt,
              kind === 'dream-inward' && styles.stageArt,
              { marginHorizontal: -reading.contentInset - 8 }]}>
              <Art kind={kind} width={artWidth} height={artHeight} active={playing} reducedMotion={reducedMotion} />
            </View>}
            {page.firstStepConclusion && <StepOneConclusion active={playing} reducedMotion={reducedMotion} />}
            {value === pages.length - 1 && endContent}
          </ScrollGate>
        </View>;
      }} />
  </View>;
}
/** Lines starting with a dash are list items: wrapped lines hang under the text, not the dash. */
function Paragraph({ text, style }: { text: string; style: StyleProp<TextStyle> }) {
  const lines = text.split('\n');
  if (!lines.some(line => line.startsWith('— '))) return <ProductText style={style}>{text}</ProductText>;
  return <View style={styles.list}>
    {lines.map(line => line.startsWith('— ')
      ? <View key={line} style={styles.item}><ProductText style={style}>—</ProductText><ProductText style={[style, styles.itemText]}>{line.slice(2)}</ProductText></View>
      : <ProductText key={line} style={style}>{line}</ProductText>)}
  </View>;
}
const styles = StyleSheet.create({
  fill: { flex: 1, minHeight: 0 },
  list: { gap: 10 }, item: { flexDirection: 'row', gap: 12 }, itemText: { flex: 1 },
  count: { fontSize: 9, lineHeight: 13, letterSpacing: 1.8, marginBottom: 20 },
  title: { fontSize: 22, lineHeight: 30, textTransform: 'uppercase', marginBottom: 26 },
  heroArt: { paddingTop: 64, paddingBottom: 64 },
  stageArt: { paddingTop: 64, paddingBottom: 64 },
  text: { textTransform: 'uppercase' }, copy: { gap: 24 },
  art: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', minHeight: 0, paddingTop: 40, paddingBottom: 36 },
});
