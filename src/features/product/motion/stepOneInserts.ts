import { bookProjectionPalette } from './bookProjection';
import { colors } from '../theme';
import { stepOneRuntime } from './stepOneInserts.generated';
import type { StepOneArtKind } from './types';

const n = (value: number) => value.toFixed(3);
const point = (x: number, y: number) => `${n(x)} ${n(y)}`;
const printOutline = 'M0-55C-24-55-37-34-37-7C-37 19-28 45-13 54C-5 59 7 59 16 52C32 40 38 16 37-8C36-36 24-55 0-55Z';

// Open, asymmetric returning ridges, with local bifurcations, rather than
// concentric ovals. Both prints have the same perimeter and different cores.
function fingerprint(whorl: boolean) {
  if (whorl) {
    // A continuous elliptical whorl, split only to give the light separate
    // real ridges to follow. Each turn joins the next at the same tangent.
    return Array.from({ length: 16 }, (_, turn) => {
      const sample = (t: number) => {
        const angle = t * Math.PI * 2, r = 1.6 + t * 2.36;
        return { x: Math.cos(angle) * r * .89 + Math.sin(t * .16) * 2.1, y: Math.sin(angle) * r * 1.34 - 1.5,
          dx: (-Math.sin(angle) * Math.PI * 2 * r + Math.cos(angle) * 2.36) * .89 + Math.cos(t * .16) * .336,
          dy: (Math.cos(angle) * Math.PI * 2 * r + Math.sin(angle) * 2.36) * 1.34 };
      };
      const first = sample(turn);
      let samples = 'M' + point(first.x, first.y);
      for (let i = 0; i < 24; i++) {
        const a = sample(turn + i / 24), b = sample(turn + (i + 1) / 24);
        samples += 'C' + point(a.x + a.dx / 72, a.y + a.dy / 72) + ' ' + point(b.x - b.dx / 72, b.y - b.dy / 72) + ' ' + point(b.x, b.y);
      }
      return `<path class="print-ridge" d="${samples}" stroke-width=".49"/>`;
    }).join('') + '<path d="M-26 26l-3 2M19-26l3 1M9 43l2 4"/>';
  }
  const ridges = Array.from({ length: 16 }, (_, i) => {
    const r = 4 + i * 2.25, top = 10 - r * 1.7;
    return `M${point(-r * .87, 67)}C${point(-r * .5, 34)} ${point(-r * 1.27, top + 17)} ${point(-r * .79, top + 3)}C${point(-r * .43, top - 8)} ${point(r * .52, top - 6)} ${point(r * .75, top + 6)}C${point(r * 1.03, top + 21)} ${point(r * .62, 38)} ${point(r * .34, 67)}`;
  });
  return ridges.map((d, i) => `<path class="print-ridge" d="${d}" stroke-width="${i % 4 === 0 ? '.66' : '.46'}"/>`).join('') +
    '<path d="M-19-35Q-16-40-10-42M19 27Q19 34 24 38M-8 24Q-11 30-9 35"/>';
}

