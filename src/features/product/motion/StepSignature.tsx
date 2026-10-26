import { Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { ProductText } from '../ui';
import { stepAuthor } from '../content';
import { useThemeColors } from '../ProductTheme';
import { useRustTextFrame } from './useRustTextFrame';

/** The author's line closing a step: written letter by letter, then a faint warm glow. */
export function StepSignature({ active, reducedMotion, center = false, style }: {
  active: boolean; reducedMotion: boolean; center?: boolean; style?: StyleProp<ViewStyle>;
}) {
  const colors = useThemeColors(), frame = useRustTextFrame(stepAuthor, 4, active, reducedMotion);
  const letters = [...stepAuthor], written = frame.scale * (letters.length + 2);
  return <View testID="step-signature" accessible accessibilityLabel={stepAuthor} style={[{ marginTop: 24, alignItems: center ? 'center' : 'flex-start' }, style]}>
    <ProductText aria-hidden style={{ color: colors.muted, fontSize: 13, lineHeight: 19, textShadowColor: colors.accent, textShadowOffset: { width: 0, height: 0 }, textShadowRadius: frame.opacity * 12 }}>
      {letters.map((letter, index) => <Text key={index} style={{ opacity: Math.max(0, Math.min(1, (written - index) / 2)) }}>{letter}</Text>)}
    </ProductText>
  </View>;
}
