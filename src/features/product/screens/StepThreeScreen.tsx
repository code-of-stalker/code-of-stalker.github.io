import { Fragment, useCallback, useLayoutEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { useIsFocused } from 'expo-router';
import type { PracticeIntroScreenProps } from './PracticeIntroScreen';
import { ProductButton, ProductScreen, ProductText } from '../ui';
import { productSpacing, useProductSpacing } from '../layout';
import { fonts } from '../theme';
import { stepThreeBlocks } from '../stepThreeContent';
import { useProduct } from '../state/ProductProvider';
import { useBackSwipe } from '../navigation/BackSwipeProvider';
import { useWebUpdateBlock } from '../updates/webUpdateSafety';
import { Art } from '../motion/Art';
import type { StepThreeArtKind } from '../motion/types';
import { ReadingExpansion } from '../motion/ReadingExpansion';
import { StepPanel } from '../motion/StepPanel';
import { StepDropdown } from '../motion/StepDropdown';
import { ScrollGate } from '../motion/ScrollGate';
import { ScrollCue } from '../motion/ScrollCue';
import { scrollCueFooterInset } from '../motion/ScrollCue.types';
import { Reveal } from '../motion/Reveal';
import { useReadingPlayback } from '../motion/useReadingPlayback';
import { useEffectQualityLevel } from '../motion/EffectsQuality';
import { EconomyReadingPages, type ReadingPagePosition } from '../motion/EconomyReadingPages';

const artKinds = stepThreeBlocks.map(block => block.art);
type Bounds = { top: number; height: number };
function MeasuredArt({ kind, width, active, reducedMotion, topInset, onMeasure }: {
  kind: StepThreeArtKind; width: number; active: boolean; reducedMotion: boolean; topInset: number;
  onMeasure(kind: StepThreeArtKind, bounds: Bounds): void;
}) {
  const ref = useRef<View>(null), callback = useRef(onMeasure);
  useLayoutEffect(() => { callback.current = onMeasure; }, [onMeasure]);
  useLayoutEffect(() => {
    if (Platform.OS !== 'web' || !ref.current) return;
    const node = ref.current as unknown as HTMLElement, parent = node.parentElement;
    if (!parent) return;
    let frame = 0, live = true;
    const read = () => {
      if (!live) return;
      const box = node.getBoundingClientRect(), content = parent.getBoundingClientRect();
      callback.current(kind, { top: box.top - content.top, height: box.height });
    };
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(read); };
    const observer = new ResizeObserver(schedule);
    observer.observe(node); observer.observe(parent); schedule(); void document.fonts.ready.then(schedule);
    return () => { live = false; cancelAnimationFrame(frame); observer.disconnect(); };
  }, [kind, width, topInset]);
  return <View ref={ref} testID={`step-three-art-${kind}`} pointerEvents="none" style={styles.art}
    onLayout={event => { if (Platform.OS !== 'web') onMeasure(kind, { top: event.nativeEvent.layout.y, height: event.nativeEvent.layout.height }); }}>
    <Art kind={kind} height={width * (kind === 'thought-loop' ? 210 / 288 : 192 / 320)} active={active} reducedMotion={reducedMotion} />
  </View>;
}

