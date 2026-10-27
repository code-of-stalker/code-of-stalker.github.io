// Rasterizes the declarative sources once: Art's approved seated figure
// (spoken-thought-person.svg) and the words of the page in Disket Mono.
// Red = the opaque cover (outer contour filled, chair included), green = ink
// lines, blue = the body alone (the cover without the chair). The labels are
// white on black, one 128 px row each. Also writes src/generated.rs: the
// body's edges per row (for the scan's marks) and the ink of every label.
// Motion, light and color stay in Rust; these are immutable inputs.
// Run from the project root: node graphics/tuning-questions/tools/prepare-assets.mjs
import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const { chromium } = createRequire(import.meta.url)('playwright');
const scene = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const engine = path.resolve(scene, '../product-engine/engine/assets');
const svg = await readFile(path.join(engine, 'spoken-thought-person.svg'), 'utf8');
const font = (await readFile(path.join(engine, 'fonts/Disket-Mono-Regular.ttf'))).toString('base64');
// The page's words, in the order of the film: the instruction, then each
// question split where it breathes (a quiet half, a bright half); the three
// possible starting points; «факт» and «интерпретация» get the same weight.
// Last, not on the card: the short thought that appears beside the head.
const words = [
  'СКАЖИ ВСЛУХ', 'ЛЮБОЙ ВЫВОД',
  'ОТКУДА ПРИШЁЛ', 'ЭТОТ ВЫВОД?',
  'ЧТО ЯВИЛОСЬ', 'СТАРТОВОЙ ТОЧКОЙ?', 'ОЩУЩЕНИЕ,', 'ОБРАЗ,', 'МЫСЛЬ?',
  'ЕСТЬ ЛИ', 'ФАКТ,', 'ИЛИ ЭТО', 'ИНТЕРПРЕТАЦИЯ?',
  'ЧТО Я ЧУВСТВУЮ ТЕЛОМ,', 'ПОКА ДУМАЮ ЭТО?',
  'ЭТО ЗНАЧИТ...',
];
// 4 px per SVG unit: the close-ups on the face stay crisp.
const K = 4, W = 335 * K, H = 530 * K, ATLAS = 1536;
const browser = await chromium.launch();
const page = await browser.newPage();
const { figure, labels, edges, ink, band } = await page.evaluate(async ({ svg, font, words, K, W, H, ATLAS }) => {
  const face = new FontFace('Disket', `url(data:font/ttf;base64,${font})`);
  await face.load(); document.fonts.add(face);
  const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
  const main = doc.getElementById('silhouette-hands-and-chair').getAttribute('d');
  const outline = main.slice(0, main.indexOf('M', 1));
  const inks = [...doc.querySelectorAll('path')].filter(p => p.id !== 'head-thought-curve').map(p => p.getAttribute('d'));
  const layer = draw => {
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d'); g.setTransform(K, 0, 0, K, 0, 0); draw(g);
    return g.getImageData(0, 0, W, H).data;
  };
  const cover = layer(g => { g.fillStyle = '#fff'; g.fill(new Path2D(outline), 'nonzero'); });
  const lines = layer(g => { g.fillStyle = '#fff'; for (const d of inks) g.fill(new Path2D(d), 'evenodd'); });
  // The chair: its backrest behind the back, the seat under the thigh and its
  // legs; measured on the SVG grid (units). The body keeps the rest.
  const chair = layer(g => {
    g.fillStyle = '#fff';
    g.beginPath();
    g.moveTo(0, 190); g.lineTo(34, 190); g.lineTo(34, 262); g.lineTo(39, 272); g.lineTo(41, 345);
    g.lineTo(212, 335); g.lineTo(220, 335); g.lineTo(220, 368); g.lineTo(200, 530); g.lineTo(0, 530); g.closePath();
    g.fill();
  });
  const out = document.createElement('canvas'); out.width = W; out.height = H;
  const o = out.getContext('2d'); const img = o.createImageData(W, H);
  const body = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) {
    const c = cover[i * 4 + 3], l = lines[i * 4 + 3], k = chair[i * 4 + 3] / 255;
    body[i] = Math.round(c * (1 - k));
    img.data[i * 4] = c; img.data[i * 4 + 1] = l; img.data[i * 4 + 2] = body[i]; img.data[i * 4 + 3] = 255;
  }
  o.putImageData(img, 0, 0);
  // The body's back and front (SVG x) on 65 rows from the top (0) to the
  // bottom (530) of the SVG, a few rows merged so the marks glide.
  const edges = Array.from({ length: 65 }, (_, i) => {
    const y = Math.round(i / 64 * (H - 1));
    let x0 = W, x1 = -1;
    for (let yy = Math.max(0, y - 6); yy <= Math.min(H - 1, y + 6); yy++)
      for (let x = 0; x < W; x++) if (body[yy * W + x] > 127) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); }
    return x1 < 0 ? [0, 0] : [x0 / K, (x1 + 1) / K];
  });
  // Labels: one ATLAS × 128 row per phrase, left aligned.
  const l = document.createElement('canvas'); l.width = ATLAS; l.height = 128 * words.length;
  const t = l.getContext('2d');
  t.fillStyle = '#000'; t.fillRect(0, 0, l.width, l.height);
  t.fillStyle = '#fff'; t.textAlign = 'left'; t.textBaseline = 'alphabetic';
  t.font = '64px Disket';
  if ('letterSpacing' in t) t.letterSpacing = '6px';
  words.forEach((s, i) => t.fillText(s, 24, 128 * i + 86));
  const px = t.getImageData(0, 0, l.width, l.height).data;
  let top = 128, bottom = 0;
  const ink = words.map((_, i) => {
    let x0 = ATLAS, x1 = -1;
    for (let y = 0; y < 128; y++) for (let x = 0; x < ATLAS; x++) {
      if (px[((128 * i + y) * ATLAS + x) * 4] > 24) {
        x0 = Math.min(x0, x); x1 = Math.max(x1, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
      }
    }
    return [x0, x1 + 1];
  });
  return { figure: out.toDataURL('image/png'), labels: l.toDataURL('image/png'), edges, ink, band: [top, bottom + 1] };
}, { svg, font, words, K, W, H, ATLAS });
await browser.close();
await writeFile(path.join(scene, 'assets/figure.png'), Buffer.from(figure.split(',')[1], 'base64'));
await writeFile(path.join(scene, 'assets/labels.png'), Buffer.from(labels.split(',')[1], 'base64'));
const rows = list => list.map(([a, b]) => `    [${a.toFixed(1)}, ${b.toFixed(1)}],`).join('\n');
await writeFile(path.join(scene, 'src/generated.rs'), `//! Generated by tools/prepare-assets.mjs from the figure's SVG and the labels.

/// The body without the chair: back and front (SVG x) on 65 rows, from the
/// top (0) to the bottom (530) of the SVG; [0, 0] where there is no body.
pub const SILHOUETTE: [[f32; 2]; 65] = [
${rows(edges)}
];

/// The labels' atlas: its width and height (px), rows of 128 px.
pub const ATLAS: [f32; 2] = [${ATLAS}.0, ${128 * words.length}.0];
/// Ink of every row (x0, x1, px), in the order of \`tools/prepare-assets.mjs\`.
pub const LABEL_INK: [[f32; 2]; ${words.length}] = [
${rows(ink)}
];
/// The rows' common ink band (top, bottom, px inside a row), accents and
/// commas included. Capitals stand 44 px tall in it.
pub const LABEL_BAND: [f32; 2] = [${band[0].toFixed(1)}, ${band[1].toFixed(1)}];
`);
console.log(`Prepared figure.png (${W} × ${H}), labels.png (${ATLAS} × ${128 * words.length}) and src/generated.rs.`);
