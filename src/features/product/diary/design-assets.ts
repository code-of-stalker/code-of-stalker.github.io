import originals from '../../../../assets/product/diary/revision-1288/sources.json';
import type { ProductColors } from '../theme';

export function diaryDesignAsset(name: keyof typeof originals, colors: ProductColors, outlineOnly = false) {
  const svg = originals[name].replaceAll('#F5DD07', colors.accent).replaceAll('#655E46', colors.faint)
    .replaceAll('fill="black"', outlineOnly ? 'fill="none"' : `fill="${colors.background}"`);
  return { uri: 'data:image/svg+xml;utf8,' + encodeURIComponent(svg) };
}
