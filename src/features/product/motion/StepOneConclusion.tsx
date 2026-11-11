import { View, type ViewProps } from 'react-native';
import { ProductText } from '../ui';
import { useThemeColors } from '../ProductTheme';
import { softBold } from '../theme';
import { useRustTextFrame } from './useRustTextFrame';
export function StepOneConclusion({ active, reducedMotion, onLayout }: { active: boolean; reducedMotion: boolean; onLayout?: ViewProps['onLayout'] }) {
  const colors = useThemeColors(), frame = useRustTextFrame('Остальные похожи. Но они не ты.', 3, active, reducedMotion);
  return <View testID="step-one-conclusion" onLayout={onLayout} style={{ gap: 10, marginTop: 36, paddingLeft: 18, borderLeftWidth: 1, borderLeftColor: colors.accent }}>
    <ProductText style={{ fontSize: 20, lineHeight: 29, textTransform: 'uppercase', color: colors.muted }}>Остальные похожи.</ProductText>
    <ProductText testID="step-one-emphasis" style={{ fontSize: 34, lineHeight: 42, textTransform: 'uppercase', ...softBold(colors, 34), textShadowColor: colors.accent, textShadowOffset: { width: 0, height: 0 }, textShadowRadius: frame.opacity * 12 }}>Но они не ты.</ProductText>
  </View>;
}
