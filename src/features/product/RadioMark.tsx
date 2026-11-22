import { Image } from 'expo-image';
import { StyleSheet } from 'react-native';

import { RustIcon } from './motion/RustIcon';
import { useThemeColors } from './ProductTheme';

const sources = {
  on: require('../../../assets/product/settings-radio-on.svg'),
  off: require('../../../assets/product/settings-radio-off.svg'),
};

/** The settings radio (Rust icon, SVG fallback); also marks a one-of-many choice in the Intensive. */
export function RadioMark({ selected }: { selected: boolean }) {
  const colors = useThemeColors();
  return <RustIcon name="radio" width={14} height={16} stroke={1.2} filled={selected} color={colors.iconTint ?? (selected ? '#F5DD07' : '#B69D4B')}
    fallback={<Image source={selected ? sources.on : sources.off} tintColor={colors.iconTint} style={styles.image} contentFit="contain" />} />;
}

const styles = StyleSheet.create({ image: { width: 14, height: 16 } });
