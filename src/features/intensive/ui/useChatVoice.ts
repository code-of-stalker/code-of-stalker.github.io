import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createDiaryRecordingGesture } from '../../product/diary/recording-gesture';
import { useObservationRecorder } from '../../product/hooks/useObservationRecorder';
import type { VoiceDraft } from '../session';
import { useFormal } from './parts';

export const VOICE_LIMIT_SECONDS = 3 * 60;
/** Speech stays clear at this rate, and three minutes fit one request. */
const VOICE_BITS = 24_000;
const MAX_AUDIO_BYTES = 1_100_000;

/**
 * Voice messages with the diary's hold gesture: hold and speak, slide up to lock,
 * slide left to cancel. A finished recording goes out at once, as in messengers.
 */
export function useChatVoice({ active, enabled, onRecorded }: { active: boolean; enabled: boolean; onRecorded(voice: VoiceDraft): void }) {
  const recorder = useObservationRecorder(VOICE_LIMIT_SECONDS, VOICE_BITS);
  const [locked, setLocked] = useState(false), [lockProgress, setLockProgress] = useState(0), [cancelProgress, setCancelProgress] = useState(0);
  const [hint, setHint] = useState(''), [error, setError] = useState(''), [saving, setSaving] = useState(false);
  const alive = useRef(true), handled = useRef<string | null>(null);
  const formal = useFormal();
  const snapshot = useRef({ recorder, active, enabled, saving, locked, onRecorded, formal });
  useLayoutEffect(() => { snapshot.current = { recorder, active, enabled, saving, locked, onRecorded, formal }; });
  // Callbacks run on pointer/accessibility input, never while rendering.
  // eslint-disable-next-line react-hooks/refs
  const [gesture] = useState(() => createDiaryRecordingGesture({
    start: async () => { setError(''); await snapshot.current.recorder.start(); },
    stop: () => snapshot.current.recorder.stop(), cancel: () => snapshot.current.recorder.cancel(), phase: () => snapshot.current.recorder.phase,
    canBegin: () => { const s = snapshot.current; return s.active && s.enabled && !s.saving && ['idle', 'error'].includes(s.recorder.phase); },
    permissionReady: () => snapshot.current.recorder.permissionReady, requestPermission: () => snapshot.current.recorder.requestPermission(),
    progress: (value, fixed) => { setLockProgress(value); setLocked(fixed); }, cancelProgress: setCancelProgress, hint: setHint,
  }));
  useEffect(() => { if (['idle', 'ready', 'error'].includes(recorder.phase)) gesture.reset(); }, [gesture, recorder.phase]);
  const cancel = recorder.cancel;
  useEffect(() => { if (!active) void cancel(); }, [active, cancel]);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  const draft = recorder.draft;
  useEffect(() => {
    if (!draft || handled.current === draft.uri) return;
    handled.current = draft.uri;
    setSaving(true);
    void (async () => {
      try {
        const audio = new Uint8Array(await (await fetch(draft.uri)).arrayBuffer());
        if (audio.byteLength > MAX_AUDIO_BYTES) throw new Error(snapshot.current.formal ? 'Запись слишком большая. Запишите покороче.' : 'Запись слишком большая. Запиши покороче.');
        if (alive.current) snapshot.current.onRecorded({ audio, durationMs: draft.durationMs, waveform: draft.waveform, mimeType: draft.mimeType ?? 'audio/webm' });
      } catch (problem) {
        if (alive.current) setError(problem instanceof Error ? problem.message : 'Не удалось подготовить запись.');
      } finally {
        await snapshot.current.recorder.clear();
        if (alive.current) setSaving(false);
      }
    })();
  }, [draft]);

  const activate = useCallback(async () => {
    const s = snapshot.current;
    if (!s.active || !s.enabled || s.saving || ['ready', 'stopping'].includes(s.recorder.phase)) return;
    if (['recording', 'preparing'].includes(s.recorder.phase)) { await s.recorder.stop(); return; }
    setError(''); setHint(''); setLocked(true); await s.recorder.start();
  }, []);
  const begin = useCallback((x: number, y: number) => {
    const s = snapshot.current;
    if (s.locked && ['recording', 'preparing'].includes(s.recorder.phase)) void s.recorder.stop();
    else if (s.active && s.enabled) void gesture.begin(x, y);
  }, [gesture]);
  const discard = useCallback(async () => { setError(''); setHint(''); gesture.reset(); await snapshot.current.recorder.cancel(); }, [gesture]);

  return {
    recorder, locked, lockProgress, cancelProgress, hint, error: error || recorder.error, saving,
    begin, move: gesture.move, end: gesture.end, cancelGesture: gesture.cancel, lock: gesture.lock, activate, discard,
    capturing: ['preparing', 'recording', 'stopping'].includes(recorder.phase), review: false,
  };
}
