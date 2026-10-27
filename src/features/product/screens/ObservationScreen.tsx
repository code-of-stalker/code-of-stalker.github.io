import { useThemeStyles } from '../ProductTheme';
import type { ProductColors } from '../theme';
import { MotionModal } from '../motion/MotionModal';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PropsWithChildren } from 'react';
import { AppState, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useIsFocused } from 'expo-router';
import { useObservationRecorder } from '../hooks/useObservationRecorder';
import { useObservationPlayer } from '../hooks/useObservationPlayer';
import { Art } from '../motion/Art';
import { Reveal } from '../motion/Reveal';
import { Fade } from '../motion/Fade';
import { RecordingGesture } from '../motion/RecordingGesture';
import { Marquee } from '../motion/Marquee';
import { HintPanel } from '../motion/HintPanel';
import { UnderlinedText } from '../motion/UnderlinedText';
import { BottomSheet } from '../motion/BottomSheet';
import { PanelScan } from '../motion/PanelScan';
import { ContentSwap } from '../motion/ContentSwap';
import { ScrollGate } from '../motion/ScrollGate';
import { ScrollCue } from '../motion/ScrollCue';
import { scrollCueFooterInset, type ScrollCueState } from '../motion/ScrollCue.types';
import { TaskStepSelector } from '../motion/TaskStepSelector';
import { TaskProgress } from '../motion/TaskProgress';
import { ObservationActionButton, ObservationIcon } from '../ObservationControls';
import { createRecordingHold } from '../audio/recording-hold';
import { useProduct } from '../state/ProductProvider';
import { useProductLayout, useProductSpacing } from '../layout';
import { ProductIconButton, ProductScreen, ProductText } from '../ui';
import { StepSignature } from '../motion/StepSignature';
import { RecordingReview } from '../RecordingReview';
import { DiaryGlass } from '../diary/DiaryGlass';
import { PanelBorder } from '../PanelBorder';
import { useBackSwipe } from '../navigation/BackSwipeProvider';

