
import { StyleSheet, View } from 'react-native';
import type { StyleProp, TextStyle, ViewProps } from 'react-native';
import { ProductText } from '../ui';
import { useThemeColors } from '../ProductTheme';
import { fonts } from '../theme';
import { useRustTextFrame } from './useRustTextFrame';

/** A separate word box lets native and web scale the word without reflowing text. */
export function DreamConclusion({ text, active, reducedMotion, style, onLayout }: {
  text: string; active: boolean; reducedMotion: boolean;
  style?: StyleProp<TextStyle>; onLayout?: ViewProps['onLayout'];
}) {
  const colors = useThemeColors();
  const frame = useRustTextFrame(text, 2, active, reducedMotion);
  const resolved = StyleSheet.flatten(style);
  const face = [style, { fontFamily: fonts.bodyBold, marginTop: 0, marginBottom: 0 }];
  const lines = text.split('\n');
  return <View testID="dream-conclusion" accessible accessibilityLabel={text} onLayout={onLayout}
    style={{ marginTop: resolved?.marginTop, marginBottom: resolved?.marginBottom }}>
    {lines.map((line, index) => <View key={index} style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline' }}
      aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {line.match(/\S+\s*/g)?.map((word, i) => /^одному\s*$/i.test(word)
        ? <View key={i} style={{ flexDirection: 'row', alignItems: 'baseline', marginHorizontal: 4 }}>
          <View testID="dream-one-breath" style={{ transform: [{ scale: frame.scale }] }}>
            <ProductText testID="dream-one-word" style={[face, { textShadowColor: `${colors.accent}55`, textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 6 }]}>{word.trimEnd()}</ProductText>
          </View><ProductText style={face}>{word.slice(word.trimEnd().length)}</ProductText>
        </View>
        : <ProductText key={i} style={face}>{word}</ProductText>)}
    </View>)}
  </View>;
}
