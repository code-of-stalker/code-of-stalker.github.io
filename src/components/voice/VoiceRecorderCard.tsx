import { useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync,
  useAudioPlayer, useAudioPlayerStatus, useAudioRecorder,
} from 'expo-audio';
import { emptyCapture, VoiceCapture } from '../../matrix/voice-capture';
import type { CaptureState } from '../../matrix/voice-capture';
import { discardVoiceFile } from '../../matrix/voice-files.native';
import { discardIncomingAudio } from '../../matrix/incoming-audio-files.native';
import { VOICE_LIMIT_SECONDS } from '../../matrix/voice-types';
import type { VoiceProbeReport } from '../../matrix/voice-types';
import { initialDraftUi, VoiceDraftController } from '../../matrix/voice-draft-controller';
import type { DraftUiState } from '../../matrix/voice-draft-controller';
import { draftErrorText } from '../../matrix/voice-draft-store';
import { voiceDraftStorage } from '../../matrix/voice-draft-storage.native';
import { checkVoiceConnection, VoiceConnectionError } from '../../matrix/voice-send-connection';
import type { VoiceTestProps } from './VoiceTest.types';
import { voiceHistory } from '../../matrix/voice-history';

const recordingOptions = { ...RecordingPresets.HIGH_QUALITY, numberOfChannels: 1, bitRate: 64_000, isMeteringEnabled: true };
const audioMode = (recording: boolean) => setAudioModeAsync({ allowsRecording: recording,
  allowsBackgroundRecording: false, shouldPlayInBackground: false, playsInSilentMode: true,
  shouldRouteThroughEarpiece: false, interruptionMode: 'doNotMix' });

function AudioPreview({ uri, label, locked, pauseRef, onReady, beforePlay }: {
  uri: string; label: string; locked: boolean; pauseRef: RefObject<(() => void) | null>; onReady?: (ready: boolean) => void;
  beforePlay?: () => void;
}) {
  const player = useAudioPlayer({ uri }, { updateInterval: 200 });
  const status = useAudioPlayerStatus(player);
  const [error, setError] = useState('');
  const [loadTimedOut, setLoadTimedOut] = useState(false);
  const playingAction = useRef(false);
  const alive = useRef(true);
  const lockedRef = useRef(locked);
  useLayoutEffect(() => { lockedRef.current = locked; }, [locked]);
  useImperativeHandle(pauseRef, () => () => { try { player.pause(); } catch {} }, [player]);
  useEffect(() => {
    alive.current = true;
    const pause = () => { try { player.pause(); } catch {} };
    const sub = AppState.addEventListener('change', (state) => { if (state !== 'active') pause(); });
    return () => { alive.current = false; sub.remove(); };
  }, [player]);
  useEffect(() => {
    onReady?.(status.isLoaded && !status.error);
    return () => onReady?.(false);
  }, [onReady, status.isLoaded, status.error]);
  useEffect(() => { if (locked) { try { player.pause(); } catch {} } }, [locked, player]);
  useEffect(() => {
    if (status.isLoaded) return;
    const timeout = setTimeout(() => setLoadTimedOut(true), 8000);
    return () => clearTimeout(timeout);
  }, [status.isLoaded]);
  async function toggle() {
    if (locked || playingAction.current || !status.isLoaded || status.error) return;
    playingAction.current = true;
    setError('');
    try {
      if (status.playing) { player.pause(); return; }
      await audioMode(false);
      if (status.didJustFinish || status.currentTime >= status.duration - 0.1) await player.seekTo(0);
      if (alive.current && !lockedRef.current && AppState.currentState === 'active') { beforePlay?.(); player.play(); }
    } catch { if (alive.current) setError('Не удалось воспроизвести запись.'); }
    finally { playingAction.current = false; }
  }
  return <View style={styles.group}>
    <Pressable accessibilityRole="button" disabled={locked || !status.isLoaded || !!status.error}
      accessibilityState={{ disabled: locked || !status.isLoaded || !!status.error }}
      onPress={() => void toggle()} style={({ pressed }) => [styles.secondary, (pressed || locked || !status.isLoaded || !!status.error) && styles.muted]}>
      <Text style={styles.secondaryText}>{status.playing ? 'Пауза' : label}</Text>
    </Pressable>
    <Text style={styles.note}>{status.isLoaded ? `${Math.floor(status.currentTime)} / ${Math.ceil(status.duration)} с` : 'Подготавливаем звук…'}</Text>
    {!!error && <Text style={styles.error}>{error}</Text>}
    {!!status.error && <Text style={styles.error}>Плеер не смог открыть запись. Сообщи об этом в нашем чате.</Text>}
    {!status.isLoaded && loadTimedOut && <Text style={styles.error}>Не удалось открыть запись для прослушивания.</Text>}
  </View>;
}

