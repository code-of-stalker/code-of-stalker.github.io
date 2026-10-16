import type { ProductColors } from '../theme';
import { colors as darkColors } from '../theme';
import { insightStyles } from './insightTheme';

/** Decoder HTML sits beside the GPU illustration, outside its palette shader. */
export function syncDecoderTheme(shadow: ShadowRoot | null | undefined, colors: ProductColors) {
  if (!shadow) return;
  let style = shadow.querySelector<HTMLStyleElement>('#product-decoder-theme');
  if (!style) { style = document.createElement('style'); style.id = 'product-decoder-theme'; shadow.append(style); }
  style.textContent = colors === darkColors ? '' : `${insightStyles(colors)}
    .mx-decoder-line { color: ${colors.muted} !important; }
    .mx-decoder-line + .mx-decoder-line { color: ${colors.text} !important; }
    .mx-code-glyph[data-locked="false"] { color: ${colors.muted} !important; }
    .mx-code-glyph[data-locked="true"] { color: inherit !important; }
    .mx-code-glyph[data-active="true"] {
      color: ${colors.accent} !important;
      text-shadow: 0 0 calc(8px * var(--iw-light) / .6) ${colors.accent}66 !important;
    }
    .mx-code-symbol { color: inherit !important; }
    .mx-decoder-scan { background: linear-gradient(90deg, transparent, ${colors.accent}, ${colors.text}, ${colors.accent}, transparent) !important; }
    .mx-decoder-terminal { background: ${colors.accent} !important; }
  `;
}
