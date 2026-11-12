// Rasterizes the declarative sources once: the standing person (Art's
// approved figure, spoken-thought-person.svg, above the waist; the hanging
// arm and the legs of tools/standing.js below it), the three other people
// of the room (task-person, task-woman, task-author-person: a man, a woman
// and a stocky adult in a shirt, all standing, facing us) and the words of
// the page in Disket Mono. Figure: red = the opaque cover, green = ink
// lines, blue = the body (the same cover: no chair any more). Others: one
// cell each, red = cover, green = ink. The labels are white on black, one
// 128 px row each. Also writes src/generated.rs: the body's edges per row,
// the plates the character is built of (sites of a relaxed Voronoi mosaic
// over the body) and the ink of every label.
// Motion, light and color stay in Rust; these are immutable inputs.
// Run from the project root: node graphics/persona-dream/tools/prepare-assets.mjs
import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const { chromium } = createRequire(import.meta.url)('playwright');
const scene = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const engine = path.resolve(scene, '../product-engine/engine/assets');
const svg = await readFile(path.join(engine, 'spoken-thought-person.svg'), 'utf8');
const people = await Promise.all(['task-person', 'task-woman', 'task-author-person']
  .map(name => readFile(path.join(engine, `${name}.svg`), 'utf8')));
const font = (await readFile(path.join(engine, 'fonts/Disket-Mono-Regular.ttf'))).toString('base64');
// The page's words, in the order of the film. The three cards (one per
// paragraph): a quiet half, a bright half, and the parts lit in turn. Then
// the tags the character wears and the marks of the picture of the world.
const words = [
  'ЧЕЛОВЕК ЖИВЁТ НЕ СОБОЙ,', 'А ПЕРСОНАЖЕМ', 'ОБРАЗЫ,', 'УСТАНОВКИ,', 'СТРАХИ,', 'ПАМЯТЬ',
  'ОН ЖИВЁТ', 'В КАРТИНЕ МИРА', 'МОЖНО,', 'НЕЛЬЗЯ,', 'ХОРОШО,', 'ПЛОХО',
  'ОН ВЕРИТ', 'В ОБРАЗ СЕБЯ', 'НЕ В ЖИВОЕ Я,', 'НЕ В ПРИСУТСТВИЕ',
  'Я ТАКОЙ-ТО', 'Я НЕ ТАКОЙ', 'Я ДОЛЖЕН', 'Я ХОЧУ',
  'МОЖНО', 'НЕЛЬЗЯ', 'ХОРОШО', 'ПЛОХО',
];
// 4 px per SVG unit: the close-ups on the face stay crisp.
const K = 4, VIEW = [200, 672], W = VIEW[0] * K, H = VIEW[1] * K, ATLAS = 1536;
// The others' cells: CELL px each, OTHER_CELL metres in the world (lib.rs),
// and how tall each person stands in it (m).
const CELL = [280, 760], OTHER_CELL = [0.7, 1.9], HEIGHTS = [1.8, 1.63, 1.72];
const browser = await chromium.launch();
const page = await browser.newPage();
await page.addScriptTag({ path: path.join(scene, 'tools/standing.js') });
const { figure, others, labels, edges, cells, ink, band } = await page.evaluate(async ({ svg, people, font, words, K, VIEW, W, H, ATLAS, CELL, OTHER_CELL, HEIGHTS }) => {
  const pose = globalThis.standing;
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
  // The seated drawing above the waist, the standing part below it.
  const cover = layer(g => {
    g.fillStyle = g.strokeStyle = '#fff';
    g.save(); pose.keep(g); g.fill(new Path2D(outline), 'nonzero'); g.restore();
    pose.cover(g);
  });
  const lines = layer(g => {
    g.fillStyle = g.strokeStyle = '#fff';
    g.save(); pose.keep(g); for (const d of inks) g.fill(new Path2D(d), 'evenodd'); g.restore();
    pose.ink(g);
  });
  const out = document.createElement('canvas'); out.width = W; out.height = H;
  const o = out.getContext('2d'); const img = o.createImageData(W, H);
  const body = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) {
    const c = cover[i * 4 + 3], l = lines[i * 4 + 3];
    body[i] = c;
    img.data[i * 4] = c; img.data[i * 4 + 1] = l; img.data[i * 4 + 2] = c; img.data[i * 4 + 3] = 255;
  }
  o.putImageData(img, 0, 0);
  // The others: each SVG fragment drawn into its cell, feet on the cell's
  // floor, as tall as HEIGHTS says. Cover: every filled shape; ink: the
  // drawing's own lines (filled or stroked).
  const fragment = (source, css) => {
    const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.innerHTML = source.replace(/<defs>/g, '<g>').replace(/<\/defs>/g, '</g>').replace(/<clipPath[\s\S]*?<\/clipPath>/g, '');
    document.body.append(s);
    const b = s.getBBox();
    s.remove();
    const text = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${b.x} ${b.y} ${b.width} ${b.height}" style="color:#fff;--book-cover:#fff"><style>${css}</style>${s.innerHTML}</svg>`;
    return { box: b, text };
  };
  const draw = async (g, text, x, y, w, h) => {
    const node = new Image();
    node.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(text)));
    await node.decode();
    g.drawImage(node, x, y, w, h);
  };
  const atlas = document.createElement('canvas'); atlas.width = CELL[0] * 3; atlas.height = CELL[1];
  const pass = async css => {
    const c = document.createElement('canvas'); c.width = atlas.width; c.height = atlas.height;
    const g = c.getContext('2d');
    for (const [k, source] of people.entries()) {
      const { box, text } = fragment(source, css(k));
      const h = HEIGHTS[k] / OTHER_CELL[1] * CELL[1];
      const w = box.width * h / box.height;
      await draw(g, text, CELL[0] * (k + 0.5) - w / 2, CELL[1] - 3 - h, w, h);
    }
    return g.getImageData(0, 0, c.width, c.height).data;
  };
  const shapes = ['#task-person-shape', '#task-woman-shape', '#task-author-person'];
  const coverPx = await pass(k => `path{fill:none;stroke:none}${shapes[k]} path:not([fill=none]){fill:#fff;stroke:#fff}`);
  const inkPx = await pass(k => k < 2
    ? `${shapes[k]}{display:none}path{stroke:#fff}`
    : 'path{fill:none!important;stroke:#fff}');
  const oc = atlas.getContext('2d'); const oi = oc.createImageData(atlas.width, atlas.height);
  for (let i = 0; i < atlas.width * atlas.height; i++) {
    oi.data[i * 4] = coverPx[i * 4 + 3]; oi.data[i * 4 + 1] = inkPx[i * 4 + 3]; oi.data[i * 4 + 3] = 255;
  }
  oc.putImageData(oi, 0, 0);
  // The body's back and front (SVG x) on 65 rows from the top (0) to the
  // bottom of the SVG, a few rows merged so the marks glide.
  const edges = Array.from({ length: 65 }, (_, i) => {
    const y = Math.round(i / 64 * (H - 1));
    let x0 = W, x1 = -1;
    for (let yy = Math.max(0, y - 6); yy <= Math.min(H - 1, y + 6); yy++)
      for (let x = 0; x < W; x++) if (body[yy * W + x] > 127) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); }
    return x1 < 0 ? [0, 0] : [x0 / K, (x1 + 1) / K];
  });
  // The plates: a jittered grid of sites over the body (SVG units), relaxed
  // three times towards the centres of their cells, so the mosaic is even.
  const inside = (x, y) => x >= 0 && y >= 0 && x < VIEW[0] && y < VIEW[1] && body[Math.floor(y * K) * W + Math.floor(x * K)] > 127;
  const rand = (n => () => ((n = (n * 1664525 + 1013904223) >>> 0) / 4294967296))(7);
  const S = 31;
  let sites = [];
  for (let y = S / 2; y < VIEW[1]; y += S) for (let x = S / 2; x < VIEW[0]; x += S) {
    const p = [x + (rand() - 0.5) * S * 0.7, y + (rand() - 0.5) * S * 0.7];
    if (inside(p[0], p[1])) sites.push(p);
  }
  for (let k = 0; k < 3; k++) {
    const sum = sites.map(() => [0, 0, 0]);
    for (let y = 0.5; y < VIEW[1]; y += 1) for (let x = 0.5; x < VIEW[0]; x += 1) {
      if (!inside(x, y)) continue;
      let best = 0, d = 1e9;
      sites.forEach((s, i) => { const e = (s[0] - x) ** 2 + (s[1] - y) ** 2; if (e < d) { d = e; best = i; } });
      sum[best][0] += x; sum[best][1] += y; sum[best][2]++;
    }
    sites = sites.map((s, i) => sum[i][2] > 20 ? [sum[i][0] / sum[i][2], sum[i][1] / sum[i][2]] : null).filter(Boolean);
  }
  // Top to bottom, so neighbours in the list are neighbours on the body.
  sites.sort((a, b) => a[1] - b[1] || a[0] - b[0]);
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
  return { figure: out.toDataURL('image/png'), others: atlas.toDataURL('image/png'), labels: l.toDataURL('image/png'), edges, cells: sites, ink, band: [top, bottom + 1] };
}, { svg, people, font, words, K, VIEW, W, H, ATLAS, CELL, OTHER_CELL, HEIGHTS });
await browser.close();
await writeFile(path.join(scene, 'assets/figure.png'), Buffer.from(figure.split(',')[1], 'base64'));
await writeFile(path.join(scene, 'assets/others.png'), Buffer.from(others.split(',')[1], 'base64'));
await writeFile(path.join(scene, 'assets/labels.png'), Buffer.from(labels.split(',')[1], 'base64'));
const rows = list => list.map(([a, b]) => `    [${a.toFixed(1)}, ${b.toFixed(1)}],`).join('\n');
await writeFile(path.join(scene, 'src/generated.rs'), `//! Generated by tools/prepare-assets.mjs from the figure's SVG and the labels.

/// The standing body: back and front (SVG x) on 65 rows, from the top (0)
/// to the bottom (${VIEW[1]}) of the SVG; [0, 0] where there is no body.
pub const SILHOUETTE: [[f32; 2]; 65] = [
${rows(edges)}
];

/// The plates the character is built of: the sites of a relaxed Voronoi
/// mosaic over the body (SVG units), top to bottom.
pub const CELLS: [[f32; 2]; ${cells.length}] = [
${rows(cells)}
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
console.log(`Prepared figure.png (${W} × ${H}), others.png (${CELL[0] * 3} × ${CELL[1]}), labels.png (${ATLAS} × ${128 * words.length}), ${cells.length} plates and src/generated.rs.`);
