import { Pressable, StyleSheet, View } from 'react-native';
import { useThemeColors } from '../ProductTheme';
import { useProduct } from '../state/ProductProvider';
import { Art } from '../motion/Art';
import { Reveal } from '../motion/Reveal';
import { RecordingGesture } from '../motion/RecordingGesture';
import { ObservationIcon } from '../ObservationControls';
import { PanelBorder } from '../PanelBorder';
import { DiaryGlass } from './DiaryGlass';
import { DiaryIcon } from './DiaryIcons';
import type { DiaryVoice } from './useDiaryVoice';

export function DiaryRecordButton({ voice, size, disabled }: { voice: DiaryVoice; size: number; disabled: boolean }) {
  const colors = useThemeColors(), { settings } = useProduct();
  const recording = voice.recorder.phase === 'recording';
  return <View testID="diary-record-button" style={{ width: size, height: size, flexShrink: 0, zIndex: 5 }}>
    {voice.capturing && <Reveal reducedMotion={settings.reducedMotion} style={styles.recordingArtwork}>
      <View pointerEvents="none" testID="diary-recording-orb" style={styles.orb}>
        <Art kind="voice" width={112} height={102} active voiceCompact mode={recording ? 'record' : 'idle'}
          audioSource={recording ? voice.recorder.audioSource : undefined} spectrum={voice.recorder.spectrum}
          level={recording ? voice.recorder.waveform.at(-1) ?? 0 : 0} reducedMotion={settings.reducedMotion} />
      </View>
      <Pressable testID="diary-recording-lock" accessibilityRole="button" accessibilityLabel={voice.locked ? 'Запись закреплена' : 'Закрепить запись'}
        accessibilityState={{ selected: voice.locked }} onPress={voice.lock} style={[styles.lock, { backgroundColor: colors.background }]}>
        <ObservationIcon name="lock" size={16} />
        <View style={{ opacity: voice.locked ? .35 : .5 + voice.lockProgress * .5, transform: [{ rotate: '-90deg' }, { translateX: voice.lockProgress * 5 }] }}><ObservationIcon name="arrow" size={16} /></View>
      </Pressable>
    </Reveal>}
    <RecordingGesture height={size} label={voice.locked ? 'Закончить запись' : 'Зажми и говори. Вверх — закрепить, влево — отменить'}
      disabled={disabled || voice.saving || voice.recorder.phase === 'stopping' || voice.review}
      onBegin={() => {}} onMove={() => {}} onBeginPoint={voice.begin} onMovePoint={voice.move}
      onEnd={() => { void voice.end(); }} onCancel={() => { void voice.cancelGesture(); }} onActivate={() => { void voice.activate(); }}>
      {!voice.capturing && <><DiaryGlass /><PanelBorder color={colors.accent} /></>}
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.center]}><DiaryIcon name={voice.locked ? 'stop' : 'lips'} size={16} /></View>
    </RecordingGesture>
  </View>;
}
const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  recordingArtwork: { position: 'absolute', bottom: 0, right: 0, width: 144, height: 176 },
  orb: { position: 'absolute', bottom: -27, right: -32, width: 112, height: 102 },
  lock: { position: 'absolute', right: 4, bottom: 76, width: 36, minHeight: 60, gap: 10, paddingVertical: 10, alignItems: 'center', justifyContent: 'center' },
});
