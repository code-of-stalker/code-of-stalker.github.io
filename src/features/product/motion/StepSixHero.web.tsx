import { InnerHero } from './InnerHero.web';
import { StepSixStill } from './StepSixStill';

/** The Rust scene «Внутренняя сфера»; Art's still stays only as its fallback. */
export function StepSixHero({ width, height, active, reducedMotion }: { width: number; height: number; active?: boolean; reducedMotion?: boolean }) {
  return <InnerHero kind="grounding-hero" webScene="inner-hero" width={width} height={height} active={active} reducedMotion={reducedMotion}
    fallback={<StepSixStill width={width} height={height} />} />;
}
