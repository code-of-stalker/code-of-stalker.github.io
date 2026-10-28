import type { ArtProps } from './types';
import { TheatreMarionette } from './TheatreMarionette.web';
import { WorldInGlasses } from './WorldInGlasses.web';
import { SimplePractice } from './SimplePractice.web';
import { RustGlass } from './RustGlass.web';
import { RustVector } from './RustVector.web';
import { useSystemReducedMotion } from './useSystemReducedMotion.web';
import { CloudDrift } from './CloudDrift.web';
import { HearState } from './HearState.web';
import { TuningQuestions } from './TuningQuestions.web';
import { PersonaDream } from './PersonaDream.web';
import { PersonaProgram } from './PersonaProgram.web';
import { Awakening } from './Awakening.web';
import { PersonaBelief } from './PersonaBelief.web';
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
  if (props.webScene === 'tuning-questions') return <TuningQuestions {...props} />;
  if (props.webScene === 'persona-dream') return <PersonaDream {...props} />;
  if (props.webScene === 'persona-program') return <PersonaProgram {...props} />;
  if (props.webScene === 'awakening') return <Awakening {...props} />;
  if (props.webScene === 'persona-belief') return <PersonaBelief {...props} />;
  // Inline films do not own card geometry, scanner reveal or button hit areas.
  if(props.kind==='grounding-here' && props.presentation!=='card')return <CloudDrift {...props}/>;
  if(props.kind==='glass'||props.kind==='rain'||props.kind==='gallery'||props.kind==='mirror'||props.kind==='voice-presence'||props.kind==='grounding-hero')return <RustGlass {...props}/>;
  if(props.kind==='attention')return <RustGlass {...props}/>;
  return <RustVector {...props}/>;
}
