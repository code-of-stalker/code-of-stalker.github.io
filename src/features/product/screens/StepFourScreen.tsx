import { useCallback, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useIsFocused } from 'expo-router';
import type { PracticeIntroScreenProps } from './PracticeIntroScreen';
import { ProductScreen } from '../ui';
import { productSpacing, useProductSpacing } from '../layout';
import { stepFourPages } from '../stepFourContent';
import { useBackSwipe } from '../navigation/BackSwipeProvider';
import { useReadingDestination } from '../navigation/readingDestination';
import { useStepFourBookmark } from '../state/useStepFourBookmark';
import { useWebUpdateBlock } from '../updates/webUpdateSafety';
import { Art } from '../motion/Art';
import { ReadingExpansion } from '../motion/ReadingExpansion';
import { StepPanel } from '../motion/StepPanel';
import { StepDropdown } from '../motion/StepDropdown';
import { ScrollCue } from '../motion/ScrollCue';
import { scrollCueFooterInset } from '../motion/ScrollCue.types';
import { Reveal } from '../motion/Reveal';
import { EconomyReadingPages, type ReadingPagePosition } from '../motion/EconomyReadingPages';

/** One scene per page in every quality mode; the shared Rust reader owns the zoom and transitions. */
export function StepFourScreen({ onSelectStep, onPreviousStep, onClose, availableAt, testUnlockAll, reducedMotion = false }: PracticeIntroScreenProps) {
  const focused = useIsFocused(), destination = useReadingDestination();
  const { initial, record, flush } = useStepFourBookmark();
  const [open, setOpen] = useState(false), [expanded, setExpanded] = useState(false);
  const [ready, setReady] = useState(false), [progress, setProgress] = useState(0);
  const [viewport, setViewport] = useState({ width: 320, height: 568 });
  const [page, setPage] = useState<ReadingPagePosition>({ index: initial.page, count: stepFourPages.length });
  const position = useRef(initial), restoringOffset = useRef(initial.offset > 0);
  const [menuHeight, setMenuHeight] = useState(0), blurTarget = useRef<View>(null);
  const { gutter } = productSpacing(viewport.width), { inset } = useProductSpacing();
  const bottomInset = Math.max(gutter, scrollCueFooterInset);
  const heroHeight = Math.max(1, viewport.width - gutter * 2) * 2 / 3;
  const width = Math.max(1, viewport.width - gutter * 2 - inset * 2);
  const reportPage = useCallback((next: ReadingPagePosition) => {
    setPage(previous => previous.index === next.index ? previous : next);
    if (position.current.page !== next.index) {
      restoringOffset.current = false;
      position.current = { page: next.index, offset: 0 }; record(position.current, true);
    }
  }, [record]);
  const retreat = () => { flush(); onPreviousStep(); };
  useBackSwipe(() => { if (open) setOpen(false); else retreat(); });
  useWebUpdateBlock(focused && (expanded || page.index > 0));
  const select = (step: number) => { setOpen(false); if (step !== 4) { flush(); onSelectStep(step); } };
  return <ProductScreen scroll={false} contentStyle={styles.fill}>
    <View testID="step-four-reading" style={styles.fill} onLayout={event => setViewport(event.nativeEvent.layout)}>
      <View style={[styles.fill, { padding: gutter, paddingBottom: bottomInset }]}>
        <ReadingExpansion gutter={gutter} bottomInset={bottomInset} inset={inset} heroHeight={heroHeight} viewportHeight={viewport.height}
          reducedMotion={reducedMotion} enabled={!open} onClose={() => { flush(); onClose(); }} onExpandedChange={setExpanded}
          onRetreat={retreat} onRetreatProgress={setProgress} onRetreatReady={setReady} paged
          continued={destination?.step === 4 && destination.section || initial.page > 0 || initial.offset > 0}
          onViewportChange={value => {
            if (value.offset > 0) restoringOffset.current = false;
            if (focused && expanded && value.height > 0 && !restoringOffset.current) {
              position.current = { page: page.index, offset: value.offset }; record(position.current);
            }
          }}
          hero={active => <Reveal reducedMotion={reducedMotion} style={{ height: heroHeight }}>
            <Art kind="grounding-hero" height={heroHeight} active={active && focused} reducedMotion={reducedMotion} />
          </Reveal>}>
          {reading => <Reveal delay={160} reducedMotion={reducedMotion} style={styles.fill}>
            <StepPanel title="ШАГ 4. ЗАЗЕМЛЕНИЕ" background="clear" expanded={open} onSelect={() => setOpen(value => !value)}
              blurTarget={blurTarget} reducedMotion={reducedMotion} readingStep={4} readingProgress={reading.headerProgress}
              contentInset={reading.contentInset} readingCloseButton={reading.closeButton} menuContentHeight={menuHeight}
              readingSelection={{ availableAt, testUnlockAll, onSelectStep: select }}
              menu={open ? <StepDropdown step={4} availableAt={availableAt} testUnlockAll={testUnlockAll} reducedMotion={reducedMotion}
                inset={inset} embedded onNaturalHeight={setMenuHeight} onClose={() => setOpen(false)} onSelect={select} /> : undefined}>
              <EconomyReadingPages step={4} chapter={0} active={focused} enabled={focused && !open}
                initialIndex={initial.page} initialOffset={initial.offset} canAdvance={false} startAtEnd={false}
                reading={reading} width={width} viewportHeight={viewport.height} reducedMotion={reducedMotion}
                onReady={setReady} onProgress={setProgress} onAdvance={() => {}} onRetreat={retreat} onPageChange={reportPage} />
            </StepPanel>
          </Reveal>}
        </ReadingExpansion>
      </View>
      <ScrollCue visible={ready && !open && (page.index < page.count - 1 || progress < 0)} progress={progress} reducedMotion={reducedMotion}
        label={progress < 0 ? page.index > 0 ? 'ПРОКРУТИ НАЗАД' : 'ПРОКРУТИ К ШАГУ 3' : 'ПРОКРУТИ ДАЛЬШЕ'}
        style={{ left: gutter + 28, right: gutter + 28 }} />
    </View>
  </ProductScreen>;
}
const styles = StyleSheet.create({ fill: { flex: 1, minHeight: 0 } });
