import type { PropsWithChildren } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { isLightTheme, type ProductColors } from '../theme';

/** Corner cuts of the shapes the skeleton stands in for, in layout pixels. */
export type SkeletonCorners = 'none' | 'panel' | 'card' | 'icon';
export const skeletonCuts: Record<SkeletonCorners, { topRight: number; bottomRight: number; bottomLeft: number }> = {
  none: { topRight: 0, bottomRight: 0, bottomLeft: 0 },
  // cutPanelPath: top-right and bottom-left.
  panel: { topRight: 12, bottomRight: 0, bottomLeft: 12 },
  // homeGlassShape: both right corners.
  card: { topRight: 20, bottomRight: 20, bottomLeft: 0 },
  // productIconPath.
  icon: { topRight: 10.4, bottomRight: 0, bottomLeft: 10.4 },
};

/** One loading surface. Loading starts when it mounts and ends when `ready`
 * turns true; the skeleton then dissolves and unmounts. Give the host a new
 * key to show a skeleton for a new load. */
export type SkeletonHostProps = PropsWithChildren<{
  ready: boolean;
  reducedMotion?: boolean;
  /** Announced while loading; omit for decorative skeletons. */
  label?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}>;
export type SkeletonBlockProps = { corners?: SkeletonCorners; style?: StyleProp<ViewStyle> };

/** Dark pages hold the content in a faint accent haze and scan it with the
 * accent; light pages hold it in ink and scan it with a paper sheen. */
export function skeletonTone(colors: ProductColors) {
  return isLightTheme(colors)
    ? { fill: `${colors.text}1a`, light: '#ffffff8c' }
    : { fill: `${colors.accent}14`, light: `${colors.accent}3d` };
}
