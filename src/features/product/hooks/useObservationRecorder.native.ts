import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { RecordingPresets, getRecordingPermissionsAsync, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder } from 'expo-audio';
import { emptyCapture, VoiceCapture } from '../../../matrix/voice-capture';
import type { CaptureState } from '../../../matrix/voice-capture';
import { discardVoiceFile } from '../../../matrix/voice-files.native';
import { voiceWaveform } from '../../../matrix/voice-types';
import { OBSERVATION_LIMIT_SECONDS } from '../state/model';

const options = { ...RecordingPresets.HIGH_QUALITY, numberOfChannels: 1, bitRate: 64_000, isMeteringEnabled: true };
export function useObservationRecorder(limitSeconds = OBSERVATION_LIMIT_SECONDS) {
  const machine = useRef<VoiceCapture | null>(null);
  const recorder = useAudioRecorder(options, status => {
    if (status.isFinished || status.hasError) machine.current?.nativeFinished(status.hasError, status.url);
  });
  const [state, setState] = useState<CaptureState>({ ...emptyCapture });
  const [liveWaveform, setLiveWaveform] = useState<number[]>([]);
  const [permissionReady, setPermissionReady] = useState(false);
  useEffect(() => { let active = true; void getRecordingPermissionsAsync().then(value => { if (active) setPermissionReady(value.granted); }); return () => { active = false; }; }, []);
  const requestPermission = useCallback(async () => { const value = await requestRecordingPermissionsAsync(); setPermissionReady(value.granted); return value.granted; }, []);
  const phase = useRef('idle');
  useEffect(() => {
    const capture = new VoiceCapture({ recorder, permission: async () => { const value = await requestRecordingPermissionsAsync(); setPermissionReady(value.granted); return value; },
      mode: recording => setAudioModeAsync({ allowsRecording: recording, allowsBackgroundRecording: false,
        shouldPlayInBackground: false, playsInSilentMode: true, shouldRouteThroughEarpiece: false, interruptionMode: 'doNotMix' }),
      foreground: () => AppState.currentState === 'active', discard: discardVoiceFile, changed: next => { phase.current = next.phase; setState(next); } }, limitSeconds);
    machine.current = capture;
    const appState = AppState.addEventListener('change', next => { if (next === 'background') void capture.cancel(); });
    return () => { appState.remove(); machine.current = null; void capture.dispose(); };
  }, [recorder, limitSeconds]);
  useEffect(() => {
    if (state.phase !== 'recording') return;
    const values: number[] = [];
    const timer = setInterval(() => {
      try {
        const metering = recorder.getStatus().metering;
        if (typeof metering === 'number' && Number.isFinite(metering)) {
          values.push(metering); setLiveWaveform(voiceWaveform(values.slice(-60)));
        }
      } catch { /* VoiceCapture owns recorder failures and publishes the error. */ }
    }, 200);
    return () => clearInterval(timer);
  }, [recorder, state.phase]);
  const start = useCallback(async () => { setLiveWaveform([]); await machine.current?.start(); }, []);
  const stop = useCallback(async () => { if (phase.current === 'preparing') await machine.current?.cancel(); else await machine.current?.stop(); }, []);
  const cancel = useCallback(async () => { await machine.current?.cancel(); setLiveWaveform([]); }, []);
  return { ...state, spectrum: undefined, permissionReady, requestPermission, waveform: state.draft?.waveform ?? liveWaveform, start, stop, cancel, clear: cancel,
    audioSource: undefined, limitSeconds, supported: true };
}
