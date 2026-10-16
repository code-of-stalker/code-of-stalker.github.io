import { Link, router, Stack, useIsFocused, useLocalSearchParams } from 'expo-router';
import { useHeaderHeight } from 'expo-router/react-navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, AppState, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { checkMatrixServer, forgetMatrixSession, loginMatrix, restoreMatrixSession } from '../matrix/network';
import { networkErrorText } from '../matrix/network-types';
import { AudioProbeError, audioProbeErrorText } from '../matrix/audio-probe';
import type { AudioProbeReport } from '../matrix/audio-probe';
import { incomingAudioErrorText } from '../matrix/incoming-audio-probe';
import VoiceTest from '../components/voice/VoiceTest';
import GroupAudioPreview from '../components/voice/GroupAudioPreview';
import type { VoiceUiStatus } from '../components/voice/VoiceTest.types';
import type { VoiceBeforeUpload, VoiceDraft, VoiceProbeReport } from '../matrix/voice-types';
import type { RecoveryReadiness } from '../matrix/recovery-readiness-model';
import type { AudioHistoryItem, MatrixTestSession, MessageReport, RestartProbeStatus, RestartReport, ServerReport, PeerRoom, PeerExchangeReport, PeerRestartProbe, PeerRestartReport, GroupRoom } from '../matrix/network-types';
import type { SasData, TrustReport, TrustStatus } from '../matrix/trust-types';
import { identityTrustText, trustConfirmed, trustPendingText } from '../matrix/trust-status';
import { connectionSummary, formatTrustDiagnostics } from '../matrix/trust-diagnostics';
import type { TrustDiagnostics } from '../matrix/trust-diagnostics';
import { observeOperation } from '../matrix/operation-wait';
import type { OperationSettlement } from '../matrix/operation-wait';
import { AutomaticVoiceReceiver } from '../matrix/automatic-voice-receiver';
import { eraseVoiceDraft } from '../matrix/voice-draft-storage';
import { eraseVoicePlaybackCache } from '../matrix/voice-playback-storage';

type TestAction = 'server' | 'login' | 'message' | 'encrypted' | 'history' | 'peer-room' | 'peer-exchange' | 'peer-history' | 'audio' | 'voice' | 'receive-voice' | 'voice-history' | 'missed-voice' | 'open-voice' | 'diary-prepare' | 'diary-save' | 'diary-open' | 'diary-share' | 'group-prepare' | 'group-send' | 'group-ipad' | 'group-computer' | 'recovery-status' | 'recovery-enable' | 'trust-status' | 'trust-own' | 'trust-peer' | 'logout' | 'forget';

