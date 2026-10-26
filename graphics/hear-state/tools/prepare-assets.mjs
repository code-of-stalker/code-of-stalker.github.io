// Rasterizes the declarative sources once: Art's approved seated figure
// (spoken-thought-person.svg) and the state labels in Disket Mono. Motion,
// light and color stay in Rust; these are immutable inputs.
// Run from the project root: node graphics/hear-state/tools/prepare-assets.mjs
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const scene = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const engine = path.resolve(scene, '../product-engine/engine/assets');
const svg = await readFile(path.join(engine, 'spoken-thought-person.svg'), 'utf8');
const font = (await readFile(path.join(engine, 'fonts/Disket-Mono-Regular.ttf'))).toString('base64');
// The five states of the page, then the question the page asks.
const states = ['УВЕРЕННОСТЬ', 'ТРЕВОГА', 'МАСКА', 'ОТСУТСТВИЕ', 'АВТОМАТИЗМ', 'ИЗ КАКОГО СОСТОЯНИЯ?'];
const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent('<canvas id="c"></canvas>');
const shots = await page.evaluate(async ({ svg, font, states }) => {
  const face = new FontFace('Disket', `url(data:font/ttf;base64,${font})`);
  await face.load(); document.fonts.add(face);
  const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
  const main = doc.getElementById('silhouette-hands-and-chair').getAttribute('d');
  const outline = main.slice(0, main.indexOf('M', 1));
  const inks = [...doc.querySelectorAll('path')].filter(p => p.id !== 'head-thought-curve').map(p => p.getAttribute('d'));
  // Figure: red = opaque cover (the outer contour filled), green = ink lines.
  const W = 1005, H = 1590, k = 3;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
  g.setTransform(k, 0, 0, k, 0, 0);
  g.globalCompositeOperation = 'lighter';
  g.fillStyle = '#f00'; g.fill(new Path2D(outline), 'nonzero');
  g.fillStyle = '#0f0'; for (const d of inks) g.fill(new Path2D(d), 'evenodd');
  const figure = c.toDataURL('image/png');
  // Labels: one 1024 × 128 row per state, white on black.
  const l = document.createElement('canvas'); l.width = 1024; l.height = 128 * states.length;
  const t = l.getContext('2d');
  t.fillStyle = '#000'; t.fillRect(0, 0, l.width, l.height);
  t.fillStyle = '#fff'; t.textAlign = 'center'; t.textBaseline = 'middle';
  t.font = '64px Disket';
  if ('letterSpacing' in t) t.letterSpacing = '6px';
  states.forEach((s, i) => t.fillText(s, 512, 128 * i + 66));
  return { figure, labels: l.toDataURL('image/png') };
}, { svg, font, states });
await browser.close();
const { writeFile } = await import('node:fs/promises');
for (const [name, url] of Object.entries(shots)) await writeFile(path.join(scene, 'assets', `${name}.png`), Buffer.from(url.split(',')[1], 'base64'));
console.log(`Prepared figure.png (1005 × 1590) and labels.png (1024 × ${128 * states.length}).`);
