import { ArtLoading } from '../skeleton/ArtLoading';
import { DynamicRings } from './DynamicRings.web';
import { InnerEcho } from './InnerEcho.web';
import type { ReadingPage } from './readingPages';
import { ScenePlaceholder } from './ScenePlaceholder';
import { SphereAnchor } from './SphereAnchor.web';
import { SphereEverywhere } from './SphereEverywhere.web';
import { SphereLake } from './SphereLake.web';
import { SphereOrbit } from './SphereOrbit.web';
import { SphereRoom } from './SphereRoom.web';
import { SphereVoice } from './SphereVoice.web';
import { SphereWorld } from './SphereWorld.web';
import type { ArtProps } from './types';
import { useSystemReducedMotion } from './useSystemReducedMotion.web';

/** A Step 5 to 7 page's live Rust scene, its place held by the 3 : 2 skeleton until
 * the first frame. A page without a scene yet, or a scene that cannot start,
 * shows the page's placeholder. */
export function StepFiveScene({ page, width, height, active, reducedMotion }: { page: ReadingPage; width: number; height: number; active: boolean; reducedMotion: boolean }) {
  const systemReduced = useSystemReducedMotion();
  const placeholder = page.placeholder ? <ScenePlaceholder scene={page.placeholder} width={width} height={height} /> : null;
  const Scene = page.webScene === 'sphere-world' ? SphereWorld
    : page.webScene === 'sphere-anchor' ? SphereAnchor
    : page.webScene === 'sphere-room' ? SphereRoom
    : page.webScene === 'sphere-orbit' ? SphereOrbit
    : page.webScene === 'sphere-voice' ? SphereVoice
    : page.webScene === 'sphere-lake' ? SphereLake
    : page.webScene === 'sphere-everywhere' ? SphereEverywhere
    : page.webScene === 'inner-echo' ? InnerEcho
    : page.webScene === 'dynamic-rings' ? DynamicRings : undefined;
  if (!Scene) return placeholder;
  // These pages have no engine art; the kind only names the load for the skeleton.
  const props: ArtProps = { kind: 'grounding-hero', webScene: page.webScene, width, height, active, reducedMotion: reducedMotion || systemReduced };
  return <ArtLoading props={props}>{scene => <Scene {...scene} fallback={placeholder} />}</ArtLoading>;
}
