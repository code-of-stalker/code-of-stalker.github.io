import { useThemeColors, useThemeStyles } from '../ProductTheme';
import type { ProductColors } from '../theme';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { RustMotion } from './RustMotion.web';
import type { MotionValues } from './RustMotion.web';
import type { TaskProgressProps } from './TaskProgress.types';

export function TaskProgress({ part, total = 3, segmented = true, label = 'Часть задания', reducedMotion = false }: TaskProgressProps) {
  const colors = useThemeColors();
  const styles = useThemeStyles(createStyles);
  const current = Math.max(1, Math.min(total, part));
  const target = useMemo<MotionValues>(() => [1, 0, 0, current / total, 0, 100], [current, total]);
  return <View pointerEvents="none" testID="task-progress" style={[styles.track, segmented && styles.segmented]} accessibilityRole="progressbar"
    accessibilityLabel={`${label} ${current} из ${total}`} aria-valuemin={0} aria-valuemax={total} aria-valuenow={current}>
    {segmented ? Array.from({ length: total }, (_, index) => {
      const fill: MotionValues = [1,0,0,index < current ? 1 : 0,0,100];
      return <View key={index} testID={`task-progress-cell-${index+1}`} style={styles.cell}>
        <RustMotion scaleX initial={fill} target={fill} duration={reducedMotion ? 0 : 300}
          style={{ width: '100%', height: 4, background: colors.accent, transformOrigin: 'left center' }} />
      </View>;
    }) : <RustMotion scaleX initial={target} target={target} duration={reducedMotion ? 0 : 300}
      style={{ width: '100%', height: 4, background: colors.accent, transformOrigin: 'left center' }} />}
  </View>;
}
const createStyles = (colors: ProductColors) => StyleSheet.create({
  track: { height: 4, flexShrink: 0, marginBottom: 8, backgroundColor: colors.track },
  segmented: { flexDirection: 'row', gap: 4, backgroundColor: 'transparent' },
  cell: { flex: 1, height: 4, overflow: 'hidden', backgroundColor: colors.track },
});
