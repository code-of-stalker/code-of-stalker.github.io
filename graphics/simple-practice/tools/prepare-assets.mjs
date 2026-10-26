// Rasterizes Art's approved seated figure (spoken-thought-person.svg) once.
// Red = the opaque cover (outer contour filled, chair included), green = ink
// lines, blue = the body alone (the cover without the chair), so Rust can
// light the person and leave the chair quiet. Motion, light and color stay in
// Rust; this is an immutable input.
// Run from the project root: node graphics/simple-practice/tools/prepare-assets.mjs
import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const { chromium } = createRequire(import.meta.url)('playwright');
const scene = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const engine = path.resolve(scene, '../product-engine/engine/assets');
const svg = await readFile(path.join(engine, 'spoken-thought-person.svg'), 'utf8');
// 4 px per SVG unit: the close-ups on the feet and the face stay crisp.
const K = 4, W = 335 * K, H = 530 * K;
const browser = await chromium.launch();
const page = await browser.newPage();
const url = await page.evaluate(async ({ svg, K, W, H }) => {
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
  const ink = layer(g => { g.fillStyle = '#fff'; for (const d of inks) g.fill(new Path2D(d), 'evenodd'); });
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
  for (let i = 0; i < W * H; i++) {
    const c = cover[i * 4 + 3], l = ink[i * 4 + 3], k = chair[i * 4 + 3] / 255;
    img.data[i * 4] = c; img.data[i * 4 + 1] = l; img.data[i * 4 + 2] = Math.round(c * (1 - k)); img.data[i * 4 + 3] = 255;
  }
  o.putImageData(img, 0, 0);
  return out.toDataURL('image/png');
}, { svg, K, W, H });
await browser.close();
await writeFile(path.join(scene, 'assets/figure.png'), Buffer.from(url.split(',')[1], 'base64'));
console.log(`Prepared figure.png (${W} × ${H}).`);
