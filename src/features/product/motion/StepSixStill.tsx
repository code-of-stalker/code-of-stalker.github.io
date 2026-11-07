import { Image } from 'expo-image';
import { useThemeColors } from '../ProductTheme';
import { isLightTheme } from '../theme';
import { stepSixHero } from '../stepSixContent';
import { ScenePlaceholder } from './ScenePlaceholder';

const painting = require('../../../../graphics/inner-hero/assets/original.webp');
/** Art's still, where the Rust scene «Внутренняя сфера» does not run. The painting is dark, so light
 * themes hold its place instead: a scene's background must be exactly the page color there. */
export function StepSixStill({ width, height }: { width: number; height: number }) {
  const colors = useThemeColors();
  if (isLightTheme(colors)) return <ScenePlaceholder scene={stepSixHero} width={width} height={height} />;
  return <Image testID="step-six-still" source={painting} contentFit="cover" style={{ width, height }}
    accessibilityLabel="Светящийся человек стоит в стеклянной сфере среди туманности, грудь его обходит кольцо света, по оси от макушки до пола горят звёзды" />;
}
