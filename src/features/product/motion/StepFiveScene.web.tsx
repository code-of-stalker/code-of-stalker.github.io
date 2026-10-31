import { ArtLoading } from '../skeleton/ArtLoading';
import type { ReadingPage } from './readingPages';
import { ScenePlaceholder } from './ScenePlaceholder';
import { SphereWorld } from './SphereWorld.web';
import type { ArtProps } from './types';
import { useSystemReducedMotion } from './useSystemReducedMotion.web';

/** A Step 5 page's live Rust scene, its place held by the 3 : 2 skeleton until
 * the first frame. A page without a scene yet, or a scene that cannot start,
 * shows the page's placeholder. */
export function StepFiveScene({ page, width, height, active, reducedMotion }: { page: ReadingPage; width: number; height: number; active: boolean; reducedMotion: boolean }) {
  const systemReduced = useSystemReducedMotion();
  const placeholder = page.placeholder ? <ScenePlaceholder scene={page.placeholder} width={width} height={height} /> : null;
  if (page.webScene !== 'sphere-world') return placeholder;
  // Step 5 pages have no engine art; the kind only names the load for the skeleton.
  const props: ArtProps = { kind: 'grounding-hero', webScene: page.webScene, width, height, active, reducedMotion: reducedMotion || systemReduced };
  return <ArtLoading props={props}>{scene => <SphereWorld {...scene} fallback={placeholder} />}</ArtLoading>;
}
