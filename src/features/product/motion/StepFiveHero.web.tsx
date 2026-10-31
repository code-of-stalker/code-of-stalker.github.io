import { SphereHero } from './SphereHero.web';
import { StepFiveStill } from './StepFiveStill';

/** The Rust scene «Скан в глубине»; Art's still stays only as its fallback. */
export function StepFiveHero({ width, height, active, reducedMotion }: { width: number; height: number; active?: boolean; reducedMotion?: boolean }) {
  return <SphereHero kind="grounding-hero" webScene="sphere-hero" width={width} height={height} active={active} reducedMotion={reducedMotion}
    fallback={<StepFiveStill width={width} height={height} />} />;
}
