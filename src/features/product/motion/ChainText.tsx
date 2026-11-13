import { View, type StyleProp, type TextStyle } from 'react-native';
import { ProductText } from '../ui';
import { useThemeColors } from '../ProductTheme';

/** Native keeps the chain still: the words and plain arrows in the accent.
 * The web version (ChainText.web.tsx) lets Rust surface it word by word. */
export function ChainText({ text, style }: {
  text: string; active: boolean; reducedMotion: boolean; style?: StyleProp<TextStyle>;
}) {
  const colors = useThemeColors(), words = text.split(/\s*→\s*/);
  return <View testID="chain-text" accessible accessibilityLabel={text} style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', rowGap: 4 }}>
    {words.map((word, i) => <View key={i} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ flexDirection: 'row', alignItems: 'center' }}>
      <ProductText style={style}>{word}</ProductText>
      {i < words.length - 1 && <ProductText style={[style, { color: colors.accent, marginHorizontal: 9 }]}>→</ProductText>}
    </View>)}
  </View>;
}
