import { useRef } from 'react';
import type { CSSProperties } from 'react';
import { StyleSheet, View, type StyleProp, type TextStyle, type TextProps } from 'react-native';
import { ProductText } from '../ui';
import { fonts } from '../theme';
import { useThemeColors } from '../ProductTheme';
import { useRustText } from './useRustText.web';

export function DreamRealityText({ text, active, reducedMotion, style, onLayout }: {
  text: string; active: boolean; reducedMotion: boolean; style?: StyleProp<TextStyle>; onLayout?: TextProps['onLayout'];
}) {
  const root = useRef<View>(null), colors = useThemeColors();
  useRustText(root, text, 1, active, reducedMotion);
  const face = [style, { fontFamily: fonts.bodyBold }];
  return <View ref={root} onLayout={onLayout} style={{ '--reading-text-background': colors.background } as object}>
    <ProductText testID="dream-reality-text" accessibilityLabel={text} style={face}>{text}</ProductText>
    <div data-rust-text-veil data-testid="dream-reality-veil" aria-hidden style={{ ...StyleSheet.flatten(style), position: 'absolute', inset: 0, opacity: 0, background: colors.background, pointerEvents: 'none', fontFamily: fonts.bodyBold, whiteSpace: 'pre-wrap' } as CSSProperties} />
  </View>;
}
