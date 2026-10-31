import { useCallback, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useIsFocused } from 'expo-router';
import type { PracticeIntroScreenProps } from './PracticeIntroScreen';
import type { ObservationNavigation } from './ObservationScreen';
import { ProductIconButton, ProductScreen, ProductText } from '../ui';
import { productSpacing, useProductLayout, useProductSpacing } from '../layout';
import { stepFourBlocks, stepFourIndex, stepFourPlace, stepFourQuestions, type StepFourPart } from '../stepFourContent';
import { useProduct } from '../state/ProductProvider';
import { useBackSwipe } from '../navigation/BackSwipeProvider';
import { useReadingDestination } from '../navigation/readingDestination';
import { useStepFourBookmark } from '../state/useStepFourBookmark';
import { useWebUpdateBlock } from '../updates/webUpdateSafety';
import { Art } from '../motion/Art';
import { ReadingExpansion } from '../motion/ReadingExpansion';
import { StepPanel } from '../motion/StepPanel';
import { StepDropdown } from '../motion/StepDropdown';
import { ScrollCue } from '../motion/ScrollCue';
import { scrollCueFooterInset, type ScrollCueState } from '../motion/ScrollCue.types';
import { Reveal } from '../motion/Reveal';
import { EconomyReadingPages, type ReadingPagePosition } from '../motion/EconomyReadingPages';
import { PracticeEntryTransition } from '../motion/PracticeEntryTransition';
import { TaskStepSelector } from '../motion/TaskStepSelector';
import { StepSignature } from '../motion/StepSignature';

type ReadingEntry = { block: 0 | 1; page: number; offset: number; end: boolean };
const ignoreHeight = () => {};

/** One scene per page in every quality mode; the shared Rust reader owns the zoom and transitions.
 * The questions between the two reading blocks use the voice answer of steps 1–2. */
