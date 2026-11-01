import { ScenePlaceholder } from './ScenePlaceholder';
import { stepSevenHero } from '../stepSevenContent';

/** Native holds the hero's place; the browser plays the Rust scene (StepSevenHero.web.tsx). */
export function StepSevenHero({ width, height }: { width: number; height: number; active?: boolean; reducedMotion?: boolean }) {
  return <ScenePlaceholder scene={stepSevenHero} width={width} height={height} />;
}
