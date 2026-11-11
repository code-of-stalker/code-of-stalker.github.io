import { View } from 'react-native';

export type VoiceWaveBarsProps = { bars: readonly number[]; positionMs: number; durationMs: number; playing: boolean; accent: string; muted: string };

export function VoiceWaveBars({ bars, positionMs, durationMs, accent, muted }: VoiceWaveBarsProps) {
  const progress = Math.min(1, positionMs / Math.max(1, durationMs));
  return <View pointerEvents="none" style={{ flex: 1, alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
    {bars.map((level, i) => <View key={i} style={{ width: 1, height: 3 + level * 25, backgroundColor: i / bars.length < progress ? accent : muted, opacity: i / bars.length < progress ? 1 : .65 }} />)}
  </View>;
}
