import { useMemo } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { Art } from '../motion/Art';
import { cutPanelPath, fitPanelPath } from '../motion/glassShape';
import { usePanelSize } from '../motion/usePanelSize';

const contours = {
  rectangle: (w: number, h: number) => 'M.125 .125H' + (w - .125) + 'V' + (h - .125) + 'H.125Z',
  input: (w: number, h: number) => fitPanelPath('M228.864 .125L228.875 8.0918V43.875H.189453L.125 35.9072V.125Z', 229, 44, w, h),
  icon: (w: number, h: number) => fitPanelPath('M33.4473 .125L43.875 10.5527V41.875H10.5527L.125 31.4473V.125Z', 44, 42, w, h),
  panel: (w: number, h: number) => fitPanelPath('M275.947 .125L287.875 12.0527V63.875H12.0527L.125 51.9473V.125Z', 288, 64, w, h),
  card: cutPanelPath,
};

/** Material under an existing frame; no outline, content wrapper or touch handler. */
export function DiaryGlass({ shape = 'rectangle', style }: { shape?: keyof typeof contours; style?: StyleProp<ViewStyle> }) {
  const { ref, size, onLayout } = usePanelSize({ width: 1, height: 1 });
  const glass = useMemo(() => ({ ...size, path: contours[shape](size.width, size.height), background: 'clear' as const }), [size, shape]);
  return <View ref={ref} testID="diary-glass" pointerEvents="none" onLayout={onLayout} style={[StyleSheet.absoluteFill, style]}>
    <Art kind="glass" glass={glass} width={size.width} height={size.height} scanOnMount={false}
      style={Platform.OS === 'web' ? { clipPath: "path('" + glass.path + "')" } as ViewStyle : undefined} />
  </View>;
}
