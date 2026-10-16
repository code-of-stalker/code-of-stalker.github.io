import type { ProductColors } from '../theme';
import { neutralColors, violetColors } from '../theme';

/** Connectors inherit the illustration tone, including its GPU style snapshot. */
export function insightStyles(colors: ProductColors) {
  return colors === neutralColors || colors === violetColors
    ? `[data-connection]{color:${colors.accent}!important;stroke:${colors.accent}!important}`
    : '';
}