import { questionsForStep, hintForStep } from '../content';
function clock(milliseconds: number) {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}
function stamp(value: number) {
  const date = new Date(value), pad = (number: number) => String(number).padStart(2, '0');
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${String(date.getFullYear()).slice(-2)} · ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
export type ObservationScreenProps = {
  questionIndex: number;
  onQuestionChange(index: number): void;
  onDone(): void;
  onBack(): void;
  onClose(): void;
  embedded?: boolean;
  active?: boolean;
  effectsActive?: boolean;
  startAtEnd?: boolean;
  onNavigationReady?: (actions: ObservationNavigation | null) => void;
  onQuestionHeight?: (height: number) => void;
};
export type ObservationNavigation = { back(): void; close(): void; reviewing?: boolean; scrollCue: ScrollCueState };
export function ObservationScreen(props: ObservationScreenProps) {
  const { progress } = useProduct();
  const focused = useIsFocused();
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => setForeground(state === 'active'));
    return () => subscription.remove();
  }, []);
  const active = props.active !== false && focused && foreground;
  // A hidden section gets a fresh media lifetime: neither a microphone nor a
  // decrypted preview URI survives route blur/background and resumes silently.
  return <ObservationScreenSession key={`${progress.selectedLevel}:${progress.step}:${active}`} {...props} active={active} />;
}
function ObservationScreenSession({ questionIndex, onQuestionChange, onDone, onBack, onClose, onNavigationReady, onQuestionHeight, embedded = false, active = true, effectsActive = true, startAtEnd = false }: ObservationScreenProps) {
  const styles = useThemeStyles(createStyles);
  const { height: screenHeight, width: screenWidth } = useWindowDimensions();
  const { inset } = useProductSpacing(), { air } = useProductLayout();
  const { observations, progress, settings, ready, error: storageError, saveObservation, loadPlayback, discardPlayback, deleteObservation, updateProgress } = useProduct();
  const questions = questionsForStep(progress.step), questionHint = hintForStep(progress.step);
  const recorder = useObservationRecorder();
  const [sheet, setSheet] = useState<'hint' | 'recordings' | null>(null);
  const [selectorOpen, setSelectorOpen] = useState(false);
  // Keep the same panel until its closing movement finishes.
  const [sheetKind, setSheetKind] = useState<'hint' | 'recordings'>('hint');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [playback, setPlayback] = useState<{ id: string; uri: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [recordingMode, setRecordingMode] = useState<'hold' | 'toggle'>('hold');
  const [voiceWidth, setVoiceWidth] = useState(288);
  const [recordingHeight, setRecordingHeight] = useState(Math.max(1, screenHeight - 200));
  const [questionHeight, setQuestionHeight] = useState(115), [voiceMetaHeight, setVoiceMetaHeight] = useState(64), [recordingFooterHeight, setRecordingFooterHeight] = useState(48);
  const voiceSize = Math.min(288, Math.max(148, recordingHeight - questionHeight - voiceMetaHeight - recordingFooterHeight - 20), Math.max(148, screenWidth - 48));
  // The side-by-side arrangement needs room for both the orb and its complete labels.
  // Narrow screens keep the status centered below a sensibly sized orb.
  const compactVoice = screenWidth >= 720 && recordingHeight - questionHeight - recordingFooterHeight < 180 + voiceMetaHeight;
  const voiceHeight = voiceWidth;
  const [error, setError] = useState(''), [deleteId, setDeleteId] = useState<string | null>(null);
  const mode = useRef<'hold' | 'toggle'>('hold'), savingRef = useRef(false);
  const [lockProgress, setLockProgress] = useState(0), [locked, setLocked] = useState(false), [permissionHint, setPermissionHint] = useState('');
  const [scrollReady, setScrollReady] = useState(false), [scrollProgress, setScrollProgress] = useState(0);
  const question = Math.max(0, Math.min(3, questionIndex));
  function openSheet(kind: 'hint' | 'recordings') {
    setSheetKind(kind); setSheet(kind);
  }
  const records = useMemo(() => observations.filter(item => item.level === (progress.selectedLevel ?? 'basic') &&
    item.step === progress.step && item.questionIndex === question), [observations, progress.selectedLevel, progress.step, question]);
  const selected = records.find(item => item.id === selectedId) ?? records[0] ?? null;
  const playbackUri = playback?.id === selected?.id ? playback?.uri ?? null : null;
  const loadingAudio = !!selected && !playbackUri && !error;
  const isRecording = recorder.phase === 'recording', preparing = recorder.phase === 'preparing';
  const hasDraft = recorder.phase === 'ready' && !!recorder.draft;
  const review = hasDraft;
  // Preserve the last draft while the review's exit animation completes.
  const [reviewDraft,setReviewDraft]=useState(recorder.draft);
  if(hasDraft&&recorder.draft!==reviewDraft)setReviewDraft(recorder.draft);
  const busy = saving || preparing || recorder.phase === 'stopping';
  const player = useObservationPlayer(hasDraft ? recorder.draft!.uri : playbackUri);
  const cancelCapture = recorder.cancel, pausePlayback = player.pause;
  useEffect(() => {
    if (!active) return;
    return () => { void cancelCapture(); };
  }, [active, cancelCapture]);
  useEffect(() => {
    if (!active) return;
    return () => pausePlayback();
  }, [active, pausePlayback]);
  const selectedRecordId = selected?.id;
  useEffect(() => {
    let cancelled = false, owned: string | null = null;
    if (selectedRecordId && active) void loadPlayback(selectedRecordId).then(uri => {
      owned = uri;
      if (cancelled) discardPlayback(uri); else setPlayback({ id: selectedRecordId, uri });
    }).catch(problem => { if (!cancelled) setError(problem instanceof Error ? problem.message : 'Запись не открылась.'); });
    return () => { cancelled = true; if (owned) discardPlayback(owned); };
  }, [active, selectedRecordId, loadPlayback, discardPlayback]);

  async function startRecording(kind: 'hold' | 'toggle') {
    if (!active || !ready || savingRef.current || preparing || isRecording) return;
    setError(''); setPermissionHint(''); player.pause();
    if (recorder.phase === 'ready') await recorder.clear();
    mode.current = kind; setRecordingMode(kind); setLocked(kind === 'toggle');
    await recorder.start();
  }
  const mediaSnapshot = useRef({ recorder, active, ready, busy, selected, review, startRecording });
  useEffect(() => { mediaSnapshot.current = { recorder, active, ready, busy, selected, review, startRecording }; });
  const hold = useMemo(() => createRecordingHold({
    start: () => mediaSnapshot.current.startRecording('hold'),
    stop: () => mediaSnapshot.current.recorder.stop(), cancel: () => mediaSnapshot.current.recorder.cancel(),
    phase: () => mediaSnapshot.current.recorder.phase,
    canBegin: () => { const current = mediaSnapshot.current; return current.active && current.ready && !current.busy && !current.selected && !current.review && current.recorder.phase !== 'recording'; },
    permissionReady: () => mediaSnapshot.current.recorder.permissionReady,
    requestPermission: () => mediaSnapshot.current.recorder.requestPermission(),
    progress: (value, fixed) => { setLockProgress(value); setLocked(fixed); if (fixed) { mode.current = 'toggle'; setRecordingMode('toggle'); } },
    hint: setPermissionHint,
  }), []);
  useEffect(() => { if (['idle', 'ready', 'error'].includes(recorder.phase)) hold.reset(); }, [recorder.phase, hold]);
  function beginHold(y: number, scale: number) {
    if ((isRecording || preparing) && mode.current === 'toggle') { void recorder.stop(); return; }
    if (selected || review || busy) return;
    void hold.begin(y, scale);
  }
  function endHold() {
    if (selected && !isRecording && !review && !preparing) void player.toggle();
    else void hold.end();
  }
  function activateVoice() {
    if (isRecording || preparing) void recorder.stop();
    else if (selected && !review) void player.toggle();
    else void startRecording('toggle');
  }
  async function changeQuestion(index: number) {
    if (busy || isRecording) return;
    player.pause(); await recorder.clear(); setSelectedId(null); setError(''); setSheet(null); onQuestionChange(index);
  }
  async function save() {
    if (!recorder.draft || savingRef.current) return;
    savingRef.current = true; setSaving(true); setError(''); player.pause();
    try {
      await saveObservation(recorder.draft, { level: progress.selectedLevel ?? 'basic', step: progress.step, questionIndex: question, questionText: questions[question] });
      await recorder.clear();
      if (question < 3) onQuestionChange(question + 1);
      else { const missing = missingQuestion(question); if (missing < 0) onDone(); else onQuestionChange(missing); }
    } catch (problem) { setError(problem instanceof Error ? problem.message : 'Не удалось сохранить запись. Можно попробовать ещё раз.'); }
    finally { savingRef.current = false; setSaving(false); }
  }
  async function remove(id: string) {
    if (savingRef.current) return;
    savingRef.current = true; setSaving(true); player.pause();
    try {
      await deleteObservation(id); setDeleteId(null);
      if (selected?.id === id) setSelectedId(null);
      if (!records.some(record => record.id !== id)) setSheet(null);
    }
    catch (problem) { setError(problem instanceof Error ? problem.message : 'Не удалось удалить запись.'); }
    finally { savingRef.current = false; setSaving(false); }
  }
  const leave = useCallback((action: () => void) => {
    if (savingRef.current) return;
    pausePlayback(); void cancelCapture().then(action);
  }, [pausePlayback, cancelCapture]);
  function missingQuestion(additional?: number) {
    return [0, 1, 2, 3].findIndex(index => index !== additional && !observations.some(record => record.level === (progress.selectedLevel ?? 'basic') &&
      record.step === progress.step && record.questionIndex === index));
  }
  // «Всё открыто» lets the questions be leafed through without recording.
  const freeMove = !!settings.testUnlockAll;
  const next = () => {
    if (question < 3) void changeQuestion(question + 1);
    else { const missing = missingQuestion(); if (missing < 0 || freeMove) onDone(); else void changeQuestion(missing); }
  };
  const nextRef = useRef(next);
  useEffect(() => { nextRef.current = next; });
  const nextQuestion = useCallback(() => nextRef.current(), []);
  const backRef = useRef(() => leave(onBack));
  useEffect(() => { backRef.current = () => { if (question > 0) void changeQuestion(question - 1); else leave(onBack); }; });
  const previousQuestion = useCallback(() => backRef.current(), []);
  const hasSavedAnswer = !!selected, canAdvance = hasSavedAnswer || freeMove;
  const canNavigate = active && effectsActive && !busy && !isRecording && !review && !sheet && !selectorOpen;
  const cueVisible = scrollReady && canNavigate && (scrollProgress < 0 || canAdvance);
  // Step 4 reads on after its questions, so its cue doesn't speak of a task or of finishing.
  const cueLabel = scrollProgress < 0 ? progress.step === 4 ? 'ПРОКРУТИ НАЗАД' : 'ПРОКРУТИ НАЗАД К ЗАДАНИЮ' : question < 3 ? 'ПРОКРУТИ К СЛЕДУЮЩЕМУ ВОПРОСУ'
    : missingQuestion() < 0 || freeMove ? progress.step === 4 ? 'ПРОКРУТИ ДАЛЬШЕ' : 'ПРОКРУТИ ДЛЯ ЗАВЕРШЕНИЯ' : 'ПРОКРУТИ К ОСТАВШИМСЯ ОТВЕТАМ';
  useBackSwipe(() => {
    if (saving) return;
    previousQuestion();
  }, active, 10);
  useEffect(() => {
    // The embedded screen owns the gesture, but its parent owns the persistent
    // footer. Send cue state up instead of drawing over the last content row.
    onNavigationReady?.({ back: previousQuestion, close: () => leave(onClose), reviewing: review,
      scrollCue: { visible: cueVisible, progress: scrollProgress, label: cueLabel } });
  }, [onNavigationReady, previousQuestion, onClose, leave, review, cueVisible, scrollProgress, cueLabel]);
  useEffect(() => () => onNavigationReady?.(null), [onNavigationReady]);
  return <>
    <ObservationContainer embedded={embedded}>
      {!embedded && <View style={styles.header}>
        <ProductIconButton icon="back" onPress={previousQuestion} />
        <ProductText variant="title" style={styles.title}>ЗАДАНИЕ</ProductText>
        <ProductIconButton icon="close" onPress={() => leave(onClose)} />
      </View>}
      <View style={!embedded && { marginTop: (air - 1) * 48 }}><TaskProgress part={question + 1} total={questions.length} segmented label="Вопрос" reducedMotion={settings.reducedMotion} /></View>
      <ScrollGate fadeTop={24} fill resetKey={question} startAtEnd={startAtEnd} allowAdvance={canAdvance} enabled={canNavigate} onReady={setScrollReady} onProgress={setScrollProgress}
        onAdvance={nextQuestion} onRetreat={previousQuestion} onViewportChange={value => { if (value.height > 0) setRecordingHeight(previous => Math.abs(previous - value.height) < 1 ? previous : value.height); }}>
      <View onLayout={event => { setQuestionHeight(event.nativeEvent.layout.height); onQuestionHeight?.(event.nativeEvent.layout.height); }}>
      <Reveal reducedMotion={settings.reducedMotion} delay={140} style={[styles.questionBlock, air > 1 && { paddingTop: 30 * air }, recordingHeight < 420 && { paddingTop: 12, minHeight: 96 }]}>
        <ProductText variant="title" maxFontSize={screenWidth >= 375 ? 14 : 10} style={styles.prompt}>ЗАПИШИ ДЛЯ СЕБЯ СВОИ НАБЛЮДЕНИЯ:</ProductText>
        <ContentSwap value={question} reducedMotion={settings.reducedMotion} style={styles.questionButton} render={index =>
          <Pressable accessibilityRole="button" accessibilityLabel={`Подсказка: ${questions[index]}`}
            onPress={() => { if (!isRecording && !busy) { player.pause(); openSheet('hint'); } }}>
            <UnderlinedText style={styles.question}>{questions[index]}</UnderlinedText>
          </Pressable>} />
      </Reveal>
      </View>
      <Reveal reducedMotion={settings.reducedMotion} delay={280} style={[styles.recorderArea, compactVoice && { flexDirection: 'row', gap: 12 }]}>
        <View testID="observation-voice-orb" style={[styles.orbSlot, { maxWidth: voiceSize }, compactVoice && { width: 180, flexShrink: 0 }]} onLayout={event => setVoiceWidth(event.nativeEvent.layout.width)}>
        <Fade opacity={review?.08:1} duration={360} reducedMotion={settings.reducedMotion} style={{width:'100%'}}>
        <RecordingGesture height={voiceHeight} label={isRecording ? 'Закончить запись' : selected ? 'Прослушать ответ' : 'Зажми и говори. Веди вверх, чтобы закрепить запись'}
          disabled={saving || !ready || !active || recorder.phase === 'stopping'} onBegin={beginHold} onMove={hold.move} onEnd={endHold} onCancel={() => { void hold.cancel(); }} onActivate={activateVoice}>
          <Art kind="voice" height={voiceHeight} active={active && effectsActive && !sheet && !review}
            lockProgress={lockProgress} locked={locked} mode={isRecording || preparing ? 'record' : selected ? 'playback' : 'idle'} spectrum={isRecording ? recorder.spectrum : undefined}
            audioSource={isRecording ? recorder.audioSource : undefined}
            reducedMotion={settings.reducedMotion} level={isRecording ? recorder.waveform.at(-1) ?? 0 : player.playing && selected
              ? selected.waveform[Math.min(selected.waveform.length - 1, Math.floor(player.positionMs / Math.max(1, selected.durationMs) * selected.waveform.length))] ?? 0 : 0} />
        </RecordingGesture>
        </Fade>
        </View>
        <View testID="observation-voice-meta" style={[styles.voiceMeta, compactVoice && { flex: 1, minWidth: 0 }]} onLayout={event => setVoiceMetaHeight(event.nativeEvent.layout.height)}>
        <ProductText testID="observation-timer" variant="label" style={[styles.timer, { opacity: review ? 0 : 1 }]}>{isRecording || preparing ? clock(recorder.durationMs) : selected ? `${clock(player.positionMs)} / ${clock(selected.durationMs)}` : '00:00'}</ProductText>
        {(!selected || loadingAudio || preparing || isRecording) && <ProductText testID="observation-recording-hint" variant="label" style={[styles.hint, { opacity: review ? 0 : 1 }]}>{loadingAudio ? 'ОТКРЫВАЕМ ЗАПИСЬ' : preparing ? 'ПОДГОТОВКА МИКРОФОНА' : isRecording ? recordingMode === 'hold' ? 'ВВЕРХ — ЗАКРЕПИТЬ · ОТПУСТИ — ЗАКОНЧИТЬ' : 'НАЖМИ, ЧТОБЫ ЗАКОНЧИТЬ' : permissionHint || 'ЗАЖМИ И ГОВОРИ'}</ProductText>}
        {!selected || isRecording ? <ProductText testID="observation-recording-limit" variant="label" style={[styles.limit, { opacity: review ? 0 : 1 }]}>ЗАПИСЬ ДО {recorder.limitSeconds / 60} МИНУТ</ProductText> : null}
        </View>
      </Reveal>
      {!!(error || recorder.error || player.error || storageError) && <ProductText accessibilityLiveRegion="polite" variant="body" style={styles.error}>{error || recorder.error || player.error || storageError}</ProductText>}
      <View onLayout={event => setRecordingFooterHeight(event.nativeEvent.layout.height)}>
      {selected && !isRecording ? <View style={[styles.savedActions, { opacity: review ? 0 : 1 }]}>
          <Pressable accessibilityRole="button" accessibilityLabel="Открыть список записей ответа" onPress={() => { player.pause(); openSheet('recordings'); }} style={styles.dateButton}>
          <ProductText variant="label" style={styles.date}>{stamp(selected.createdAt)}</ProductText><ObservationIcon name="chevron" size={12} muted />
        </Pressable>
        <ObservationActionButton label="ДОПОЛНИТЬ ОТВЕТ" icon="lips" onPress={() => void startRecording('toggle')} disabled={busy || !ready} style={styles.addButton} />
      </View> : <View style={{ opacity: review ? 0 : 1 }}><Marquee text="ЗДЕСЬ НЕТ ПРАВИЛЬНЫХ ОТВЕТОВ, ЕСТЬ ТОЛЬКО ТВОЁ НАБЛЮДЕНИЕ" active={active && effectsActive && !sheet && !review} reducedMotion={settings.reducedMotion} /></View>}
      {!selected && <ProductText variant="label" style={[styles.localNote, { opacity: review ? 0 : 1 }]}>ЗАПИСИ СОХРАНЯЮТСЯ НА ЭТОМ УСТРОЙСТВЕ</ProductText>}
      {progress.step === 1 && question === questions.length - 1 && <StepSignature center active={active && effectsActive && !sheet && !review} reducedMotion={settings.reducedMotion} style={[styles.signature, { opacity: review ? 0 : 1 }]} />}
      </View>
      </ScrollGate>
      {!embedded && <View pointerEvents={review ? 'none' : 'auto'} style={{ opacity: review ? 0 : 1 }}><TaskStepSelector step={progress.step === 2 ? 2 : 1} availableAt={progress.availableAt} testUnlockAll={settings.testUnlockAll} open={selectorOpen}
        onToggle={() => setSelectorOpen(value => !value)} onSelect={step => { setSelectorOpen(false); if (step !== progress.step) void updateProgress({ step }); }}
        reducedMotion={settings.reducedMotion} inset={inset} maxHeight={Math.max(120, screenHeight - 112)} /></View>}
      {!embedded && <ScrollCue visible={cueVisible} progress={scrollProgress} label={cueLabel} reducedMotion={settings.reducedMotion} />}
    </ObservationContainer>

    <MotionModal visible={review} transparent animationType={settings.reducedMotion ? 'none' : 'fade'} onRequestClose={() => { if (!saving) { player.pause(); void recorder.clear(); } }}>
      <View style={[styles.modalBackdrop, { backgroundColor: 'transparent' }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Закрыть проверку записи" style={StyleSheet.absoluteFill}
          onPress={() => { if (!saving) { player.pause(); void recorder.clear(); } }} />
        <RecordingReview waveform={reviewDraft?.waveform??recorder.waveform} positionMs={player.positionMs} durationMs={reviewDraft?.durationMs??recorder.durationMs}
          playing={player.playing} loaded={player.loaded} muted={player.muted} volume={player.volume} saving={saving} error={error} reducedMotion={settings.reducedMotion}
          onPlay={() => void player.toggle()} onSeek={ms => void player.seekTo(ms / 1000)} onMute={() => player.setMuted(!player.muted)} onVolume={player.setVolume}
          onSave={() => void save()} onRecordAgain={() => void startRecording('toggle')} />
      </View>
    </MotionModal>
    <BottomSheet open={sheet !== null} reducedMotion={settings.reducedMotion} onClose={() => setSheet(null)}>
        {sheetKind === 'hint' ? <HintPanel text={questionHint} reducedMotion={settings.reducedMotion} /> : <PanelScan testID="answer-recordings-panel" style={styles.recordingsSheet} reducedMotion={settings.reducedMotion}>
          <View style={styles.recordingsHeader}><DiaryGlass /><PanelBorder /><ProductText variant="label" style={styles.recordingsTitle}>ЗАПИСИ ОТВЕТА</ProductText>
            <Pressable accessibilityRole="button" accessibilityLabel="Закрыть список записей" onPress={() => setSheet(null)} style={styles.recordingsClose}><ObservationIcon name="close" size={14} muted /></Pressable>
          </View>
          <View style={[styles.recordingsBody, { paddingHorizontal: 9 }]}><DiaryGlass /><PanelBorder /><ScrollView showsVerticalScrollIndicator={false}>
            {records.map(record => <View key={record.id} style={[styles.recordingRow, selected?.id === record.id && styles.selectedRow]}>
              <Pressable accessibilityRole="button" accessibilityLabel={`Открыть запись ${stamp(record.createdAt)}`} onPress={() => { player.pause(); setSelectedId(record.id); setSheet(null); }} style={styles.recordingLabel}>
                <ObservationIcon name={selected?.id === record.id ? 'waveform' : 'play'} size={16} />
                <View style={styles.recordingStamp}><ProductText variant="label" numberOfLines={1} style={styles.recordingDate}>{stamp(record.createdAt).split(' · ')[0]}</ProductText>
                  <ProductText variant="label" numberOfLines={1} style={styles.recordingTime}>{stamp(record.createdAt).split(' · ')[1]}</ProductText></View>
                <ProductText variant="label" numberOfLines={1} style={styles.recordingDuration}>{clock(record.durationMs)}</ProductText>
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel={deleteId === record.id ? 'Подтвердить удаление записи' : 'Удалить запись'} disabled={saving} style={styles.deleteButton}
                onPress={() => { if (deleteId === record.id) void remove(record.id); else setDeleteId(record.id); }}>
                {deleteId === record.id ? <ProductText variant="label" style={styles.deleteLabel}>ДА?</ProductText> : <ObservationIcon name="trash" size={16} muted />}
              </Pressable>
            </View>)}
          </ScrollView></View>
        </PanelScan>}
    </BottomSheet>
  </>;
}

function ObservationContainer({ embedded, children }: PropsWithChildren<{ embedded: boolean }>) {
  const styles = useThemeStyles(createStyles);
  return embedded ? <View style={[styles.screen, styles.embedded]}>{children}</View>
    : <ProductScreen scroll={false} contentStyle={[styles.screen, { paddingBottom: scrollCueFooterInset }]}>{children}</ProductScreen>;
}

const createStyles = (colors: ProductColors) => StyleSheet.create({
  screen: { paddingTop: 16, flex: 1, minHeight: 0 },
  embedded: { width: '100%', paddingTop: 0, paddingBottom: 0 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 20, lineHeight: 28 },
  questionBlock: { boxSizing: 'border-box', paddingTop: 30, minHeight: 115, alignItems: 'center' },
  prompt: { fontSize: 14, lineHeight: 20, textAlign: 'center' },
  questionButton: { marginTop: 19, minHeight: 42, justifyContent: 'center' },
  question: { fontSize: 12, lineHeight: 17, textAlign: 'center', textTransform: 'uppercase' },
  recorderArea: { flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: 0 },
  orbSlot: { width: '100%', alignSelf: 'center' },
  orbButton: { width: '100%', alignItems: 'center', justifyContent: 'center' },
  timer: { fontSize: 10, lineHeight: 16, letterSpacing: 2, textAlign: 'center', marginTop: 0 },
  hint: { fontSize: 8, lineHeight: 14, letterSpacing: 1.6, textAlign: 'center', marginTop: 9 },
  voiceMeta: { alignSelf: 'stretch', alignItems: 'center' },
  limit: { fontSize: 7, lineHeight: 11, color: colors.muted, marginTop: 6, letterSpacing: 1, textAlign: 'center' },
  error: { color: colors.accent, fontSize: 11, lineHeight: 17, marginVertical: 12, textAlign: 'center' },
  savedActions: { alignItems: 'center' },
  dateButton: { padding: 12, marginTop: 2, flexDirection: 'row', gap: 8, alignItems: 'center' },
  date: { fontSize: 10, lineHeight: 14, letterSpacing: 0.5, color: colors.muted },
  addButton: { width: '80%', marginTop: 8, minHeight: 36 },
  marquee: { marginTop: 18, marginBottom: 8, fontSize: 8, lineHeight: 12, letterSpacing: 3.5 },
  signature: { marginTop: 14 },
  localNote: { fontSize: 6, lineHeight: 10, marginTop: 8, textAlign: 'center', color: colors.muted, letterSpacing: 0.5 },
  modalBackdrop: { flex: 1, backgroundColor: colors.background === '#000000' ? '#000000cf' : colors.overlay, padding: 16, alignItems: 'center', justifyContent: 'flex-end' },
  recordingsSheet: { width: '100%', maxWidth: 440, alignSelf: 'center', maxHeight: '100%', gap: 8 },
  recordingsHeader: { minHeight: 36, paddingVertical: 5, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 0, borderColor: colors.background === '#FAE18F' ? colors.accent : colors.border, backgroundColor: 'transparent', paddingLeft: 12 },
  recordingsTitle: { fontSize: 10, lineHeight: 14, letterSpacing: 2.2 },
  recordingsClose: { height: 26, width: 42, alignItems: 'center', justifyContent: 'center' },
  recordingsBody: { flexShrink: 1, borderWidth: 0, borderColor: colors.background === '#FAE18F' ? colors.accent : colors.border, backgroundColor: 'transparent', paddingVertical: 8 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 38, paddingLeft: 12, borderBottomWidth: 0.5, borderBottomColor: colors.border },
  sheetTitle: { fontSize: 11, letterSpacing: 2 },
  reviewPanel: { width: '100%', maxWidth: 440, gap: 14, marginBottom: 16 },
  reviewCopy: { fontSize: 12, lineHeight: 18 },
  reviewWaveform: { height: 36, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 2, overflow: 'hidden' },
  waveBar: { width: 2, backgroundColor: colors.accent },
  recordingRow: { flexDirection: 'row', alignItems: 'center', minHeight: 52, borderBottomWidth: 0.5, borderBottomColor: colors.border, paddingLeft: 8 },
  selectedRow: { backgroundColor: colors.subtle },
  recordingLabel: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  recordingStamp: { flex: 1, minWidth: 0, gap: 4 },
  recordingDate: { fontSize: 10, lineHeight: 14 },
  recordingTime: { fontSize: 8, lineHeight: 11, color: colors.muted },
  recordingDuration: { fontSize: 10, marginRight: 8 },
  deleteButton: { width: 34, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  deleteLabel: { fontSize: 15, color: colors.muted },
});
