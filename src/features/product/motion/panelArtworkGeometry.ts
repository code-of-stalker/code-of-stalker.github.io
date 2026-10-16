import { fitPanelPath } from './glassShape';

export type PanelSource = { uri: string };
export function panelSvg(source: PanelSource) {
  if (!source.uri.startsWith('data:image/svg+xml;utf8,')) throw new Error('PanelArtwork requires a local authored SVG');
  return decodeURIComponent(source.uri.slice('data:image/svg+xml;utf8,'.length));
}
export function panelSvgSize(svg: string) {
  const box = svg.match(/viewBox="([^"]+)"/);
  if (!box) throw new Error('Panel artwork needs source dimensions');
  const [x, y, width, height] = box[1].split(/\s+/).map(Number);
  if (x !== 0 || y !== 0 || !(width > 0 && height > 0)) throw new Error('Invalid panel source dimensions');
  return { width, height };
}
export function fitPanelSvg(svg: string, width: number, height: number) {
  const from = panelSvgSize(svg);
  return svg.replace(/<svg\b[^>]*>/, root => root
    .replace(/width="[^"]+"/, `width="${width}"`).replace(/height="[^"]+"/, `height="${height}"`)
    .replace(/viewBox="[^"]+"/, `viewBox="0 0 ${width} ${height}"`).replace(/preserveAspectRatio="[^"]+"/, 'preserveAspectRatio="xMidYMid meet"'))
    .replace(/<path\b[^>]*>/g, tag => tag.replace(/\bd="([^"]+)"/, (_, path) => `d="${fitPanelPath(path, from.width, from.height, width, height)}"`));
}
