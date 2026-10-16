import { Animated } from '../motion/RustAnimated';
import { useThemeStyles } from '../ProductTheme';
import type { ProductColors } from '../theme';
import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { AppState, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useIsFocused } from 'expo-router';
import { firstStepExplanations, productStepNames, stepDescriptions, stepTwoDream } from '../content';
import { Art } from '../motion/Art';
import { Reveal } from '../motion/Reveal';
import { ScrollGate } from '../motion/ScrollGate';
import { StepPanel } from '../motion/StepPanel';
import { ReadingExpansion } from '../motion/ReadingExpansion';
import { StepDropdown } from '../motion/StepDropdown';
import { ScrollCue } from '../motion/ScrollCue';
import { scrollCueFooterInset, type ScrollCueState } from '../motion/ScrollCue.types';
import { ContentSwap } from '../motion/ContentSwap';
import { DreamRealityText } from '../motion/DreamRealityText';
import { DreamConclusion } from '../motion/DreamConclusion';
import { StepOneConclusion } from '../motion/StepOneConclusion';
import { TaskStepSelector } from '../motion/TaskStepSelector';
import { TaskExplanationSwap } from '../motion/TaskExplanationSwap';
import { usePracticeMotion } from '../motion/usePracticeMotion';
import { PracticeEntryTransition } from '../motion/PracticeEntryTransition';
import { useReadingPlayback } from '../motion/useReadingPlayback';
import { useEffectQualityLevel } from '../motion/EffectsQuality';
import { EconomyReadingPages, type ReadingPagePosition } from '../motion/EconomyReadingPages';
import { StepTwoTaskPage } from '../motion/StepTwoTaskPage';
import { useProduct } from '../state/ProductProvider';
import type { ObservationNavigation } from './ObservationScreen';
import type { PracticeStage } from '../state/model';
import { PracticeCooldown } from './PracticeCooldown';
import { StepThreePlaceholder } from './StepThreePlaceholder';
import { fonts } from '../theme';
import { productSpacing, useProductSpacing } from '../layout';
import { ProductIconButton, ProductScreen, ProductText } from '../ui';
import { useBackSwipe } from '../navigation/BackSwipeProvider';
import { useWebUpdateBlock } from '../updates/webUpdateSafety';

