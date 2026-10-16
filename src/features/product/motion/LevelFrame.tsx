import { useMemo } from 'react';
import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';
import type { LevelId } from '../content';
import { levelFrameSlices } from '../levelArtwork';
import { useThemeColors } from '../ProductTheme';

export function LevelFrame({ level, expanded }: { level: LevelId; expanded: boolean; width: number }) {
  const colors = useThemeColors();
  const layers = useMemo(() => [true, false].map(fill => levelFrameSlices(colors, level, expanded, fill)), [colors, level, expanded]);
  return <>{layers.map((slices, index) => <View key={index} pointerEvents="none" style={[StyleSheet.absoluteFill, index === 1 && { zIndex: 3 }]}>
    {slices.cells.map((row, y) => <View key={y} style={{ flexDirection: 'row', ...(y === 1 ? { flex: 1, minHeight: 0 } : { height: slices.cap }) }}>
      {row.map((source, x) => <Image key={x} source={source} style={{ height: '100%', ...(x === 1 ? { flex: 1, minWidth: 0 } : { width: slices.cap }) }} contentFit="fill" />)}
    </View>)}
  </View>)}</>;
}
