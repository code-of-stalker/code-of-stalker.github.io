import { Fragment, useCallback, useLayoutEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { useIsFocused } from 'expo-router';
import type { PracticeIntroScreenProps } from './PracticeIntroScreen';
import { ProductScreen, ProductText } from '../ui';
import { StepSignature } from '../motion/StepSignature';
import { productSpacing, useProductSpacing } from '../layout';
import { fonts } from '../theme';
import { stepThreeBlocks } from '../stepThreeContent';
import { stepThreePractice } from '../stepThreePractice';
import { ContentSwap } from '../motion/ContentSwap';
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
import { useStepThreeBookmark } from '../state/useStepThreeBookmark';
import { useReadingDestination } from '../navigation/readingDestination';

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
export function StepThreeScreen({ onSelectStep, onPreviousStep, onClose, availableAt, testUnlockAll, reducedMotion = false, startAtEnd = false }: PracticeIntroScreenProps) {
  const { settings } = useProduct(), focused = useIsFocused();
  const destination = useReadingDestination();
  const { initial, record, flush } = useStepThreeBookmark();
  const [entry, setEntry] = useState(initial);
  const position = useRef(initial);
  const restoringOffset = useRef(initial.offset > 0);
  const paged = settings.effectQuality === 'economy' || !!initial.paged || destination?.step === 3 && destination.section, economy = useEffectQualityLevel() === 'economy';
  const [chapter, setChapter] = useState<0 | 1>(initial.chapter), [changing, setChanging] = useState(false);
  const [returnToReading, setReturnToReading] = useState(false);
  const [open, setOpen] = useState(false), [expanded, setExpanded] = useState(false);
  const [ready, setReady] = useState(false), [progress, setProgress] = useState(0);
  const [viewport, setViewport] = useState({ width: 320, height: 568 });
  const [page, setPage] = useState<ReadingPagePosition>({ index: initial.page, count: initial.chapter === 1 ? stepThreePractice.length : stepThreeBlocks.length });
  const [menuHeight, setMenuHeight] = useState(0);
  const blurTarget = useRef<View>(null);
  const { gutter } = productSpacing(viewport.width), { inset } = useProductSpacing();
  const bottomInset = Math.max(gutter, scrollCueFooterInset);
  const heroHeight = Math.max(1, viewport.width - gutter * 2) * 2 / 3;
  const width = Math.max(1, viewport.width - gutter * 2 - inset * 2);
  const artBounds = useRef<Partial<Record<StepThreeArtKind, Bounds>>>({});
  const window = useRef({ offset: 0, height: 0 });
  const { playing, update } = useReadingPlayback(artKinds, economy, chapter === 0 && !paged && focused && !open && !changing);
  const measure = useCallback((kind: StepThreeArtKind, bounds: Bounds) => {
    artBounds.current[kind] = bounds; update(artBounds.current, window.current);
  }, [update]);
  const reportPage = useCallback((next: ReadingPagePosition) => {
    setPage(previous => previous.index === next.index && previous.count === next.count ? previous : next);
    if (position.current.chapter !== chapter || position.current.page !== next.index) {
      restoringOffset.current = false;
      position.current = { chapter, page: next.index, offset: 0 };
      record({ ...position.current, paged }, true);
    }
  }, [chapter, paged, record]);
  const changeChapter = (next: 0 | 1) => {
    if (changing || next === chapter) return;
    setChanging(true); setReady(false); setProgress(0); setReturnToReading(next === 0);
    setPage({ index: next === 0 && paged ? stepThreeBlocks.length - 1 : 0, count: next === 1 ? stepThreePractice.length : stepThreeBlocks.length });
    artBounds.current = {}; setChapter(next);
    const target = { chapter: next, page: next === 0 && paged ? stepThreeBlocks.length - 1 : 0, offset: 0 };
    position.current = target; setEntry(target); record({ ...target, paged }, true);
    restoringOffset.current = false;
  };
  const retreat = () => { if (chapter === 1) changeChapter(0); else onPreviousStep(); };
  const back = () => { if (open) setOpen(false); else retreat(); };
  useBackSwipe(back);
  useWebUpdateBlock(focused && (expanded || chapter === 1 || page.index > 0));
  const select = (step: number) => { setOpen(false); if (step !== 3) onSelectStep(step); };
  const more = (paged || chapter === 1) && page.index < page.count - 1;
  return <ProductScreen scroll={false} contentStyle={styles.fill}>
    <View testID="step-three-reading" style={styles.fill} onLayout={event => setViewport(event.nativeEvent.layout)}>
      <View style={[styles.fill, { padding: gutter, paddingBottom: bottomInset }]}>
        <ReadingExpansion gutter={gutter} bottomInset={bottomInset} inset={inset} heroHeight={heroHeight} viewportHeight={viewport.height}
          reducedMotion={reducedMotion} enabled={!open && !changing} onClose={() => { flush(); onClose(); }} onExpandedChange={setExpanded} onRetreat={retreat} onRetreatProgress={setProgress} onRetreatReady={setReady} paged={paged || chapter === 1} continued={destination?.step === 3 && destination.section || chapter === 1 || paged && page.index > 0 || entry.offset > 0}
          onViewportChange={value => {
            window.current = value; update(artBounds.current, value);
            if (value.offset > 0) restoringOffset.current = false;
            if (focused && !changing && value.height > 0 && (expanded || chapter === 1) && !restoringOffset.current) {
              position.current = { chapter, page: page.index, offset: value.offset }; record({ ...position.current, paged });
            }
          }}
          hero={active => <Reveal reducedMotion={reducedMotion} style={{ height: heroHeight }}>
            <Art kind="voice-presence" height={heroHeight} active={active && focused} reducedMotion={reducedMotion} />
          </Reveal>}>
          {reading => <Reveal delay={160} reducedMotion={reducedMotion} style={styles.fill}>
            <StepPanel title="ШАГ 3. ГОЛОС КАК МОСТ" background="clear" expanded={open} onSelect={() => setOpen(value => !value)}
              blurTarget={blurTarget} reducedMotion={reducedMotion} readingStep={3} readingProgress={reading.headerProgress}
              contentInset={reading.contentInset} readingCloseButton={reading.closeButton} menuContentHeight={menuHeight}
              readingSelection={{ availableAt, testUnlockAll, onSelectStep: select }}
              menu={open ? <StepDropdown step={3} availableAt={availableAt} testUnlockAll={testUnlockAll} reducedMotion={reducedMotion}
                inset={inset} embedded onNaturalHeight={setMenuHeight} onClose={() => setOpen(false)} onSelect={select} /> : undefined}>
              <ContentSwap value={chapter} fill dissolve duration={600} exitDuration={240} reducedMotion={reducedMotion}
                onComplete={value => { if (value === chapter) setChanging(false); }} render={part => {
                  const current = part === chapter, enabled = current && focused && !open && !changing;
                  if (paged || part === 1) return <EconomyReadingPages step={3} chapter={part} active={current && focused && !open} enabled={enabled}
                    initialIndex={entry.chapter === part ? entry.page : 0} initialOffset={entry.chapter === part ? entry.offset : 0}
                    canAdvance={part === 0} startAtEnd={part === 0 && returnToReading || part === 1 && startAtEnd && entry.chapter === 1 && entry.page === stepThreePractice.length - 1}
                    reading={reading} width={width} viewportHeight={viewport.height} reducedMotion={reducedMotion}
                    onReady={current ? setReady : () => {}} onProgress={current ? setProgress : () => {}}
                    onAdvance={() => changeChapter(1)} onRetreat={retreat} onPageChange={current ? reportPage : () => {}}
                    endContent={part === 1 ? <StepSignature active={current && focused && !open} reducedMotion={reducedMotion} /> : undefined} />;
                  return <ScrollGate enabled={enabled} allowAdvance={current} onReady={current ? setReady : () => {}} onProgress={current ? setProgress : () => {}}
                    onAdvance={() => changeChapter(1)} onRetreat={retreat} fadeTop={24} fadeBottom={24} startAtEnd={returnToReading} initialOffset={entry.chapter === part ? entry.offset : 0} guardEntryGesture={returnToReading}
                    controllerRef={current ? reading.controllerRef : undefined} readingGesture={current ? reading.readingGesture : undefined}
                    onViewportChange={current ? reading.onViewportChange : undefined} contentStyle={reading.contentStyle}>
                    {stepThreeBlocks.map(block => <Fragment key={block.id}>
                      {block.title && <ProductText accessibilityRole="header" variant="title" style={styles.title}>{block.title}</ProductText>}
                      {block.paragraphs.map(text => <ProductText key={text} style={styles.copy}>{text}</ProductText>)}
                      {block.emphasis && <ProductText style={[styles.copy, styles.emphasis]}>{block.emphasis}</ProductText>}
                      <MeasuredArt kind={block.art} width={width} active={current && playing[block.art] && focused && !open && !changing} reducedMotion={reducedMotion}
                        topInset={Number(reading.contentStyle.paddingTop ?? 0)} onMeasure={measure} />
                    </Fragment>)}
                  </ScrollGate>;
                }} />
            </StepPanel>
          </Reveal>}
        </ReadingExpansion>
      </View>
      <ScrollCue visible={ready && !open && (more || chapter === 0 || progress < 0)} progress={progress} reducedMotion={reducedMotion}
        label={progress < 0 ? chapter === 1 || paged && page.index > 0 ? 'ПРОКРУТИ НАЗАД' : 'ПРОКРУТИ К ШАГУ 2' : 'ПРОКРУТИ ДАЛЬШЕ'}
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
});
