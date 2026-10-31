import { useCallback, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useIsFocused } from 'expo-router';
import type { PracticeIntroScreenProps } from './PracticeIntroScreen';
import { ProductScreen } from '../ui';
import { StepSignature } from '../motion/StepSignature';
import { productSpacing, useProductLayout, useProductSpacing } from '../layout';
import { stepThreeBlocks } from '../stepThreeContent';
import { stepThreePractice } from '../stepThreePractice';
import { ContentSwap } from '../motion/ContentSwap';
import { useBackSwipe } from '../navigation/BackSwipeProvider';
import { useWebUpdateBlock } from '../updates/webUpdateSafety';
import { Art } from '../motion/Art';
import { ReadingExpansion } from '../motion/ReadingExpansion';
import { StepPanel } from '../motion/StepPanel';
import { StepDropdown } from '../motion/StepDropdown';
import { ScrollCue } from '../motion/ScrollCue';
import { scrollCueFooterInset } from '../motion/ScrollCue.types';
import { Reveal } from '../motion/Reveal';
import { EconomyReadingPages, type ReadingPagePosition } from '../motion/EconomyReadingPages';
import { useStepThreeBookmark } from '../state/useStepThreeBookmark';
import { useReadingDestination } from '../navigation/readingDestination';

/** Uses the same Rust expansion, fitted panel and reading input gate as steps 1–2. */
export function StepThreeScreen({ onSelectStep, onPreviousStep, onNextStep, onClose, availableAt, testUnlockAll, reducedMotion = false, startAtEnd = false }: PracticeIntroScreenProps) {
  const focused = useIsFocused();
  const destination = useReadingDestination();
  const { initial: stored, record, flush } = useStepThreeBookmark();
  // Like step 4, the reading is one page per illustration. A bookmark left in
  // the old scrolling article holds an offset into the whole article, so it
  // starts the reading from its first page.
  const [initial] = useState(() => stored.chapter === 0 && !stored.paged ? { chapter: 0 as const, page: 0, offset: 0 } : stored);
  const [entry, setEntry] = useState(initial);
  const position = useRef(initial);
  const restoringOffset = useRef(initial.offset > 0);
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
  // Larger screens leave more air between the hero and the panel below it.
  // An illustration spans the plate below it at every size; its height follows the width.
  const { air } = useProductLayout(), heroWidth = Math.max(1, viewport.width - gutter * 2), hero = { width: heroWidth, height: heroWidth * 2 / 3 };
  const heroHeight = hero.height + (air - 1) * 32;
  const width = Math.max(1, viewport.width - gutter * 2 - inset * 2);
  const reportPage = useCallback((next: ReadingPagePosition) => {
    setPage(previous => previous.index === next.index && previous.count === next.count ? previous : next);
    if (position.current.chapter !== chapter || position.current.page !== next.index) {
      restoringOffset.current = false;
      position.current = { chapter, page: next.index, offset: 0 };
      record({ ...position.current, paged: true }, true);
    }
  }, [chapter, record]);
  const changeChapter = (next: 0 | 1) => {
    if (changing || next === chapter) return;
    setChanging(true); setReady(false); setProgress(0); setReturnToReading(next === 0);
    setPage({ index: next === 0 ? stepThreeBlocks.length - 1 : 0, count: next === 1 ? stepThreePractice.length : stepThreeBlocks.length });
    setChapter(next);
    const target = { chapter: next, page: next === 0 ? stepThreeBlocks.length - 1 : 0, offset: 0 };
    position.current = target; setEntry(target); record({ ...target, paged: true }, true);
    restoringOffset.current = false;
  };
  const retreat = () => { if (chapter === 1) changeChapter(0); else onPreviousStep(); };
  // Scrolling past the signature crosses into the start of Step 4.
  const advance = (part: 0 | 1) => { if (part === 0) changeChapter(1); else if (onNextStep) { flush(); onNextStep(); } };
  const back = () => { if (open) setOpen(false); else retreat(); };
  useBackSwipe(back);
  useWebUpdateBlock(focused && (expanded || chapter === 1 || page.index > 0));
  const select = (step: number) => { setOpen(false); if (step !== 3) onSelectStep(step); };
  const more = page.index < page.count - 1;
  return <ProductScreen scroll={false} contentStyle={styles.fill} layout="reading">
    <View testID="step-three-reading" style={styles.fill} onLayout={event => setViewport(event.nativeEvent.layout)}>
      <View style={[styles.fill, { padding: gutter, paddingBottom: bottomInset }]}>
        <ReadingExpansion gutter={gutter} bottomInset={bottomInset} inset={inset} heroHeight={heroHeight} viewportHeight={viewport.height}
          reducedMotion={reducedMotion} enabled={!open && !changing} onClose={() => { flush(); onClose(); }} onExpandedChange={setExpanded} onRetreat={retreat} onRetreatProgress={setProgress} onRetreatReady={setReady} paged continued={destination?.step === 3 && destination.section || chapter === 1 || page.index > 0 || entry.offset > 0}
          onViewportChange={value => {
            if (value.offset > 0) restoringOffset.current = false;
            if (focused && !changing && value.height > 0 && (expanded || chapter === 1) && !restoringOffset.current) {
              position.current = { chapter, page: page.index, offset: value.offset }; record({ ...position.current, paged: true });
            }
          }}
          hero={active => <Reveal reducedMotion={reducedMotion} style={{ height: hero.height, width: hero.width, alignSelf: 'center' }}>
            <Art kind="voice-presence" width={hero.width} height={hero.height} active={active && focused} reducedMotion={reducedMotion} />
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
                  return <EconomyReadingPages step={3} chapter={part} active={current && focused && !open} enabled={enabled}
                    initialIndex={entry.chapter === part ? entry.page : 0} initialOffset={entry.chapter === part ? entry.offset : 0}
                    canAdvance={part === 0 || !!onNextStep} startAtEnd={part === 0 && returnToReading || part === 1 && startAtEnd && entry.chapter === 1 && entry.page === stepThreePractice.length - 1}
                    reading={reading} width={width} reducedMotion={reducedMotion}
                    onReady={current ? setReady : () => {}} onProgress={current ? setProgress : () => {}}
                    onAdvance={() => advance(part)} onRetreat={retreat} onPageChange={current ? reportPage : () => {}}
                    endContent={part === 1 ? <StepSignature active={current && focused && !open} reducedMotion={reducedMotion} /> : undefined} />;
                }} />
            </StepPanel>
          </Reveal>}
        </ReadingExpansion>
      </View>
      <ScrollCue visible={ready && !open && (more || chapter === 0 || !!onNextStep || progress < 0)} progress={progress} reducedMotion={reducedMotion}
        label={progress < 0 ? chapter === 1 || page.index > 0 ? 'ПРОКРУТИ НАЗАД' : 'ПРОКРУТИ К ШАГУ 2' : chapter === 1 && !more ? 'ПРОКРУТИ К ШАГУ 4' : 'ПРОКРУТИ ДАЛЬШЕ'}
        style={{ left: gutter + 28, right: gutter + 28 }} />
    </View>
  </ProductScreen>;
}
const styles = StyleSheet.create({
  fill: { flex: 1, minHeight: 0 },
});
