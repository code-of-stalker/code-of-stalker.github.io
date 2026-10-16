import { Image } from 'expo-image';
import { RustMotion, shown } from './RustMotion.web';
import { useThemeColors } from '../ProductTheme';
const icon = require('../../../../assets/product/step-chevron.svg');
export function StepChevron({ expanded = false }: { expanded?: boolean }) {
  const colors = useThemeColors();
  return <RustMotion initial={shown} target={[1, 0, 0, 1, expanded ? 180 : 0, 100]} duration={240} style={{ width: 7, height: 5, flexShrink: 0 }}>
    <Image source={icon} tintColor={colors.iconTint} contentFit="contain" pointerEvents="none" style={{ width: 7, height: 5 }} />
  </RustMotion>;
}
