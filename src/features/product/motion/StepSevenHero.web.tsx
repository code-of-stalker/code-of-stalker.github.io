import { DynamicRings } from './DynamicRings.web';
import { ScenePlaceholder } from './ScenePlaceholder';
import { stepSevenHero } from '../stepSevenContent';

/** The Rust scene «Динамическая сфера»; the placeholder stays only as its fallback. */
export function StepSevenHero({ width, height, active, reducedMotion }: { width: number; height: number; active?: boolean; reducedMotion?: boolean }) {
  return <DynamicRings kind="grounding-hero" webScene="dynamic-hero" width={width} height={height} active={active} reducedMotion={reducedMotion}
    fallback={<ScenePlaceholder scene={stepSevenHero} width={width} height={height} />} />;
}