function imprints() {
  return `<defs><clipPath id="print-clip"><path d="${printOutline}"/></clipPath>
    <linearGradient id="print-substrate" x1="0" y1="0" x2="1" y2=".65"><stop stop-color="var(--book-cover)"/><stop offset=".48" stop-color="var(--book-paper)"/><stop offset="1" stop-color="var(--book-cover)"/></linearGradient>
    <linearGradient id="print-sheen"><stop stop-color="var(--book-light)" stop-opacity="0"/><stop offset=".5" stop-color="var(--book-light)" stop-opacity=".18"/><stop offset="1" stop-color="var(--book-light)" stop-opacity="0"/></linearGradient>
    <radialGradient id="print-shadow"><stop stop-color="var(--book-ink)" stop-opacity=".12"/><stop offset="1" stop-color="var(--book-ink)" stop-opacity="0"/></radialGradient>
  </defs>
  <g class="print-comparison" stroke-linecap="round" stroke-linejoin="round">
    <path d="M33 145H255" stroke="var(--book-ink)" stroke-width=".25" opacity=".14"/>
    ${[0, 1].map(i => `<g class="print-specimen" data-side="${i ? 1 : -1}">
      <ellipse class="print-shadow" cy="67" rx="43" ry="5" fill="url(#print-shadow)"/>
      <path d="${printOutline}" transform="translate(0 1.5)" fill="var(--book-edge)"/>
      <path d="${printOutline}" fill="url(#print-substrate)" stroke="var(--book-ink)" stroke-width=".35" stroke-opacity=".38"/>
      <g clip-path="url(#print-clip)">
        <g class="print-engraving" fill="none" stroke="var(--book-ink)" stroke-width=".5" opacity="${i ? '.58' : '.78'}">${fingerprint(!!i)}</g>
        <path class="print-light" d="M-85-65H-64L8 70H-13Z" fill="url(#print-sheen)"/>
        <g class="ridge-glints" fill="none" stroke="var(--book-light)" stroke-width=".7">${Array.from({ length: 4 }, () => '<path pathLength="1" stroke-dasharray=".07 .93"/>').join('')}</g>
      </g>
      <path d="M-23-43C-13-57 11-59 24-42" stroke="var(--book-light)" stroke-width=".4" opacity=".4" fill="none"/>
      <path class="print-detail" d="${i ? 'M-7 5L-2 1L4 6M20 23l4 2' : 'M-7 5L-1 1L5 4M-20 22l3 3'}" stroke="var(--book-light)" stroke-width=".8" fill="none" opacity=".3"/>
    </g>`).join('')}
    <g class="comparison-register" stroke="var(--book-ink)" stroke-width=".4" opacity=".35"><path d="M137 78H151M137 84H151"/><path class="difference-stroke" d="M141 89L148 73"/></g>
    <g stroke="var(--book-ink)" stroke-width=".3" opacity=".22"><path d="M35 36V28H43M245 28H253V36M35 125V133H43M245 133H253V125"/></g>
  </g>`;
}