export default function VoiceRecorderCard(props: VoiceTestProps) {
  // Account/room changes get a fresh recorder and UI lifetime. Local storage
  // remains bound to the previous scope until explicitly removed.
  return <VoiceRecorderSession key={props.draftScope ? JSON.stringify(props.draftScope) : 'no-room'} {...props} />;
}

function VoiceRecorderSession(props: VoiceTestProps) {
  const [state, setState] = useState<CaptureState>({ ...emptyCapture });
  const [sending, setSending] = useState(false);
  const [previewReady, setPreviewReady] = useState(false);
  const [report, setReport] = useState<VoiceProbeReport | null>(null);
  const [reportTarget, setReportTarget] = useState<'peer' | 'diary'>('peer');
  const [incoming, setIncoming] = useState<VoiceProbeReport | null>(null);
  const [openedLabel, setOpenedLabel] = useState('Голосовое с iPad');
  const [draftState, setDraftState] = useState<DraftUiState>(() => props.draftScope ? { ...initialDraftUi } : { phase: 'empty', saved: null, error: '' });
  const capture = useRef<VoiceCapture | null>(null);
  const draftController = useRef<VoiceDraftController | null>(null);
  const callbacks = useRef(props);
  useLayoutEffect(() => { callbacks.current = props; }, [props]);
  const verifiedUri = useRef<string | undefined>(undefined);
  const incomingUri = useRef<string | undefined>(undefined);
  const alive = useRef(true);
  const sendLock = useRef(false);
  const sendProbe = useRef<AbortController | null>(null);
  const pausePlayback = useRef<(() => void) | null>(null);
  const pauseIncoming = useRef<(() => void) | null>(null);
  const recorder = useAudioRecorder(recordingOptions);
  const recording = state.phase === 'recording';
  const capturing = recording || state.phase === 'preparing' || state.phase === 'stopping';
  const draftBusy = ['loading', 'checking', 'saving', 'deleting'].includes(draftState.phase);
  const unavailable = props.locked || sending || draftBusy;
  const networkUnavailable = unavailable || props.networkLocked;
  const uncertain = draftState.saved?.state === 'sending';

  useEffect(() => {
    if (props.diagnostics) {
      pausePlayback.current?.(); pauseIncoming.current?.();
    }
  }, [props.diagnostics]);

  useEffect(() => {
    alive.current = true;
    const controller = new VoiceCapture({ recorder, permission: requestRecordingPermissionsAsync, mode: audioMode,
      foreground: () => AppState.currentState === 'active', discard: discardVoiceFile,
      changed(next) {
        if (!alive.current || capture.current !== controller) return;
        setState(next);
        if (next.phase === 'ready' && next.draft) void draftController.current?.save(next.draft);
        if (draftController.current?.busy) return;
        const busy = next.phase === 'preparing' || next.phase === 'recording' || next.phase === 'stopping';
        callbacks.current.onStatus({ busy, error: next.error, text: next.phase === 'recording'
          ? `Записываем голос: ${Math.floor(next.durationMs / 1000)} / ${VOICE_LIMIT_SECONDS} с`
          : next.phase === 'preparing' ? 'Подготавливаем микрофон'
          : next.phase === 'stopping' ? 'Останавливаем запись'
          : next.phase === 'ready' ? 'Запись готова. Прослушай её или отправь на iPad'
          : next.phase === 'error' ? 'Запись не завершена' : 'Можно записать короткую фразу' });
      },
    });
    capture.current = controller;
    const context = callbacks.current.draftScope;
    const local = context ? new VoiceDraftController(voiceDraftStorage, context, {
      restored: (draft, replace) => capture.current === controller && (replace ? controller.replaceReadyDraft(draft) : controller.restoreDraft(draft)),
      discard: discardVoiceFile,
      changed(next) {
        if (!alive.current || capture.current !== controller) return;
        setDraftState(next);
        if (next.phase === 'loading') {
          setState({ ...emptyCapture }); setPreviewReady(false); setReport(null); setIncoming(null);
        }
        const busy = ['loading', 'checking', 'saving', 'deleting'].includes(next.phase);
        callbacks.current.onStatus({ busy, error: next.error,
          text: next.phase === 'loading' ? 'Открываем черновик на Tecno'
            : next.phase === 'checking' ? 'Проверяем связь перед отправкой'
            : next.phase === 'saving' ? 'Сохраняем черновик на Tecno'
            : next.phase === 'deleting' ? 'Удаляем локальный черновик'
            : next.saved?.state === 'sending' ? 'Отправка начиналась. Проверь запись на iPad'
            : next.saved ? 'Черновик сохранён на Tecno. Можно прослушать и отправить'
            : next.error ? 'Черновик требует внимания' : 'Можно записать короткую фразу' });
      },
    }) : null;
    draftController.current = local;
    if (local) void local.restore();
    const recordingEvents = recorder.addListener('recordingStatusUpdate', (status) => {
      if (status.isFinished || status.hasError) controller.nativeFinished(status.hasError, status.url);
    });
    const sub = AppState.addEventListener('change', (next) => {
      // Do not invalidate a permission dialog merely because it covers the app.
      // prepare() checks foreground again before it can start the microphone.
      if (next !== 'active') {
        sendProbe.current?.abort();
        try { if (recorder.isRecording) void controller.cancel('Запись остановлена при закрытии экрана. Запиши фразу заново.'); } catch {}
      }
    });
    return () => {
      alive.current = false;
      sendProbe.current?.abort();
      sub.remove();
      recordingEvents.remove();
      if (capture.current === controller) capture.current = null;
      if (draftController.current === local) draftController.current = null;
      // A source file must outlive a save that has already started. The
      // encrypted draft itself belongs to storage, not the screen lifetime.
      void (local?.dispose() ?? Promise.resolve()).then(() => controller.dispose());
      discardVoiceFile(verifiedUri.current);
      verifiedUri.current = undefined;
      discardIncomingAudio(incomingUri.current);
      incomingUri.current = undefined;
      callbacks.current.onStatus({ busy: false, text: '' });
    };
  }, [recorder]);

  async function start() {
    const local = draftController.current;
    if (unavailable || capturing || sendLock.current || !local || (draftState.phase === 'error' && !state.draft)) return;
    pausePlayback.current?.(); pauseIncoming.current?.(); setPreviewReady(false);
    // Explicit replacement deletes the protected old draft before starting a
    // new recording. A failed key deletion keeps it available for recovery.
    if (state.draft || draftState.saved) {
      if (!await local.remove() || !alive.current || draftController.current !== local) return;
      await capture.current?.cancel();
    }
    if (!alive.current || draftController.current !== local) return;
    discardVoiceFile(verifiedUri.current); verifiedUri.current = undefined;
    setReport(null);
    void capture.current?.start();
  }
  async function removeDraft() {
    const local = draftController.current;
    if (unavailable || capturing || sendLock.current || !local) return;
    pausePlayback.current?.(); setPreviewReady(false);
    if (await local.remove() && alive.current && draftController.current === local) await capture.current?.cancel();
  }
  async function send(target: 'peer' | 'diary' = 'peer') {
    const local = draftController.current;
    if (!state.draft || networkUnavailable || capturing || report || sendLock.current || !previewReady || !local || !draftState.saved || uncertain ||
        (target === 'diary' && (!props.diaryRoomReady || props.diaryHistory.length >= 2))) return;
    pausePlayback.current?.(); pauseIncoming.current?.();
    sendLock.current = true; setSending(true);
    const probe = new AbortController();
    sendProbe.current = probe;
    try {
      // This first probe never marks the draft. SDK setup may be interrupted by
      // development-client Reload; only the actual upload callback can mark it.
      await local.beforeSend(async () => {
        const context = callbacks.current.draftScope;
        if (!context) throw new VoiceConnectionError('Комната не выбрана. Черновик не отправлен.');
        await checkVoiceConnection(context.serverUrl, probe.signal);
        if (AppState.currentState !== 'active' || probe.signal.aborted) throw new VoiceConnectionError('Проверка связи остановлена. Черновик сохранён на Tecno.');
      });
      if (!alive.current || draftController.current !== local || probe.signal.aborted || AppState.currentState !== 'active') return;
      const result = await (target === 'diary' ? callbacks.current.onSaveDiary : callbacks.current.onSend)(state.draft, async (signal) => {
        const cancel = () => probe.abort();
        signal.addEventListener('abort', cancel, { once: true });
        try {
          if (signal.aborted) cancel();
          await local.beforeUpload(signal, async () => {
            const context = callbacks.current.draftScope;
            if (!alive.current || draftController.current !== local || !context || probe.signal.aborted || AppState.currentState !== 'active') {
              throw new VoiceConnectionError('Подготовка отправки остановлена. Черновик сохранён на Tecno.');
            }
            // Recheck at the native boundary, after sync and trust preparation.
            await checkVoiceConnection(context.serverUrl, probe.signal);
            if (!alive.current || draftController.current !== local || probe.signal.aborted || AppState.currentState !== 'active') {
              throw new VoiceConnectionError('Подготовка отправки остановлена. Черновик сохранён на Tecno.');
            }
          });
        } finally { signal.removeEventListener('abort', cancel); }
      });
      if (!alive.current || draftController.current !== local) { discardVoiceFile(result?.playbackUri); return; }
      if (result) {
        verifiedUri.current = result.playbackUri; setReportTarget(target); setReport(result);
        const removed = await local.sent();
        if (removed && alive.current && draftController.current === local) callbacks.current.onStatus({ busy: false,
          text: target === 'diary' ? 'Запись сохранена в личном дневнике. Черновик удалён с Tecno'
            : 'Голос отправлен и расшифрован. Черновик удалён с Tecno' });
      }
    } catch (error) {
      if (alive.current && draftController.current === local) callbacks.current.onStatus({ busy: false,
        text: error instanceof VoiceConnectionError ? 'Запись не отправлена. Черновик сохранён на Tecno' : 'Отправка не завершена', error: draftErrorText(error) });
    } finally {
      if (sendProbe.current === probe) sendProbe.current = null;
      sendLock.current = false; if (alive.current) setSending(false);
    }
  }
  async function receive(mode: 'new' | 'history' | 'missed' = 'new', eventId?: string) {
    if (networkUnavailable || capturing || sendLock.current || !props.peerUserId) return;
    pausePlayback.current?.(); pauseIncoming.current?.();
    sendLock.current = true; setSending(true);
    discardIncomingAudio(incomingUri.current); incomingUri.current = undefined; setIncoming(null);
    setOpenedLabel(eventId && props.ownHistory.some(item => item.eventId === eventId) ? 'Твоя отправленная запись' : 'Голосовое с iPad');
    try {
      const result = await (mode === 'missed' ? callbacks.current.onReceiveMissed()
        : mode === 'history' && eventId ? callbacks.current.onOpenHistory(eventId) : callbacks.current.onReceive());
      if (!alive.current) { discardIncomingAudio(result?.playbackUri); return; }
      if (result) { incomingUri.current = result.playbackUri; setIncoming(result); }
    } finally { sendLock.current = false; if (alive.current) setSending(false); }
  }
  async function openDiary(eventId: string) {
    if (networkUnavailable || capturing || sendLock.current || !props.diaryRoomReady) return;
    pausePlayback.current?.(); pauseIncoming.current?.();
    sendLock.current = true; setSending(true);
    discardIncomingAudio(incomingUri.current); incomingUri.current = undefined; setIncoming(null);
    setOpenedLabel('Личная запись');
    try {
      const result = await callbacks.current.onOpenDiary(eventId);
      if (!alive.current) { discardIncomingAudio(result?.playbackUri); return; }
      if (result) { incomingUri.current = result.playbackUri; setIncoming(result); }
    } finally { sendLock.current = false; if (alive.current) setSending(false); }
  }
  return <>
    {props.diagnostics && <View style={styles.card}>
      <Text style={styles.title}>Дополнительные действия с голосом</Text>
      <Text accessibilityLiveRegion="polite" style={props.automaticError ? styles.error : styles.text}>{props.automaticStage}</Text>
      {!!props.automaticError && <>
        <Text selectable style={styles.error}>{props.automaticError}</Text>
        {props.automaticRetryAllowed && <VoiceButton label="Повторить автоприём" onPress={props.onRetryAutomatic} disabled={networkUnavailable || capturing} />}
      </>}
      {!props.peerUserId && <Text style={styles.note}>Сначала подготовь комнату с аккаунтом iPad во вкладке «Диагностика».</Text>}
      <>
        {props.savedAudio && <VoiceButton label="Получить пропущенное голосовое" onPress={() => void receive('missed')}
          disabled={networkUnavailable || capturing} />}
        <VoiceButton label="Получить новое голосовое вручную" onPress={() => void receive()}
          disabled={networkUnavailable || capturing || !props.peerUserId} />
        <Text style={styles.note}>Ручная проверка временно остановит автоприём. При проверке нового голосового отправь его с iPad после статуса «Ждём новое голосовое».</Text>
      </>
      {incoming && <AudioPreview key={incoming.playbackUri} uri={incoming.playbackUri} label={`Слушать: ${openedLabel.toLowerCase()}`}
        locked={unavailable || capturing} pauseRef={pauseIncoming} beforePlay={() => pausePlayback.current?.()} />}
      {((state.draft && !report) || draftState.saved || !!draftState.error) && <VoiceButton label="Удалить черновик"
        onPress={() => void removeDraft()} disabled={unavailable || capturing} />}
      <Text style={styles.note}>Черновик хранится только на Tecno. Удаление черновика не удаляет уже отправленную запись на iPad.</Text>
    </View>}
    {!props.diagnostics && <>
    <View style={styles.card}>
    <Text style={styles.title}>{props.diary ? 'Новая личная запись' : 'Запись голоса'}</Text>
    <Text style={styles.text}>{props.diary ? 'Запиши короткую тестовую фразу, прослушай её и сохрани в личный дневник.'
      : 'Запиши тестовую фразу до 15 секунд. Затем прослушай и отправь на iPad.'}</Text>
    {!props.diary && <Text style={styles.note}>На iPad запись придёт как аудиофайл. Открой новое вложение, чтобы его прослушать.</Text>}
    {!props.diary && !!props.peerUserId && <Text selectable style={styles.note}>iPad: {props.peerUserId}</Text>}
    {draftBusy && <Text accessibilityLiveRegion="polite" style={styles.text}>{draftState.phase === 'loading' ? 'Открываем сохранённый черновик…'
      : draftState.phase === 'checking' ? 'Проверяем связь перед отправкой…'
      : draftState.phase === 'saving' ? 'Сохраняем черновик…' : 'Удаляем черновик…'}</Text>}
    {draftState.phase === 'checking' && <VoiceButton label="Отменить проверку связи" onPress={() => sendProbe.current?.abort()} disabled={false} />}
    {draftState.saved && !report && <Text accessibilityLiveRegion="polite" style={styles.success}>Черновик сохранён на Tecno</Text>}
    {uncertain && !report && <Text style={styles.error}>Отправка этой записи уже начиналась. Она могла прийти на iPad — проверь Element X. Повторная отправка отключена. Черновик можно прослушать и удалить.</Text>}
    {report && <View style={styles.group}>
      <Text style={styles.success}>{reportTarget === 'diary' ? 'Личная запись сохранена' : 'Голос отправлен и расшифрован'}</Text>
      <Text style={styles.text}>{reportTarget === 'diary'
        ? 'Запись с сервера совпала с оригиналом. Других участников в личную комнату не приглашали.'
        : 'Запись с сервера совпала с оригиналом. Включи её здесь, а на iPad открой новый аудиофайл в Element X.'}</Text>
      <AudioPreview key={report.playbackUri} uri={report.playbackUri} label="Слушать запись с сервера" locked={unavailable || capturing} pauseRef={pausePlayback} beforePlay={() => pauseIncoming.current?.()} />
    </View>}
    {capturing ? <>
      <Text accessibilityLiveRegion="polite" style={styles.timer}>{Math.floor(state.durationMs / 1000)} / {VOICE_LIMIT_SECONDS} с</Text>
      {recording && <VoiceButton label="Остановить запись" onPress={() => void capture.current?.stop()} disabled={unavailable} danger />}
      <VoiceButton label="Отменить запись" onPress={() => void capture.current?.cancel()} disabled={unavailable || state.phase === 'stopping'} />
    </> : <>
      {state.draft && !report && <AudioPreview key={state.draft.uri} uri={state.draft.uri} label="Прослушать перед отправкой" locked={unavailable} pauseRef={pausePlayback} onReady={setPreviewReady} beforePlay={() => pauseIncoming.current?.()} />}
      {state.draft && !report && <VoiceButton label={props.diary ? 'Сохранить только в личный дневник' : 'Отправить голос на iPad'}
        onPress={() => void send(props.diary ? 'diary' : 'peer')}
        disabled={networkUnavailable || !previewReady || !draftState.saved || uncertain ||
          (props.diary ? !props.diaryRoomReady || props.diaryHistory.length >= 2 : !props.peerUserId)} />}
      {state.draft && !draftState.saved && !!draftState.error && <VoiceButton label="Повторить сохранение черновика"
        onPress={() => { if (state.draft) void draftController.current?.save(state.draft); }} disabled={unavailable} />}
      {!state.draft && !!draftState.error && <VoiceButton label="Повторить открытие черновика"
        onPress={() => void draftController.current?.restore()} disabled={unavailable} />}
      <VoiceButton label={state.draft || report ? 'Записать новую фразу' : 'Записать голос'} onPress={() => void start()}
        disabled={unavailable || !props.draftScope || (props.diary && (!props.diaryRoomReady || props.diaryHistory.length >= 2)) ||
          (draftState.phase === 'error' && !state.draft)} />
    </>}
    {!!state.error && <Text style={styles.error}>{state.error}</Text>}
    {!!draftState.error && <Text style={styles.error}>{draftState.error}</Text>}
    <Text style={styles.note}>Хранится один зашифрованный черновик. Он остаётся на Tecno после закрытия приложения. Новая запись заменит его; выход из аккаунта удалит. Отправка — только отдельной кнопкой.</Text>
    <Text style={styles.note}>Если связи с сервером нет перед отправкой, черновик остаётся здесь. После возвращения интернета нажми отправку ещё раз.</Text>
    <Text style={styles.note}>Запись остановится через 15 секунд. Для теста достаточно короткой фразы без личных данных.</Text>
    </View>
    {props.diary ? <View style={styles.card}>
      <Text style={styles.title}>Две личные записи</Text>
      <Text style={styles.note}>Каждую можно открыть с сервера и проверить отдельно. Передача iPad создаёт отдельную зашифрованную копию выбранной записи.</Text>
      {!props.diaryHistory.length && <Text style={styles.text}>Записей пока нет.</Text>}
      {props.diaryHistory.map((item, index) => <View key={item.eventId} style={styles.historyItem}>
        <Text style={styles.historyLabel}>Запись {index + 1} · {Math.max(1, Math.round(item.durationMs / 1000))} с</Text>
        <VoiceButton label="Открыть личную запись" onPress={() => void openDiary(item.eventId)} disabled={networkUnavailable || capturing} />
        {incoming?.eventId === item.eventId && <AudioPreview key={incoming.playbackUri} uri={incoming.playbackUri}
          label="Слушать личную запись" locked={unavailable || capturing} pauseRef={pauseIncoming} beforePlay={() => pausePlayback.current?.()} />}
        <VoiceButton label="Передать только эту запись на iPad" onPress={() => void props.onShareDiary(item.eventId)}
          disabled={networkUnavailable || capturing || !props.peerUserId || props.diarySharedEventId === item.eventId} />
        {props.diarySharedEventId === item.eventId && <Text style={styles.success}>Эта запись передана iPad</Text>}
      </View>)}
    </View> :
    <View style={styles.card}>
      <Text style={styles.title}>История голосовых</Text>
      <Text style={styles.note}>Последние 5 твоих записей и 5 записей с iPad. Первое открытие скачивает запись с сервера и сохраняет зашифрованную копию на Tecno. Затем её можно слушать без интернета.</Text>
      {!props.history.length && !props.ownHistory.length && <Text style={styles.text}>Здесь появятся отправленные и полученные голосовые.</Text>}
      {voiceHistory(props.history, props.ownHistory).map(item => <View key={item.eventId}
        style={[styles.historyItem, item.direction === 'outgoing' && styles.ownHistoryItem]}>
        <Text style={styles.historyLabel}>{item.direction === 'outgoing' ? 'Ты' : 'iPad'} · {Math.max(1, Math.round(item.durationMs / 1000))} с</Text>
        <Text style={styles.note}>{item.direction === 'outgoing' ? 'Отправлена' : 'Получена'} {new Date(item.receivedAt).toLocaleString('ru-RU', {
          day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
        })}</Text>
        {incoming?.eventId === item.eventId ? <View style={styles.group}>
          <Text style={styles.success}>{incoming.playbackSource === 'tecno' ? 'С Tecno · без интернета' : 'Расшифрована · можно слушать'}</Text>
          {incoming.playbackSource !== 'tecno' && <Text style={styles.note}>{incoming.offlineCopy === 'saved'
            ? 'Сохранена на Tecno для прослушивания без интернета.'
            : 'Копию для прослушивания без интернета сохранить не удалось. Запись с сервера можно слушать сейчас.'}</Text>}
          <AudioPreview key={incoming.playbackUri} uri={incoming.playbackUri} label="Слушать запись"
            locked={unavailable || capturing} pauseRef={pauseIncoming} beforePlay={() => pausePlayback.current?.()} />
          </View>
          : <VoiceButton label="Открыть запись" onPress={() => void receive('history', item.eventId)}
          disabled={networkUnavailable || capturing} />}
      </View>)}
    </View>}
    </>}
  </>;
}

