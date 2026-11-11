import { View } from 'react-native';

export function SlideMark({ x, width, color, thickness = 1 }: { x: number; width: number; color: string; thickness?: number }) {
  return <View pointerEvents="none" style={{ position: 'absolute', left: x, bottom: 0, width, height: thickness, backgroundColor: color }} />;
}