type P3 = { x: number; y: number; z: number };
function route(u: number, lane: number): P3 {
  const phase = u * Math.PI * 2;
  return { x: 25 + u * 238, y: lane ? 101 + 29 * Math.sin(phase - .5) - 10 * Math.sin(u * Math.PI) : 112 - 57 * Math.sin(u * Math.PI) + 18 * Math.sin(phase), z: lane ? 13 + 12 * Math.cos(phase + .8) : 12 - 12 * Math.cos(phase + .8) };
}
function project(p: P3) { return { x: p.x, y: p.y - p.z * .42 }; }
function ribbonEdge(u: number, lane: number) {
  const p = project(route(u, lane)), a = project(route(Math.max(0, u - .001), lane)), b = project(route(Math.min(1, u + .001), lane));
  const length = Math.hypot(b.x - a.x, b.y - a.y) || 1, w = 3.2 + Math.sin(u * Math.PI) * 2.6;
  return { p, left: { x: p.x - (b.y - a.y) / length * w, y: p.y + (b.x - a.x) / length * w }, right: { x: p.x + (b.y - a.y) / length * w, y: p.y - (b.x - a.x) / length * w } };
}
function spline(points: { x: number; y: number }[], move = true) {
  let d = move ? 'M' + point(points[0].x, points[0].y) : '';
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[Math.max(0, i - 1)], b = points[i], c = points[i + 1], e = points[Math.min(points.length - 1, i + 2)];
    d += 'C' + point(b.x + (c.x - a.x) / 6, b.y + (c.y - a.y) / 6) + ' ' + point(c.x - (e.x - b.x) / 6, c.y - (e.y - b.y) / 6) + ' ' + point(c.x, c.y);
  }
  return d;
}
function livedPaths() {
  const ribbon = (lane: number, from = 0) => {
    const edges = Array.from({ length: 65 }, (_, i) => ribbonEdge(from + (1 - from) * i / 64, lane));
    const left = edges.map(edge => edge.left), right = edges.map(edge => edge.right).reverse();
    const top = spline(left) + 'L' + point(right[0].x, right[0].y) + spline(right, false) + 'Z';
    const under = left.map(p => ({ x: p.x, y: p.y + 2.2 })).reverse();
    const side = spline(left) + 'L' + point(under[0].x, under[0].y) + spline(under, false) + 'Z';
    return `<g class="ribbon-layer" data-lane="${lane}" data-from="${from}">
      <path d="${side}" fill="var(--book-edge)" stroke="var(--book-ink)" stroke-width=".2" stroke-opacity=".28"/>
      <path class="ribbon-surface" d="${top}" fill="url(#ribbon-material-${lane})"/>
      <path class="ribbon-light" d="${top}" fill="url(#ribbon-light-${lane})"/>
      <path d="${spline(left)} ${spline(right)}" stroke="var(--book-ink)" stroke-width=".42" opacity="${lane ? '.5' : '.72'}"/>
      <path d="${spline(edges.map(edge => edge.p))}" stroke="var(--book-ink)" stroke-width=".23" opacity=".19"/>
      ${Array.from({ length: 11 }, (_, i) => {
        const u = (i + 1) / 12;
        if (u < from) return '';
        const edge = ribbonEdge(u, lane), q = lane ? .28 : .52;
        return `<path d="M${point(edge.left.x, edge.left.y)}L${point(edge.left.x + (edge.right.x - edge.left.x) * q, edge.left.y + (edge.right.y - edge.left.y) * q)}" stroke="var(--book-ink)" stroke-width=".3" opacity=".33"/>`;
      }).join('')}
    </g>`;
  };
  return `<defs><radialGradient id="path-ground"><stop stop-color="var(--book-ink)" stop-opacity=".13"/><stop offset="1" stop-color="var(--book-ink)" stop-opacity="0"/></radialGradient>
      ${[0, 1].map(lane => `<linearGradient id="ribbon-material-${lane}" x1="0" y1="0" x2="0" y2="1"><stop stop-color="var(--book-${lane ? 'paper' : 'edge'})"/><stop offset=".52" stop-color="var(--book-cover)"/><stop offset="1" stop-color="var(--book-edge)"/></linearGradient>
        <linearGradient id="ribbon-light-${lane}" class="ribbon-light-gradient" data-lane="${lane}" gradientUnits="userSpaceOnUse" x1="-100" x2="-50"><stop stop-color="var(--book-light)" stop-opacity="0"/><stop offset=".5" stop-color="var(--book-light)" stop-opacity=".3"/><stop offset="1" stop-color="var(--book-light)" stop-opacity="0"/></linearGradient>`).join('')}
    </defs>
    <ellipse cx="144" cy="138" rx="116" ry="12" fill="url(#path-ground)"/>
    <g class="path-sculpture" stroke-linejoin="round" stroke-linecap="round">${ribbon(0)}${ribbon(1)}${ribbon(0, .55)}</g>
    <g fill="none" stroke="var(--book-ink)" stroke-width=".3" opacity=".26"><path d="M25 126V145H42M246 145H263V126"/></g>`;
}

export function stepOneInsertHtml(kind: StepOneArtKind, reducedMotion: boolean) {
  const palette = bookProjectionPalette(colors);
  const variables = Object.entries(palette.colors).map(([key, value]) => `--book-${key}:${value}`).join(';');
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none';script-src 'unsafe-inline';style-src 'unsafe-inline'"><style>:root{${variables}}html,body{margin:0;width:100%;height:100%;overflow:hidden;background:transparent}svg{display:block;width:100%;height:100%;pointer-events:none}</style></head><body>
    <svg class="step-one-insert" data-kind="${kind}" viewBox="0 0 288 176" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${kind === 'identity-imprints' ? 'Одинаковые очертания, два разных отпечатка' : 'Две независимые линии прожитого опыта'}">${kind === 'identity-imprints' ? imprints() : livedPaths()}</svg>
    <script>${stepOneRuntime}</script><script>window.WatcherArt.update({reducedMotion:${JSON.stringify(reducedMotion)}});</script></body></html>`;
}