export function StepFourScreen({ onSelectStep, onPreviousStep, onNextStep, onClose, availableAt, testUnlockAll, reducedMotion = false, renderQuestions }: PracticeIntroScreenProps) {
  const focused = useIsFocused(), destination = useReadingDestination(), { updateProgress } = useProduct();
  const { initial, record, flush } = useStepFourBookmark();
  const [part, setPart] = useState<StepFourPart>(() => stepFourPlace(initial.page).part);
  // The reader keeps its own entry, so it doesn't move while the questions scan in over it.
  const [reading, setReading] = useState<ReadingEntry>(() => {
    const start = stepFourPlace(initial.page);
    return start.part === 'questions' ? { block: 0, page: stepFourBlocks[0].length - 1, offset: 0, end: true }
      : { block: start.part, page: start.page, offset: initial.offset, end: false };
  });
  const questions = part === 'questions';
  const [scanning, setScanning] = useState(false);
  const [open, setOpen] = useState(false), [expanded, setExpanded] = useState(false);
  const [ready, setReady] = useState(false), [progress, setProgress] = useState(0);
  const [viewport, setViewport] = useState({ width: 320, height: 568 });
  const [page, setPage] = useState<ReadingPagePosition>({ index: reading.page, count: stepFourBlocks[reading.block].length });
  const position = useRef(initial), restoringOffset = useRef(initial.offset > 0);
  const [menuHeight, setMenuHeight] = useState(0), blurTarget = useRef<View>(null);
  const observation = useRef<ObservationNavigation | null>(null), crossing = useRef(false);
  const [reviewing, setReviewing] = useState(false), [recordingCue, setRecordingCue] = useState<ScrollCueState | null>(null);
  const { gutter } = productSpacing(viewport.width), { inset } = useProductSpacing();
  const bottomInset = Math.max(gutter, scrollCueFooterInset);
  const sceneHeight = Math.max(1, viewport.height - gutter - (questions ? gutter : bottomInset));
  // Larger screens leave more air between the hero and the panel below it.
  // An illustration spans the plate below it at every size; its height follows the width.
  const { air } = useProductLayout(), heroWidth = Math.max(1, viewport.width - gutter * 2), hero = { width: heroWidth, height: heroWidth * 2 / 3 };
  const heroHeight = hero.height + (air - 1) * 32;
  const width = Math.max(1, viewport.width - gutter * 2 - inset * 2);
  const reportPage = useCallback((next: ReadingPagePosition) => {
    setPage(previous => previous.index === next.index && previous.count === next.count ? previous : next);
    const index = stepFourIndex(reading.block, next.index);
    if (position.current.page !== index) {
      restoringOffset.current = false;
      position.current = { page: index, offset: 0 }; record(position.current, true);
    }
  }, [record, reading.block]);
  const registerNavigation = useCallback((actions: ObservationNavigation | null) => {
    observation.current = actions;
    setReviewing(!!actions?.reviewing);
    setRecordingCue(previous => {
      const next = actions?.scrollCue ?? null;
      return previous?.visible === next?.visible && previous?.progress === next?.progress && previous?.label === next?.label ? previous : next;
    });
  }, []);
  // Each crossing between a reading block and the questions moves the bookmark with it.
  function enter(next: StepFourPart, end = false) {
    const target = next === 'questions' ? 0 : end ? stepFourBlocks[next].length - 1 : 0;
    restoringOffset.current = false; setOpen(false); setReady(false); setProgress(0);
    position.current = { page: stepFourIndex(next, target), offset: 0 }; record(position.current, true);
    if (next !== 'questions') {
      setReading({ block: next, page: target, offset: 0, end });
      setPage({ index: target, count: stepFourBlocks[next].length });
    }
    // Like steps 1–2, the scanner opens the questions after the reading before them.
    setScanning(next === 'questions' && part === 0 && !reducedMotion);
    setPart(next);
  }
  const retreat = () => {
    if (reading.block === 0) { flush(); onPreviousStep(); return; }
    // Crossing back lands on the last question, as crossing back into step 1 does.
    if (crossing.current) return;
    crossing.current = true;
    void updateProgress({ questionIndex: stepFourQuestions.length - 1 }).catch(() => {})
      .finally(() => { crossing.current = false; enter('questions'); });
  };
  useBackSwipe(() => { if (open) setOpen(false); else if (questions) observation.current?.back(); else retreat(); });
  useWebUpdateBlock(focused && (expanded || questions || reading.block === 1 || page.index > 0));
  // The first block scrolls on into the questions; the end of the second scrolls into step five.
  const advance = () => { if (reading.block === 0) enter('questions'); else if (onNextStep) { flush(); onNextStep(); } };
  const select = (step: number) => { setOpen(false); if (step !== 4) { flush(); onSelectStep(step); } };
  const close = () => { flush(); onClose(); };
  const lastPage = page.index >= page.count - 1;
  const questionCue = <ScrollCue visible={!!recordingCue?.visible && !open && !scanning} progress={recordingCue?.progress ?? 0}
    label={recordingCue?.label ?? 'ПРОКРУТИ ДАЛЬШЕ'} reducedMotion={reducedMotion} style={{ left: 0, right: 0, bottom: 5 }} />;
  return <ProductScreen scroll={false} contentStyle={styles.fill} layout="reading">
    <View testID="step-four-reading" style={styles.fill} onLayout={event => setViewport(event.nativeEvent.layout)}>
      <View style={[styles.fill, { padding: gutter, paddingBottom: questions ? gutter : bottomInset }]}>
        <PracticeEntryTransition showTask={questions} scanning={scanning} height={sceneHeight} reducedMotion={reducedMotion}
          onComplete={() => setScanning(false)} intro={<ReadingExpansion gutter={gutter} bottomInset={bottomInset} inset={inset} heroHeight={heroHeight} viewportHeight={viewport.height}
          reducedMotion={reducedMotion} enabled={!open && !questions} onClose={close} onExpandedChange={setExpanded}
          onRetreat={retreat} onRetreatProgress={setProgress} onRetreatReady={setReady} paged
          continued={destination?.step === 4 && destination.section || reading.block === 1 || reading.page > 0 || reading.offset > 0}
          onViewportChange={value => {
            if (value.offset > 0) restoringOffset.current = false;
            if (focused && expanded && !questions && value.height > 0 && !restoringOffset.current) {
              position.current = { page: stepFourIndex(reading.block, page.index), offset: value.offset }; record(position.current);
            }
          }}
          hero={active => <Reveal reducedMotion={reducedMotion} style={{ height: hero.height, width: hero.width, alignSelf: 'center' }}>
            <Art kind="grounding-hero" width={hero.width} height={hero.height} active={active && focused && !questions} reducedMotion={reducedMotion} />
          </Reveal>}>
          {layout => <Reveal delay={160} reducedMotion={reducedMotion} style={styles.fill}>
            <StepPanel title="ШАГ 4. ЗАЗЕМЛЕНИЕ" background="clear" expanded={open && !questions} onSelect={() => setOpen(value => !value)}
              blurTarget={blurTarget} reducedMotion={reducedMotion} readingStep={4} readingProgress={layout.headerProgress}
              contentInset={layout.contentInset} readingCloseButton={layout.closeButton} menuContentHeight={menuHeight}
              readingSelection={{ availableAt, testUnlockAll, onSelectStep: select }}
              menu={open && !questions ? <StepDropdown step={4} availableAt={availableAt} testUnlockAll={testUnlockAll} reducedMotion={reducedMotion}
                inset={inset} embedded onNaturalHeight={setMenuHeight} onClose={() => setOpen(false)} onSelect={select} /> : undefined}>
              <EconomyReadingPages key={reading.block} step={4} chapter={reading.block} active={focused && !open && !questions} enabled={focused && !open && !questions}
                initialIndex={reading.page} initialOffset={reading.offset} canAdvance={reading.block === 0 ? !!renderQuestions : !!onNextStep} startAtEnd={reading.end}
                reading={layout} width={width} reducedMotion={reducedMotion}
                onReady={setReady} onProgress={setProgress} onAdvance={advance} onRetreat={retreat} onPageChange={reportPage}
                endContent={reading.block === 1 ? <StepSignature active={focused && !open && !questions} reducedMotion={reducedMotion} /> : undefined} />
            </StepPanel>
          </Reveal>}
        </ReadingExpansion>}>
          {open && <Pressable accessibilityLabel="Закрыть выбор шага" style={[StyleSheet.absoluteFill, { zIndex: 10 }]} onPress={() => setOpen(false)} />}
          <Reveal reducedMotion={reducedMotion} style={[styles.header, { marginBottom: 12 + (air - 1) * 24 }]}>
            <ProductIconButton icon="back" onPress={() => { if (observation.current) observation.current.back(); else enter(0, true); }} />
            <ProductText variant="title">ЗАДАНИЕ</ProductText>
            <ProductIconButton icon="close" onPress={() => { if (observation.current) observation.current.close(); else close(); }} />
          </Reveal>
          <View pointerEvents={open ? 'none' : 'auto'} style={styles.fill}>
            {questions && <Questions render={renderQuestions} effectsActive={!open} onBack={() => enter(0, true)} onNavigation={registerNavigation} onAnswered={() => enter(1)} />}
          </View>
          <View pointerEvents={reviewing ? 'none' : 'auto'} style={{ opacity: reviewing ? 0 : 1, zIndex: 20 }}>
            <TaskStepSelector step={4} availableAt={availableAt} testUnlockAll={testUnlockAll} open={open} onToggle={() => setOpen(value => !value)}
              onSelect={select} reducedMotion={reducedMotion} inset={inset} maxHeight={Math.max(120, sceneHeight - 56)} trailing={questionCue} />
          </View>
        </PracticeEntryTransition>
      </View>
      {!questions && <ScrollCue visible={ready && !open && (!lastPage || reading.block === 0 || !!onNextStep || progress < 0)} progress={progress} reducedMotion={reducedMotion}
        label={progress < 0 ? page.index > 0 || reading.block === 1 ? 'ПРОКРУТИ НАЗАД' : 'ПРОКРУТИ К ШАГУ 3' : lastPage ? reading.block === 0 ? 'ПРОКРУТИ К ЗАПИСИ' : 'ПРОКРУТИ К ШАГУ 5' : 'ПРОКРУТИ ДАЛЬШЕ'}
        style={{ left: gutter + 28, right: gutter + 28 }} />}
    </View>
  </ProductScreen>;
}
/** The shared question flow of steps 1–2, mounted as an element so its handlers stay event handlers. */
function Questions({ render, effectsActive, onBack, onNavigation, onAnswered }: {
  render: PracticeIntroScreenProps['renderQuestions']; effectsActive: boolean;
  onBack(): void; onNavigation(actions: ObservationNavigation | null): void; onAnswered(): void;
}) {
  return render?.(true, onBack, onNavigation, ignoreHeight, effectsActive, onAnswered) ?? null;
}
const styles = StyleSheet.create({
  fill: { flex: 1, minHeight: 0 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
});
