import { useMemo, useRef, useState } from 'react';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';
import type { GestureResponderEvent } from 'react-native';
import { useThemeColors, useThemeStyles } from './ProductTheme';
import type { ProductColors } from './theme';
import { ProductText } from './ui';
import { panelAsset } from './panelAssets';
import { GlassHost } from './motion/GlassHost';
import { PanelBorder } from './PanelBorder';
import { VolumeSlider } from './VolumeSlider';
import { PanelArtwork } from './motion/PanelArtwork';
import { PanelScan } from './motion/PanelScan';

const contour = (w: number, h: number) => `M.125 .125H${w-.125}V${h-.125}H.125Z`;
const clock = (ms: number) => { const seconds = Math.max(0, Math.floor(ms / 1000)); return `${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`; };

/** Figma 1130:41841; waveform and position come from the current audio draft. */
export function RecordingReview({ waveform, positionMs, durationMs, playing, loaded, muted, volume, saving, error, reducedMotion, onPlay, onSeek, onMute, onVolume, onSave, onRecordAgain }: {
  waveform: readonly number[]; positionMs: number; durationMs: number; playing: boolean; loaded: boolean; muted: boolean; saving: boolean;
  volume:number;error?: string; reducedMotion: boolean; onPlay(): void; onSeek(ms: number): void; onMute(): void; onVolume(value:number):void;onSave(): void; onRecordAgain(): void;
}) {
  const colors = useThemeColors(), styles = useThemeStyles(createStyles), [width, setWidth] = useState(148);
  const timeline = useRef<View>(null);
  const [volumeOpen,setVolumeOpen]=useState(false);
  function seek(event: GestureResponderEvent) {
    const x = event.nativeEvent.pageX;
    if (!loaded || saving || !Number.isFinite(x)) return;
    // A waveform bar can be the target; measure the whole timeline instead of
    // using locationX relative to that bar (missing in some web PressEvents).
    timeline.current?.measureInWindow((left, _top, measuredWidth) => {
      if (measuredWidth > 0) onSeek(Math.max(0, Math.min(1, (x-left) / measuredWidth)) * durationMs);
    });
  }
  const frames = useMemo(() => ({ header: panelAsset('header', colors), body: panelAsset('body', colors) }), [colors]);
  const bars = useMemo(() => Array.from({ length: 25 }, (_, i) => {
    const from = Math.floor(i * waveform.length / 25), to = Math.max(from + 1, Math.floor((i+1) * waveform.length / 25));
    return Math.max(.04, ...waveform.slice(from, to));
  }), [waveform]);
  const progress = Math.max(0, Math.min(1, positionMs / Math.max(1, durationMs)));
  return <PanelScan style={styles.root} testID="recording-review" reducedMotion={reducedMotion}>
    <GlassHost contour={contour} reducedMotion={reducedMotion} touchEnabled={false} style={styles.header}>
      <ProductText variant="label" style={styles.heading}>ПРОВЕРЬ ЗАПИСЬ</ProductText>
      <PanelArtwork source={frames.header} />
    </GlassHost>
    <GlassHost contour={contour} reducedMotion={reducedMotion} touchEnabled={false} style={styles.body}>
      <View style={styles.upper}>
        <ProductText style={styles.copy}>{'ПРОСЛУШАЙ И СОХРАНИ ОТВЕТ\nИЛИ ЗАПИШИ ЗАНОВО'}</ProductText>
        <View style={styles.playback}>
        <View style={styles.controls}>
          <Pressable accessibilityRole="button" accessibilityLabel={playing ? 'Приостановить запись' : 'Прослушать запись'} disabled={!loaded || saving}
            accessibilityState={{ disabled: !loaded || saving }} onPress={onPlay} hitSlop={2} style={[styles.iconButton, !loaded && styles.disabled]}>
            <PanelBorder color={colors.accent} />
            {playing ? <View style={styles.pause}><View style={styles.pauseBar} /><View style={styles.pauseBar} /></View>
              : <Image source={require('../../../assets/product/review/play.svg')} tintColor={colors.accent} contentFit="contain" style={styles.icon} />}
          </Pressable>
          <View ref={timeline} style={styles.timeline} onLayout={event => setWidth(event.nativeEvent.layout.width)}>
            <Pressable accessibilityRole="button" accessibilityLabel="Перемотать запись" disabled={!loaded || saving}
              onPress={seek} style={styles.waveform}>
              {bars.map((level, i) => <View key={i} style={[styles.waveBar, { height: 3 + Math.min(1,level) * 24, backgroundColor: i/25 <= progress ? colors.accent : colors.muted }]} />)}
              <View pointerEvents="none" style={[styles.cursor, { left: progress * Math.max(0,width-1.5) }]} />
            </Pressable>
            <ProductText variant="label" numberOfLines={1} style={styles.time}>{clock(positionMs)} / {clock(durationMs)}</ProductText>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Громкость" accessibilityState={{ expanded: volumeOpen }}
            disabled={saving} hitSlop={2} onPress={()=>setVolumeOpen(value=>!value)} style={styles.iconButton}>
            <PanelBorder color={colors.accent} />
            <Image source={require('../../../assets/product/review/speaker.svg')} tintColor={colors.accent} contentFit="contain" style={[styles.icon, muted && styles.disabled]} />
          </Pressable>
        </View>
        <View testID="recording-volume" pointerEvents={volumeOpen ? 'auto' : 'none'} accessibilityElementsHidden={!volumeOpen}
          importantForAccessibility={volumeOpen ? 'auto' : 'no-hide-descendants'} aria-hidden={!volumeOpen}
          style={[styles.volumeRow, { opacity: volumeOpen ? 1 : 0 }]}>
          <Pressable accessibilityRole="button" accessibilityLabel={muted?'Включить звук записи':'Выключить звук записи'} disabled={saving || !volumeOpen} onPress={onMute} style={styles.volumeMute}>
            <Image source={require('../../../assets/product/review/speaker.svg')} tintColor={colors.accent} style={[styles.icon,muted&&styles.disabled]}/>
          </Pressable>
          <View style={styles.volumeTrack}><VolumeSlider value={volume} onChange={value=>{onVolume(value);if(muted&&value>0)onMute();}} disabled={saving || !volumeOpen}/></View>
          <ProductText variant="label" numberOfLines={1} style={styles.volumeValue}>{Math.round(volume*100)}%</ProductText>
        </View>
        </View>
      </View>
      <View style={styles.actions}>
        {!!error && <ProductText style={styles.error}>{error}</ProductText>}
        <Pressable accessibilityRole="button" accessibilityLabel="СОХРАНИТЬ ЗАПИСЬ" disabled={saving} onPress={onSave} hitSlop={1} style={[styles.save, saving && styles.disabled]}>
          <PanelBorder color={colors.accent} />
          <ProductText variant="title" numberOfLines={1} style={styles.saveLabel}>{saving ? 'СОХРАНЯЕМ…' : 'СОХРАНИТЬ ЗАПИСЬ'}</ProductText>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="ПЕРЕЗАПИСАТЬ" disabled={saving} onPress={onRecordAgain} hitSlop={1} style={styles.again}>
          <ProductText variant="title" style={styles.againLabel}>ПЕРЕЗАПИСАТЬ</ProductText>
        </Pressable>
      </View>
      <PanelArtwork source={frames.body} />
    </GlassHost>
  </PanelScan>;
}
const createStyles = (colors: ProductColors) => StyleSheet.create({
  root: { width: '100%', maxWidth: 480, alignSelf: 'center', gap: 10 },
  header: { minHeight: 25, flexShrink: 0, justifyContent: 'center', paddingHorizontal: 12, paddingVertical: 6 }, heading: { fontSize: 10, lineHeight: 14, letterSpacing: 2.2 },
  body: { minHeight: 282, padding: 16, justifyContent: 'space-between', gap: 28 }, upper: { gap: 24 }, playback: { gap: 12 },
  copy: { fontSize: 12, lineHeight: 16.8 }, controls: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  volumeRow: { minHeight: 44, flexDirection: 'row', gap: 8, alignItems: 'center' },
  volumeMute: { width: 32, height: 44, flexShrink: 0, justifyContent: 'center', alignItems: 'center' },
  volumeTrack: { flex: 1, minWidth: 0, height: 44, justifyContent: 'center' },
  volumeValue: { fontSize: 10, lineHeight: 14, width: 56, flexShrink: 0, textAlign: 'right', letterSpacing: .8 },
  iconButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderColor: colors.accent, borderWidth: 0 },
  icon: { width: 32, height: 32 }, timeline: { flex: 1, minWidth: 0, gap: 4 }, waveform: { height: 27, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  waveBar: { width: .75 }, cursor: { position: 'absolute', top: 0, height: 27, width: 1.5, backgroundColor: colors.accent },
  time: { fontSize: 8, lineHeight: 11.2, letterSpacing: 1.76 }, actions: { gap: 12 },
  save: { height: 42, borderColor: colors.accent, borderWidth: 0, alignItems: 'center', justifyContent: 'center' }, saveLabel: { fontSize: 14, lineHeight: 19.6, fontWeight: '500' },
  again: { height: 42, alignItems: 'center', justifyContent: 'center' }, againLabel: { fontSize: 14, lineHeight: 19.6, fontWeight: '400', color: colors.muted },
  error: { fontSize: 12, color: colors.error }, disabled: { opacity: .45 }, pause: { flexDirection: 'row', gap: 5 }, pauseBar: { height: 14, width: .75, backgroundColor: colors.accent },
});
