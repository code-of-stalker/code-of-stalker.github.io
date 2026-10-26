import type { ProductColors } from '../theme';
import { dawnColors, mirageColors, neutralColors, violetColors } from '../theme';
/** Theme roles are saved with the text, so switching themes recolors old notes. */
export function diaryTextColors(colors: ProductColors) {
  if (colors.background === neutralColors.background) return { ...colors, secondary: '#E0B779', muted: colors.accent, faint: '#A9B9E0' };
  if (colors === mirageColors || colors === dawnColors) return { ...colors, secondary: colors.secondary ?? colors.accent };
  if (colors === violetColors) return { ...colors, secondary: colors.secondary ?? colors.accent, muted: colors.accent, faint: '#C080B5' };
  return { ...colors, secondary: colors.background === '#000000' ? '#FF9302' : colors.background === '#FAE18F' ? colors.accent : '#D1BD96' };
}
