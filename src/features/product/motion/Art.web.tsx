import type { ArtProps } from './types';
import { TheatreMarionette } from './TheatreMarionette.web';
import { WorldInGlasses } from './WorldInGlasses.web';
import { SimplePractice } from './SimplePractice.web';
import { RustGlass } from './RustGlass.web';
import { RustVector } from './RustVector.web';
import { useSystemReducedMotion } from './useSystemReducedMotion.web';
import { CloudDrift } from './CloudDrift.web';
import { HearState } from './HearState.web';
import { ArtLoading, holdsPlace } from '../skeleton/ArtLoading';
export function Art(input: ArtProps) {
  const systemReduced = useSystemReducedMotion();
  const props = systemReduced ? { ...input, reducedMotion: true } : input;
  return holdsPlace(props) ? <ArtLoading props={props}>{scene}</ArtLoading> : scene(props);
}
function scene(props: ArtProps) {
  if (props.webScene === 'theatre-marionette') return <TheatreMarionette {...props} />;
  if (props.webScene === 'world-in-glasses') return <WorldInGlasses {...props} />;
  if (props.webScene === 'simple-practice') return <SimplePractice {...props} />;
  if (props.webScene === 'hear-state') return <HearState {...props} />;
  // Inline films do not own card geometry, scanner reveal or button hit areas.
  if(props.kind==='grounding-here' && props.presentation!=='card')return <CloudDrift {...props}/>;
  if(props.kind==='glass'||props.kind==='rain'||props.kind==='gallery'||props.kind==='mirror'||props.kind==='voice-presence'||props.kind==='grounding-hero')return <RustGlass {...props}/>;
  if(props.kind==='attention')return <RustGlass {...props}/>;
  return <RustVector {...props}/>;
}
