import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useObservationRecorder } from '../hooks/useObservationRecorder';
import { useObservationPlayer } from '../hooks/useObservationPlayer';
import { DIARY_LIMIT_SECONDS, type DiaryCategory } from '../state/model';
import { useProduct } from '../state/ProductProvider';
import { ProductButton, ProductText } from '../ui';
import { useThemeColors } from '../ProductTheme';
import { RecordingReview } from '../RecordingReview';
import { Art } from '../motion/Art';
import { RecordingGesture } from '../motion/RecordingGesture';
import { ContentSwap } from '../motion/ContentSwap';
import { createRecordingHold } from '../audio/recording-hold';
import { PanelBorder } from '../PanelBorder';
import { DiaryIcon } from './DiaryIcons';
import { diaryClock } from './feed';

export function DiaryVoiceComposer({ category, active, onSaved, onClose, registerClose }: {
  category: DiaryCategory; active: boolean; onSaved(): void; onClose(): void; registerClose(action: (() => void) | null): void;
}) {
  const colors = useThemeColors(), { saveDiaryVoice, settings } = useProduct(), { width, height } = useWindowDimensions();
  const recorder = useObservationRecorder(DIARY_LIMIT_SECONDS), player = useObservationPlayer(recorder.draft?.uri ?? null);
  const [saving, setSaving] = useState(false), [error, setError] = useState(''), [confirmCancel, setConfirmCancel] = useState(false);
  const [lockProgress, setLockProgress] = useState(0), [locked, setLocked] = useState(false), [hint, setHint] = useState('');
  const pending = useRef(false), alive = useRef(true), mode = useRef<'hold' | 'toggle'>('hold');
  const recording = recorder.phase === 'recording', preparing = recorder.phase === 'preparing', review = recorder.phase === 'ready' && !!recorder.draft;
  const [lastDraft, setLastDraft] = useState(recorder.draft); if (recorder.draft && recorder.draft !== lastDraft) setLastDraft(recorder.draft);
  const voiceHeight = Math.min(280, width - 72, height * .4);
  const snapshot = useRef({ recorder, active, review, saving, player });
  useEffect(() => { snapshot.current = { recorder, active, review, saving, player }; });
  // The hold factory stores these callbacks and invokes them only on input.
  // eslint-disable-next-line react-hooks/refs
  const hold = useMemo(() => createRecordingHold({
    start: async () => { mode.current = 'hold'; setError(''); await snapshot.current.recorder.start(); },
    stop: () => snapshot.current.recorder.stop(), cancel: () => snapshot.current.recorder.cancel(),
    phase: () => snapshot.current.recorder.phase,
    canBegin: () => { const s = snapshot.current; return s.active && !s.review && !s.saving && !['preparing', 'recording', 'stopping'].includes(s.recorder.phase); },
    permissionReady: () => snapshot.current.recorder.permissionReady, requestPermission: () => snapshot.current.recorder.requestPermission(),
    progress: (value, fixed) => { setLockProgress(value); setLocked(fixed); if (fixed) mode.current = 'toggle'; }, hint: setHint,
  }), []);
  useEffect(() => { if (['idle', 'ready', 'error'].includes(recorder.phase)) hold.reset(); }, [recorder.phase, hold]);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const cancel = recorder.cancel, pause = player.pause;
  useEffect(() => { if (!active) { pause(); void cancel(); } }, [active, cancel, pause]);
  const requestClose = useCallback(() => {
    const s = snapshot.current; if (s.saving || pending.current) return;
    s.player.pause();
    if (s.recorder.draft || ['recording', 'preparing', 'stopping'].includes(s.recorder.phase)) setConfirmCancel(true);
    else void s.recorder.cancel().then(onClose);
  }, [onClose]);
  useEffect(() => {
    registerClose(requestClose);
    return () => registerClose(null);
  }, [requestClose, registerClose]);
  async function activate() {
    if (!active || saving || recorder.phase === 'stopping' || review) return;
    if (recording || preparing) { await recorder.stop(); return; }
    mode.current = 'toggle'; setLocked(true); setError(''); setHint(''); await recorder.start();
  }
  async function save() {
    if (!recorder.draft || pending.current) return;
    pending.current = true; setSaving(true); setError(''); player.pause();
    try { await saveDiaryVoice(recorder.draft, category); await recorder.clear(); if (alive.current) onSaved(); }
    catch (problem) { if (alive.current) setError(problem instanceof Error ? problem.message : 'Запись не сохранена. Попробуй ещё раз.'); }
    finally { pending.current = false; if (alive.current) setSaving(false); }
  }
  return <View style={styles.root} testID="diary-voice-composer">
    <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
    <ContentSwap value={confirmCancel ? 'discard' : review || saving || (!active && lastDraft) ? 'review' : 'capture'} reducedMotion={settings.reducedMotion} dissolve duration={360} render={phase => phase === 'discard' ?
      <View style={[styles.capturePanel, styles.confirm, { backgroundColor: colors.background }]} testID="diary-voice-discard">
        <PanelBorder color={colors.accent} />
        <ProductText style={styles.prompt}>УДАЛИТЬ НЕСОХРАНЁННУЮ ЗАПИСЬ?</ProductText>
        <ProductButton label="ПРОДОЛЖИТЬ" kind="outline" onPress={() => setConfirmCancel(false)} />
        <ProductButton label="УДАЛИТЬ И ЗАКРЫТЬ" kind="ghost" onPress={() => { player.pause(); void recorder.cancel().then(onClose); }} />
      </View> : phase === 'review' && lastDraft ?
      <RecordingReview waveform={lastDraft.waveform} positionMs={player.positionMs} durationMs={lastDraft.durationMs}
        playing={player.playing} loaded={player.loaded} muted={player.muted} volume={player.volume} saving={saving} error={error || recorder.error || player.error} reducedMotion={settings.reducedMotion}
        onPlay={() => { void player.toggle(); }} onSeek={ms => { void player.seekTo(ms / 1000); }} onMute={() => player.setMuted(!player.muted)} onVolume={player.setVolume}
        onSave={() => { void save(); }} onRecordAgain={() => { player.pause(); setError(''); mode.current = 'toggle'; setLocked(true); void recorder.start(); }} /> :
      <View style={[styles.capturePanel, { backgroundColor: colors.background }]} testID="diary-voice-capture">
        <PanelBorder color={colors.accent} />
        <View style={styles.header}>
          <ProductText variant="title" style={styles.title}>{category === 'dynamics' ? 'ГОЛОСОВОЙ ОТЧЁТ' : 'НОВОЕ НАБЛЮДЕНИЕ'}</ProductText>
          <Pressable accessibilityRole="button" accessibilityLabel="Закрыть запись" disabled={saving} onPress={requestClose} style={styles.close}><DiaryIcon name="close" /></Pressable>
        </View>
        <View style={styles.captureContent}>
        {category === 'dynamics' && <ProductText color={colors.muted} style={styles.prompt}>Что изменилось за день? Что ты заметил в себе? Что стало ощущаться иначе?</ProductText>}
        <View style={styles.capture}>
        <View style={{ width: voiceHeight, alignSelf: 'center' }}>
          <RecordingGesture height={voiceHeight} label={recording ? 'Закончить запись' : 'Зажми и говори. Веди вверх, чтобы закрепить запись'} disabled={!active || saving || recorder.phase === 'stopping' || review || confirmCancel}
            onBegin={(y, scale) => { if ((recording || preparing) && mode.current === 'toggle') void recorder.stop(); else void hold.begin(y, scale); }}
            onMove={hold.move} onEnd={() => { void hold.end(); }} onCancel={() => { void hold.cancel(); }} onActivate={() => { void activate(); }}>
            <Art kind="voice" height={voiceHeight} active={active && !review && !confirmCancel} lockProgress={lockProgress} locked={locked}
              mode={recording || preparing ? 'record' : 'idle'} spectrum={recording ? recorder.spectrum : undefined} audioSource={recording ? recorder.audioSource : undefined}
              reducedMotion={settings.reducedMotion} level={recording ? recorder.waveform.at(-1) ?? 0 : 0} />
          </RecordingGesture>
        </View>
        <ProductText variant="label">{diaryClock(recorder.durationMs)} / 15:00</ProductText>
        <ProductText style={styles.prompt} color={colors.muted}>{preparing ? 'ПОДГОТОВКА МИКРОФОНА' : recorder.phase === 'stopping' ? 'ЗАВЕРШАЕМ ЗАПИСЬ…' : recording ? mode.current === 'hold' ? 'ВВЕРХ — ЗАКРЕПИТЬ · ОТПУСТИ — ЗАКОНЧИТЬ' : 'НАЖМИ, ЧТОБЫ ЗАКОНЧИТЬ' : hint || 'ЗАЖМИ И ГОВОРИ · ИЛИ КОСНИСЬ ДЛЯ ЗАПИСИ'}</ProductText>
        {!!recorder.error && <ProductText accessibilityRole="alert" style={styles.prompt}>{recorder.error}</ProductText>}
        </View>
        <ProductButton label="ОТМЕНА" kind="ghost" disabled={saving} onPress={requestClose} />
        </View>
      </View>} />
    </ScrollView>
  </View>;
}
const styles = StyleSheet.create({
  root: { width: '100%', maxWidth: 480, maxHeight: '100%', alignSelf: 'center', flexShrink: 1, minHeight: 0 },
  scroll: { flexShrink: 1, minHeight: 0 }, capturePanel: { width: '100%' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 16, paddingRight: 8, paddingVertical: 8, gap: 8 },
  title: { fontSize: 14, lineHeight: 20, flexShrink: 1 }, close: { width: 32, height: 40, alignItems: 'center', justifyContent: 'center' },
  captureContent: { padding: 16, gap: 12 }, prompt: { fontSize: 10, lineHeight: 17, textAlign: 'center' },
  capture: { alignItems: 'center', gap: 12 }, confirm: { padding: 16, gap: 12 },
});
