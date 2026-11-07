import { StepSixStill } from './StepSixStill';

/** Native keeps Art's still; the browser plays the Rust scene (StepSixHero.web.tsx). */
export function StepSixHero({ width, height }: { width: number; height: number; active?: boolean; reducedMotion?: boolean }) {
  return <StepSixStill width={width} height={height} />;
}
