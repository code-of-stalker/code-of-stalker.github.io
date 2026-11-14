import { LighthouseHero } from './LighthouseHero.web';
import { StepSevenStill } from './StepSevenStill';

/** The Rust scene «Маяк» (also the home card from step 7 on); Art's still stays only as its fallback. */
export function StepSevenHero({ width, height, active, reducedMotion }: { width: number; height: number; active?: boolean; reducedMotion?: boolean }) {
  return <LighthouseHero kind="grounding-hero" webScene="lighthouse-hero" width={width} height={height} active={active} reducedMotion={reducedMotion}
    fallback={<StepSevenStill width={width} height={height} />} />;
}
