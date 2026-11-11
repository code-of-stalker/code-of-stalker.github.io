import { useRef } from 'react';
import { View, type ViewProps } from 'react-native';
import { ProductText } from '../ui';
import { softBold } from '../theme';
import { useRustText } from './useRustText.web';
import { useThemeColors } from '../ProductTheme';
export function StepOneConclusion({ active, reducedMotion, onLayout }: { active: boolean; reducedMotion: boolean; onLayout?: ViewProps['onLayout'] }) {
  const root = useRef<View>(null), colors = useThemeColors();
  useRustText(root, 'Остальные похожи. Но они не ты.', 3, active, reducedMotion);
  return <View ref={root} testID="step-one-conclusion" onLayout={onLayout} style={{ gap: 10, marginTop: 36, paddingLeft: 18, borderLeftWidth: 1, borderLeftColor: colors.accent }}>
    <ProductText style={{ fontSize: 20, lineHeight: 29, textTransform: 'uppercase', color: colors.muted }}>Остальные похожи.</ProductText>
    <ProductText testID="step-one-emphasis" style={{ fontSize: 34, lineHeight: 42, textTransform: 'uppercase', ...softBold(colors, 34), ...{ '--conclusion-accent': colors.accent } }}>Но они не ты.</ProductText>
  </View>;
}
