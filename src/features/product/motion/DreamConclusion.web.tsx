import { useRef } from 'react';
import { StyleSheet, View, type StyleProp, type TextStyle, type ViewProps } from 'react-native';
import { ProductText } from '../ui';
import { fonts } from '../theme';
import { useThemeColors } from '../ProductTheme';
import { useRustText } from './useRustText.web';

export function DreamConclusion({ text, active, reducedMotion, style, onLayout }: {
  text: string; active: boolean; reducedMotion: boolean; style?: StyleProp<TextStyle>; onLayout?: ViewProps['onLayout'];
}) {
  const root = useRef<View>(null), colors = useThemeColors();
  useRustText(root, text, 2, active, reducedMotion);
  const resolved = StyleSheet.flatten(style), face = [style, { fontFamily: fonts.bodyBold, marginTop: 0, marginBottom: 0 }];
  return <View ref={root} testID="dream-conclusion" accessible accessibilityLabel={text} onLayout={onLayout} style={{ marginTop: resolved?.marginTop, marginBottom: resolved?.marginBottom }}>
    {text.split('\n').map((line, index) => <View key={index} style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline' }} aria-hidden>
      {line.match(/\S+\s*/g)?.map((word, i) => /^одному\s*$/i.test(word)
        ? <View key={i} style={{ flexDirection: 'row', alignItems: 'baseline', marginHorizontal: 4 }}>
          <span data-rust-one data-testid="dream-one-breath" style={{ display: 'inline-block', transform: 'scale(1)', transformOrigin: '50% 70%' }}>
            <ProductText testID="dream-one-word" style={[face, { textShadowColor: `${colors.accent}55`, textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 6 }]}>{word.trimEnd()}</ProductText>
          </span><ProductText style={face}>{word.slice(word.trimEnd().length)}</ProductText>
        </View> : <ProductText key={i} style={face}>{word}</ProductText>)}
    </View>)}
  </View>;
}
