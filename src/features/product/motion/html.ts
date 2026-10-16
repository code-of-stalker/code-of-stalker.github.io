import { galleryHtml, laboratoryHtml, mirrorHtml } from './art.generated';
import type { ArtKind } from './types';
import { isDreamArt, isStepOneArt } from './types';
import type { VoiceSpectrum } from '../audio/spectrum';
import type { GlassShape } from './glassShape';
import type { ProductColors } from '../theme';
import { inlineVoiceStyles } from './inlineVoiceTheme';
import { insightStyles } from './insightTheme';
import { legacyIllustrationTheme } from './legacyTheme';
import { bookProjectionHtml, bookProjectionPalette } from './bookProjection';
import { stepTwoInsertHtml } from './stepTwoInserts';
import { dreamInsertHtml } from './dreamInserts';
import { stepOneInsertHtml } from './stepOneInserts';

export function artHtml(kind: ArtKind, reducedMotion = false, presentation: 'card' | 'artwork' = 'artwork', scanOnMount = true, externalGlass = false, inlineVoiceColors?: ProductColors, illustrationColors?: ProductColors) {
  if (kind === 'book') return bookProjectionHtml(reducedMotion);
  if (kind === 'reflections' || kind === 'single-hero') return stepTwoInsertHtml(kind, reducedMotion);
  if (isDreamArt(kind)) return dreamInsertHtml(kind, reducedMotion);
  if (isStepOneArt(kind)) return stepOneInsertHtml(kind, reducedMotion);
  const template = kind === 'gallery' ? galleryHtml : kind === 'mirror' ? mirrorHtml : laboratoryHtml;
  let html = template.replace('__WATCHER_ART_INITIAL_JSON__', JSON.stringify({ kind, active: false, decoderVisible: false, reducedMotion, level: 0, presentation, scanOnMount, externalGlass }));
  html = html.replace('<body>', `<body>${legacyIllustrationTheme(illustrationColors)}`);
  if (kind === 'voice' && inlineVoiceColors) html = html.replace('</head>', `<style>${inlineVoiceStyles(inlineVoiceColors)}</style></head>`);
  if (kind !== 'insight') return html;
  if (illustrationColors) html = html.replace('</head>', `<style>${insightStyles(illustrationColors)}</style></head>`);
  // The native/legacy document reports the same actual completion as Rust.
  return html.replace('</body>', `<script>(()=>{let done=false;const watch=()=>{const el=document.querySelector('.mx-decoder');if(!el)return;mount.disconnect();const check=()=>{if(done||el.dataset.motionState!=='settled')return;done=true;state.disconnect();const value={type:'watcher-decoder-complete'};if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(JSON.stringify(value));else parent.postMessage(value,'*');};const state=new MutationObserver(check);state.observe(el,{attributes:true,attributeFilter:['data-motion-state']});check();};const mount=new MutationObserver(watch);mount.observe(document.body,{childList:true,subtree:true});watch();})();</script></body>`);
}

export function artUpdate(props: { glass?: GlassShape; active: boolean; decoderVisible?: boolean; reducedMotion: boolean; level: number; spectrum?: VoiceSpectrum; mode?: 'idle' | 'record' | 'playback'; lockProgress?: number; locked?: boolean; bookColors?: ProductColors }) {
  const { bookColors, ...rest } = props;
  return { type: 'watcher-art', props: { ...rest, ...(bookColors ? { bookPalette: bookProjectionPalette(bookColors) } : {}), spectrum: props.spectrum ? { ...props.spectrum, contour: props.spectrum.contour ? Array.from(props.spectrum.contour) : undefined } : undefined,
    level: Number.isFinite(props.level) ? Math.max(0, Math.min(1, props.level)) : 0 } };
}
