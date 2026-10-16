import { useThemeStyles } from '../ProductTheme';
import type { ProductColors } from '../theme';
import { StyleSheet, View } from 'react-native';
import type { TaskProgressProps } from './TaskProgress.types';

export function TaskProgress({ part, total = 3, segmented = true, label = 'Часть задания' }: TaskProgressProps) {
  const styles = useThemeStyles(createStyles);
  const current = Math.max(1, Math.min(total, part));
  return <View pointerEvents="none" testID="task-progress" style={[styles.track, segmented && styles.segmented]} accessibilityRole="progressbar"
    accessibilityLabel={`${label} ${current} из ${total}`} aria-valuemin={0} aria-valuemax={total} aria-valuenow={current}>
    {segmented ? Array.from({ length: total }, (_, index) => <View key={index} testID={`task-progress-cell-${index+1}`} style={styles.cell}>
      <View style={[styles.fill, { width: index < current ? '100%' : '0%' }]} />
    </View>) : <View style={[styles.fill, { width: `${current / total * 100}%` }]} />}
  </View>;
}
const createStyles = (colors: ProductColors) => StyleSheet.create({
  track: { height: 4, flexShrink: 0, marginBottom: 8, backgroundColor: colors.track },
  fill: { height: 4, backgroundColor: colors.accent },
  segmented: { flexDirection: 'row', gap: 4, backgroundColor: 'transparent' },
  cell: { flex: 1, height: 4, overflow: 'hidden', backgroundColor: colors.track },
});
