import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { discardIncomingAudio } from '../../matrix/incoming-audio-files.native';

export default function GroupAudioPreview({ uri, label }: { uri: string; label: string }) {
  const player = useAudioPlayer({ uri }, { updateInterval: 200 });
  const status = useAudioPlayerStatus(player);
  const [error, setError] = useState('');
  useEffect(() => () => { try { player.pause(); } catch {} discardIncomingAudio(uri); }, [player, uri]);
  async function toggle() {
    if (!status.isLoaded || status.error) return;
    try {
      if (status.playing) { player.pause(); return; }
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true,
        shouldPlayInBackground: false, shouldRouteThroughEarpiece: false, interruptionMode: 'doNotMix' });
      if (status.didJustFinish || status.currentTime >= status.duration - 0.1) await player.seekTo(0);
      player.play();
    } catch { setError('Не удалось воспроизвести запись.'); }
  }
  return <View style={styles.box}>
    <Pressable accessibilityRole="button" disabled={!status.isLoaded || !!status.error} onPress={() => void toggle()}
      style={[styles.button, (!status.isLoaded || !!status.error) && styles.muted]}>
      <Text style={styles.buttonText}>{status.playing ? 'Пауза' : `Слушать аудио от ${label}`}</Text>
    </Pressable>
    <Text style={styles.note}>{status.isLoaded ? `${Math.floor(status.currentTime)} / ${Math.ceil(status.duration)} с` : 'Открываем запись…'}</Text>
    {!!(error || status.error) && <Text style={styles.error}>{error || 'Плеер не смог открыть запись.'}</Text>}
  </View>;
}

const styles = StyleSheet.create({
  box: { gap: 10 }, button: { backgroundColor: '#2059b0', borderRadius: 14, padding: 16, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: '700' }, muted: { opacity: 0.5 },
  note: { color: '#536178', fontSize: 14 }, error: { color: '#943232', fontSize: 16 },
});
