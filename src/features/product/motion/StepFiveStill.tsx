import { Image } from 'expo-image';
import { useThemeColors } from '../ProductTheme';
import { isLightTheme } from '../theme';
import { stepFiveHero } from '../stepFiveContent';
import { ScenePlaceholder } from './ScenePlaceholder';

const painting = require('../../../../graphics/sphere-hero/assets/original.webp');
/** Art's still, where the Rust scene «Скан в глубине» does not run. The painting is dark, so light
 * themes hold its place instead: a scene's background must be exactly the page color there. */
export function StepFiveStill({ width, height }: { width: number; height: number }) {
  const colors = useThemeColors();
  if (isLightTheme(colors)) return <ScenePlaceholder scene={stepFiveHero} width={width} height={height} />;
  return <Image testID="step-five-still" source={painting} contentFit="cover" style={{ width, height }}
    accessibilityLabel="Светящийся человек стоит внутри сферы из точек и орбит, вокруг ветви дерева, птица, лес, река и горы" />;
}
