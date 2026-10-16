import type { ArtProps } from './types';
import { RustGlass } from './RustGlass.web';
import { RustVector } from './RustVector.web';
import { useSystemReducedMotion } from './useSystemReducedMotion.web';
export function Art(input: ArtProps) {
  const systemReduced = useSystemReducedMotion();
  const props = systemReduced ? { ...input, reducedMotion: true } : input;
  if(props.kind==='glass'||props.kind==='rain'||props.kind==='gallery'||props.kind==='mirror')return <RustGlass {...props}/>;
  if(props.kind==='attention')return <RustGlass {...props}/>;
  return <RustVector {...props}/>;
}
