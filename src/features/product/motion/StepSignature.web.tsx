import { useRef } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import type { CSSProperties } from 'react';
import { ProductText } from '../ui';
import { stepAuthor } from '../content';
import { useThemeColors } from '../ProductTheme';
import { useRustText } from './useRustText.web';

/** The author's line closing a step. Rust writes it once by a soft hand and
 * then lets a faint warm glow breathe; without Rust it simply stands. */
export function StepSignature({ active, reducedMotion, center = false, style }: {
  active: boolean; reducedMotion: boolean; center?: boolean; style?: StyleProp<ViewStyle>;
}) {
  const root = useRef<View>(null), colors = useThemeColors();
  useRustText(root, stepAuthor, 4, active, reducedMotion);
  const mask = 'linear-gradient(90deg,#000 calc(var(--signature-written,1) * 130% - 30%),transparent calc(var(--signature-written,1) * 130%))';
  return <View ref={root} testID="step-signature" accessible accessibilityLabel={stepAuthor} style={[{ marginTop: 24, alignItems: center ? 'center' : 'flex-start' }, style]}>
    <span data-rust-signature aria-hidden style={{ display: 'inline-block', WebkitMaskImage: mask, maskImage: mask,
      '--signature-warm': `color-mix(in srgb,${colors.accent} 55%,#FFAA66)` } as CSSProperties}>
      <ProductText style={{ color: colors.muted, fontSize: 13, lineHeight: 19 }}>{stepAuthor}</ProductText>
    </span>
  </View>;
}