export type PracticeIntroScreenProps = {
  step: number; availableAt: number | null; testUnlockAll?: boolean; reducedMotion?: boolean;
  onBack(): void; onClose(): void; onLevels(): void; onQuestions(step?: number): void; onSelectStep(step: number): void; onPreviousStep(): void; onDiary(): void;
  renderQuestions?: (active: boolean, onBack: () => void, registerNavigation: (actions: ObservationNavigation | null) => void, onQuestionHeight: (height: number) => void, effectsActive: boolean, onAnswered?: () => void) => ReactNode; showQuestions?: boolean;
  initialStage?: PracticeStage;
  startAtEnd?: boolean;
  onStageChange?: (stage: PracticeStage) => void;
  onCompleteSecondStep?: () => Promise<void>;
};
function remainingTime(deadline: number, now: number) {
  const seconds = Math.max(0, Math.ceil((deadline - now) / 1000));
  return [Math.floor(seconds / 3600), Math.floor(seconds % 3600 / 60), seconds % 60].map(value => String(value).padStart(2, '0')).join(':');
}
const ignoreMeasuredHeight = () => {};
const readingArtKinds = ['cells', 'reflections', 'single-hero', 'book', 'dream-world', 'dream-wake', 'dream-inward', 'dreamer', 'identity-imprints', 'lived-paths'] as const;
type ReadingArtKind = typeof readingArtKinds[number];
const readingMotionKinds = [...readingArtKinds, 'dream-reality', 'dream-conclusion', 'step-one-conclusion'] as const;
type ReadingMotionKind = typeof readingMotionKinds[number];
type ReadingArtBounds = { top: number; height: number };
function ReadingArt({ kind, width, viewportHeight, active, reducedMotion, onMeasure, topInset = 0 }: {
  kind: ReadingArtKind; width: number; viewportHeight: number; active: boolean; reducedMotion: boolean;
  topInset?: number;
  onMeasure(kind: ReadingArtKind, bounds: ReadingArtBounds): void;
}) {
  const element = useRef<View>(null), measure = useRef(onMeasure);
  useLayoutEffect(() => { measure.current = onMeasure; }, [onMeasure]);
  useLayoutEffect(() => {
    if (Platform.OS !== 'web' || !element.current) return;
    const node = element.current as unknown as HTMLElement, parent = node.parentElement;
    if (!parent) return;
    let frame = 0, live = true;
    // RN Web's onLayout observes size, so it misses the position change when
    // the zoom moves the parent's padding. Measure in the actual content box.
    const read = () => {
      if (!live) return;
      const box = node.getBoundingClientRect(), content = parent.getBoundingClientRect();
      if (box.height > 0) measure.current(kind, { top: box.top - content.top, height: box.height });
    };
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(read); };
    const observer = new ResizeObserver(schedule); observer.observe(node); observer.observe(parent);
    schedule(); void document.fonts.ready.then(schedule);
    return () => { live = false; cancelAnimationFrame(frame); observer.disconnect(); };
  }, [kind, width, topInset]);
  return <View ref={element} testID={`step-two-${kind}`} pointerEvents="none" style={{
    marginTop: kind === 'dream-inward' || kind === 'reflections' || kind === 'single-hero' ? 64 : kind === 'dreamer' ? 36 : kind === 'dream-world' ? 24 : kind === 'book' ? 4 : 0,
    marginBottom: kind === 'dream-inward' || kind === 'reflections' || kind === 'single-hero' ? 64 : kind === 'dream-world' ? 60 : kind === 'book' ? 0 : 20,
  }} onLayout={event => {
    if (Platform.OS !== 'web') onMeasure(kind, { top: event.nativeEvent.layout.y, height: event.nativeEvent.layout.height });
  }}>
    <Art kind={kind} height={Math.min(viewportHeight * .55, kind === 'dreamer' ? width * 0.92 : kind === 'reflections' || kind === 'single-hero' ? width * 136 / 288 : kind === 'dream-inward' ? width * 136 / 288 : kind === 'cells' ? Math.min(236, width * 156 / 288) : kind === 'identity-imprints' || kind === 'lived-paths' ? Math.min(236, width * 176 / 288) : kind === 'book' || kind === 'dream-world' || kind === 'dream-wake' ? width * 206 / 288 : Math.min(154, width * 136 / 288))} active={active} reducedMotion={reducedMotion} />
  </View>;
}
export function PracticeIntroScreen(props: PracticeIntroScreenProps) { return props.step === 3 ? <StepThreePlaceholder {...props} /> : <PracticeSession key={props.step} {...props} />; }

