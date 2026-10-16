import { StyleSheet, View, type StyleProp, type TextStyle, type TextProps } from 'react-native';
import { ProductText } from '../ui';
import { fonts } from '../theme';
import { useThemeColors } from '../ProductTheme';
import { useRustTextFrame } from './useRustTextFrame';
export function DreamRealityText({ text, active, reducedMotion, style, onLayout }: { text: string; active: boolean; reducedMotion: boolean; style?: StyleProp<TextStyle>; onLayout?: TextProps['onLayout'] }) {
  const colors = useThemeColors(), frame = useRustTextFrame(text, 1, active, reducedMotion), face = [style, { fontFamily: fonts.bodyBold }];
  return <View onLayout={onLayout}>
    <ProductText testID="dream-reality-text" accessibilityLabel={text} style={face}>{text}</ProductText>
    <View testID="dream-reality-veil" pointerEvents="none" aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[StyleSheet.absoluteFill, { opacity: frame.opacity, backgroundColor: colors.background }]}>
      <ProductText style={face}>{frame.text}</ProductText>
    </View>
  </View>;
}
