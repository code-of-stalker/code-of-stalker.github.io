import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useObservationRecorder } from '../hooks/useObservationRecorder';
import { useObservationPlayer } from '../hooks/useObservationPlayer';
import { DIARY_LIMIT_SECONDS, type DiaryCategory } from '../state/model';
import { useProduct } from '../state/ProductProvider';
import { createDiaryRecordingGesture } from './recording-gesture';

export function useDiaryVoice({ active, enabled, category, onSaved }: {
  active: boolean; enabled: boolean; category: DiaryCategory; onSaved(): void;
}) {
  const recorder = useObservationRecorder(DIARY_LIMIT_SECONDS), player = useObservationPlayer(recorder.draft?.uri ?? null);
  const { saveDiaryVoice } = useProduct();
  const [locked, setLocked] = useState(false), [lockProgress, setLockProgress] = useState(0), [cancelProgress, setCancelProgress] = useState(0);
  const [hint, setHint] = useState(''), [error, setError] = useState(''), [saving, setSaving] = useState(false);
  const takeCategory = useRef(category), pending = useRef(false), alive = useRef(true);
  const snapshot = useRef({ recorder, player, active, enabled, category, saving, locked, onSaved });
  useLayoutEffect(() => { snapshot.current = { recorder, player, active, enabled, category, saving, locked, onSaved }; });
  // Callbacks run on pointer/accessibility input, never while rendering.
  // eslint-disable-next-line react-hooks/refs
  const [gesture] = useState(() => createDiaryRecordingGesture({
    start: async () => { const s = snapshot.current; takeCategory.current = s.category; setError(''); s.player.pause(); await s.recorder.start(); },
    stop: () => snapshot.current.recorder.stop(), cancel: () => snapshot.current.recorder.cancel(), phase: () => snapshot.current.recorder.phase,
    canBegin: () => { const s = snapshot.current; return s.active && s.enabled && !s.saving && ['idle', 'error'].includes(s.recorder.phase); },
    permissionReady: () => snapshot.current.recorder.permissionReady, requestPermission: () => snapshot.current.recorder.requestPermission(),
    progress: (value, fixed) => { setLockProgress(value); setLocked(fixed); }, cancelProgress: setCancelProgress, hint: setHint,
  }));
  useEffect(() => { if (['idle', 'ready', 'error'].includes(recorder.phase)) gesture.reset(); }, [gesture, recorder.phase]);
  const cancel = recorder.cancel, pause = player.pause;
  useEffect(() => { if (!active) { pause(); void cancel(); } }, [active, cancel, pause]);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const activate = useCallback(async () => {
    const s = snapshot.current;
    if (!s.active || !s.enabled || s.saving || ['ready', 'stopping'].includes(s.recorder.phase)) return;
    if (['recording', 'preparing'].includes(s.recorder.phase)) { await s.recorder.stop(); return; }
    takeCategory.current = s.category; setError(''); setHint(''); s.player.pause();
    setLocked(true); await s.recorder.start();
  }, []);
  const begin = useCallback((x: number, y: number) => {
    const s = snapshot.current;
    if (s.locked && ['recording', 'preparing'].includes(s.recorder.phase)) void s.recorder.stop();
    else if (s.active && s.enabled) void gesture.begin(x, y);
  }, [gesture]);
  const save = useCallback(async () => {
    const s = snapshot.current; if (!s.recorder.draft || pending.current) return;
    pending.current = true; setSaving(true); setError(''); s.player.pause();
    try { await saveDiaryVoice(s.recorder.draft, takeCategory.current); await s.recorder.clear(); if (alive.current) s.onSaved(); }
    catch (problem) { if (alive.current) setError(problem instanceof Error ? problem.message : 'Запись не сохранена. Попробуй ещё раз.'); }
    finally { pending.current = false; if (alive.current) setSaving(false); }
  }, [saveDiaryVoice]);
  const discard = useCallback(async () => { snapshot.current.player.pause(); setError(''); setHint(''); gesture.reset(); await snapshot.current.recorder.cancel(); }, [gesture]);
  return { recorder, player, locked, lockProgress, cancelProgress, hint, error: error || recorder.error, saving, begin, move: gesture.move, end: gesture.end, cancelGesture: gesture.cancel, lock: gesture.lock, activate, save, discard,
    capturing: ['preparing', 'recording', 'stopping'].includes(recorder.phase), review: recorder.phase === 'ready' && !!recorder.draft };
}
export type DiaryVoice = ReturnType<typeof useDiaryVoice>;
