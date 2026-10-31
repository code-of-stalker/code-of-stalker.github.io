import { StepFiveStill } from './StepFiveStill';

/** Native keeps Art's still; the browser plays the Rust scene (StepFiveHero.web.tsx). */
export function StepFiveHero({ width, height }: { width: number; height: number; reducedMotion?: boolean }) {
  return <StepFiveStill width={width} height={height} />;
}