export default function NetworkTestScreen() {
  const { section } = useLocalSearchParams<{ section?: string }>();
  const diagnostics = section === 'diagnostics';
  const diary = section === 'diary';
  const group = section === 'group';
  const focused = useIsFocused();
  const [appActive, setAppActive] = useState(AppState.currentState === 'active');
  const headerHeight = useHeaderHeight();
  const scrollView = useRef<ScrollView>(null);
  const serverInput = useRef<TextInput>(null);
  const usernameInput = useRef<TextInput>(null);
  const passwordInput = useRef<TextInput>(null);
  const peerInput = useRef<TextInput>(null);
  const focusedInput = useRef<TextInput | null>(null);
  const [server, setServer] = useState('https://matrix-client.matrix.org');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [userId, setUserId] = useState('');
  const [deviceId, setDeviceId] = useState('');
  const [restoreFailed, setRestoreFailed] = useState(false);
  const [restoring, setRestoring] = useState(true);
  const [busy, setBusy] = useState(false);
  const [voiceBusy, setVoiceBusy] = useState(false);
  const voiceBusyRef = useRef(false);
  const [stopping, setStopping] = useState(false);
  const [stopDelayed, setStopDelayed] = useState(false);
  const [waitCancelled, setWaitCancelled] = useState(false);
  const [stage, setStage] = useState('');
  const [error, setError] = useState('');
  const [report, setReport] = useState<ServerReport | null>(null);
  const [message, setMessage] = useState<MessageReport | null>(null);
  const [restartProbe, setRestartProbe] = useState<RestartProbeStatus | null>(null);
  const [restartReport, setRestartReport] = useState<RestartReport | null>(null);
  const [peerUserId, setPeerUserId] = useState('');
  const [peerRoom, setPeerRoom] = useState<PeerRoom | null>(null);
  const [peerReport, setPeerReport] = useState<PeerExchangeReport | null>(null);
  const [audioReport, setAudioReport] = useState<AudioProbeReport | null>(null);
  const [peerAudioHistory, setPeerAudioHistory] = useState<readonly AudioHistoryItem[]>([]);
  const [ownAudioHistory, setOwnAudioHistory] = useState<readonly AudioHistoryItem[]>([]);
  const [diaryRoomId, setDiaryRoomId] = useState<string | null>(null);
  const [diaryHistory, setDiaryHistory] = useState<readonly AudioHistoryItem[]>([]);
  const [diarySharedEventId, setDiarySharedEventId] = useState<string | null>(null);
  const [groupRoom, setGroupRoom] = useState<GroupRoom | null>(null);
  const [computerUserId, setComputerUserId] = useState('');
  const [groupSent, setGroupSent] = useState<AudioProbeReport | null>(null);
  const [groupReceived, setGroupReceived] = useState<{ sender: 'ipad' | 'computer'; report: VoiceProbeReport } | null>(null);
  const [recoveryReport, setRecoveryReport] = useState<RecoveryReadiness | null>(null);
  const [recoveryCode, setRecoveryCode] = useState('');
  const [recoveryCodeSaved, setRecoveryCodeSaved] = useState(false);
  const [peerAudioRestartProbe, setPeerAudioRestartProbe] = useState<PeerRestartProbe | null>(null);
  const [peerRestartProbe, setPeerRestartProbe] = useState<PeerRestartProbe | null>(null);
  const [peerRestartReport, setPeerRestartReport] = useState<PeerRestartReport | null>(null);
  const [trustStatus, setTrustStatus] = useState<TrustStatus | null>(null);
  const [trustReport, setTrustReport] = useState<TrustReport | null>(null);
  const [trustDiagnostics, setTrustDiagnostics] = useState<TrustDiagnostics | null>(null);
  const [sas, setSas] = useState<SasData | null>(null);
  const [sasResponding, setSasResponding] = useState(false);
  const responsePending = useRef(false);
  const responseError = useRef('');
  const session = useRef<MatrixTestSession | null>(null);
  const operation = useRef<AbortController | null>(null);
  const automaticReceiver = useRef<AutomaticVoiceReceiver | null>(null);
  const previousAutomaticStop = useRef<Promise<void>>(Promise.resolve());
  const [automaticStage, setAutomaticStage] = useState('');
  const [automaticError, setAutomaticError] = useState('');
  const [automaticRetryAllowed, setAutomaticRetryAllowed] = useState(true);
  const mounted = useRef(true);
  const locked = busy || restoring || stopping || voiceBusy;
  const tabsLocked = busy || restoring || voiceBusy;
  const automaticWanted = Platform.OS !== 'web' && focused && appActive && !diagnostics && !diary && !group && !!userId && !!peerRoom && !locked;
  const updateVoiceStatus = useCallback((status: VoiceUiStatus) => {
    voiceBusyRef.current = status.busy;
    if (status.busy) void automaticReceiver.current?.pause().catch(() => {});
    if (!mounted.current) return;
    setVoiceBusy(status.busy);
    if (!operation.current && status.text) {
      setStage(status.text); setError(status.error ?? ''); setWaitCancelled(false);
    }
  }, []);

  const revealFocusedInput = useCallback(() => {
    const input = focusedInput.current;
    if (Keyboard.isVisible() && input?.isFocused()) {
      // Pass the host ref directly: compatible with Fabric, without findNodeHandle.
      scrollView.current?.scrollResponderScrollNativeHandleToKeyboard(input, headerHeight + 20, true);
    }
  }, [headerHeight]);

  function focusInput(input: TextInput | null) {
    focusedInput.current = input;
    revealFocusedInput();
  }

  useEffect(() => {
    const keyboard = Keyboard.addListener('keyboardDidShow', revealFocusedInput);
    return () => keyboard.remove();
  }, [revealFocusedInput]);

  useEffect(() => {
    mounted.current = true;
    const appState = AppState.addEventListener('change', (state) => {
      setAppActive(state === 'active');
      if (state !== 'active') {
        void automaticReceiver.current?.pause().catch(() => {});
        operation.current?.abort();
      }
    });
    return () => {
      appState.remove();
      mounted.current = false;
      const stopped = automaticReceiver.current?.pause().catch(() => {}) ?? Promise.resolve();
      if (operation.current) operation.current.abort();
      else void stopped.then(() => {
        if (!mounted.current && !operation.current) { session.current?.dispose(); session.current = null; }
      });
    };
  }, []);

  useEffect(() => {
    const receiver = new AutomaticVoiceReceiver({
      starting() {
        if (mounted.current && automaticReceiver.current === receiver) {
          setAutomaticError(''); setAutomaticRetryAllowed(true); setAutomaticStage('Подключаем автоприём голосовых');
        }
      },
      async receive(signal) {
        // Fast Refresh may replay effects after reception has already started.
        // A replacement waits for the prior owner instead of overlapping sync.
        await previousAutomaticStop.current;
        if (signal.aborted) return;
        const current = session.current;
        if (!current || operation.current || voiceBusyRef.current) return;
        if (typeof current.watchVoiceMessagesFromPeer !== 'function') throw new AudioProbeError('Выполни Reload, чтобы включить автоматический приём.');
        try {
          await current.watchVoiceMessagesFromPeer(signal, (text) => {
            if (mounted.current && automaticReceiver.current === receiver && !signal.aborted) setAutomaticStage(text);
          }, () => {
            if (mounted.current && automaticReceiver.current === receiver && !signal.aborted && session.current === current) {
              setPeerAudioHistory(current.peerAudioHistory ?? []);
              setPeerAudioRestartProbe(current.peerAudioRestartProbe);
            }
          });
        } finally {
          if (mounted.current && automaticReceiver.current === receiver && session.current === current) {
            setPeerAudioHistory(current.peerAudioHistory ?? []);
            setPeerAudioRestartProbe(current.peerAudioRestartProbe);
          }
        }
      },
      failed(problem, retryMs) {
        if (mounted.current && automaticReceiver.current === receiver) {
          setAutomaticError(incomingAudioErrorText(problem));
          setAutomaticRetryAllowed(retryMs > 0);
          setAutomaticStage(retryMs ? `Автоприём прервался · повтор через ${retryMs / 1000} с` : 'Автоприём остановлен · перезапусти приложение');
        }
      },
    });
    automaticReceiver.current = receiver;
    return () => {
      previousAutomaticStop.current = receiver.pause();
      void previousAutomaticStop.current.catch(() => {});
      if (automaticReceiver.current === receiver) automaticReceiver.current = null;
    };
  }, []);

  useEffect(() => {
    automaticReceiver.current?.setEnabled(automaticWanted);
    return () => { void automaticReceiver.current?.pause().catch(() => {}); };
  }, [automaticWanted, userId, peerRoom?.roomId]);

  const restoreSavedLogin = useCallback(async (controller: AbortController) => {
    if (operation.current) return;
    operation.current = controller;
    const timeout = setTimeout(() => controller.abort(), 60_000);
    setRestoring(true);
    setRestoreFailed(false);
    setError('');
    setStage('Открываем сохранённый вход');
    try {
      const next = await restoreMatrixSession(controller.signal);
      if (!mounted.current) { next?.dispose(); return; }
      if (controller.signal.aborted) { next?.dispose(); throw new Error('Aborted'); }
      session.current = next;
      if (next) {
        setUserId(next.userId);
        setDeviceId(next.deviceId);
        setServer(next.serverUrl);
        setUsername(next.userId);
        setRestartProbe(next.restartProbe);
        setPeerRoom(next.peerRoom);
        setPeerRestartProbe(next.peerRestartProbe);
        setPeerAudioRestartProbe(next.peerAudioRestartProbe);
        setPeerAudioHistory(next.peerAudioHistory ?? []);
        setOwnAudioHistory(next.ownAudioHistory ?? []);
        setDiaryRoomId(next.diaryRoomId ?? null);
        setDiaryHistory(next.diaryAudioHistory ?? []);
        setDiarySharedEventId(next.diarySharedEventId ?? null);
        setGroupRoom(next.groupRoom ?? null);
        setComputerUserId(next.groupRoom?.computerUserId ?? '');
        setPeerUserId(next.peerRoom?.peerUserId ?? '');
        setStage('Сохранённый вход восстановлен');
      } else setStage('');
    } catch (problem) {
      if (mounted.current) { setError(networkErrorText(problem)); setRestoreFailed(true); }
    } finally {
      clearTimeout(timeout);
      if (operation.current === controller) operation.current = null;
      if (mounted.current) setRestoring(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    // Defer native work until the screen renders; also avoids opening the same
    // SQLite store twice during React's development effect replay.
    const timer = setTimeout(() => void restoreSavedLogin(controller), 50);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [restoreSavedLogin]);

  useEffect(() => {
    if (error || message || report || restartReport || peerReport || peerRestartReport || audioReport || sas || trustStatus || trustReport) scrollView.current?.scrollTo({ y: 0, animated: true });
  }, [error, message, report, restartReport, peerReport, peerRestartReport, audioReport, sas, trustStatus, trustReport]);

  async function respondToSas(matches: boolean) {
    const current = session.current;
    const controller = operation.current;
    if (!current || !controller || controller.signal.aborted || !sas || responsePending.current) return;
    responsePending.current = true;
    setSasResponding(true);
    try { await current.respondToVerification(matches); }
    catch (problem) {
      // A late failure from the cancelled operation must not affect a later one.
      if (operation.current !== controller || controller.signal.aborted) return;
      responseError.current = networkErrorText(problem);
      if (mounted.current) setError(responseError.current);
      controller.abort();
    }
  }

  async function run(action: TestAction, draft?: VoiceDraft, audioEventId?: string, beforeUpload?: VoiceBeforeUpload): Promise<VoiceProbeReport | undefined> {
    if (operation.current || restoring || voiceBusyRef.current) return;
    // Fast Refresh can retain a session whose receiver predates bounded reads.
    // Reject it before waiting on that receiver's potentially stalled pause.
    if ((action === 'voice' || action === 'diary-save') && session.current && session.current.voiceUploadBoundaryVersion !== 3) {
      setStage('Нужно обновить открытое приложение');
      setError('Выполни полный Reload один раз, чтобы загрузить историю своих записей. Черновик не отправлен.');
      return;
    }
    if (action === 'open-voice' && session.current && session.current.voicePlaybackCacheVersion !== 1) {
      setStage('Нужно обновить открытое приложение');
      setError('Выполни полный Reload один раз, чтобы включить прослушивание сохранённых записей без интернета.');
      return;
    }
    Keyboard.dismiss();
    if (action !== 'open-voice') scrollView.current?.scrollTo({ y: 0, animated: true });
    const controller = new AbortController();
    operation.current = controller;
    responseError.current = '';
    let lastStage = '';
    let timedOut = false;
    let voiceUploadBoundaryReached = false;
    let pendingTask: OperationSettlement | undefined;
    function waitForNative<T>(work: Promise<T>): Promise<T> {
      const observed = observeOperation(work, controller.signal);
      pendingTask = observed;
      return observed.result;
    }
    const trustAction = action === 'trust-status' || action === 'trust-own' || action === 'trust-peer';
    const diaryAction = action === 'diary-prepare' || action === 'diary-save' || action === 'diary-open' || action === 'diary-share';
    const groupAction = action === 'group-prepare' || action === 'group-send' || action === 'group-ipad' || action === 'group-computer';
    const audioAction = action === 'audio' || action === 'voice' || action === 'receive-voice' || action === 'voice-history' || action === 'missed-voice' || action === 'open-voice' || diaryAction || groupAction;
    let timeout = setTimeout(() => { timedOut = true; controller.abort(); }, action === 'voice' || action === 'diary-save' ? 60_000 : action === 'recovery-enable' || action === 'peer-exchange' || action === 'trust-own' || action === 'trust-peer' || audioAction ? 300_000 : action === 'encrypted' ? 180_000 : action === 'message' || action === 'history' || action === 'peer-room' || action === 'peer-history' || action === 'trust-status' || action === 'recovery-status' ? 120_000 : 60_000);
    setBusy(true);
    setWaitCancelled(false); setStopping(false); setStopDelayed(false);
    setError('');
    setAudioReport(null);
    if (action === 'recovery-status') setRecoveryReport(null);
    if (action === 'group-send') setGroupSent(null);
    if (action === 'group-ipad' || action === 'group-computer') setGroupReceived(null);
    if (action === 'server') setReport(null);
    if (action === 'message' || action === 'encrypted') setMessage(null);
    if (action === 'encrypted' || action === 'history') setRestartReport(null);
    setPeerRestartReport(null);
    setTrustStatus(null); setTrustReport(null); setSas(null);
    // Keep the last comparison journal while rechecking its pending result.
    if (action !== 'trust-status') setTrustDiagnostics(null);
    if (trustAction || action === 'peer-room' || action === 'peer-exchange' || action === 'peer-history' || audioAction) {
      setPeerReport(null); setMessage(null); setRestartReport(null); setReport(null);
    } else setPeerReport(null);
    function updateStage(text: string) {
      if (controller.signal.aborted || operation.current !== controller) return;
      lastStage = text; if (mounted.current) setStage(text);
    }
    try {
      if (action === 'open-voice' && audioEventId && session.current) {
        const local = await waitForNative(session.current.readCachedPeerAudio(audioEventId, controller.signal, updateStage)
          .then(async (result) => {
            if (!mounted.current || controller.signal.aborted) {
              (await import('../matrix/incoming-audio-files.native')).discardIncomingAudio(result?.playbackUri);
              throw new AudioProbeError('Открытие записи отменено.');
            }
            return result;
          }));
        if (local) {
          if (mounted.current) setStage('Запись открыта с Tecno · интернет не нужен');
          return local;
        }
      }
      updateStage('Останавливаем автоприём перед действием');
      // Claim the manual operation first, then wait for the receiver's real
      // cleanup. This also keeps logout and saved-key reads away from live sync.
      await waitForNative(automaticReceiver.current?.pause() ?? Promise.resolve());
      if (controller.signal.aborted) throw new Error('Aborted');
      // Let the loading state render before initializing the native bindings.
      await new Promise<void>((resolve) => setTimeout(resolve, 50));
      if (controller.signal.aborted) throw new Error('Aborted');
      if (action === 'server') {
        updateStage('Проверяем сервер через нативный SDK');
        const result = await checkMatrixServer(server, controller.signal);
        if (mounted.current) { setReport(result); setStage('Сервер ответил'); }
      } else if (action === 'login') {
        updateStage('Входим в тестовый аккаунт');
        const next = await loginMatrix(server, username, password, controller.signal);
        session.current = next;
        if (mounted.current) {
          setUserId(next.userId); setDeviceId(next.deviceId); setServer(next.serverUrl);
          setRestoreFailed(false); setStage('Вход выполнен и сохранён на телефоне');
          setRestartProbe(next.restartProbe);
          setPeerRoom(next.peerRoom);
          setPeerRestartProbe(next.peerRestartProbe);
          setPeerAudioRestartProbe(next.peerAudioRestartProbe);
          setPeerAudioHistory(next.peerAudioHistory ?? []);
          setOwnAudioHistory(next.ownAudioHistory ?? []);
          setDiaryRoomId(next.diaryRoomId ?? null);
          setDiaryHistory(next.diaryAudioHistory ?? []);
          setDiarySharedEventId(next.diarySharedEventId ?? null);
          setGroupRoom(next.groupRoom ?? null);
          setPeerUserId(next.peerRoom?.peerUserId ?? '');
        }
      } else if (action === 'message' || action === 'encrypted') {
        if (!session.current) throw new Error('Сначала войдите в тестовый аккаунт.');
        if (action === 'encrypted' && typeof session.current.sendEncryptedTestMessage !== 'function') {
          throw new Error('После обновления выполните Reload и войдите снова, чтобы открыть новую проверку шифрования.');
        }
        const result = action === 'encrypted'
          ? await session.current.sendEncryptedTestMessage(controller.signal, updateStage)
          : await session.current.sendTestMessage(controller.signal, updateStage);
        if (mounted.current) {
          setMessage(result);
          setRestartProbe(session.current.restartProbe);
          setStage(result.mode === 'encrypted' ? 'Шифрование и расшифровка тестового сообщения подтверждены' : 'Сообщение получено с сервера');
        }
      } else if (action === 'history') {
        if (!session.current) throw new Error('Сначала откройте сохранённый аккаунт.');
        if (typeof session.current.readEncryptedMessageAfterRestart !== 'function') {
          throw new Error('Откройте меню разработки и выполните Reload, чтобы загрузить проверку старого сообщения.');
        }
        const result = await session.current.readEncryptedMessageAfterRestart(controller.signal, updateStage);
        if (mounted.current) {
          setRestartReport(result);
          setStage('Прежнее сообщение расшифровано после восстановления сессии');
        }
      } else if (action === 'peer-history') {
        if (!session.current) throw new Error('Сначала откройте сохранённый аккаунт.');
        if (typeof session.current.readPeerReplyAfterRestart !== 'function') {
          throw new Error('Выполните Reload, чтобы открыть проверку ответа iPad после перезапуска.');
        }
        const result = await session.current.readPeerReplyAfterRestart(controller.signal, updateStage);
        if (mounted.current) { setPeerRestartReport(result); setStage('Прежний ответ iPad расшифрован сохранёнными ключами'); }
      } else if (action === 'peer-room' || action === 'peer-exchange') {
        if (!session.current) throw new Error('Сначала откройте сохранённый аккаунт.');
        if (action === 'peer-room') {
          const result = await session.current.preparePeerRoom(peerUserId, controller.signal, updateStage);
          if (mounted.current) {
            setPeerRoom(result); setPeerUserId(result.peerUserId);
            setStage('Комната готова. На iPad примите приглашение в Element X');
          }
        } else {
          if (!session.current.peerRoom || peerUserId.trim() !== session.current.peerRoom.peerUserId) {
            throw new Error('Для указанного аккаунта iPad сначала создайте тестовую комнату.');
          }
          const result = await session.current.exchangeWithPeer(controller.signal, updateStage);
          if (mounted.current) { setPeerReport(result); setStage('Зашифрованный ответ iPad получен, расшифрован и запомнен для перезапуска'); }
        }
      } else if (action === 'receive-voice' || action === 'voice-history' || action === 'missed-voice' || action === 'open-voice') {
        const current = session.current;
        if (!current) throw new AudioProbeError('Сначала открой сохранённый аккаунт.');
        if (typeof current.receiveVoiceMessageFromPeer !== 'function') throw new AudioProbeError('Выполни Reload, чтобы загрузить приём голоса.');
        if (action === 'voice-history' && typeof current.readPeerAudioAfterRestart !== 'function') throw new AudioProbeError('Выполни Reload, чтобы загрузить чтение прежнего голосового.');
        if (action === 'missed-voice' && typeof current.receiveMissedVoiceFromPeer !== 'function') throw new AudioProbeError('Выполни Reload, чтобы загрузить поиск пропущенных голосовых.');
        if (action === 'open-voice' && (!audioEventId || typeof current.readPeerAudio !== 'function')) throw new AudioProbeError('Выполни Reload, чтобы открыть историю голосовых.');
        const work = (action === 'open-voice' ? current.readPeerAudio(audioEventId!, controller.signal, updateStage)
          : action === 'missed-voice' ? current.receiveMissedVoiceFromPeer(controller.signal, updateStage)
          : action === 'voice-history' ? current.readPeerAudioAfterRestart(controller.signal, updateStage)
          : current.receiveVoiceMessageFromPeer(controller.signal, updateStage)).then(async (result) => {
          if (!mounted.current || controller.signal.aborted) {
            (await import('../matrix/incoming-audio-files.native')).discardIncomingAudio(result?.playbackUri);
            throw new AudioProbeError('Ожидание голосового отменено.');
          }
          return result;
        });
        const result = await waitForNative(work);
        if (!result) {
          if (mounted.current) setStage('Новых голосовых после последней полученной записи не найдено. Можно проверить позже');
          return;
        }
        if (mounted.current) setStage(action === 'open-voice' ? 'Выбранное голосовое расшифровано и совпало с сохранённой записью. Можно слушать'
          : action === 'missed-voice' ? 'Пропущенное голосовое с iPad расшифровано и запомнено. Можно слушать'
          : action === 'voice-history' ? 'Прежнее голосовое расшифровано сохранёнными ключами и совпало с ранее полученной записью. Можно слушать'
          : 'Голосовое с iPad расшифровано и запомнено. Прослушай его перед перезапуском');
        return result;
      } else if (diaryAction) {
        const current = session.current;
        if (!current || current.diaryBoundaryVersion !== 1) throw new AudioProbeError('Выполни полный Reload, чтобы открыть личный тестовый дневник.');
        if (action === 'diary-prepare') {
          const roomId = await waitForNative(current.prepareDiary(controller.signal, updateStage));
          if (mounted.current) { setDiaryRoomId(roomId); setStage('Личный дневник создан: доступ есть только у твоего аккаунта'); }
        } else if (action === 'diary-save') {
          if (!draft || !beforeUpload) throw new AudioProbeError('Сначала запиши тестовую фразу.');
          const result = await waitForNative(current.saveDiaryVoice(draft, controller.signal, updateStage, async (signal) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => { timedOut = true; controller.abort(); }, 300_000);
            await beforeUpload(signal);
            voiceUploadBoundaryReached = true;
          }));
          if (!mounted.current || controller.signal.aborted) {
            (await import('../matrix/voice-files.native')).discardVoiceFile(result.playbackUri);
            throw new AudioProbeError('Ожидание отменено. Запись могла уже попасть в личный дневник.');
          }
          setDiaryHistory(current.diaryAudioHistory);
          setStage('Запись сохранилась в личном дневнике и проверена после скачивания с сервера');
          return result;
        } else if (action === 'diary-open') {
          if (!audioEventId) throw new AudioProbeError('Выбери запись личного дневника.');
          const result = await waitForNative(current.readDiaryVoice(audioEventId, controller.signal, updateStage));
          if (!mounted.current || controller.signal.aborted) {
            (await import('../matrix/incoming-audio-files.native')).discardIncomingAudio(result.playbackUri);
            throw new AudioProbeError('Открытие записи отменено.');
          }
          setStage('Личная запись расшифрована с сервера. Можно слушать');
          return result;
        } else {
          if (!audioEventId) throw new AudioProbeError('Выбери одну запись для передачи iPad.');
          const shared = await waitForNative(current.shareDiaryVoice(audioEventId, controller.signal, updateStage));
          (await import('../matrix/voice-files.native')).discardVoiceFile(shared.playbackUri);
          if (mounted.current) { setDiarySharedEventId(audioEventId); setStage('Выбранная запись передана iPad отдельной зашифрованной копией'); }
        }
      } else if (action === 'recovery-status') {
        const current = session.current;
        if (!current || typeof current.inspectRecoveryReadiness !== 'function') {
          throw new AudioProbeError('Выполни полный Reload, чтобы проверить готовность восстановления.');
        }
        const result = await waitForNative(current.inspectRecoveryReadiness(controller.signal, updateStage));
        if (mounted.current) { setRecoveryReport(result); setStage('Состояние резервной копии прочитано. Данные Tecno не менялись'); }
      } else if (action === 'recovery-enable') {
        const current = session.current;
        if (!current || typeof current.enableDiaryRecovery !== 'function') {
          throw new AudioProbeError('Выполни полный Reload перед включением восстановления.');
        }
        if (!recoveryCodeSaved || !recoveryCode) throw new AudioProbeError('Сначала сохрани код восстановления вне Tecno.');
        const result = await waitForNative(current.enableDiaryRecovery(recoveryCode, controller.signal, updateStage));
        if (mounted.current) { setRecoveryReport(result); setStage('Восстановление включено. Храни код вне Tecno до проверки в чистой установке'); }
      } else if (groupAction) {
        const current = session.current;
        if (!current || typeof current.prepareGroupRoom !== 'function') throw new AudioProbeError('Выполни полный Reload, чтобы открыть проверку группы.');
        if (action === 'group-prepare') {
          if (!peerRoom) throw new AudioProbeError('Сначала нужна комната с аккаунтом iPad.');
          const created = await waitForNative(current.prepareGroupRoom(computerUserId, controller.signal, updateStage));
          if (mounted.current) { setGroupRoom(created); setGroupSent(null); setGroupReceived(null); setStage('Группа создана. Прими приглашения на iPad и Компьютере'); }
        } else if (action === 'group-send') {
          const sent = await waitForNative(current.sendGroupAudio(controller.signal, updateStage));
          if (mounted.current) { setGroupSent(sent); setStage('Tecno отправил зашифрованное аудио в группу. Проверь на iPad и Компьютере'); }
        } else {
          const sender = action === 'group-ipad' ? 'ipad' : 'computer';
          const received = await waitForNative(current.readGroupAudio(sender, controller.signal, updateStage));
          if (!mounted.current || controller.signal.aborted) {
            (await import('../matrix/incoming-audio-files.native')).discardIncomingAudio(received.playbackUri);
            throw new AudioProbeError('Чтение группового аудио остановлено.');
          }
          setGroupReceived({ sender, report: received });
          setStage(`Аудио от ${sender === 'ipad' ? 'iPad' : 'Компьютера'} расшифровано на Tecno`);
        }
      } else if (action === 'voice') {
        const current = session.current;
        if (!current || !draft || !beforeUpload) throw new AudioProbeError('Сначала войди в аккаунт и запиши короткую фразу.');
        if (typeof current.sendVoiceMessageToPeer !== 'function') throw new AudioProbeError('Выполни Reload, чтобы загрузить отправку голоса.');
        if (current.voiceUploadBoundaryVersion !== 3) throw new AudioProbeError('Выполни полный Reload, чтобы обновить историю своих записей. Черновик не отправлен.');
        const work = current.sendVoiceMessageToPeer(draft, controller.signal, updateStage, async (signal) => {
          if (controller.signal.aborted) throw new Error('Aborted');
          clearTimeout(timeout);
          timeout = setTimeout(() => { timedOut = true; controller.abort(); }, 300_000);
          voiceUploadBoundaryReached = true;
          await beforeUpload(signal);
        }).then(async (result) => {
          if (!mounted.current || controller.signal.aborted) {
            (await import('../matrix/voice-files.native')).discardVoiceFile(result.playbackUri);
            throw new AudioProbeError('Ожидание отменено. Голос мог уже отправиться.');
          }
          return result;
        });
        const result = await waitForNative(work);
        if (mounted.current) setStage('Голос отправлен и расшифрован. Прослушай его на Tecno и iPad');
        return result;
      } else if (action === 'audio') {
        const current = session.current;
        if (!current) throw new AudioProbeError('Сначала открой сохранённый аккаунт.');
        if (typeof current.sendEncryptedAudioToPeer !== 'function') throw new AudioProbeError('Выполни Reload, чтобы загрузить проверку аудиофайла.');
        const result = await waitForNative(current.sendEncryptedAudioToPeer(controller.signal, updateStage));
        if (mounted.current) {
          setAudioReport(result);
          setStage('Аудиофайл зашифрован и проверен на Tecno. Послушай его на iPad');
        }
      } else if (trustAction) {
        const current = session.current;
        if (!current) throw new Error('Сначала откройте сохранённый аккаунт.');
        if (typeof current.verifyTrust !== 'function') throw new Error('Выполните Reload, чтобы загрузить проверку доверия устройств.');
        if (action === 'trust-status') {
          const status = await waitForNative(current.inspectTrust(controller.signal, updateStage));
          if (mounted.current) {
            setTrustStatus(status);
            const target = status.peerIdentity ? 'peer' : 'own';
            setStage(trustConfirmed(status, target, status.peerIdentity?.userId ?? status.ownIdentity.userId)
              ? target === 'peer' ? 'Аккаунт iPad подтверждён нативным SDK' : 'Сессия Tecno подтверждена нативным SDK'
              : 'Статус обновлён: доверие ещё не подтверждено');
          }
        } else {
          const result = await waitForNative(current.verifyTrust(action === 'trust-own' ? 'own' : 'peer', controller.signal, updateStage,
            (data) => { if (mounted.current && operation.current === controller && !controller.signal.aborted) setSas(data); },
            (data) => { if (mounted.current && operation.current === controller) setTrustDiagnostics(data); }));
          if (mounted.current) {
            setTrustStatus(result.status); setTrustReport(result);
            setStage(result.outcome === 'pending' ? 'Сравнение завершено; доверие ещё не подтверждено'
              : result.target === 'own' ? 'Сессия Tecno подтверждена через Компьютер' : 'Аккаунт iPad подтверждён нативным SDK');
          }
        }
      } else if (action === 'forget') {
        updateStage('Удаляем сохранённый вход с телефона');
        await eraseVoiceDraft();
        await eraseVoicePlaybackCache();
        session.current?.dispose();
        session.current = null;
        await forgetMatrixSession();
        if (mounted.current) { setUserId(''); setDeviceId(''); setRestoreFailed(false); setMessage(null); setRestartProbe(null); setRestartReport(null); setPeerRoom(null); setPeerUserId(''); setDiaryRoomId(null); setDiaryHistory([]); setDiarySharedEventId(null); setGroupRoom(null); setGroupReceived(null); setRecoveryReport(null); setRecoveryCode(''); setRecoveryCodeSaved(false); setStage('Сохранённый вход удалён'); }
      } else {
        updateStage('Завершаем сессию на сервере');
        await eraseVoiceDraft();
        await eraseVoicePlaybackCache();
        await session.current?.logout(controller.signal);
        session.current = null;
        if (mounted.current) { setUserId(''); setDeviceId(''); setMessage(null); setRestartProbe(null); setRestartReport(null); setPeerRoom(null); setPeerUserId(''); setDiaryRoomId(null); setDiaryHistory([]); setDiarySharedEventId(null); setGroupRoom(null); setGroupReceived(null); setRecoveryReport(null); setRecoveryCode(''); setRecoveryCodeSaved(false); setStage('Выход выполнен. Сохранённый вход удалён'); }
      }
    } catch (problem) {
      if (mounted.current && (trustAction || audioAction) && controller.signal.aborted && !responseError.current) {
        setWaitCancelled(!timedOut);
      }
      if (mounted.current) setError(responseError.current || (trustAction && controller.signal.aborted
        ? `${timedOut ? 'Время ожидания истекло' : 'Проверка остановлена'}. Последний этап: ${lastStage || 'подключение'}. Доверие не подтверждено. Вход и ключи сохранены. Закройте старое окно сравнения на другом устройстве перед новой попыткой.`
        : (action === 'receive-voice' || action === 'voice-history' || action === 'missed-voice' || action === 'open-voice') ? controller.signal.aborted
          ? `${timedOut ? 'Время ожидания истекло' : 'Приём остановлен'}. Последний этап: ${lastStage || 'подключение'}. Вход и ключи сохранены. Можно повторить чтение прежнего голосового или начать приём нового.`
          : `${incomingAudioErrorText(problem)} Последний этап: ${lastStage || 'подключение'}.`
        : (action === 'voice' || action === 'diary-save') && !voiceUploadBoundaryReached
          ? `Подготовка отправки остановлена до передачи записи SDK. Черновик сохранён на Tecno. ${controller.signal.aborted ? (timedOut ? 'Время ожидания истекло.' : 'Ожидание отменено.') : audioProbeErrorText(problem)} Последний этап: ${lastStage || 'подключение'}.`
        : diaryAction ? controller.signal.aborted
          ? `${timedOut ? 'Время ожидания истекло' : 'Действие остановлено'}. Последний этап: ${lastStage || 'подключение'}. Запись могла уже попасть в личный дневник или на iPad. Проверь обе комнаты перед повтором.`
          : `${problem instanceof AudioProbeError ? problem.message : 'Проверка дневника не завершилась. Проверь обе комнаты перед повтором.'} Последний этап: ${lastStage || 'подключение'}.`
        : groupAction ? controller.signal.aborted
          ? `${timedOut ? 'Время ожидания истекло' : 'Проверка остановлена'}. Последний этап: ${lastStage || 'подключение'}. Звук мог уже попасть в групповую комнату. Проверь iPad и Компьютер перед повтором.`
          : `${problem instanceof AudioProbeError ? problem.message : 'Групповая проверка не завершилась. Проверь связь и состав участников.'} Последний этап: ${lastStage || 'подключение'}.`
        : action === 'recovery-enable' ? controller.signal.aborted
          ? `${timedOut ? 'Время ожидания истекло' : 'Действие остановлено'}. Код сохрани; сначала проверь статус восстановления. Настройка могла завершиться на сервере.`
          : problem instanceof AudioProbeError ? problem.message : 'Настройка восстановления не завершилась. Код сохрани и сначала проверь статус.'
        : audioAction ? controller.signal.aborted
          ? `${timedOut ? 'Время ожидания истекло' : 'Ожидание отменено'}. Последний этап: ${lastStage || 'подключение'}. Файл мог уже попасть в очередь SDK или на сервер и может прийти позже. Сначала посмотри комнату на iPad. Успех проверки не подтверждён.`
          : `${audioProbeErrorText(problem)} Последний этап: ${lastStage || 'подключение'}.`
        : (action === 'history' || action === 'peer-history') && controller.signal.aborted
        ? 'Чтение отменено или время ожидания истекло. Сохранённый вход и ключи остаются на телефоне.'
        : networkErrorText(problem, password)));
    } finally {
      clearTimeout(timeout);
      if (mounted.current) {
        if (action === 'login') setPassword('');
        setSas(null); setSasResponding(false);
        setBusy(false);
      }
      const release = () => {
        if (operation.current !== controller) return;
        operation.current = null;
        responsePending.current = false;
        if (mounted.current) {
          setRestartProbe(session.current?.restartProbe ?? null);
          setPeerRoom(session.current?.peerRoom ?? null);
          setPeerRestartProbe(session.current?.peerRestartProbe ?? null);
          setPeerAudioRestartProbe(session.current?.peerAudioRestartProbe ?? null);
          setPeerAudioHistory(session.current?.peerAudioHistory ?? []);
          setOwnAudioHistory(session.current?.ownAudioHistory ?? []);
          setDiaryRoomId(session.current?.diaryRoomId ?? null);
          setDiaryHistory(session.current?.diaryAudioHistory ?? []);
          setDiarySharedEventId(session.current?.diarySharedEventId ?? null);
          setGroupRoom(session.current?.groupRoom ?? null);
          setStopping(false); setStopDelayed(false);
        } else {
          session.current?.dispose();
          session.current = null;
        }
      };
      if (pendingTask?.isPending()) {
        // Leave the operation lock and client alive while native cleanup runs.
        // The UI already shows cancellation and the journal, without a spinner.
        if (mounted.current) setStopping(true);
        const warning = setTimeout(() => {
          if (mounted.current && operation.current === controller) setStopDelayed(true);
        }, 8_000);
        void pendingTask.settled.then(() => { clearTimeout(warning); release(); });
      } else release();
    }
  }

  async function generateRecoveryCode() {
    if (locked) return;
    try {
      const crypto = await import('expo-crypto');
      const bytes = await crypto.getRandomBytesAsync(24);
      if (!mounted.current) return;
      setRecoveryCode(Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join(''));
      setRecoveryCodeSaved(false);
      setError('');
    } catch {
      if (mounted.current) setError('Не удалось создать код восстановления на Tecno. Повтори попытку.');
    }
  }

  function button(label: string, action: TestAction, disabled = false) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: locked || disabled }}
        disabled={locked || disabled}
        onPress={() => void run(action)}
        style={({ pressed }) => [styles.button, (pressed || locked || disabled) && styles.muted]}
      >
        <Text style={styles.buttonText}>{label}</Text>
      </Pressable>
    );
  }

  return (
    <SafeAreaView style={styles.page} edges={['left', 'right', 'bottom']}>
      <Stack.Screen options={{ title: 'Matrix', headerTitle: diagnostics ? 'Matrix · диагностика' : diary ? 'Matrix · дневник' : group ? 'Matrix · группа' : 'Matrix · голос' }} />
      <KeyboardAvoidingView
        style={styles.fill}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={headerHeight}
      >
        <View style={styles.statusArea}>
          <View accessibilityLiveRegion="polite" style={styles.statusCard}>
            <View style={styles.statusRow}>
              {(busy || restoring) && <ActivityIndicator color="#2059b0" accessibilityLabel={restoring ? 'Восстанавливается сохранённый вход' : 'Идёт сетевая проверка'} />}
              <Text style={[styles.statusText, !!error && !waitCancelled && styles.error]}>
                {waitCancelled ? 'Ожидание отменено' : error ? 'Ошибка: действие не завершено' : stage || (restoring ? 'Проверяем сохранённый вход' : userId ? 'Вход выполнен' : 'Можно войти в Matrix')}
              </Text>
            </View>
            {!diagnostics && !diary && !group && !!userId && !!peerRoom && <Text style={[styles.note, automaticWanted && !!automaticError && styles.error]}>
              {automaticWanted ? automaticStage || 'Подключаем автоприём голосовых' : 'Автоприём на паузе · возобновится после возвращения к экрану и завершения действия'}
            </Text>}
            {trustDiagnostics?.connection && <Text style={styles.note}>{connectionSummary(trustDiagnostics)}</Text>}
            {(busy || restoring) && (
              <Pressable accessibilityRole="button" onPress={() => operation.current?.abort()}
                style={({ pressed }) => [styles.secondaryButton, pressed && styles.muted]}>
                <Text style={styles.secondaryText}>Отменить ожидание</Text>
              </Pressable>
            )}
          </View>
          <View style={styles.tabs}>
            {([{ value: 'devices', label: 'Голос' }, { value: 'diary', label: 'Дневник' }, { value: 'group', label: 'Группа' }, { value: 'diagnostics', label: 'Диагностика' }] as const).map((tab) => {
              const selected = (section ?? 'devices') === tab.value;
              return (
                <Pressable key={tab.value} accessibilityRole="tab"
                  accessibilityState={{ selected, disabled: tabsLocked }} disabled={tabsLocked}
                  onPress={() => { Keyboard.dismiss(); setGroupReceived(null); router.setParams({ section: tab.value }); scrollView.current?.scrollTo({ y: 0, animated: false }); }}
                  style={({ pressed }) => [styles.tab, selected && styles.selectedTab, (pressed || tabsLocked) && styles.muted]}>
                  <Text style={[styles.tabText, selected && styles.selectedTabText]}>{tab.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
        <ScrollView
          ref={scrollView}
          style={styles.fill}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          onLayout={revealFocusedInput}
        >
          {!!error && (
            <View style={styles.card}>
              <Text style={waitCancelled ? styles.sectionTitle : styles.errorTitle}>{waitCancelled ? 'Ожидание отменено' : 'Не удалось завершить действие'}</Text>
              <Text selectable style={styles.error}>{error}</Text>
              {stopping && <Text style={styles.note}>{stopDelayed
                ? 'Остановка SDK не завершилась. Сначала скопируй сообщение об ошибке и доступные этапы ниже, затем полностью останови приложение через настройки Tecno и открой его снова. Сохранённый вход и ключи не удаляй.'
                : 'Завершаем остановку сетевого действия. Запись и прослушивание черновика доступны; повторная отправка дождётся остановки SDK.'}</Text>}
            </View>
          )}
          {diagnostics && audioReport && (
            <View style={styles.card}>
              <Text style={styles.success}>Аудиофайл зашифрован и проверен</Text>
              <Text style={styles.text}>Tecno получил файл с сервера и расшифровал его. Все байты совпали с исходным звуком.</Text>
              <Text style={styles.text}>Теперь на iPad открой нашу комнату в Element X и включи последнее аудио. Должны прозвучать два коротких сигнала.</Text>
              <Text selectable style={styles.note}>Файл: {audioReport.filename}{'\n'}Размер: {audioReport.byteLength} байт · длительность: {audioReport.durationMs / 1000} с</Text>
              <Text style={styles.note}>Сообщение и файл на сервере зашифрованы. Воспроизведение на iPad пока нужно проверить вручную.</Text>
              {diagnostics && <Text selectable style={styles.note}>Комната: {audioReport.roomId}{'\n'}Событие: {audioReport.eventId}{'\n'}Проверка: {Math.round(audioReport.elapsedMs / 1000)} с. Файл скачан без кэша; контрольная сумма шифротекста совпала.</Text>}
            </View>
          )}
          {sas && (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Tecno и {sas.userId === userId ? 'Компьютер' : 'iPad'}</Text>
              <Text selectable style={styles.note}>Подтверждаем аккаунт: {sas.userId}</Text>
              {sas.kind === 'emojis' ? (
                <View style={styles.emojiRow}>
                  {sas.values.map((value, index) => (
                    <View key={index} style={styles.emojiCell}>
                      <Text style={styles.note}>{index + 1}</Text>
                      <Text accessibilityLabel={value.description} style={styles.emoji}>{value.symbol}</Text>
                      <Text style={styles.emojiDescription}>{value.description}</Text>
                    </View>
                  ))}
                </View>
              ) : <Text selectable style={styles.decimals}>{sas.values.join(' · ')}</Text>}
              <Text style={styles.text}>Проверь все {sas.kind === 'emojis' ? 'семь эмодзи' : 'три числа'} в том же порядке {sas.userId === userId ? 'на Компьютере' : 'на iPad'}. Подтверди совпадение на обоих экранах только после сравнения.</Text>
              <Pressable accessibilityRole="button" disabled={sasResponding}
                accessibilityState={{ disabled: sasResponding }} onPress={() => void respondToSas(true)}
                style={({ pressed }) => [styles.button, (pressed || sasResponding) && styles.muted]}>
                <Text style={styles.buttonText}>Всё совпало</Text>
              </Pressable>
              <Pressable accessibilityRole="button" disabled={sasResponding}
                accessibilityState={{ disabled: sasResponding }} onPress={() => void respondToSas(false)}
                style={({ pressed }) => [styles.secondaryButton, (pressed || sasResponding) && styles.muted]}>
                <Text style={styles.secondaryText}>Не совпало</Text>
              </Pressable>
              <Text style={styles.note}>После «Всё совпало» дождись результата вверху. Одного нажатия для подтверждения доверия недостаточно.</Text>
            </View>
          )}
          {diagnostics && trustStatus && (
            <View style={styles.card}>
              <Text style={trustReport?.outcome === 'verified' ? styles.success : styles.sectionTitle}>{trustReport
                ? trustReport.outcome === 'pending' ? 'Сравнение завершено. Доверие ожидается'
                  : trustReport.target === 'own' ? 'Сессия Tecno подтверждена' : 'Аккаунт iPad подтверждён'
                : 'Последняя проверка доверия в SDK'}</Text>
              <Text selectable style={styles.text}>Tecno: {trustStatus.deviceState === 'verified' ? 'подтверждён' : trustStatus.deviceState === 'unverified' ? 'ожидает подтверждения' : 'состояние пока неизвестно'}{'\n'}Устройство Matrix: {trustStatus.deviceId}</Text>
              <Text selectable style={styles.note}>Tecno и Компьютер: {trustStatus.ownIdentity.userId}{'\n'}{identityTrustText(trustStatus.ownIdentity)}</Text>
              {trustStatus.peerIdentity && <Text selectable style={styles.note}>iPad: {trustStatus.peerIdentity.userId}{'\n'}{identityTrustText(trustStatus.peerIdentity)}</Text>}
              {!trustStatus.ownIdentity.present || (trustStatus.deviceState !== 'verified' && !trustStatus.hasOwnDeviceToVerify) ? (
                <Text style={styles.text}>Открой Element на Компьютере с аккаунтом Tecno, который показан выше. Заверши настройку шифрования и оставь Element открытым.</Text>
              ) : trustStatus.deviceState !== 'verified' || !trustStatus.ownIdentity.verified ? (
                <Text style={styles.text}>Во вкладке «Диагностика» нажми «Подтвердить Tecno через Компьютер». Прими запрос в Element на Компьютере.</Text>
              ) : trustStatus.peerIdentity && !trustStatus.peerIdentity.verified && <Text style={styles.text}>{trustPendingText(trustStatus, 'peer')}</Text>}
              {trustReport && <Text style={styles.note}>{trustReport.outcome === 'pending'
                ? 'SDK завершил сравнение, но подтверждения доверия к ключам пока нет. Это промежуточный результат.'
                : trustReport.sasCompared
                ? 'Сравнение принято тобой; обмен завершён и доверие к ключам подтверждено SDK.'
                : 'SDK уже считал аккаунт iPad подтверждённым. Новое сравнение не запускалось.'}</Text>}
              <Text style={styles.note}>Состояние получено из SDK при этой проверке. Перенос сообщений и восстановление после удаления данных проверяются отдельно.</Text>
            </View>
          )}
          {diagnostics && trustDiagnostics && (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Последнее сравнение · {trustDiagnostics.version}</Text>
              <Text selectable style={styles.note}>{formatTrustDiagnostics(trustDiagnostics)}</Text>
              <Text style={styles.note}>Этот текст можно выделить и скопировать. В нём только статусы, этапы и время, без пароля и ключей.</Text>
            </View>
          )}
          {diagnostics && peerRestartReport && (
            <View style={styles.card}>
              <Text style={styles.success}>Ответ iPad расшифрован после перезапуска</Text>
              <Text selectable style={styles.text}>Отправитель: {peerRestartReport.senderUserId}</Text>
              <Text selectable style={styles.text}>{peerRestartReport.body}</Text>
              <Text style={styles.text}>Это прежний ответ с сервера. Текст совпал с сохранённой контрольной суммой. Получение новых сообщений при чтении не запускалось.</Text>
              <Text selectable style={styles.note}>Устройство до и после: {peerRestartReport.deviceId}{'\n'}Комната: {peerRestartReport.roomId}{'\n'}Событие: {peerRestartReport.eventId}</Text>
              <Text style={styles.note}>На сервере — зашифрованное событие. Время: {peerRestartReport.elapsedMs} мс.</Text>
            </View>
          )}
          {diagnostics && peerReport && (
            <View style={styles.card}>
              <Text style={styles.success}>Зашифрованный обмен подтверждён</Text>
              <Text selectable style={styles.text}>Ответ от {peerReport.peerUserId}</Text>
              <Text selectable style={styles.text}>{peerReport.replyBody}</Text>
              <Text style={styles.text}>SDK на Tecno получил и расшифровал точный ответ на текущий тест. Сервер вернул оба сообщения в зашифрованном виде.</Text>
              <Text style={styles.text}>Ответ запомнен. Теперь можно полностью остановить Tecno и проверить чтение этого ответа после открытия приложения.</Text>
              <Text selectable style={styles.note}>Комната: {peerReport.roomId}{'\n'}Запрос: {peerReport.sentEventId}{'\n'}Ответ: {peerReport.replyEventId}</Text>
              <Text style={styles.note}>Время: {Math.round(peerReport.elapsedMs / 1000)} сек. На iPad используется Element X. Доверие проверяется во вкладке «Диагностика».</Text>
            </View>
          )}
          {diagnostics && restartReport && (
            <View style={styles.card}>
              <Text style={styles.success}>Старое сообщение расшифровано</Text>
              <Text selectable style={styles.text}>{restartReport.body}</Text>
              <Text style={styles.text}>Текст совпал с отправленным до восстановления сессии. Новое сообщение не отправлялось.</Text>
              <Text selectable style={styles.note}>Устройство до и после: {restartReport.deviceId}</Text>
              <Text selectable style={styles.note}>Комната: {restartReport.roomId}{'\n'}Событие: {restartReport.eventId}</Text>
              <Text style={styles.note}>На сервере — зашифрованное событие. Время проверки: {restartReport.elapsedMs} мс.</Text>
              <Text style={styles.note}>Проверка на одном телефоне. Перенос и восстановление на другом устройстве ещё не проверены.</Text>
            </View>
          )}
          {diagnostics && message && (
            <View style={styles.card}>
              <Text style={styles.success}>{message.mode === 'encrypted' ? 'Шифрование и расшифровка подтверждены' : 'Сообщение отправлено и получено с сервера'}</Text>
              <Text selectable style={styles.text}>{message.body}</Text>
              <Text selectable style={styles.note}>Комната: {message.roomId}</Text>
              <Text selectable style={styles.note}>Событие: {message.eventId}</Text>
              <Text style={styles.text}>Время: {message.elapsedMs} мс.</Text>
              {message.mode === 'encrypted' && (
                <>
                  <Text style={styles.text}>На сервере — шифротекст. SDK на телефоне получил и расшифровал исходный тестовый текст.</Text>
                  <Text style={styles.note}>Тип события: {message.encryption.eventType}{'\n'}Алгоритм: {message.encryption.algorithm}</Text>
                </>
              )}
              <Text style={styles.note}>{message.mode === 'encrypted'
                ? 'Эта кнопка проверяет сообщение в одной сессии. Для проверки доверия откройте вкладку «Диагностика».'
                : 'Подтверждён ответ сервера в этой же сессии. Для шифрования используйте отдельную кнопку ниже.'}</Text>
            </View>
          )}
          {diagnostics && report && (
            <View style={styles.card}>
              <Text style={styles.success}>Сервер ответил нативному SDK</Text>
              <Text selectable style={styles.text}>{report.url}</Text>
              <Text style={styles.text}>Вход по паролю: {report.passwordLogin ? 'доступен' : 'недоступен'}.</Text>
              <Text style={styles.text}>Получение событий для этого теста: {report.nativeSync ? 'поддерживается сервером' : 'сервер не объявляет поддержку'}.</Text>
            </View>
          )}
          {diary && !!userId && <View style={styles.card}>
            <Text style={styles.title}>Личный тестовый дневник</Text>
            <Text style={styles.text}>Запиши две короткие тестовые фразы. Они сохраняются в отдельной зашифрованной комнате твоего аккаунта. На iPad появится только запись, которую ты передашь отдельной кнопкой.</Text>
            {!diaryRoomId ? button('Создать личный дневник', 'diary-prepare')
              : <Text style={styles.success}>Личная комната готова · {diaryHistory.length} из 2 записей</Text>}
            <Text style={styles.note}>Облачное восстановление после потери телефона проверяется следующим этапом. Пока «сохранено» означает, что запись и файл проверены на этом устройстве.</Text>
            {button('Проверить готовность восстановления', 'recovery-status', !diaryRoomId)}
            {recoveryReport && <View style={styles.recoveryStatus}>
              <Text style={styles.sectionTitle}>Состояние восстановления</Text>
              <Text style={styles.text}>Резервная копия ключей на сервере: {recoveryReport.serverBackupExists ? 'есть' : 'не найдена'}.</Text>
              <Text style={styles.text}>Ключ копии на Tecno: {recoveryReport.backupState === 'ready' ? 'подключён'
                : recoveryReport.backupState === 'working' ? 'SDK выполняет переход' : 'не подтверждён'}.</Text>
              <Text style={styles.text}>Восстановление на Tecno: {recoveryReport.recoveryState === 'ready' ? 'включено'
                : recoveryReport.recoveryState === 'disabled' ? 'не включено'
                : recoveryReport.recoveryState === 'incomplete' ? 'настроено не полностью' : 'состояние неизвестно'}.</Text>
              <Text style={styles.note}>{recoveryReport.recoveryState === 'ready'
                ? 'Статус включён, но восстановление записи в чистой установке ещё не доказано.'
                : 'Это только чтение статуса. Ключи и настройки не менялись; возможность восстановить запись ещё не доказана.'}</Text>
            </View>}
            {recoveryReport?.serverBackupExists && recoveryReport.backupState === 'ready' &&
              recoveryReport.recoveryState === 'disabled' && diaryHistory.length === 2 && <View style={styles.recoveryStatus}>
                <Text style={styles.sectionTitle}>Подготовить восстановление</Text>
                <Text style={styles.text}>Сначала создай код и сохрани его вне Tecno. Он понадобится для чистой установки. В чате и на скриншотах код не присылай.</Text>
                <Pressable accessibilityRole="button" disabled={locked} onPress={() => void generateRecoveryCode()}
                  style={({ pressed }) => [styles.secondaryButton, (pressed || locked) && styles.muted]}>
                  <Text style={styles.secondaryText}>{recoveryCode ? 'Создать другой код' : 'Создать код восстановления'}</Text>
                </Pressable>
              </View>}
            {!!recoveryCode && <View style={styles.recoveryStatus}>
              <Text style={styles.label}>Код восстановления — сохрани вне Tecno</Text>
              <Text selectable style={styles.recoveryCode}>{recoveryCode.replace(/(.{8})(?=.)/g, '$1-')}</Text>
              <Text style={styles.note}>Дефисы нужны только для чтения. После перезапуска приложения код исчезнет с экрана. Сервер не получает его в открытом виде.</Text>
              {recoveryReport?.recoveryState === 'disabled' && <>
                <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: recoveryCodeSaved, disabled: locked }}
                  disabled={locked} onPress={() => setRecoveryCodeSaved(!recoveryCodeSaved)}
                  style={({ pressed }) => [styles.secondaryButton, (pressed || locked) && styles.muted]}>
                  <Text style={styles.secondaryText}>{recoveryCodeSaved ? '✓ Код сохранён вне Tecno' : '□ Я сохранил код вне Tecno'}</Text>
                </Pressable>
                {button('Включить восстановление', 'recovery-enable', !recoveryCodeSaved || !recoveryReport.serverBackupExists ||
                  recoveryReport.backupState !== 'ready' || diaryHistory.length !== 2)}
              </>}
              {recoveryReport?.recoveryState === 'ready' && <Text style={styles.success}>Восстановление включено. Код понадобится в отдельной чистой установке.</Text>}
            </View>}
          </View>}
          {group && !!userId && <View style={styles.card}>
            <Text style={styles.title}>Тестовая группа на троих</Text>
            <Text style={styles.text}>Tecno — первый аккаунт, iPad — второй. На Компьютере открой третий отдельный аккаунт Matrix. Используй только тестовые записи.</Text>
            <Text selectable style={styles.note}>iPad: {peerRoom?.peerUserId ?? 'сначала подготовь комнату с iPad в Диагностике'}</Text>
            {!groupRoom ? <>
              <Text style={styles.label}>Адрес третьего аккаунта на Компьютере</Text>
              <TextInput accessibilityLabel="Matrix-адрес третьего аккаунта" style={styles.input} value={computerUserId}
                onChangeText={setComputerUserId} placeholder="@третий:matrix.org" placeholderTextColor="#536178"
                autoCapitalize="none" autoCorrect={false} editable={!locked} />
              {button('Создать закрытую группу', 'group-prepare', !peerRoom || !computerUserId.trim())}
            </> : <>
              <Text selectable style={styles.note}>Компьютер: {groupRoom.computerUserId}{'\n'}Группа: {groupRoom.roomId}</Text>
              <Text style={styles.text}>Прими приглашение на iPad в Element X и на Компьютере в Element. Проверку можно продолжать, когда оба аккаунта вошли в группу.</Text>
              {button('Отправить тестовый звук всем', 'group-send')}
              {groupSent && <Text style={styles.success}>Тестовый звук зашифрован и загружен. Проверь, что его слышно на iPad и Компьютере.</Text>}
              <Text style={styles.text}>Затем отправь короткое голосовое с iPad и отдельный аудиофайл с Компьютера в эту группу. Кнопки ниже читают последнее аудио каждого аккаунта.</Text>
              {button('Получить аудио от iPad', 'group-ipad')}
              {button('Получить аудио от Компьютера', 'group-computer')}
              {groupReceived && <>
                <Text style={styles.success}>Сообщение расшифровано и файл проверен</Text>
                <Text style={styles.note}>Отправитель: {groupReceived.sender === 'ipad' ? 'iPad' : 'Компьютер'}</Text>
                <GroupAudioPreview key={groupReceived.report.playbackUri} uri={groupReceived.report.playbackUri}
                  label={groupReceived.sender === 'ipad' ? 'iPad' : 'Компьютера'} />
              </>}
            </>}
            <Text style={styles.note}>Это проверка отдельной группы. Личный дневник и комната Tecno ↔ iPad не меняются. Подтверждение личности третьего аккаунта проверим отдельно.</Text>
          </View>}
          {!!userId && !group && <VoiceTest locked={busy || restoring} networkLocked={stopping} diagnostics={diagnostics} diary={diary}
            diaryRoomReady={!!diaryRoomId} diaryHistory={diaryHistory} diarySharedEventId={diarySharedEventId}
            onSaveDiary={(draft, beforeUpload) => run('diary-save', draft, undefined, beforeUpload)}
            onOpenDiary={(eventId) => run('diary-open', undefined, eventId)}
            onShareDiary={(eventId) => run('diary-share', undefined, eventId).then(() => {})}
            peerUserId={peerRoom?.peerUserId}
            draftScope={peerRoom && deviceId ? { userId, serverUrl: server,
              deviceId, roomId: peerRoom.roomId, peerUserId: peerRoom.peerUserId }
              : diary && diaryRoomId && deviceId ? { userId, serverUrl: server,
                deviceId, roomId: diaryRoomId, peerUserId: userId } : null}
            onStatus={updateVoiceStatus} onSend={(draft, beforeUpload) => run('voice', draft, undefined, beforeUpload)} onReceive={() => run('receive-voice')}
            savedAudio={peerAudioRestartProbe} history={peerAudioHistory} ownHistory={ownAudioHistory} onOpenHistory={(eventId) => run('open-voice', undefined, eventId)}
            onReceiveMissed={() => run('missed-voice')}
            automaticStage={automaticWanted ? automaticStage || 'Подключаем автоприём голосовых' : 'Автоприём на паузе'}
            automaticError={automaticError} automaticRetryAllowed={automaticRetryAllowed}
            onRetryAutomatic={() => { automaticReceiver.current?.restart(); router.setParams({ section: 'devices' }); }} />}
          {diagnostics && !!userId && (
            <View style={styles.card}>
              <Text style={styles.title}>Звук для iPad</Text>
              <Text style={styles.text}>Повтор прежнего теста: два синтетических сигнала в зашифрованном аудиофайле.</Text>
              <Text selectable style={styles.note}>Аккаунт iPad: {peerRoom?.peerUserId ?? 'ещё не выбран в «Диагностике»'}</Text>
              {button('Отправить тестовый звук на iPad', 'audio', !peerRoom)}
              <Text style={styles.note}>Оставь приложение на Tecno открытым до результата. Затем послушай звук в Element X на iPad. Микрофон для этого теста не нужен.</Text>
            </View>
          )}
          {diagnostics && !!userId && (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Наши устройства</Text>
              <Text selectable style={styles.text}>Tecno — наше приложение{'\n'}Компьютер — Element, тот же аккаунт{'\n'}iPad — Element X, другой аккаунт</Text>
              <Text selectable style={styles.note}>Tecno и Компьютер: {userId}</Text>
              <Text style={styles.note}>Вход сохранён. Для записи, отправки и прослушивания вернись во вкладку «Голос».</Text>
            </View>
          )}
          {diagnostics && (
            <Link href="/sdk" asChild>
              <Pressable accessibilityRole="button" disabled={locked} style={StyleSheet.flatten([styles.secondaryButton, locked && styles.muted])}>
                <Text style={styles.secondaryText}>Открыть проверку SDK</Text>
              </Pressable>
            </Link>
          )}
          {(diagnostics || !userId) && <>
          <Text style={styles.title}>{userId ? 'Сохранённый аккаунт Tecno' : 'Вход в Matrix'}</Text>
          <Text style={styles.text}>{userId ? 'Здесь собраны прежние проверки и настройки тестового аккаунта.' : 'Войдите один раз. Приложение сохранит защищённую сессию для следующего запуска.'}</Text>
          {!userId && !restoring && (
            <Link href="https://account.matrix.org/register" asChild>
              <Pressable accessibilityRole="button" style={styles.secondaryButton}>
                <Text style={styles.secondaryText}>Создать тестовый аккаунт ↗</Text>
              </Pressable>
            </Link>
          )}
          <Text style={styles.label}>Адрес Matrix-сервера</Text>
          <TextInput
            ref={serverInput}
            onFocus={() => focusInput(serverInput.current)}
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => usernameInput.current?.focus()}
            accessibilityLabel="Адрес Matrix-сервера"
            style={styles.input} value={server} onChangeText={(value) => { setServer(value); setReport(null); }}
            autoCapitalize="none" autoCorrect={false} keyboardType="url" editable={!locked && !userId}
          />
          {button('Проверить связь без аккаунта', 'server', !!userId)}
          {!restoring && (!userId ? (
            <>
              <Text style={styles.label}>Имя пользователя</Text>
              <TextInput
                ref={usernameInput}
                onFocus={() => focusInput(usernameInput.current)}
                returnKeyType="next"
                submitBehavior="submit"
                onSubmitEditing={() => passwordInput.current?.focus()}
                accessibilityLabel="Имя пользователя тестового аккаунта"
                style={styles.input} value={username} onChangeText={setUsername} placeholder="@имя:matrix.org"
                autoCapitalize="none" autoCorrect={false} editable={!locked}
              />
              <Text style={styles.label}>Пароль тестового аккаунта</Text>
              <TextInput
                ref={passwordInput}
                onFocus={() => focusInput(passwordInput.current)}
                returnKeyType="done"
                onSubmitEditing={() => { if (!busy && username.trim() && password) void run('login'); }}
                accessibilityLabel="Пароль тестового аккаунта"
                style={styles.input} value={password} onChangeText={setPassword} secureTextEntry
                autoCapitalize="none" autoCorrect={false} editable={!locked}
              />
              <Text style={styles.note}>Пароль нужен только для первого входа. Вместо пароля приложение сохраняет защищённую сессию и локальные ключи шифрования.</Text>
              {button('Войти', 'login', restoreFailed || !username.trim() || !password)}
              <Link href="/recovery" asChild>
                <Pressable accessibilityRole="button" disabled={locked} style={styles.secondaryButton}>
                  <Text style={styles.secondaryText}>Проверить восстановление в отдельной установке</Text>
                </Pressable>
              </Link>
              {restoreFailed && (
                <>
                  <Pressable accessibilityRole="button" disabled={locked} onPress={() => void restoreSavedLogin(new AbortController())} style={styles.secondaryButton}>
                    <Text style={styles.secondaryText}>Повторить восстановление входа</Text>
                  </Pressable>
                  {button('Забыть сохранённый вход', 'forget')}
                  <Text style={styles.note}>Забыть вход — удалить с этого телефона сессию и её локальные ключи. После этого потребуется пароль. При ошибке связи сначала попробуйте восстановление ещё раз.</Text>
                </>
              )}
            </>
          ) : (
            <View style={styles.card}>
              <Text style={styles.success}>Вход выполнен</Text>
              <Text selectable style={styles.text}>{userId}</Text>
              <Text selectable style={styles.note}>Устройство Matrix: {deviceId}</Text>
              <Text style={styles.text}>Следующая кнопка создаст закрытую комнату без приглашений и отправит одно тестовое сообщение. Комната и сообщение останутся на сервере. Шифрование отключено для этого теста.</Text>
              {button('Отправить и получить тестовое сообщение', 'message')}
              <Text style={styles.text}>Для проверки шифрования создадим отдельную закрытую комнату без приглашений. SDK должен расшифровать сообщение, а сервер — вернуть это же событие в зашифрованном виде.</Text>
              {button('Проверить шифрование сообщения', 'encrypted')}
              <Text style={styles.note}>Только тестовый текст. Ключи сохраняются на этом телефоне. Перенос на другой телефон и восстановление из резервной копии пока не реализованы.</Text>
              <Text style={styles.sectionTitle}>Сообщение после перезапуска</Text>
              {!restartProbe ? (
                <Text style={styles.text}>Сначала нажмите «Проверить шифрование сообщения». Приложение запомнит это событие для проверки после перезапуска.</Text>
              ) : (
                <>
                  <Text selectable style={styles.note}>Запомненное событие: {restartProbe.eventId}{'\n'}Устройство: {restartProbe.deviceId}</Text>
                  <Text style={styles.text}>{restartProbe.requiresRestart
                    ? 'Сообщение запомнено. Полностью остановите приложение через настройки телефона и откройте снова. Не выходите из аккаунта и не очищайте данные.'
                    : 'Сохранённый вход открыт. Теперь можно прочитать прежнее сообщение без отправки нового. Перед чтением повторно проверять шифрование не нужно.'}</Text>
                </>
              )}
              {button('Прочитать сообщение после перезапуска', 'history', !restartProbe || restartProbe.requiresRestart)}
              <Text style={styles.sectionTitle}>Обмен с iPad</Text>
              <Text style={styles.text}>На iPad открыт Element X со вторым аккаунтом. Tecno и Компьютер используют первый аккаунт.</Text>
              <Link href="https://account.matrix.org/register" asChild>
                <Pressable accessibilityRole="button" style={styles.secondaryButton} disabled={locked}>
                  <Text style={styles.secondaryText}>Создать тестовый аккаунт для iPad ↗</Text>
                </Pressable>
              </Link>
              <Link href="https://apps.apple.com/app/id1631335820" asChild>
                <Pressable accessibilityRole="button" style={styles.secondaryButton} disabled={locked}>
                  <Text style={styles.secondaryText}>Element X для iPad ↗</Text>
                </Pressable>
              </Link>
              <Text style={styles.label}>Полный адрес аккаунта iPad</Text>
              <TextInput
                ref={peerInput} onFocus={() => focusInput(peerInput.current)}
                accessibilityLabel="Полный Matrix-адрес аккаунта iPad"
                style={styles.input} value={peerUserId}
                onChangeText={(value) => { setPeerUserId(value); setPeerReport(null); setTrustStatus(null); setTrustReport(null); }}
                placeholder="@второе_имя:matrix.org" placeholderTextColor="#536178"
                autoCapitalize="none" autoCorrect={false} editable={!locked} returnKeyType="done"
              />
              <Text style={styles.note}>Эта кнопка создаёт отдельную закрытую комнату и приглашает указанный аккаунт. Тестовая комната останется на сервере.</Text>
              {button('Создать комнату и пригласить', 'peer-room', !peerUserId.trim())}
              {peerRoom && (
                <>
                  <Text selectable style={styles.note}>Комната для {peerRoom.peerUserId}:{'\n'}{peerRoom.roomId}</Text>
                  <Text style={styles.text}>На iPad примите в Element X приглашение в «Matrix · проверка двух аккаунтов». Затем нажмите кнопку ниже на Tecno. На iPad скопируйте строку «Matrix ответ …» из полученного сообщения и отправьте её отдельным сообщением. Ожидание — до 5 минут; держите оба приложения открытыми.</Text>
                </>
              )}
              {button('Отправить тест и дождаться ответа', 'peer-exchange', !peerRoom || peerRoom.peerUserId !== peerUserId.trim())}
              <Text style={styles.sectionTitle}>Ответ после перезапуска Tecno</Text>
              {!peerRestartProbe ? (
                <Text style={styles.text}>После Reload повторите обмен и ответьте из Element X. Приложение запомнит новое событие ответа для этой проверки.</Text>
              ) : (
                <>
                  <Text selectable style={styles.note}>Ответ от {peerRestartProbe.senderUserId}{'\n'}Событие: {peerRestartProbe.eventId}</Text>
                  <Text style={styles.text}>{peerRestartProbe.requiresRestart
                    ? 'Ответ запомнен. Закройте Element X на iPad. Полностью остановите приложение на Tecno через настройки Android и откройте снова. Сохранённый вход и данные оставьте.'
                    : 'Сохранённый вход открыт. Теперь прочитайте запомненный ответ. Повторно отправлять тест и отвечать из Element X перед чтением не нужно.'}</Text>
                </>
              )}
              {button('Прочитать ответ после перезапуска', 'peer-history', !peerRestartProbe || peerRestartProbe.requiresRestart)}
              <Text style={styles.sectionTitle}>Подтверждение через Компьютер</Text>
              <Text style={styles.text}>Tecno и Компьютер используют один аккаунт. Для повторной проверки открой Element на Компьютере и сравни эмодзи на обоих экранах.</Text>
              <Text selectable style={styles.note}>Аккаунт на Компьютере: {userId}{'\n'}https://app.element.io</Text>
              {button('Подтвердить Tecno через Компьютер', 'trust-own')}
              <Text style={styles.sectionTitle}>Повторное подтверждение iPad</Text>
              <Text style={styles.text}>Если доверие уже подтверждено, заново сравнивать эмодзи не нужно. Для новой проверки открой Element X на iPad, прими запрос и сравни эмодзи.</Text>
              {button('Подтвердить iPad', 'trust-peer', !peerRoom)}
              {button('Проверить статус доверия', 'trust-status')}
              {button('Выйти из аккаунта', 'logout')}
              <Text style={styles.note}>«Выйти» завершает сессию на сервере и удаляет сохранённый вход, локальные ключи и неотправленный черновик. Простое закрытие приложения сохраняет вход и черновик.</Text>
            </View>
          ))}
          </>}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  page: { flex: 1, backgroundColor: '#f5f7fb' },
  content: { padding: 20, gap: 14, width: '100%', maxWidth: 640, alignSelf: 'center' },
  statusArea: { paddingHorizontal: 20, paddingTop: 12, width: '100%', maxWidth: 640, alignSelf: 'center' },
  statusCard: { borderRadius: 12, padding: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: '#dbe3ef' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  tabs: { flexDirection: 'row', gap: 8, marginTop: 12 },
  tab: { flex: 1, minHeight: 48, borderRadius: 10, borderWidth: 1, borderColor: '#b8c7dd', backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', padding: 6 },
  selectedTab: { backgroundColor: '#2059b0', borderColor: '#2059b0' },
  tabText: { fontSize: 14, fontWeight: '600', color: '#2059b0', textAlign: 'center' },
  selectedTabText: { color: '#fff' },
  statusText: { flex: 1, fontSize: 16, lineHeight: 23, fontWeight: '600', color: '#26364a' },
  title: { fontSize: 25, fontWeight: '700', color: '#14243b' },
  sectionTitle: { fontSize: 19, fontWeight: '700', color: '#14243b' },
  text: { fontSize: 16, lineHeight: 24, color: '#26364a' },
  label: { fontSize: 16, fontWeight: '600', color: '#26364a' },
  input: { minHeight: 52, borderWidth: 1, borderColor: '#77879d', borderRadius: 10, padding: 12, fontSize: 16, backgroundColor: '#fff', color: '#14243b' },
  button: { minHeight: 52, borderRadius: 12, backgroundColor: '#2059b0', justifyContent: 'center', alignItems: 'center', padding: 14 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600', textAlign: 'center' },
  secondaryButton: { minHeight: 52, borderRadius: 12, borderWidth: 1, borderColor: '#2059b0', justifyContent: 'center', alignItems: 'center', padding: 14 },
  secondaryText: { color: '#2059b0', fontSize: 16, fontWeight: '600', textAlign: 'center' },
  muted: { opacity: 0.55 },
  card: { borderRadius: 12, padding: 16, backgroundColor: '#fff', gap: 12 },
  recoveryStatus: { gap: 8 },
  recoveryCode: { fontFamily: 'monospace', fontSize: 18, lineHeight: 28, color: '#14243b' },
  success: { color: '#14623a', fontSize: 19, fontWeight: '700' },
  error: { color: '#a22525', fontSize: 16, lineHeight: 24 },
  errorTitle: { color: '#a22525', fontSize: 19, fontWeight: '700' },
  note: { color: '#536178', fontSize: 14, lineHeight: 21 },
  emojiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  emojiCell: { alignItems: 'center', width: 70, gap: 3 },
  emoji: { fontSize: 36, lineHeight: 48 },
  emojiDescription: { color: '#536178', fontSize: 12, textAlign: 'center' },
  decimals: { fontSize: 24, fontWeight: '700', color: '#14243b', textAlign: 'center' },
  link: { color: '#2059b0', fontSize: 16, lineHeight: 24, textDecorationLine: 'underline' },
});
