import { useId, useRef } from 'react';
import { View, type StyleProp, type TextStyle } from 'react-native';
import { ProductText } from '../ui';
import { useThemeColors } from '../ProductTheme';
import { useRustText } from './useRustText.web';

/** «стопы → опора → дыхание → …»: the words and the arrows between them, laid
 * out to wrap like the copy. Rust (text effect 5) surfaces the words one after
 * another, draws each arrow towards the next word and runs the glow; this
 * only lays them out and passes the theme's accent. */
export function ChainText({ text, active, reducedMotion, style }: {
  text: string; active: boolean; reducedMotion: boolean; style?: StyleProp<TextStyle>;
}) {
  const root = useRef<View>(null), colors = useThemeColors();
  useRustText(root, text, 5, active, reducedMotion);
  const words = text.split(/\s*→\s*/);
  return <View ref={root} testID="chain-text" accessible accessibilityLabel={text}
    style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', rowGap: 4, ...{ '--chain-accent': colors.accent } }}>
    {words.map((word, i) => <View key={i} aria-hidden style={{ flexDirection: 'row', alignItems: 'center' }}>
      <span data-rust-chain-word style={{ display: 'inline-block' }}><ProductText style={style}>{word}</ProductText></span>
      {i < words.length - 1 && <span data-rust-chain-arrow style={{ display: 'inline-flex', margin: '0 9px' }}><Arrow color={colors.accent} /></span>}
    </View>)}
  </View>;
}

/** A hairline that gathers strength towards an open head. Both paths are
 * measured as 1 so Rust draws them by their dash offset. */
function Arrow({ color }: { color: string }) {
  const id = `chain-${useId().replace(/:/g, '')}`;
  return <svg width={30} height={12} viewBox="0 0 30 12" fill="none" style={{ display: 'block', overflow: 'visible' }}>
    <defs>
      <linearGradient id={id} gradientUnits="userSpaceOnUse" x1={1} y1={6} x2={28} y2={6}>
        <stop offset={0} stopColor={color} stopOpacity={0.12} />
        <stop offset={0.7} stopColor={color} stopOpacity={0.8} />
        <stop offset={1} stopColor={color} stopOpacity={1} />
      </linearGradient>
    </defs>
    <path data-rust-chain-line d="M1 6 H27.4" pathLength={1} stroke={`url(#${id})`} strokeWidth={1.3} strokeLinecap="round" strokeDasharray="1 1" strokeDashoffset={0} />
    <path data-rust-chain-head d="M22.6 1.8 Q24.6 4.6 27.6 6 Q24.6 7.4 22.6 10.2" pathLength={1} stroke={color} strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round" strokeDasharray="1 1" strokeDashoffset={0} />
  </svg>;
}
