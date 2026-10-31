import { SphereHero } from './SphereHero.web';
import { StepFiveStill } from './StepFiveStill';

/** The Rust scene «Скан в глубине»; Art's still stays only as its fallback. */
export function StepFiveHero({ width, height, reducedMotion }: { width: number; height: number; reducedMotion?: boolean }) {
  return <SphereHero width={width} height={height} reducedMotion={reducedMotion}
    fallback={<StepFiveStill width={width} height={height} />} />;
}