function PracticeSession({ step, availableAt, testUnlockAll = false, reducedMotion = false, onBack, onClose, onLevels, onQuestions, onSelectStep, onPreviousStep, onDiary, renderQuestions, showQuestions = false, initialStage = 0, startAtEnd = false, onStageChange, onCompleteSecondStep }: PracticeIntroScreenProps) {
  const styles = useThemeStyles(createStyles);
  const { settings } = useProduct();
  // A temporary renderer downgrade must never replace the article mid-reading.
  const pagedEconomy = settings.effectQuality === 'economy';
  const focused = useIsFocused();
  const currentStep: 1 | 2 = step === 2 ? 2 : 1;
  const [stage, setStage] = useState(() => step === 1 ? showQuestions ? 4 : initialStage : !testUnlockAll && (availableAt ?? 0) > Date.now() ? 0 : initialStage);
  const [readingChapter, setReadingChapter] = useState<0 | 1>(0);
  const [returnToDream, setReturnToDream] = useState(false);
  const stepTwoBack = useRef<(() => void) | null>(null);
  const registerStepTwoBack = useCallback((value: (() => void) | null) => { stepTwoBack.current = value; }, []);
  const questionStage = currentStep === 2 ? 3 : 4;
  const [economyPage, setEconomyPage] = useState<ReadingPagePosition>({ index: 0, count: step === 1 ? 2 : 3 });
  const reportEconomyPage = useCallback((value: ReadingPagePosition) => setEconomyPage(previous => previous.index === value.index && previous.count === value.count ? previous : value), []);
  const [returnToBook, setReturnToBook] = useState(false);
  const chapterTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(chapterTimer.current), []);
  // These reading/question stages live inside the route; apply the release on
  // leaving the session so a reload cannot jump back to its first illustration.
  useWebUpdateBlock(focused && (stage > 0 || readingChapter > 0));
  const [viewport, setViewport] = useState({ width: 320, height: 568 });
  const [ready, setReady] = useState(false), [progress, setProgress] = useState(0), [changing, setChanging] = useState(false);
  const [entryScanning, setEntryScanning] = useState(false);
  const [selectorOpen, setSelectorOpen] = useState(false), [now, setNow] = useState(Date.now);
  const [menuContentHeight, setMenuContentHeight] = useState(0);
  const motion = usePracticeMotion((currentStep === 1 || stage > 0) && ready, reducedMotion, viewport.height);
  const [leavingScale, setLeavingScale] = useState(1);
  const blurTarget = useRef<View | null>(null), transitionLocked = useRef(false);
  const observationNavigation = useRef<ObservationNavigation | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [recordingCue, setRecordingCue] = useState<ScrollCueState | null>(null);
  const registerNavigation = useCallback((actions: ObservationNavigation | null) => {
    observationNavigation.current = actions;
    setReviewing(!!actions?.reviewing);
    setRecordingCue(previous => {
      const next = actions?.scrollCue ?? null;
      return previous?.visible === next?.visible && previous?.progress === next?.progress && previous?.label === next?.label ? previous : next;
    });
  }, []);
  const scrollWindow = useRef({ offset: 0, height: 0 });
  const readingArtBounds = useRef<Partial<Record<ReadingMotionKind, { top: number; height: number }>>>({});
  const economy = useEffectQualityLevel() === 'economy';
  const { playing: readingArtVisible, update: updateReadingPlayback } = useReadingPlayback(readingMotionKinds, economy, !pagedEconomy && focused && stage === 0 && !selectorOpen && !changing);
  const deadline = availableAt ?? 0, coolingDown = currentStep === 2 && deadline > now && !testUnlockAll;
  const { gutter } = productSpacing(viewport.width);
  const bottomInset = stage > 0 ? gutter : Math.max(gutter, scrollCueFooterInset);
  const sceneHeight = Math.max(1, viewport.height - gutter - bottomInset);
  const { inset } = useProductSpacing();
  const illustrationWidth = Math.max(1, viewport.width - gutter * 2);
  const heroHeight = illustrationWidth * 206 / 288;
  const insightWidth = Math.max(1, illustrationWidth - inset * 2);
  function checkReadingArtVisibility() {
    updateReadingPlayback(readingArtBounds.current, scrollWindow.current);
  }
  function measureReadingArt(kind: ReadingMotionKind, bounds: ReadingArtBounds) {
    readingArtBounds.current[kind] = bounds; checkReadingArtVisibility();
  }
  const canAdvance = (currentStep === 1 ? stage < 4 : !coolingDown) && !selectorOpen && !changing;
  const canNavigate = !selectorOpen && !changing;
  useEffect(() => {
    if (currentStep !== 2 || deadline <= Date.now()) return;
    let timer: ReturnType<typeof setInterval> | undefined;
    const update = (state: string) => { if (timer) clearInterval(timer); timer = undefined; setNow(Date.now()); if (state === 'active') timer = setInterval(() => setNow(Date.now()), 1000); };
    update(AppState.currentState); const listener = AppState.addEventListener('change', update);
    return () => { if (timer) clearInterval(timer); listener.remove(); };
  }, [currentStep, deadline]);
  function resetTransition() {
    setReady(false); setProgress(0); motion.reset();
    scrollWindow.current = { offset: 0, height: 0 };
  }
  function finishEntryScan() {
    setEntryScanning(false); resetTransition(); setChanging(false); transitionLocked.current = false;
  }
  function enterStage(next: number) {
    const value = next as PracticeStage;
    if (currentStep === 2 && next === 0) { setReturnToDream(true); setReadingChapter(1); }
    setStage(value); onStageChange?.(value);
  }
  function changeStage(next: number) {
    if (transitionLocked.current) return;
    transitionLocked.current = true; setChanging(true);
    const reset = resetTransition;
    if (stage === 0 && next === 1) {
      // Keep the outgoing panel mounted until the chosen scanner has passed.
      // Its decoded text stays visible under the incoming task's reveal mask.
      setReady(false); setProgress(0); motion.reset(); setEntryScanning(true); enterStage(1);
      return;
    }
    // Task-to-task changes keep the shell and scroller. Text and artwork own
    // their transition; exit is only a lock clock here, never shell opacity.
    if (stage > 0 && next > 0 && renderQuestions) {
      motion.freeze(scale => {
        // Freeze the leaving page at its actual gesture scale before resetting the new one.
        setLeavingScale(scale);
        reset(); enterStage(next);
        motion.lock(() => { setChanging(false); transitionLocked.current = false; });
      });
      return;
    }
    if (stage > 0 && next === 0) {
      // The intro's exit frame is unmounted in the task. Waiting for its leave
      // callback deadlocks both the back button and the swipe.
      reset(); enterStage(0);
      motion.lock(() => { setChanging(false); transitionLocked.current = false; });
      return;
    }
    motion.leave(() => {
      if (next === 4 && !renderQuestions) { onQuestions(1); return; }
      enterStage(next); reset(); setChanging(false); transitionLocked.current = false;
    });
  }
  function changeReadingChapter(next: 0 | 1) {
    if (transitionLocked.current || next === readingChapter) return;
    transitionLocked.current = true;
    setChanging(true); setReady(false); setProgress(0); motion.reset();
    readingArtBounds.current = {}; checkReadingArtVisibility();
    setReturnToBook(next === 0); setReadingChapter(next);
    // The chapter dissolves inside the existing frame. Never reuse the task
    // exit clock, which also moves/fades the entire native reading shell.
    chapterTimer.current = setTimeout(() => {
      setChanging(false); transitionLocked.current = false;
    }, reducedMotion ? 0 : 650);
  }
  function advance() {
    if (!canAdvance) return;
    if (currentStep === 2 && stage === 0 && readingChapter === 0) changeReadingChapter(1);
    else if (currentStep === 2 && stage === 4) { if (onCompleteSecondStep) void onCompleteSecondStep().catch(() => {}); }
    else changeStage(stage + 1);
  }
  function retreat() {
    if (!canNavigate) return;
    if (currentStep === 2 && stepTwoBack.current) stepTwoBack.current();
    else if (stage > 0) changeStage(stage - 1);
    else if (currentStep === 2 && readingChapter === 1) changeReadingChapter(0);
    else if (currentStep === 2) onPreviousStep();
    else onLevels();
  }
  useBackSwipe(() => {
    if (selectorOpen) { setSelectorOpen(false); return; }
    if (stage === questionStage && observationNavigation.current) observationNavigation.current.back();
    else if (!changing) { if (currentStep === 2 && stage > 0) retreat(); else if (stage > 0) changeStage(stage - 1); else if (readingChapter === 1) changeReadingChapter(0); else onBack(); }
  });
  const menu = <StepDropdown step={currentStep} availableAt={availableAt} testUnlockAll={testUnlockAll} reducedMotion={reducedMotion} inset={inset} embedded={stage === 0} onNaturalHeight={setMenuContentHeight}
    onClose={() => setSelectorOpen(false)} onSelect={value => { setSelectorOpen(false); if (value !== currentStep) onSelectStep(value); }} />;
  const explanationStage = Math.max(1, Math.min(3, stage));
  const hasNextReadingPage = pagedEconomy && stage === 0 && economyPage.index < economyPage.count - 1;
  const cue = <ScrollCue visible={stage === questionStage ? !!recordingCue?.visible && !changing && !selectorOpen : ready && canNavigate && (canAdvance || hasNextReadingPage || progress < 0)}
    progress={stage === questionStage ? recordingCue?.progress ?? 0 : progress} reducedMotion={reducedMotion}
    label={stage === questionStage ? recordingCue?.label ?? 'ПРОКРУТИ ДАЛЬШЕ' : progress < 0 ? pagedEconomy && stage === 0 && economyPage.index > 0 ? 'ПРОКРУТИ НАЗАД' : stage === 0 ? readingChapter === 1 ? 'ПРОКРУТИ К КНИГЕ' : currentStep === 2 ? 'ПРОКРУТИ К ШАГУ 1' : 'ПРОКРУТИ К ВЫБОРУ УРОВНЯ' : 'ПРОКРУТИ НАЗАД' : hasNextReadingPage ? 'ПРОКРУТИ ДАЛЬШЕ' : currentStep === 2 ? 'ПРОКРУТИ К ПРОДОЛЖЕНИЮ' : stage === 3 ? 'ПРОКРУТИ К ЗАПИСИ' : 'ПРОКРУТИ ДАЛЬШЕ'}
    style={stage > 0 ? { left: 0, right: 0, bottom: 5 } : { left: gutter + 28, right: gutter + 28 }} />;

  return <>
    {motion.clock}
    <ProductScreen scroll={false} contentStyle={styles.root}>
      <View style={styles.viewport} onLayout={event => setViewport(event.nativeEvent.layout)}>
        <View style={[styles.scene, { padding: gutter, paddingBottom: bottomInset }]}>
          <PracticeEntryTransition showTask={stage > 0} scanning={entryScanning} height={sceneHeight}
            reducedMotion={reducedMotion} onComplete={finishEntryScan} intro={motion.frame(coolingDown ?
            <PracticeCooldown title={`ШАГ ${currentStep}. ${productStepNames[currentStep]}`} time={remainingTime(deadline, now)} deadline={deadline} now={now}
              heroHeight={heroHeight} gutter={gutter} inset={inset} expanded={selectorOpen} menu={selectorOpen ? menu : undefined} menuContentHeight={menuContentHeight}
              reducedMotion={reducedMotion} active={!changing} onBack={onBack} onClose={onClose}
              onRetreat={retreat} onReady={setReady} onProgress={setProgress}
              onSelect={() => setSelectorOpen(value => !value)} onDiary={onDiary} /> : <ReadingExpansion gutter={gutter} bottomInset={bottomInset} inset={inset} heroHeight={heroHeight} viewportHeight={viewport.height}
                reducedMotion={reducedMotion} onClose={onClose} enabled={canNavigate} continued={readingChapter === 1 || returnToDream || pagedEconomy && currentStep === 1 && economyPage.index > 0} paged={pagedEconomy}
                onViewportChange={value => { scrollWindow.current = value; checkReadingArtVisibility(); }}
                hero={active => <Reveal reducedMotion={reducedMotion} style={{ height: heroHeight }}>
                  <Art kind={currentStep === 1 ? 'mirror' : 'gallery'} height={heroHeight} active={active && !selectorOpen && !changing && focused} reducedMotion={reducedMotion} />
                </Reveal>}>
            {reading => motion.panel(<>
              <Reveal delay={160} reducedMotion={reducedMotion} style={styles.panelSpace}>
                <StepPanel title={`ШАГ ${currentStep}. ${productStepNames[currentStep]}`} background="clear" reducedMotion={reducedMotion} expanded={selectorOpen} onSelect={() => setSelectorOpen(value => !value)} blurTarget={blurTarget} contentInset={reading.contentInset} readingProgress={reading.headerProgress} readingStep={currentStep} readingCloseButton={reading.closeButton}
                  readingSelection={{ availableAt, testUnlockAll, onSelectStep: value => { setSelectorOpen(false); if (value !== currentStep) onSelectStep(value); } }}>
                  <ContentSwap value={readingChapter} fill dissolve duration={600} exitDuration={260} reducedMotion={reducedMotion} render={chapter => {
                    const current = chapter === readingChapter;
                    if (pagedEconomy) return <EconomyReadingPages step={currentStep} chapter={chapter} active={current && stage === 0 && focused && !selectorOpen} enabled={canNavigate}
                      canAdvance={canAdvance} startAtEnd={chapter === 1 ? returnToDream : currentStep === 1 ? economyPage.index > 0 : returnToBook} reading={reading} width={insightWidth} viewportHeight={viewport.height} reducedMotion={reducedMotion}
                      onReady={current ? setReady : ignoreMeasuredHeight} onProgress={current ? setProgress : ignoreMeasuredHeight}
                      onAdvance={advance} onRetreat={retreat} onPageChange={reportEconomyPage} />;
                    return <ScrollGate enabled={current && canNavigate} allowAdvance={current && canAdvance} onReady={current ? setReady : ignoreMeasuredHeight} onProgress={current ? setProgress : ignoreMeasuredHeight} onAdvance={advance} onRetreat={retreat} fadeTop={24} fadeBottom={24}
                      startAtEnd={chapter === 1 ? returnToDream : returnToBook}
                      guardEntryGesture={chapter === 1 || returnToBook}
                      onViewportChange={current ? reading.onViewportChange : undefined} controllerRef={current ? reading.controllerRef : undefined}
                      readingGesture={current ? reading.readingGesture : undefined}
                      contentStyle={chapter === 1 ? { ...reading.contentStyle, paddingTop: 0, minHeight: viewport.height } : reading.contentStyle}>
                      {chapter === 1 ? <>
                        <ProductText testID="dream-chapter-title" accessibilityRole="header" variant="title" style={styles.chapterTitle}>{stepTwoDream.title}</ProductText>
                        {stepTwoDream.blocks.map((block, index) => <Fragment key={block.art}>
                          <ProductText testID={`dream-text-${index}`} style={styles.overviewText}>{block.text}</ProductText>
                          {'emphasis' in block && <DreamRealityText text={block.emphasis} style={styles.overviewText}
                            active={current && readingArtVisible['dream-reality'] && !selectorOpen && !changing && focused}
                            reducedMotion={reducedMotion} onLayout={current ? event => measureReadingArt('dream-reality', { top: event.nativeEvent.layout.y, height: event.nativeEvent.layout.height }) : undefined} />}
                          {'conclusion' in block && <DreamConclusion text={block.conclusion} style={[styles.overviewText, styles.dreamConclusion]}
                            active={current && readingArtVisible['dream-conclusion'] && !selectorOpen && !changing && focused}
                            reducedMotion={reducedMotion} onLayout={current ? event => measureReadingArt('dream-conclusion', { top: event.nativeEvent.layout.y, height: event.nativeEvent.layout.height }) : undefined} />}
                          <ReadingArt kind={block.art} width={insightWidth} viewportHeight={viewport.height} active={current && readingArtVisible[block.art] && !selectorOpen && !changing && focused}
                            reducedMotion={reducedMotion} onMeasure={current ? measureReadingArt : ignoreMeasuredHeight} />
                        </Fragment>)}
                      </> : <>
                      {stepDescriptions[currentStep].split('\n\n').map((text, index) => <Fragment key={text}>
                        <Reveal reducedMotion={reducedMotion} delay={220 + index * 65}><ProductText style={styles.overviewText}>{text}</ProductText></Reveal>
                        {currentStep === 2 && (index === 1 || index === 2) && <ReadingArt kind={index === 1 ? 'reflections' : 'single-hero'} width={insightWidth} viewportHeight={viewport.height} topInset={Number(reading.contentStyle.paddingTop ?? 0)}
                          active={current && readingArtVisible[index === 1 ? 'reflections' : 'single-hero'] && !selectorOpen && !changing && stage === 0}
                          reducedMotion={reducedMotion} onMeasure={current ? measureReadingArt : ignoreMeasuredHeight} />}
                        {currentStep === 1 && (index === 1 || index === 3) && <ReadingArt kind={index === 1 ? 'cells' : 'identity-imprints'} width={insightWidth} viewportHeight={viewport.height} topInset={Number(reading.contentStyle.paddingTop ?? 0)}
                          active={current && readingArtVisible[index === 1 ? 'cells' : 'identity-imprints'] && !selectorOpen && !changing && stage === 0}
                          reducedMotion={reducedMotion} onMeasure={current ? measureReadingArt : ignoreMeasuredHeight} />}
                      </Fragment>)}
                      {currentStep === 1 && <StepOneConclusion active={current && readingArtVisible['step-one-conclusion'] && !selectorOpen && !changing && stage === 0} reducedMotion={reducedMotion}
                        onLayout={current ? event => measureReadingArt('step-one-conclusion', { top: event.nativeEvent.layout.y, height: event.nativeEvent.layout.height }) : undefined} />}
                      {currentStep === 2 && <ReadingArt kind="book" width={insightWidth} viewportHeight={viewport.height} topInset={Number(reading.contentStyle.paddingTop ?? 0)} active={current && readingArtVisible.book && !selectorOpen && !changing && stage === 0}
                        reducedMotion={reducedMotion} onMeasure={current ? measureReadingArt : ignoreMeasuredHeight} />}
                      </>}
                    </ScrollGate>;
                  }} />
                </StepPanel>
              </Reveal>
            </>, styles.panelSpace)}
          </ReadingExpansion>, styles.panelSpace, changing)}>
            {selectorOpen && stage > 0 && <Pressable accessibilityLabel="Закрыть выбор шага" style={[StyleSheet.absoluteFill, { zIndex: 10 }]} onPress={() => setSelectorOpen(false)} />}
            <Reveal reducedMotion={reducedMotion} style={styles.header}>
              <ProductIconButton icon="back" onPress={() => {
                if (stage === questionStage && observationNavigation.current) observationNavigation.current.back();
                else if (!changing) { if (currentStep === 2 && stage > 0) retreat(); else if (stage > 0) changeStage(stage - 1); else onBack(); }
              }} />
              <ProductText variant="title">{currentStep === 2 && stage === 4 ? 'ДОПОЛНЕНИЕ' : 'ЗАДАНИЕ'}</ProductText><ProductIconButton icon="close" onPress={() => {
                if (stage === questionStage && observationNavigation.current) observationNavigation.current.close(); else onClose();
              }} />
            </Reveal>
            <View pointerEvents={selectorOpen ? 'none' : 'auto'} style={styles.panelSpace}>
            {currentStep === 2 ? <ContentSwap value={stage} fill dissolve duration={520} exitDuration={220} reducedMotion={reducedMotion} render={part => part === 3
              ? renderQuestions?.(stage === 3 && !changing, () => changeStage(2), registerNavigation, ignoreMeasuredHeight, !selectorOpen, () => changeStage(4))
              : <StepTwoTaskPage key={part} part={part === 4 ? 4 : part === 2 ? 2 : 1} active={stage > 0 && stage === part && focused && !selectorOpen} enabled={stage > 0 && stage === part && canNavigate}
                width={illustrationWidth} viewportHeight={viewport.height} reducedMotion={reducedMotion} startAtEnd={startAtEnd && initialStage === 4} onNext={advance} onPrevious={() => changeStage(part === 4 ? 3 : part - 1)}
                onComplete={onCompleteSecondStep ?? (async () => {})} onReady={part === stage ? setReady : ignoreMeasuredHeight} onProgress={part === stage ? setProgress : ignoreMeasuredHeight} onBackReady={registerStepTwoBack} />} />
            : <ContentSwap value={stage === questionStage ? 'recording' : 'explanation'} fill dissolve exitDuration={200} reducedMotion={reducedMotion} render={kind => kind === 'recording'
              ? renderQuestions?.(stage === 4, () => changeStage(3), registerNavigation, ignoreMeasuredHeight, !selectorOpen)
              : <TaskExplanationSwap value={explanationStage} active={stage < 4 && !selectorOpen}
                scale={stage < 4 ? motion.scale : leavingScale}
                leavingScale={leavingScale} reducedMotion={reducedMotion} onTextHeight={ignoreMeasuredHeight}
                pulledBack={stage < 4 && ready}
                render={(index, presentation) => <ScrollGate fill fadeTop={12} resetKey={index} enabled={canAdvance && presentation.active}
                  onReady={presentation.active ? setReady : () => {}} onProgress={presentation.active ? setProgress : () => {}}
                  onAdvance={advance} onRetreat={retreat}>
                  {presentation.textWrapper ? presentation.textWrapper(<ProductText style={styles.explanationText} onLayout={event => presentation.onTextHeight(event.nativeEvent.layout.height)}>
                    {firstStepExplanations[index - 1].runs.map((run, runIndex) => <Text key={runIndex} style={{ fontFamily: run.bold ? fonts.bodyBold : fonts.body }}>{run.text}</Text>)}
                  </ProductText>) : <Animated.View style={presentation.textStyle ?? { opacity: presentation.text, transform: [{ translateY: presentation.text.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] }}>
                    <ProductText style={styles.explanationText} onLayout={event => presentation.onTextHeight(event.nativeEvent.layout.height)}>
                    {firstStepExplanations[index - 1].runs.map((run, runIndex) => <Text key={runIndex} style={{ fontFamily: run.bold ? fonts.bodyBold : fonts.body }}>{run.text}</Text>)}
                    </ProductText>
                  </Animated.View>}
                  <View style={styles.explanationArt}>
                    {presentation.artworkWrapper ? presentation.artworkWrapper(<View style={{ height: illustrationWidth * (firstStepExplanations[index - 1].art === 'attention' ? 1 : 244 / 320), justifyContent: 'center' }}>
                      <Art kind={firstStepExplanations[index - 1].art} onReady={presentation.onReady}
                        height={illustrationWidth * (firstStepExplanations[index - 1].art === 'attention' ? 1 : 244 / 320)}
                        active={presentation.active} reducedMotion={reducedMotion} />
                    </View>) : <Animated.View style={presentation.artworkStyle ?? { opacity: presentation.artwork }}>
                      <View style={{ height: illustrationWidth * (firstStepExplanations[index - 1].art === 'attention' ? 1 : 244 / 320), justifyContent: 'center' }}>
                        <Art kind={firstStepExplanations[index - 1].art} onReady={presentation.onReady}
                          height={illustrationWidth * (firstStepExplanations[index - 1].art === 'attention' ? 1 : 244 / 320)}
                          active={presentation.active} reducedMotion={reducedMotion} />
                      </View>
                    </Animated.View>}
                  </View>
                </ScrollGate>} />} />}
            </View>
            <View pointerEvents={reviewing ? 'none' : 'auto'} style={{ opacity: reviewing ? 0 : 1, zIndex: 20 }}><TaskStepSelector step={currentStep} availableAt={availableAt} testUnlockAll={testUnlockAll} open={selectorOpen} onToggle={() => setSelectorOpen(value => !value)}
              onSelect={value => { setSelectorOpen(false); if (value !== currentStep) onSelectStep(value); }} reducedMotion={reducedMotion} inset={inset}
              maxHeight={Math.max(120, sceneHeight - 56)} trailing={cue} /></View>
          </PracticeEntryTransition>
        </View>
        {stage === 0 && cue}
      </View>
    </ProductScreen>

  </>;
}
const createStyles = (colors: ProductColors) => StyleSheet.create({
  root: { padding: 0, minHeight: 0 }, viewport: { flex: 1, overflow: 'hidden' },
  scene: { flex: 1, minHeight: 0, padding: 16 },
  heroNavigation: { ...StyleSheet.absoluteFill, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  panelSpace: { flex: 1, minHeight: 0 },
  overviewText: { fontSize: 12, lineHeight: 17, textTransform: 'uppercase', marginBottom: 10 },
  chapterTitle: { fontSize: 20, lineHeight: 27, textTransform: 'uppercase', marginTop: 80, marginBottom: 24 },
  dreamConclusion: { fontFamily: fonts.bodyBold, marginTop: 8 },
  conclusion: { gap: 6, paddingVertical: 12 }, conclusionSmall: { fontSize: 11, lineHeight: 16 }, conclusionStrong: { fontSize: 15, lineHeight: 21 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  explanationText: { fontSize: 12, lineHeight: 17, textTransform: 'uppercase' },
  // Include the selector's 10px top gap when centering between text and button.
  explanationArt: { flex: 1, justifyContent: 'center', paddingTop: 10 },
  compactMenu: { position: 'absolute', left: 16, right: 16, bottom: 16, zIndex: 30 },
  compactSelector: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 12, minWidth: 94, minHeight: 26, borderWidth: .25, borderColor: colors.border, justifyContent: 'center', paddingHorizontal: 12, marginTop: 10 },
  compactLabel: { fontSize: 8, lineHeight: 12, letterSpacing: 1.76 },
  cue: { position: 'absolute', left: 44, right: 44, bottom: 6, alignItems: 'center', gap: 5 },
  cueText: { fontSize: 6, lineHeight: 8, letterSpacing: 2, color: colors.muted }, cueTrack: { width: '100%', height: 2, backgroundColor: `${colors.accent}24` }, cueFill: { height: 2, backgroundColor: colors.accent },
  timeTitle: { fontSize: 20, marginBottom: 16 }, countdownLabel: { fontSize: 8, marginTop: 16 }, countdown: { fontSize: 40, lineHeight: 52, marginBottom: 20 },
  panelFooter: { flexShrink: 0 },
  overlay: { flex: 1, backgroundColor: colors.background === '#000000' ? '#000b' : colors.overlay, justifyContent: 'flex-end', padding: 16 },
  sheet: { backgroundColor: colors.surface, borderWidth: .25, borderColor: colors.background === '#FAE18F' ? colors.accent : colors.border, padding: 12, maxHeight: '85%' },
  stepOption: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 8 },
});
