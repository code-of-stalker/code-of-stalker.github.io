import { Image } from 'expo-image';
import { useThemeColors } from '../ProductTheme';

const icon = require('../../../../assets/product/step-chevron.svg');
// Use Figma's vector, independent of font metrics and responsive text sizing.
export function StepChevron({ expanded = false }: { expanded?: boolean }) {
  const colors = useThemeColors();
  return <Image source={icon} tintColor={colors.accent} contentFit="contain" pointerEvents="none"
    style={{ width: 7, height: 5, flexShrink: 0, transform: [{ rotate: expanded ? '180deg' : '0deg' }] }} />;
}
