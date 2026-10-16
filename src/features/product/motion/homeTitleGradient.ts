import sources from '../../../../assets/product/home-gradients/sources.json';
import { neutralColors, violetColors, type ProductColors } from '../theme';

export type HomeTitleGradient = keyof typeof sources;

/** Preserve the supplied viewport and direction; neutral shades follow its paper. */
export function homeTitleGradient(variant: HomeTitleGradient, colors: ProductColors) {
  const background = colors.background;
  let svg = sources[variant]
    .replace('<svg ', '<svg preserveAspectRatio="none" ')
    .replace(/<stop\b/g, `<stop stop-color="${background}"`);
  if (colors === neutralColors || colors === violetColors) {
    // Keep the authored direction and viewport, with a softer shade on the
    // neutral paper. It starts behind the copy and fades into the clear glass.
    svg = svg.replace(/<stop[^>]*\/>(\s*)<stop[^>]*\/>/, `<stop offset="0.25" stop-color="${background}" stop-opacity=".94"/><stop offset=".55" stop-color="${background}" stop-opacity=".64"/><stop offset=".8" stop-color="${background}" stop-opacity=".22"/><stop offset="1" stop-color="${background}" stop-opacity="0"/>`);
  }
  return { uri: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}` };
}
