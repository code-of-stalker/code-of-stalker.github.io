import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useIsFocused } from 'expo-router';
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';

export function useObservationPlayer(uri: string | null) {
  const focused = useIsFocused();
  const player = useAudioPlayer(uri ? { uri } : null, { updateInterval: 200 });
  const status = useAudioPlayerStatus(player);
  const [volume,setVolumeState]=useState(1);
  useEffect(()=>{
    // Apply the selected level to a replacement native player as well.
    // eslint-disable-next-line react-hooks/immutability
    player.volume=volume;
  },[player,volume]);
  const [failure, setFailure] = useState<{ uri: string | null; message: string }>({ uri: null, message: '' });
  const [timedOutUri, setTimedOutUri] = useState<string | null>(null);
  const alive = useRef(true), pending = useRef(false);
  useEffect(() => {
    alive.current = true;
    const subscription = AppState.addEventListener('change', state => { if (state !== 'active') { try { player.pause(); } catch {} } });
    return () => { alive.current = false; subscription.remove(); };
  }, [player]);
  useEffect(() => {
    if (!uri || status.isLoaded) return;
    const timeout = setTimeout(() => setTimedOutUri(uri), 8000);
    return () => clearTimeout(timeout);
  }, [uri, status.isLoaded]);
  const pause = useCallback(() => { try { player.pause(); } catch {} }, [player]);
  useEffect(() => { if (!focused) pause(); }, [focused, pause]);
  const play = useCallback(async () => {
    if (!focused || !uri || !status.isLoaded || pending.current || status.error) return;
    pending.current = true; setFailure({ uri, message: '' });
    try {
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true, shouldPlayInBackground: false,
        shouldRouteThroughEarpiece: false, interruptionMode: 'doNotMix' });
      if (status.didJustFinish || status.currentTime >= status.duration - 0.1) await player.seekTo(0);
      if (alive.current && AppState.currentState === 'active') player.play();
    } catch { if (alive.current) setFailure({ uri, message: 'Не удалось воспроизвести запись.' }); }
    finally { pending.current = false; }
  }, [focused, player, status.currentTime, status.didJustFinish, status.duration, status.error, status.isLoaded, uri]);
  const toggle = useCallback(async () => { if (status.playing) pause(); else await play(); }, [pause, play, status.playing]);
  const setMuted = useCallback((value: boolean) => {
    // Expo Audio's SharedObject exposes muted as a native mutable setter.
    // eslint-disable-next-line react-hooks/immutability
    player.muted = value;
  }, [player]);
  const setVolume=useCallback((value:number)=>{
    if(!Number.isFinite(value))return;
    const next=Math.max(0,Math.min(1,value));
    // Expo Audio's documented mutable playback property (SDK57).
    // eslint-disable-next-line react-hooks/immutability
    player.volume=next;setVolumeState(next);
  },[player]);
  // The web adapter can report isLoaded for a player with no source. A caller
  // must wait for its decrypted URI before consuming an automatic play request.
  return { playing: status.playing, loaded: !!uri && status.isLoaded, loading: !!uri && !status.isLoaded,
    muted: status.mute, setMuted, volume, setVolume,
    durationMs: Math.round(status.duration * 1000), positionMs: Math.round(status.currentTime * 1000),
    error: (failure.uri === uri ? failure.message : '') || (status.error ? 'Не удалось открыть аудиофайл.' : !!uri && timedOutUri === uri && !status.isLoaded ? 'Аудиофайл не открылся. Попробуй снова.' : ''),
    play, pause, toggle, seekTo: (seconds: number) => Number.isFinite(seconds) && seconds >= 0 ? player.seekTo(seconds) : Promise.resolve() };
}
