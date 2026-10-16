export type GlassShape = { width: number; height: number; path: string; background?: 'orbs' | 'clear' };
export type Point = [number, number];

/** Shared by panel artwork and the glass underneath, at measured layout size. */
export function cutPanelPath(width: number, height: number, cutCorner = 12) {
  const c = Math.min(cutCorner, width / 3, height / 3);
  return `M.25 .25H${width-c}L${width-.25} ${c}V${height-.25}H${c}L.25 ${height-c}Z`;
}

/** The supplied panel contours use absolute M/L/H/V/Z commands only. */
export function linePolygons(path: string): Point[][] {
  const tokens = path.match(/[A-Za-z]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:e[-+]?\d+)?/gi) ?? [];
  const polygons: Point[][] = [];
  let points: Point[] = [], command = '', index = 0, x = 0, y = 0;
  while (index < tokens.length) {
    if (/^[A-Za-z]$/.test(tokens[index])) command = tokens[index++];
    if (command === 'Z') { if (points.length >= 3) polygons.push(points); points = []; command = ''; continue; }
    if (!['M', 'L', 'H', 'V'].includes(command)) throw new Error('Unsupported glass contour');
    if (command === 'M' || command === 'L') {
      x = Number(tokens[index++]); y = Number(tokens[index++]);
      if (command === 'M') { if (points.length >= 3) polygons.push(points); points = []; command = 'L'; }
    } else if (command === 'H') x = Number(tokens[index++]);
    else y = Number(tokens[index++]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error('Invalid glass contour');
    points.push([x, y]);
  }
  if (points.length >= 3) polygons.push(points);
  if (!polygons.length) throw new Error('Empty glass contour');
  return polygons;
}

/** Nine-region fitting: corners keep their authored geometry; only straight spans grow. */
export function fitPanelPath(path: string, fromWidth: number, fromHeight: number, width: number, height: number) {
  if (![fromWidth, fromHeight, width, height].every(value => Number.isFinite(value) && value > 0)) throw new Error('Invalid panel size');
  const polygons = linePolygons(path);
  const caps = [1, 1, 1, 1]; // left, right, top, bottom
  for (const points of polygons) for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length], dx = Math.abs(a[0] - b[0]), dy = Math.abs(a[1] - b[1]);
    // Ignore the tiny authored slant on a long vertical edge.
    if (dx > .001 && dy > .001 && dx / dy >= .5 && dx / dy <= 2) {
      const left = Math.max(a[0], b[0]) + .001, right = fromWidth - Math.min(a[0], b[0]) + .001;
      const top = Math.max(a[1], b[1]) + .001, bottom = fromHeight - Math.min(a[1], b[1]) + .001;
      if (left <= right) caps[0] = Math.max(caps[0], left); else caps[1] = Math.max(caps[1], right);
      if (top <= bottom) caps[2] = Math.max(caps[2], top); else caps[3] = Math.max(caps[3], bottom);
    }
  }
  for (const axis of [0, 1]) {
    const index = axis * 2, factor = Math.min(1, [fromWidth, fromHeight][axis] / (caps[index] + caps[index + 1]));
    caps[index] *= factor; caps[index + 1] *= factor;
  }
  const scale = Math.min(1, width / (caps[0] + caps[1]), height / (caps[2] + caps[3]));
  const fit = (value: number, original: number, target: number, leading: number, trailing: number) => {
    if (value <= leading) return value * scale;
    if (value >= original - trailing) return target - (original - value) * scale;
    return leading * scale + (value - leading) / (original - leading - trailing) * (target - (leading + trailing) * scale);
  };
  return polygons.map(points => points.map(([x, y], index) => `${index ? 'L' : 'M'}${fit(x, fromWidth, width, caps[0], caps[1])} ${fit(y, fromHeight, height, caps[2], caps[3])}`).join('') + 'Z').join('');
}

