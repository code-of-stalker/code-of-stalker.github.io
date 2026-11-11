import { useState } from 'react';
import { RustMotion } from './RustMotion.web';
import { uiCurve, uiDuration, useUiReduced } from './uiMotion';

/** The underline of the chosen tab. It slides and stretches to the next tab
 * instead of jumping. Base bar is 100px wide, scaled from its left edge. */
export function SlideMark({ x, width, color, thickness = 1 }: { x: number; width: number; color: string; thickness?: number }) {
  const reduced = useUiReduced();
  const [initial] = useState(() => [1, x, 0, width / 100, 0, 100] as const);
  return <RustMotion scaleX initial={initial} target={[1, x, 0, width / 100, 0, 100]} duration={reduced ? 0 : uiDuration} curve={uiCurve} aria-hidden
    style={{ position: 'absolute', left: 0, bottom: 0, width: 100, height: thickness, backgroundColor: color, transformOrigin: 'left center', pointerEvents: 'none' }} />;
}
