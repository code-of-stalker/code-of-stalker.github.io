import type { ProductColors } from '../theme';

/** The inline composer owns its lips/stop button and lock. Reuse the sphere's
 * existing motion and real microphone signal without duplicating its controls. */
export function inlineVoiceStyles(colors: ProductColors) {
  // The GPU adapter snapshots opacity. Rust later toggles inline display on
  // these glyphs, so display:none alone would leave them in its painted scene.
  return `.voice-recorder{--vr-color:${colors.accent}!important;--vr-light:${colors.accent}!important;color:${colors.accent}!important}
    .voice-recorder .vr-lock,.voice-recorder .vr-lock-gpu,.voice-recorder .vr-mic,.voice-recorder .vr-speaker,.voice-recorder .vr-stop,.voice-recorder .vr-ray{display:none!important;opacity:0!important}`;
}
export function syncInlineVoiceTheme(shadow: ShadowRoot | null | undefined, compact: boolean | undefined, colors: ProductColors) {
  if (!shadow) return;
  let style = shadow.querySelector<HTMLStyleElement>('#product-inline-voice');
  if (!style) { style = document.createElement('style'); style.id = 'product-inline-voice'; shadow.append(style); }
  style.textContent = compact ? inlineVoiceStyles(colors) : '';
}
