import { View, type ViewProps } from 'react-native';
import { ProductText } from '../ui';
import { useThemeColors } from '../ProductTheme';
import { fonts } from '../theme';
import { useRustTextFrame } from './useRustTextFrame';
export function StepOneConclusion({ active, reducedMotion, onLayout }: { active: boolean; reducedMotion: boolean; onLayout?: ViewProps['onLayout'] }) {
  const colors = useThemeColors(), frame = useRustTextFrame('Остальные похожи. Но они не ты.', 3, active, reducedMotion);
  return <View testID="step-one-conclusion" onLayout={onLayout} style={{ gap: 8, paddingVertical: 20 }}>
    <ProductText style={{ fontSize: 16, lineHeight: 23 }}>Остальные похожи.</ProductText>
    <ProductText testID="step-one-emphasis" style={{ fontSize: 22, lineHeight: 31, fontFamily: fonts.bodyBold, textShadowColor: colors.accent, textShadowOffset: { width: 0, height: 0 }, textShadowRadius: frame.opacity * 12 }}>Но они не ты.</ProductText>
  </View>;
}