/** Uses the same Rust expansion, fitted panel and reading input gate as steps 1–2. */
export function StepThreeScreen({ onSelectStep, onPreviousStep, onClose, onDiary, availableAt, testUnlockAll, reducedMotion = false }: PracticeIntroScreenProps) {
  const { settings } = useProduct(), focused = useIsFocused();
  const paged = settings.effectQuality === 'economy', economy = useEffectQualityLevel() === 'economy';
  const [open, setOpen] = useState(false), [expanded, setExpanded] = useState(false);
  const [ready, setReady] = useState(false), [progress, setProgress] = useState(0);
  const [viewport, setViewport] = useState({ width: 320, height: 568 });
  const [page, setPage] = useState<ReadingPagePosition>({ index: 0, count: stepThreeBlocks.length });
  const [menuHeight, setMenuHeight] = useState(0);
  const blurTarget = useRef<View>(null);
  const { gutter } = productSpacing(viewport.width), { inset } = useProductSpacing();
  const bottomInset = Math.max(gutter, scrollCueFooterInset);
  const heroHeight = Math.max(1, viewport.width - gutter * 2) * 2 / 3;
  const width = Math.max(1, viewport.width - gutter * 2 - inset * 2);
  const artBounds = useRef<Partial<Record<StepThreeArtKind, Bounds>>>({});
  const window = useRef({ offset: 0, height: 0 });
  const { playing, update } = useReadingPlayback(artKinds, economy, !paged && focused && !open);
  const measure = useCallback((kind: StepThreeArtKind, bounds: Bounds) => {
    artBounds.current[kind] = bounds; update(artBounds.current, window.current);
  }, [update]);
  const reportPage = useCallback((next: ReadingPagePosition) => setPage(previous =>
    previous.index === next.index && previous.count === next.count ? previous : next), []);
  const back = () => { if (open) setOpen(false); else onPreviousStep(); };
  useBackSwipe(back);
  useWebUpdateBlock(focused && (expanded || page.index > 0));
  const select = (step: number) => { setOpen(false); if (step !== 3) onSelectStep(step); };
  const end = <View style={styles.end}><ProductButton label="ОТКРЫТЬ ДНЕВНИК" kind="outline" onPress={onDiary} /></View>;
  const more = paged && page.index < page.count - 1;
  return <ProductScreen scroll={false} contentStyle={styles.fill}>
    <View testID="step-three-reading" style={styles.fill} onLayout={event => setViewport(event.nativeEvent.layout)}>
      <View style={[styles.fill, { padding: gutter, paddingBottom: bottomInset }]}>
        <ReadingExpansion gutter={gutter} bottomInset={bottomInset} inset={inset} heroHeight={heroHeight} viewportHeight={viewport.height}
          reducedMotion={reducedMotion} enabled={!open} onClose={onClose} onExpandedChange={setExpanded} onRetreat={onPreviousStep} onRetreatProgress={setProgress} onRetreatReady={setReady} paged={paged} continued={paged && page.index > 0}
          onViewportChange={value => { window.current = value; update(artBounds.current, value); }}
          hero={active => <Reveal reducedMotion={reducedMotion} style={{ height: heroHeight }}>
            <Art kind="voice-presence" height={heroHeight} active={active && focused && !open} reducedMotion={reducedMotion} />
          </Reveal>}>
          {reading => <Reveal delay={160} reducedMotion={reducedMotion} style={styles.fill}>
            <StepPanel title="ШАГ 3. ГОЛОС КАК МОСТ" background="clear" expanded={open} onSelect={() => setOpen(value => !value)}
              blurTarget={blurTarget} reducedMotion={reducedMotion} readingStep={3} readingProgress={reading.headerProgress}
              contentInset={reading.contentInset} readingCloseButton={reading.closeButton} menuContentHeight={menuHeight}
              readingSelection={{ availableAt, testUnlockAll, onSelectStep: select }}
              menu={open ? <StepDropdown step={3} availableAt={availableAt} testUnlockAll={testUnlockAll} reducedMotion={reducedMotion}
                inset={inset} embedded onNaturalHeight={setMenuHeight} onClose={() => setOpen(false)} onSelect={select} /> : undefined}>
              {paged ? <EconomyReadingPages step={3} chapter={0} active={focused && !open} enabled={!open} canAdvance={false} startAtEnd={false}
                reading={reading} width={width} viewportHeight={viewport.height} reducedMotion={reducedMotion}
                onReady={setReady} onProgress={setProgress} onAdvance={() => {}} onRetreat={onPreviousStep} onPageChange={reportPage} endContent={end} />
                : <ScrollGate enabled={!open} allowAdvance={false} onReady={setReady} onProgress={setProgress} onAdvance={() => {}}
                  onRetreat={onPreviousStep} fadeTop={24} fadeBottom={24} controllerRef={reading.controllerRef} readingGesture={reading.readingGesture}
                  onViewportChange={reading.onViewportChange} contentStyle={reading.contentStyle}>
                  {stepThreeBlocks.map((block, index) => <Fragment key={block.id}>
                    {block.title && <ProductText accessibilityRole="header" variant="title" style={styles.title}>{block.title}</ProductText>}
                    {block.paragraphs.map(text => <ProductText key={text} style={styles.copy}>{text}</ProductText>)}
                    {block.emphasis && <ProductText style={[styles.copy, styles.emphasis]}>{block.emphasis}</ProductText>}
                    <MeasuredArt kind={block.art} width={width} active={playing[block.art] && focused && !open} reducedMotion={reducedMotion}
                      topInset={Number(reading.contentStyle.paddingTop ?? 0)} onMeasure={measure} />
                    {index === stepThreeBlocks.length - 1 && end}
                  </Fragment>)}
                </ScrollGate>}
            </StepPanel>
          </Reveal>}
        </ReadingExpansion>
      </View>
      <ScrollCue visible={ready && !open && (more || progress < 0)} progress={progress} reducedMotion={reducedMotion}
        label={progress < 0 ? paged && page.index > 0 ? 'ПРОКРУТИ НАЗАД' : 'ПРОКРУТИ К ШАГУ 2' : 'ПРОКРУТИ ДАЛЬШЕ'}
        style={{ left: gutter + 28, right: gutter + 28 }} />
    </View>
  </ProductScreen>;
}
const styles = StyleSheet.create({
  fill: { flex: 1, minHeight: 0 },
  title: { fontSize: 20, lineHeight: 28, textTransform: 'uppercase', marginBottom: 24 },
  copy: { fontSize: 14, lineHeight: 21, textTransform: 'uppercase', marginBottom: 20 },
  emphasis: { fontFamily: fonts.bodyBold },
  art: { marginTop: 12, marginBottom: 52 },
  end: { paddingBottom: 20 },
});
