import { useCallback, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useIsFocused } from 'expo-router';
import type { PracticeIntroScreenProps } from './PracticeIntroScreen';
import { ProductScreen } from '../ui';
import { productSpacing, useProductLayout, useProductSpacing } from '../layout';
import { stepFivePages } from '../stepFiveContent';
import { useBackSwipe } from '../navigation/BackSwipeProvider';
import { useReadingDestination } from '../navigation/readingDestination';
import { useStepFiveBookmark } from '../state/useStepFiveBookmark';
import { useWebUpdateBlock } from '../updates/webUpdateSafety';
import { ReadingExpansion } from '../motion/ReadingExpansion';
import { StepPanel } from '../motion/StepPanel';
import { StepDropdown } from '../motion/StepDropdown';
import { StepSignature } from '../motion/StepSignature';
import { StepFiveHero } from '../motion/StepFiveHero';
import { ScrollCue } from '../motion/ScrollCue';
import { scrollCueFooterInset } from '../motion/ScrollCue.types';
import { Reveal } from '../motion/Reveal';
import { EconomyReadingPages, type ReadingPagePosition } from '../motion/EconomyReadingPages';

/** One reading block of seven pages, each with its own scene, and no questions. The author's
 * signature closes the last page; scrolling back from the first page returns to step four. */
export function StepFiveScreen({ onSelectStep, onPreviousStep, onClose, availableAt, testUnlockAll, reducedMotion = false }: PracticeIntroScreenProps) {
  const focused = useIsFocused(), destination = useReadingDestination();
  const { initial, record, flush } = useStepFiveBookmark();
  const [open, setOpen] = useState(false), [expanded, setExpanded] = useState(false);
  const [ready, setReady] = useState(false), [progress, setProgress] = useState(0);
  const [viewport, setViewport] = useState({ width: 320, height: 568 });
  const [page, setPage] = useState<ReadingPagePosition>({ index: initial.page, count: stepFivePages.length });
  const position = useRef(initial), restoringOffset = useRef(initial.offset > 0);
  const [menuHeight, setMenuHeight] = useState(0), blurTarget = useRef<View>(null);
  const { gutter } = productSpacing(viewport.width), { inset } = useProductSpacing();
  const bottomInset = Math.max(gutter, scrollCueFooterInset);
  // An illustration spans the plate below it at every size; its height follows the width.
  const { air } = useProductLayout(), heroWidth = Math.max(1, viewport.width - gutter * 2), hero = { width: heroWidth, height: heroWidth * 2 / 3 };
  const heroHeight = hero.height + (air - 1) * 32;
  const width = Math.max(1, viewport.width - gutter * 2 - inset * 2);
  const reportPage = useCallback((next: ReadingPagePosition) => {
    setPage(previous => previous.index === next.index && previous.count === next.count ? previous : next);
    if (position.current.page !== next.index) {
      restoringOffset.current = false;
      position.current = { page: next.index, offset: 0 }; record(position.current, true);
    }
  }, [record]);
  const retreat = () => { flush(); onPreviousStep(); };
  useBackSwipe(() => { if (open) setOpen(false); else retreat(); });
  useWebUpdateBlock(focused && (expanded || page.index > 0));
  const select = (step: number) => { setOpen(false); if (step !== 5) { flush(); onSelectStep(step); } };
  const close = () => { flush(); onClose(); };
  const lastPage = page.index >= page.count - 1;
  return <ProductScreen scroll={false} contentStyle={styles.fill} layout="reading">
    <View testID="step-five-reading" style={styles.fill} onLayout={event => setViewport(event.nativeEvent.layout)}>
      <View style={[styles.fill, { padding: gutter, paddingBottom: bottomInset }]}>
        <ReadingExpansion gutter={gutter} bottomInset={bottomInset} inset={inset} heroHeight={heroHeight} viewportHeight={viewport.height}
          reducedMotion={reducedMotion} enabled={!open} onClose={close} onExpandedChange={setExpanded}
          onRetreat={retreat} onRetreatProgress={setProgress} onRetreatReady={setReady} paged
          continued={destination?.step === 5 && destination.section || initial.page > 0 || initial.offset > 0}
          onViewportChange={value => {
            if (value.offset > 0) restoringOffset.current = false;
            if (focused && expanded && value.height > 0 && !restoringOffset.current) {
              position.current = { page: page.index, offset: value.offset }; record(position.current);
            }
          }}
          hero={() => <Reveal reducedMotion={reducedMotion} style={{ height: hero.height, width: hero.width, alignSelf: 'center' }}>
            <StepFiveHero width={hero.width} height={hero.height} reducedMotion={reducedMotion} />
          </Reveal>}>
          {layout => <Reveal delay={160} reducedMotion={reducedMotion} style={styles.fill}>
            <StepPanel title="ШАГ 5. ВНЕШНЕЕ КОЛЬЦО" background="clear" expanded={open} onSelect={() => setOpen(value => !value)}
              blurTarget={blurTarget} reducedMotion={reducedMotion} readingStep={5} readingProgress={layout.headerProgress}
              contentInset={layout.contentInset} readingCloseButton={layout.closeButton} menuContentHeight={menuHeight}
              readingSelection={{ availableAt, testUnlockAll, onSelectStep: select }}
              menu={open ? <StepDropdown step={5} availableAt={availableAt} testUnlockAll={testUnlockAll} reducedMotion={reducedMotion}
                inset={inset} embedded onNaturalHeight={setMenuHeight} onClose={() => setOpen(false)} onSelect={select} /> : undefined}>
              <EconomyReadingPages step={5} chapter={0} active={focused && !open} enabled={focused && !open}
                initialIndex={initial.page} initialOffset={initial.offset} canAdvance={false} startAtEnd={false}
                reading={layout} width={width} reducedMotion={reducedMotion}
                onReady={setReady} onProgress={setProgress} onAdvance={() => {}} onRetreat={retreat} onPageChange={reportPage}
                endContent={<StepSignature active={focused && !open} reducedMotion={reducedMotion} />} />
            </StepPanel>
          </Reveal>}
        </ReadingExpansion>
      </View>
      <ScrollCue visible={ready && !open && (!lastPage || progress < 0)} progress={progress} reducedMotion={reducedMotion}
        label={progress < 0 ? page.index > 0 ? 'ПРОКРУТИ НАЗАД' : 'ПРОКРУТИ К ШАГУ 4' : 'ПРОКРУТИ ДАЛЬШЕ'}
        style={{ left: gutter + 28, right: gutter + 28 }} />
    </View>
  </ProductScreen>;
}
const styles = StyleSheet.create({
  fill: { flex: 1, minHeight: 0 },
});
