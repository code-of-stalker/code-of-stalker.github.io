import { View, Text } from 'react-native';
import { useThemeColors } from '../ProductTheme';
import { artLabels, type ArtProps } from './types';

/** A failed Rust surface must never silently switch to JavaScript graphics. */
export function ArtUnavailable(props: ArtProps) {
  const colors = useThemeColors();
  return <View testID="rust-art-unavailable" style={[{ width: props.width ?? '100%', height: props.height, alignItems: 'center', justifyContent: 'center' }, props.style]}>
    <Text accessibilityRole="text" style={{ color: colors.muted, fontSize: 11 }}>{artLabels[props.kind]}</Text>
  </View>;
}
