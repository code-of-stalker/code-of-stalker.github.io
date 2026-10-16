import { type DreamArtKind } from './types';
import { dreamCinemaHtml } from './dreamCinema';
import { inwardProjectionHtml } from './inwardProjection';
import { dreamSphereHtml } from './dreamSphere';

/** Four self-contained reading scenes share the current illustration palette. */
export function dreamInsertHtml(kind: DreamArtKind, reducedMotion: boolean) {
  if (kind === 'dream-world' || kind === 'dream-wake') return dreamCinemaHtml(kind, reducedMotion);
  if (kind === 'dream-inward') return inwardProjectionHtml(reducedMotion);
  return dreamSphereHtml(reducedMotion);
}
