import reviewSource from '../../../assets/product/review/sources.json';
import hintSource from '../../../assets/product/hint-frames.json';
import type { ProductColors } from './theme';
const source = { ...reviewSource, ...hintSource };

/** Preserve authored contours; stroke width remains in CSS pixels when resized. */
export function panelAsset(name: keyof typeof source, colors: ProductColors, filled = false) {
  const svg = source[name].replaceAll('fill="black"', `fill="${filled ? colors.accent : 'none'}"`)
    .replaceAll('#F5DD07', colors.accent).replace(/stroke-width="[^"]+"/g, 'stroke-width=".25"')
    .replaceAll('<path ', '<path vector-effect="non-scaling-stroke" ');
  return { uri: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}` };
}