export const productIconSize = { width: 44, height: 42, buttonHeight: 44 } as const;
export function productIconPath(width: number, height: number) {
  return fitPanelPath('M33.4473 .125L43.875 10.5527V41.875H10.5527L.125 31.4473V.125Z', 44, 42, width, height);
}

export function contourDistance(x: number, y: number, polygons: Point[][]) {
  let squaredDistance = Infinity, inside = false;
  for (const points of polygons) {
    let contained = false;
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const [ax, ay] = points[j], [bx, by] = points[i];
      if ((ay > y) !== (by > y) && x < (bx - ax) * (y - ay) / (by - ay) + ax) contained = !contained;
      const dx = bx - ax, dy = by - ay;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
      const edgeX = x - ax - t * dx, edgeY = y - ay - t * dy;
      squaredDistance = Math.min(squaredDistance, edgeX * edgeX + edgeY * edgeY);
    }
    inside ||= contained;
  }
  const distance = Math.sqrt(squaredDistance);
  return inside ? -distance : distance;
}

/** A small, linearly filtered distance field; geometry is rebuilt only on resize. */
export function contourPixels(shape: GlassShape) {
  const polygons = linePolygons(shape.path), width = Math.min(192, Math.max(16, Math.round(shape.width)));
  const height = Math.min(384, Math.max(16, Math.round(width * shape.height / shape.width)));
  const pixels = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const signed = contourDistance((x + .5) * shape.width / width, (y + .5) * shape.height / height, polygons) / shape.height;
    const packed = Math.round((Math.max(-1, Math.min(1, signed)) + 1) * .5 * 65535), offset = (y * width + x) * 4;
    pixels[offset] = packed >>> 8; pixels[offset + 1] = packed & 255; pixels[offset + 3] = 255;
  }
  return { pixels, width, height };
}

const homeContours = [
  { width: 289, height: 201, path: 'M288.375 180.27L288.339 180.307L268.339 200.338L268.302 200.375L0.125 200.375V200.25L0.168945 0.25V0.125L268.302 0.125L268.339 0.161133L288.339 20.1592L288.375 20.1953L288.375 180.27Z' },
  { width: 344, height: 283, path: 'M343.446 258.577L343.403 258.621L319.584 282.403L319.54 282.446L0.149414 282.446L0.149414 282.298L0.201172 0.297729L0.201172 0.149292L319.54 0.149292L319.584 0.192261L343.403 24.1278L343.446 24.1718L343.446 258.577Z' },
  { width: 393, height: 326, path: 'M392.446 301.577L392.403 301.621L368.584 325.403L368.54 325.446L0.149414 325.446L0.149414 325.298L0.201172 0.297729L0.201172 0.149292L368.54 0.149292L368.584 0.192261L392.403 24.1278L392.446 24.1718L392.446 301.577Z' },
];
export function homeGlassShape(viewport: number, width: number, height: number): GlassShape {
  const source = homeContours[viewport < 375 ? 0 : viewport < 440 ? 1 : 2];
  return { width, height, path: fitPanelPath(source.path, source.width, source.height, width, height), background: 'clear' };
}

export function stepPanelBodyPath(width: number, height: number, top = 33.75) {
  const anchor = width - 136;
  return `M.25 ${top}H${anchor}L${anchor+12} ${top+12}H${anchor+48}L${anchor+60} ${top}H${width-29}L${width-.25} ${top+32}V${height-.25}H.25Z`;
}

export function stepPanelPaths(width: number, height: number, headerHeight = 25) {
  const anchor = width - 136, offset = headerHeight - 25;
  // Grow the straight header to its measured copy; translate the notch and
  // diagonal together, preserving their dimensions and the 8.5px separation.
  const top = `M.25 .25H${width-.25}V${57.5+offset}L${width-29} ${25.25+offset}H${anchor+60}L${anchor+48} ${37.25+offset}H${anchor+12}L${anchor} ${25.25+offset}H.25Z`;
  const body = stepPanelBodyPath(width, height, 33.75 + offset);
  return { top, body, path: top + body };
}