function VoiceButton({ label, onPress, disabled, danger = false }: { label: string; onPress: () => void; disabled: boolean; danger?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
    style={({ pressed }) => [styles.button, danger && styles.danger, (disabled || pressed) && styles.muted]}>
    <Text style={styles.buttonText}>{label}</Text>
  </Pressable>;
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#fff', borderRadius: 18, padding: 22, gap: 14 },
  historyItem: { gap: 10, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#dfe5ec' },
  ownHistoryItem: { backgroundColor: '#edf4ff', padding: 14, borderRadius: 12, borderTopWidth: 0 },
  historyLabel: { fontSize: 20, fontWeight: '600', color: '#182b39' },
  group: { gap: 10 }, title: { fontSize: 28, fontWeight: '700', color: '#182b39' },
  text: { fontSize: 18, lineHeight: 27, color: '#273844' }, note: { fontSize: 15, lineHeight: 23, color: '#596570' },
  timer: { fontSize: 32, fontWeight: '700', color: '#a12626' }, success: { fontSize: 22, fontWeight: '700', color: '#216747' },
  error: { fontSize: 17, lineHeight: 25, color: '#943232' },
  button: { backgroundColor: '#2059b0', borderRadius: 14, minHeight: 54, padding: 16, alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: '700', textAlign: 'center' }, danger: { backgroundColor: '#a12626' },
  secondary: { borderColor: '#2059b0', borderWidth: 1, borderRadius: 14, padding: 16, minHeight: 52, alignItems: 'center' },
  secondaryText: { color: '#2059b0', fontSize: 18, fontWeight: '700', textAlign: 'center' }, muted: { opacity: 0.5 },
});
