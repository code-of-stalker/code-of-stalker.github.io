import { useCallback, useEffect, useRef, useState } from 'react';
import type { ObservationDraft } from '../state/model';
import { OBSERVATION_LIMIT_SECONDS, validateObservationDraft } from '../state/model';
import { voiceWaveform } from '../../../matrix/voice-types';
import { measureVoiceSpectrum, silentBands } from '../audio/spectrum';
import { createVoiceSignal } from '../audio/voice-signal';
import { blockWebUpdate } from '../updates/webUpdateSafety';
import { useProduct } from '../state/ProductProvider';
import { createMicrophoneSignalMonitor, microphoneError, openMicrophone } from '../audio/microphone-input';

type State = { phase: 'idle' | 'preparing' | 'recording' | 'stopping' | 'ready' | 'error'; durationMs: number; draft: ObservationDraft | null; error: string };
const initial: State = { phase: 'idle', durationMs: 0, draft: null, error: '' };
function supportedMime() {
  if (typeof MediaRecorder === 'undefined') return 'audio/webm';
  return ['audio/webm', 'audio/mp4', 'audio/ogg'].find(type => MediaRecorder.isTypeSupported(type)) ?? 'audio/webm';
}
// Own the browser stream: a late permission grant must release every track
// without starting a recording after cancellation or navigation.
export function useObservationRecorder(limitSeconds = OBSERVATION_LIMIT_SECONDS) {
  const { settings } = useProduct();
  const selectedInput = settings.microphoneDeviceId ?? '';
  const [inputLabel, setInputLabel] = useState('');
  const [mimeType] = useState(supportedMime), [state, setState] = useState<State>(initial);
  const [waveform, setWaveform] = useState<number[]>([]);
  const [audioSource] = useState(createVoiceSignal);
  const [permissionReady, setPermissionReady] = useState(false);
  const permissionJob = useRef<Promise<boolean> | null>(null);
  const alive = useRef(true), generation = useRef(0), preparing = useRef(false);
  const current = useRef<State>(initial), ownedUri = useRef<string | null>(null), startedAt = useRef(0);
  const media = useRef<MediaRecorder | null>(null), stream = useRef<MediaStream | null>(null);
  const context = useRef<AudioContext | null>(null), finish = useRef<Promise<void> | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const visualFrame = useRef<number | null>(null);
  const releaseUpdate = useRef<(() => void) | null>(null);
  const supported = typeof window !== 'undefined' && !!globalThis.navigator?.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined';
  const publish = useCallback((next: State) => {
    if (next.phase !== 'idle' && next.phase !== 'error') releaseUpdate.current ??= blockWebUpdate();
    else { releaseUpdate.current?.(); releaseUpdate.current = null; }
    current.current = next; if (alive.current) setState(next);
  }, []);
  const releaseUri = useCallback(() => { if (ownedUri.current) URL.revokeObjectURL(ownedUri.current); ownedUri.current = null; }, []);
  const releaseStream = useCallback(() => {
    if (timer.current) clearInterval(timer.current); timer.current = null;
    if (visualFrame.current !== null) cancelAnimationFrame(visualFrame.current); visualFrame.current = null;
    audioSource.publish(silentBands);
    stream.current?.getTracks().forEach(track => track.stop()); stream.current = null;
    const previous = context.current; context.current = null;
    if (previous && previous.state !== 'closed') void previous.close().catch(() => {});
  }, [audioSource]);
  const stop = useCallback(async () => {
    if (preparing.current) { ++generation.current; releaseStream(); publish(initial); return; }
    const recorder = media.current;
    if (!recorder || recorder.state !== 'recording') return;
    publish({ ...current.current, phase: 'stopping' }); recorder.stop(); await finish.current;
  }, [publish, releaseStream]);
  const requestPermission = useCallback(() => {
    if (permissionJob.current) return permissionJob.current;
    if (!supported) { publish({ ...initial, phase: 'error', error: 'Для микрофона открой приложение через HTTPS в браузере.' }); return Promise.resolve(false); }
    const token = ++generation.current;
    publish({ ...initial, phase: 'preparing' });
    const job = openMicrophone(navigator.mediaDevices, selectedInput, () => alive.current && token === generation.current).then(opened => {
      opened.stream.getTracks().forEach(track => track.stop());
      if (!alive.current || token !== generation.current) return false;
      setInputLabel(opened.label);
      setPermissionReady(true);
      if (token === generation.current) publish(initial);
      return true;
    }).catch(problem => {
      if (alive.current && token === generation.current) publish({ ...initial, phase: 'error', error: microphoneError(problem) });
      return false;
    }).finally(() => { permissionJob.current = null; });
    permissionJob.current = job; return job;
  }, [supported, publish, selectedInput]);
  const start = useCallback(async () => {
    if (preparing.current || media.current) return;
    if (!supported) { publish({ ...initial, phase: 'error', error: 'Микрофон доступен в современном браузере через HTTPS или localhost.' }); return; }
    const token = ++generation.current;
    preparing.current = true; releaseUri(); setWaveform([]); publish({ ...initial, phase: 'preparing' });
    try {
      // Unlock Web Audio in the initiating gesture, before the permission prompt.
      // The analyser never connects to the speakers (no microphone feedback).
      let audioContext: AudioContext | null = null;
      if (typeof AudioContext !== 'undefined') {
        try { audioContext = new AudioContext(); context.current = audioContext; void audioContext.resume().catch(() => {}); }
        catch { /* Capture is still available without a visual analyser. */ }
      }
      const input = await openMicrophone(navigator.mediaDevices, selectedInput, () => alive.current && token === generation.current);
      const opened = input.stream;
      if (alive.current) setPermissionReady(true);
      if (!alive.current || token !== generation.current) { opened.getTracks().forEach(track => track.stop()); return; }
      stream.current = opened;
      setInputLabel(input.label);
      const recorder = new MediaRecorder(opened, { mimeType, audioBitsPerSecond: 64_000 }); media.current = recorder;
      const chunks: Blob[] = [], levels: number[] = [];
      const signal = createMicrophoneSignalMonitor();
      const track = opened.getAudioTracks()[0];
      let disconnected = false;
      track.addEventListener('ended', () => { disconnected = true; if (recorder.state === 'recording') { publish({ ...current.current, phase: 'stopping' }); recorder.stop(); } });
      let analyser: AnalyserNode | null = null, buffer: Float32Array<ArrayBuffer> | null = null;
      if (audioContext && audioContext.state !== 'closed') {
        try {
          analyser = audioContext.createAnalyser(); analyser.fftSize = 2048; analyser.smoothingTimeConstant = 0.35;
          audioContext.createMediaStreamSource(opened).connect(analyser); buffer = new Float32Array(analyser.fftSize);
          void audioContext.resume().catch(() => {});
        } catch { /* Recording still works if metering is unavailable. */ }
      }
      let resolveFinish: () => void = () => {};
      finish.current = new Promise(resolve => { resolveFinish = resolve; });
      recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      recorder.onerror = () => {
        if (media.current !== recorder) { opened.getTracks().forEach(track => track.stop()); resolveFinish(); return; }
        ++generation.current; media.current = null; releaseStream();
        publish({ ...initial, phase: 'error', error: 'Браузер прервал запись. Попробуй ещё раз.' }); resolveFinish();
      };
      recorder.onstop = () => {
        const durationMs = Math.min((limitSeconds + 1) * 1000, Math.round(Date.now() - startedAt.current));
        if (media.current === recorder) { media.current = null; releaseStream(); }
        else opened.getTracks().forEach(track => track.stop());
        try {
          if (!alive.current || token !== generation.current) return;
          const blob = new Blob(chunks, { type: recorder.mimeType || mimeType });
          if (!blob.size) throw new Error('Браузер не вернул звук. Попробуй ещё раз.');
          const uri = URL.createObjectURL(blob); ownedUri.current = uri;
          const draft: ObservationDraft = { uri, durationMs, waveform: voiceWaveform(levels), mimeType: blob.type };
          validateObservationDraft(draft, limitSeconds); publish({ phase: 'ready', durationMs, draft, error: disconnected
            ? 'Микрофон отключился. Можно сохранить записанную часть или записать снова.'
            : signal.silent() ? 'В записи не обнаружен звук. Проверь источник в настройках и запиши снова.' : '' });
        } catch (problem) { releaseUri(); publish({ ...initial, phase: 'error', error: problem instanceof Error ? problem.message : 'Не удалось завершить запись.' }); }
        finally { resolveFinish(); }
      };
      startedAt.current = Date.now(); recorder.start(); publish({ ...initial, phase: 'recording' });
      if (analyser && audioContext) {
        const meter = analyser, sampleRate = audioContext.sampleRate;
        const frequencies = new Float32Array(meter.frequencyBinCount);
        let lastFrame = 0;
        const draw = (time: number) => {
          if (!alive.current || token !== generation.current || recorder.state !== 'recording') return;
          if (time - lastFrame >= 1000 / 30) {
            lastFrame = time; meter.getFloatFrequencyData(frequencies);
            audioSource.publish(measureVoiceSpectrum(frequencies, sampleRate, meter.fftSize));
          }
          visualFrame.current = requestAnimationFrame(draw);
        };
        visualFrame.current = requestAnimationFrame(draw);
      }
      timer.current = setInterval(() => {
        const durationMs = Math.min(limitSeconds * 1000, Date.now() - startedAt.current);
        if (analyser && buffer) {
          analyser.getFloatTimeDomainData(buffer);
          const rms = Math.sqrt(buffer.reduce((sum, sample) => sum + sample * sample, 0) / buffer.length);
          if (audioContext?.state === 'running') signal.sample(rms);
          levels.push(rms ? 20 * Math.log10(rms) : -160);
          if (alive.current) setWaveform(voiceWaveform(levels));
        }
        if (current.current.phase === 'recording') publish({ ...current.current, durationMs, error: signal.warning(durationMs) });
        if (durationMs >= limitSeconds * 1000) void stop();
      }, 200);
    } catch (problem) {
      media.current = null; releaseStream();
      if (token === generation.current) publish({ ...initial, phase: 'error', error: microphoneError(problem) });
    } finally { preparing.current = false; }
  }, [audioSource, limitSeconds, mimeType, publish, releaseStream, releaseUri, stop, supported, selectedInput]);
  const cancel = useCallback(async () => {
    ++generation.current;
    const recorder = media.current;
    if (recorder?.state === 'recording') { recorder.stop(); await finish.current; }
    releaseStream(); releaseUri(); if (alive.current) setWaveform([]); publish(initial);
  }, [publish, releaseStream, releaseUri]);
  useEffect(() => {
    alive.current = true;
    let permission: PermissionStatus | undefined;
    const changed = () => setPermissionReady(permission?.state === 'granted');
    void navigator.permissions?.query({ name: 'microphone' as PermissionName }).then(value => {
      if (!alive.current) return;
      permission = value; changed(); permission.addEventListener('change', changed);
    }).catch(() => {});
    const hidden = () => { if (document.visibilityState === 'hidden') void cancel(); };
    document.addEventListener('visibilitychange', hidden);
    return () => { alive.current = false; permission?.removeEventListener('change', changed); document.removeEventListener('visibilitychange', hidden); void cancel(); };
  }, [cancel]);
  return { ...state, inputLabel, spectrum: undefined, audioSource, permissionReady, requestPermission, waveform: state.draft?.waveform ?? waveform, start, stop, cancel, clear: cancel,
    limitSeconds, supported };
}
