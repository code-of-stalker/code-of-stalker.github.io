import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { DiaryGlass } from './DiaryGlass';
import { PanelBorder } from '../PanelBorder';
import { useObservationPlayer } from '../hooks/useObservationPlayer';
import { useProduct } from '../state/ProductProvider';
import type { AudioRecord } from '../state/model';
import { useThemeColors } from '../ProductTheme';
import { ProductText } from '../ui';
import { VolumeSlider } from '../VolumeSlider';
import { DiaryIcon } from './DiaryIcons';
import { diaryClock } from './feed';

export const DiaryWaveform = memo(function DiaryWaveform({ waveform, positionMs = 0, durationMs, onSeek }: {
  waveform: readonly number[]; positionMs?: number; durationMs: number; onSeek?(ms: number): void;
}) {
  const colors = useThemeColors(), timeline = useRef<View>(null);
  const bars = useMemo(() => Array.from({ length: 32 }, (_, i) => {
    const from = Math.floor(i * waveform.length / 32), to = Math.max(from + 1, Math.floor((i + 1) * waveform.length / 32));
    return Math.max(.02, ...waveform.slice(from, to));
  }), [waveform]);
  const progress = Math.min(1, positionMs / Math.max(1, durationMs));
  return <View ref={timeline} style={styles.timeline}>
    <Pressable accessibilityRole={onSeek ? 'adjustable' : 'progressbar'} accessibilityLabel="Позиция в записи"
      accessibilityValue={{ min: 0, max: durationMs, now: Math.min(positionMs, durationMs), text: `${diaryClock(positionMs)} из ${diaryClock(durationMs)}` }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={event => onSeek?.(Math.max(0, Math.min(durationMs, positionMs + (event.nativeEvent.actionName === 'increment' ? 10000 : -10000))))}
      disabled={!onSeek} onPress={event => { const x = event.nativeEvent.pageX; timeline.current?.measureInWindow((left, _y, width) => { if (width > 0) onSeek?.(Math.max(0, Math.min(1, (x - left) / width)) * durationMs); }); }}
      style={styles.waveform}>
      {bars.map((level, i) => <View key={i} style={{ width: 1, height: 3 + level * 25, backgroundColor: i / bars.length < progress ? colors.accent : colors.muted, opacity: i / bars.length < progress ? 1 : .65 }} />)}
    </Pressable>
    <ProductText style={[styles.time, { color: colors.muted }]}>{diaryClock(positionMs)} / {diaryClock(durationMs)}</ProductText>
  </View>;
});

export function DiaryAudio({ record, active, onActivate }: { record: AudioRecord; active: boolean; onActivate(): void }) {
  return active ? <LoadedDiaryAudio record={record} /> : <View style={styles.row}>
    <Pressable accessibilityRole="button" accessibilityLabel="Слушать запись" onPress={onActivate} style={styles.play}><DiaryGlass /><PanelBorder /><DiaryIcon name="play" /></Pressable>
    <DiaryWaveform waveform={record.waveform} durationMs={record.durationMs} />
  </View>;
}
function LoadedDiaryAudio({ record }: { record: AudioRecord }) {
  const { loadPlayback, discardPlayback } = useProduct();
  const [uri, setUri] = useState<string | null>(null), [error, setError] = useState(''), [attempt, setAttempt] = useState(0);
  const player = useObservationPlayer(uri), started = useRef(false);
  const [volumeOpen, setVolumeOpen] = useState(false);
  useEffect(() => {
    let live = true, owned: string | null = null;
    void loadPlayback(record.id).then(value => { owned = value; if (live) setUri(value); else discardPlayback(value); })
      .catch(problem => { if (live) setError(problem instanceof Error ? problem.message : 'Не удалось открыть запись.'); });
    return () => { live = false; if (owned) discardPlayback(owned); };
  }, [record.id, loadPlayback, discardPlayback, attempt]);
  const play = player.play;
  useEffect(() => { if (player.loaded && !started.current) { started.current = true; void play(); } }, [player.loaded, play]);
  const problem = error || player.error;
  return <View style={styles.player}>
    <View style={styles.row}>
      <Pressable accessibilityRole="button" accessibilityLabel={problem ? 'Повторить загрузку записи' : player.playing ? 'Пауза' : 'Слушать запись'} disabled={!problem && !player.loaded}
        onPress={() => { if (problem) { started.current = false; setUri(null); setError(''); setAttempt(value => value + 1); } else void player.toggle(); }} style={styles.play}>
        <DiaryGlass /><PanelBorder />{problem || !player.loaded ? <ProductText>{problem ? '↻' : '···'}</ProductText> : <DiaryIcon name={player.playing ? 'pause' : 'play'} />}
      </Pressable>
      <DiaryWaveform waveform={record.waveform} durationMs={record.durationMs} positionMs={player.positionMs} onSeek={player.loaded ? ms => { void player.seekTo(ms / 1000); } : undefined} />
      <Pressable accessibilityRole="button" accessibilityLabel="Громкость записи" accessibilityState={{ expanded: volumeOpen }} onPress={() => setVolumeOpen(value => !value)} style={styles.sound}><DiaryIcon name="sound" size={18} /></Pressable>
    </View>
    {player.loaded && <View style={styles.transport}>
      <Pressable accessibilityRole="button" accessibilityLabel="Назад на 10 секунд" onPress={() => { void player.seekTo(Math.max(0, player.positionMs / 1000 - 10)); }} style={styles.seek}><DiaryIcon name="rewind" /></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Вперёд на 10 секунд" onPress={() => { void player.seekTo(Math.min(record.durationMs / 1000, player.positionMs / 1000 + 10)); }} style={styles.seek}><DiaryIcon name="fastForward" /></Pressable>
    </View>}
    {volumeOpen && <View style={styles.row}><VolumeSlider value={player.volume} onChange={player.setVolume} /><ProductText style={styles.small}>{Math.round(player.volume * 100)}%</ProductText></View>}
    {!!problem && <ProductText accessibilityRole="alert" style={styles.problem}>{problem}</ProductText>}
  </View>;
}
const styles = StyleSheet.create({
  player: { gap: 4 }, row: { flexDirection: 'row', alignItems: 'center', gap: 10 }, play: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  timeline: { flex: 1, minWidth: 0 }, waveform: { height: 34, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, time: { fontSize: 8, lineHeight: 12 },
  sound: { width: 32, height: 44, justifyContent: 'center', alignItems: 'center' }, transport: { flexDirection: 'row', justifyContent: 'center', gap: 20 }, seek: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' }, small: { fontSize: 8, lineHeight: 12 }, problem: { fontSize: 10, lineHeight: 16 },
});
