import { useRef } from 'react';
import { View, type ViewProps } from 'react-native';
import { ProductText } from '../ui';
import { fonts } from '../theme';
import { useRustText } from './useRustText.web';
import { useThemeColors } from '../ProductTheme';
export function StepOneConclusion({ active, reducedMotion, onLayout }: { active: boolean; reducedMotion: boolean; onLayout?: ViewProps['onLayout'] }) {
  const root = useRef<View>(null), colors = useThemeColors();
  useRustText(root, 'Остальные похожи. Но они не ты.', 3, active, reducedMotion);
  return <View ref={root} testID="step-one-conclusion" onLayout={onLayout} style={{ gap: 8, paddingVertical: 20 }}>
    <ProductText style={{ fontSize: 16, lineHeight: 23 }}>Остальные похожи.</ProductText>
    <ProductText testID="step-one-emphasis" style={{ fontSize: 22, lineHeight: 31, fontFamily: fonts.bodyBold, ...{ '--conclusion-accent': colors.accent } }}>Но они не ты.</ProductText>
  </View>;
}
