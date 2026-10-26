import type { ArtProps } from './types';
import { TheatreMarionette } from './TheatreMarionette.web';
import { RustGlass } from './RustGlass.web';
import { RustVector } from './RustVector.web';
import { useSystemReducedMotion } from './useSystemReducedMotion.web';
import { CloudDrift } from './CloudDrift.web';
export function Art(input: ArtProps) {
  const systemReduced = useSystemReducedMotion();
  const props = systemReduced ? { ...input, reducedMotion: true } : input;
  if (props.webScene === 'theatre-marionette') return <TheatreMarionette {...props} />;
  // Inline films do not own card geometry, scanner reveal or button hit areas.
  if(props.kind==='grounding-here' && props.presentation!=='card')return <CloudDrift {...props}/>;
  if(props.kind==='glass'||props.kind==='rain'||props.kind==='gallery'||props.kind==='mirror'||props.kind==='voice-presence'||props.kind==='grounding-hero')return <RustGlass {...props}/>;
  if(props.kind==='attention')return <RustGlass {...props}/>;
  return <RustVector {...props}/>;
}
