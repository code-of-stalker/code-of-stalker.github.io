import type { ReadingPage } from './readingPages';
import { ScenePlaceholder } from './ScenePlaceholder';

/** A Step 5 page's scene. The live Rust scenes run in the browser; the native
 * app keeps the page's placeholder until it gets its own. */
export function StepFiveScene({ page, width, height }: { page: ReadingPage; width: number; height: number; active: boolean; reducedMotion: boolean }) {
  return page.placeholder ? <ScenePlaceholder scene={page.placeholder} width={width} height={height} /> : null;
}
