import { bookScript, bookSvg } from './bookProjection.generated';
import { colors as darkColors, lightColors, matrixColors, neutralColors, violetColors, type ProductColors } from '../theme';

const blend = (a: string, b: string, amount: number) => '#' + [1, 3, 5].map(at =>
  Math.round(parseInt(a.slice(at, at + 2), 16) * (1 - amount) + parseInt(b.slice(at, at + 2), 16) * amount).toString(16).padStart(2, '0')).join('');

export function bookProjectionPalette(colors: ProductColors) {
  const light = colors === lightColors, soft = colors === neutralColors;
  return {
    name: light ? 'light' : soft ? 'neutral' : colors === violetColors ? 'violet' : colors === matrixColors ? 'matrix' : 'dark', soft,
    colors: {
      ink: colors.accent,
      light: light ? colors.accent : soft ? '#D1BD96' : colors === violetColors ? '#C2C4FF' : colors === matrixColors ? '#D4FFDC' : '#FFF9D4',
      cover: blend(colors.background, colors.accent, .025), paper: blend(colors.background, colors.accent, .065),
      edge: blend(colors.background, colors.accent, .12), dim: blend(colors.background, colors.accent, light ? .60 : .30),
      line: blend(colors.background, light ? colors.text : colors.accent, .65),
      bright: blend(colors.background, light ? colors.text : colors.accent, .85),
    },
  };
}

/** One self-contained vector scene: no network, font payload, panel or controls. */
export function bookProjectionHtml(reducedMotion: boolean) {
  const palette = bookProjectionPalette(darkColors);
  const variables = Object.entries(palette.colors).map(([key, value]) => `--book-${key}:${value}`).join(';');
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none';script-src 'unsafe-inline';style-src 'unsafe-inline'"><style>:root{${variables}}html,body{margin:0;width:100%;height:100%;overflow:hidden;background:transparent}.wbq-art{display:block;width:100%;height:100%;pointer-events:none}</style></head><body>${bookSvg}<script>${bookScript}</script><script>window.WatcherArt.update({reducedMotion:${JSON.stringify(reducedMotion)}});</script></body></html>`;
}

/** Start only once a meaningful part of the scene is inside the reading panel. */
export function bookProjectionVisible(bounds: { top: number; height: number } | null, viewport: { offset: number; height: number }) {
  if (!bounds || bounds.height <= 0 || viewport.height <= 0) return false;
  const overlap = Math.min(bounds.top + bounds.height, viewport.offset + viewport.height) - Math.max(bounds.top, viewport.offset);
  return overlap >= Math.min(bounds.height * .55, viewport.height * .65);
}
