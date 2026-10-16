import { contourDistance, linePolygons, productIconPath, type Point } from './glassShape';

export type ReadingMenuCutout = { left: number; top: number; width: number; height: number };
export const readingMenuClearance = 3;
const halfStroke = .125, epsilon = 1e-6;
const cross = (a: Point, b: Point) => a[0] * b[1] - a[1] * b[0];

/** Offset the actual icon's straight edges, retaining its authored corner angles. */
function outside(points: Point[], distance: number): Point[] {
  const edges = points.map((a, i) => {
    const b = points[(i + 1) % points.length], direction: Point = [b[0] - a[0], b[1] - a[1]];
    const length = Math.hypot(...direction);
    return { point: [a[0] + direction[1] / length * distance, a[1] - direction[0] / length * distance] as Point, direction };
  });
  return edges.map((current, i) => {
    const previous = edges[(i + edges.length - 1) % edges.length];
    const difference: Point = [current.point[0] - previous.point[0], current.point[1] - previous.point[1]];
    const denominator = cross(previous.direction, current.direction);
    if (Math.abs(denominator) < epsilon) return current.point;
    const t = cross(difference, current.direction) / denominator;
    return [previous.point[0] + previous.direction[0] * t, previous.point[1] + previous.direction[1] * t];
  });
}

function clip(points: Point[], axis: 0 | 1, edge: number, sign: number): Point[] {
  const output: Point[] = [];
  for (let i = 0; i < points.length; i++) {
    const a = points[(i + points.length - 1) % points.length], b = points[i];
    const aInside = sign * (a[axis] - edge) >= -epsilon, bInside = sign * (b[axis] - edge) >= -epsilon;
    if (aInside !== bInside) {
      const t = (edge - a[axis]) / (b[axis] - a[axis]);
      output.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
    if (bInside) output.push(b);
  }
  return output;
}

/** A rectangle whose top-right edge goes around the close button with 3px of air.
 * One concave contour drives the fill, outline, content clip and glass field.
 */
export function readingMenuPath(width: number, height: number, cutout?: ReadingMenuCutout) {
  const left = halfStroke, top = halfStroke, right = width - halfStroke, bottom = height - halfStroke;
  const rectangle = `M${left} ${top}H${right}V${bottom}H${left}Z`;
  if (!cutout || width <= .25 || height <= .25) return rectangle;
  const icon = linePolygons(productIconPath(cutout.width, cutout.height))[0]
    .map(([x, y]) => [x + cutout.left, y + cutout.top] as Point);
  // Include half of each .25px outline so the visible edge-to-edge gap is 3px.
  const expanded = outside(icon, readingMenuClearance + 2 * halfStroke);
  if (contourDistance(right, top, [expanded]) >= -epsilon) return rectangle;
  let polygon = expanded;
  for (const [axis, edge, sign] of [[0, left, 1], [0, right, -1], [1, top, 1], [1, bottom, -1]] as const) polygon = clip(polygon, axis, edge, sign);
  polygon.reverse();
  let start = -1, end = -1;
  polygon.forEach((point, i) => {
    if (Math.abs(point[1] - top) < epsilon && (start < 0 || point[0] < polygon[start][0])) start = i;
    if (Math.abs(point[0] - right) < epsilon && (end < 0 || point[1] > polygon[end][1])) end = i;
  });
  if (start < 0 || end < 0 || start === end) return rectangle;
  const boundary: Point[] = [];
  for (let i = start, count = 0; count < polygon.length; i = (i + 1) % polygon.length, count++) {
    boundary.push(polygon[i]);
    if (i === end) break;
  }
  return `M${left} ${top}` + boundary.map(([x, y]) => `L${x} ${y}`).join('') + `L${right} ${bottom}H${left}Z`;
}
