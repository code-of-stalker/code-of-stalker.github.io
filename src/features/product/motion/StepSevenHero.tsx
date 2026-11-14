import { StepSevenStill } from './StepSevenStill';

/** Native keeps Art's still; the browser plays the Rust scene «Маяк» (StepSevenHero.web.tsx). */
export function StepSevenHero({ width, height }: { width: number; height: number; active?: boolean; reducedMotion?: boolean }) {
  return <StepSevenStill width={width} height={height} />;
}
