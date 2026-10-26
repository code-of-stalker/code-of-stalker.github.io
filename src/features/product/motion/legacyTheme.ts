import { dawnColors, matrixColors, mirageColors, violetColors, type ProductColors } from '../theme';

/** Native WebView and GPU fallback retain the same authored alpha masks. */
export function legacyIllustrationTheme(colors?: ProductColors) {
  // Матрица: the same linear yellow-to-green map as presentation.wgsl, so
  // gold reads as code green and white highlights stay a pale mint.
  if (colors === matrixColors) return filter(MATRIX.map(row => [...row, 0, 0].join(' ')));
  if (colors !== violetColors && colors !== mirageColors && colors !== dawnColors) return '';
  const rgb = (hex: string) => hex.slice(1).match(/../g)!.map(channel => parseInt(channel, 16) / 255);
  const paper = rgb(colors.background), ink = rgb(colors.accent), secondary = rgb(colors.secondary ?? colors.accent);
  // White follows the main accent; red emission adds the secondary tint
  // without changing the scene's alpha, movement or geometry.
  const rows = paper.map((channel, index) => {
    const tint = (secondary[index] - ink[index]) * .4;
    // SVG color matrices read straight RGB: a constant paper offset keeps
    // translucent black pixels seamless when composited onto the same paper.
    return [.68 * (ink[index] - channel) + tint, .30 * (ink[index] - channel) - tint, .02 * (ink[index] - channel), 0, channel].join(' ');
  });
  return filter(rows);
}
const MATRIX = [[0, 0, .9], [.55, .5, 0], [.25, 0, .6]];
const filter = (rows: string[]) => `<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0" style="position:absolute;pointer-events:none" aria-hidden="true"><defs><filter id="product-violet" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="${rows.join(' ')} 0 0 0 1 0"/></filter></defs></svg><style>#art,#prince-gallery-motion,#prince-matrix-mirror{filter:url(#product-violet)}</style>`;

export function syncLegacyIllustrationTheme(shadow: ShadowRoot | null | undefined, colors: ProductColors) {
  if (!shadow) return;
  let definition = shadow.querySelector<HTMLDivElement>('#product-art-theme');
  if (!definition) {
    definition = document.createElement('div'); definition.id = 'product-art-theme';
    definition.style.cssText = 'position:absolute;width:0;height:0;pointer-events:none'; shadow.append(definition);
  }
  definition.innerHTML = legacyIllustrationTheme(colors);
}
