import { Image } from 'expo-image';
import { useThemeColors } from '../ProductTheme';
import { isLightTheme } from '../theme';
import { stepSevenHero } from '../stepSevenContent';
import { ScenePlaceholder } from './ScenePlaceholder';

const painting = require('../../../../graphics/lighthouse-hero/assets/original.webp');
/** Art's still, where the Rust scene «Маяк» does not run. The painting is dark, so light themes
 * hold its place instead: a scene's background must be exactly the page color there. */
export function StepSevenStill({ width, height }: { width: number; height: number }) {
  const colors = useThemeColors();
  if (isLightTheme(colors)) return <ScenePlaceholder scene={stepSevenHero} width={width} height={height} />;
  return <Image testID="step-seven-still" source={painting} contentFit="cover" style={{ width, height }}
    accessibilityLabel="Стеклянный светящийся человек стоит на винтовой лестнице маяка, держась за латунный поручень, вокруг него прозрачная сфера и три кольца света, наверху колодца горит лампа маяка" />;
}
