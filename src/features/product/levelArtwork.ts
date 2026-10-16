import sources from '../../../assets/product/levels/sources.json';
import type { ProductColors } from './theme';
import type { LevelId } from './content';

export function levelActionArtwork(level: LevelId, color: string) {
  const path = level === 'intensive' ? 'M264 10.6479V0H12L0 12V30L12 42H15.5H264V10.6479Z' : 'M252 0H0V30L12 42H15.5H264V12L252 0Z';
  return { uri: `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="264" height="42" viewBox="0 0 264 42"><path d="${path}" fill="${color}"/></svg>`)}` };
}

/** Preserve Figma paths and root dimensions; glass supplies the background. */
export function levelArtwork(colors: ProductColors, filled = false) {
  return Object.fromEntries(Object.entries(sources).map(([name, svg]) => [name, { uri:
    `data:image/svg+xml;utf8,${encodeURIComponent(svg.replaceAll('fill="black"', `fill="${filled?colors.background:'none'}"`).replaceAll('#F5DD07', colors.accent)
      .replace(/stroke-width="[^"]+"/g, `stroke-width="${name.endsWith('-expanded') ? '.75' : '.25'}"`)
      .replaceAll('<path ', '<path vector-effect="non-scaling-stroke" '))}`,
  }])) as Record<keyof typeof sources, { uri: string }>;
}

/** Native presentation keeps both end caps fixed; only the straight middle grows. */
export function levelFrameSlices(colors: ProductColors, level: LevelId, expanded: boolean, filled: boolean) {
  let svg = sources[`${level}-expanded`];
  const [, , width, height] = svg.match(/viewBox="([^"]+)"/)![1].split(' ').map(Number);
  svg = svg.replaceAll('fill="black"', `fill="${filled ? colors.background : 'none'}"`)
    .replaceAll('#F5DD07', filled ? 'none' : colors.accent)
    .replace(/stroke-width="[^"]+"/g, `stroke-width="${expanded ? '.75' : '.25'}"`)
    .replaceAll('<path ', '<path vector-effect="non-scaling-stroke" ')
    .replace('overflow="visible"', 'overflow="hidden"');
  if (level !== 'basic') svg = svg.replace('<path ', `<g transform="translate(0 ${height}) scale(1 -1)"><path `).replace('</svg>', '</g></svg>');
  const cap = 21, xs = [0, cap, width-cap], ys = [0, cap, height-cap];
  const widths = [cap, width-cap*2, cap], heights = [cap, height-cap*2, cap];
  return { cap, cells: ys.map((y,row) => xs.map((x,column) => ({ uri: `data:image/svg+xml;utf8,${encodeURIComponent(svg
    .replace(/viewBox="[^"]+"/, `viewBox="${x} ${y} ${widths[column]} ${heights[row]}"`)
    .replace(/width="[^"]+"/, `width="${widths[column]}"`).replace(/height="[^"]+"/, `height="${heights[row]}"`))}` }))) };
}
