import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Art } from './Art';

export function MatrixBackdrop({ active, reducedMotion }: { active: boolean; reducedMotion: boolean }) {
  const [size, setSize] = useState({ width: 1, height: 1 });
  return <View pointerEvents="none" style={StyleSheet.absoluteFill} onLayout={event => {
    const { width, height } = event.nativeEvent.layout;
    if (width > 0 && height > 0) setSize(old => old.width === width && old.height === height ? old : { width, height });
  }}><Art kind="rain" width={size.width} height={size.height} active={active} reducedMotion={reducedMotion} /></View>;
}
