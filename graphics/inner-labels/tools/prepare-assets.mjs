// Rasterizes the scene's only fixed input once: the labels in Disket Mono,
// white on black, one 128 px row each, and below them the word the wind
// almost writes in the grass, in Tektur. Writes assets/labels.png and
// src/generated.rs with the metrics the renderer needs. Everything else (the
// meadow, the wind, the rings) is computed in Rust and its shaders.
// It drives a headless Chrome over the DevTools protocol, so it needs no npm
// package; CHROME=<path> picks the browser.
// Run from the project root:
//   node graphics/inner-labels/tools/prepare-assets.mjs
//   python graphics/lossless-webp.py
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import path from 'node:path';

const scene = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fonts = path.resolve(scene, '../../assets/product/fonts');
const disket = (await readFile(path.join(fonts, 'Disket-Mono-Regular.ttf'))).toString('base64');
const tektur = (await readFile(path.join(fonts, 'Tektur-Medium.ttf'))).toString('base64');
// The labels in the order of lib.rs `LABELS`; the last one is the comment
// that starts to write itself and is taken back.
const words = [
  'ЕСТЬ МЫСЛЬ', 'ЕСТЬ ЭМОЦИЯ', 'ЕСТЬ ИМПУЛЬС', 'ЕСТЬ НАПРЯЖЕНИЕ',
  'ЕСТЬ РАССЛАБЛЕНИЕ', 'ЕСТЬ ФИЗИОЛОГИЯ', 'ЕСТЬ МЫСЛЬ, ПОТОМУ ЧТО...',
];
const WORD = 'почему';
const ATLAS = 1536, ROW = 128, SPACING = 6, WORD_H = 384;

const chrome = process.env.CHROME || (process.platform === 'win32'
  ? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
  : process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : 'google-chrome');
const profile = await mkdtemp(path.join(tmpdir(), 'inner-labels-'));
const port = 9300 + Math.floor(Math.random() * 400);
const browser = spawn(chrome, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--no-first-run', 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
let target;
for (let i = 0; i < 120 && !target; i++) {
  await sleep(250);
  try { target = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find(t => t.type === 'page'); } catch {}
}
if (!target) throw new Error(`no headless Chrome at ${chrome}`);
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise(resolve => ws.addEventListener('open', resolve));
let seq = 0;
const waiting = new Map();
ws.addEventListener('message', event => {
  const m = JSON.parse(event.data);
  if (m.id && waiting.has(m.id)) { waiting.get(m.id)(m); waiting.delete(m.id); }
});
const send = (method, params = {}) => new Promise(resolve => { const id = ++seq; waiting.set(id, resolve); ws.send(JSON.stringify({ id, method, params })); });

const bake = async ({ disket, tektur, words, WORD, ATLAS, ROW, SPACING, WORD_H }) => {
  for (const [name, data] of [['Disket', disket], ['Tektur', tektur]]) {
    const face = new FontFace(name, `url(data:font/ttf;base64,${data})`);
    await face.load();
    document.fonts.add(face);
  }
  const top = ROW * words.length;
  const c = document.createElement('canvas');
  c.width = ATLAS; c.height = top + WORD_H;
  const g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = '#fff'; g.textAlign = 'left'; g.textBaseline = 'alphabetic';
  g.font = '64px Disket';
  g.letterSpacing = `${SPACING}px`;
  words.forEach((s, i) => g.fillText(s, 24, ROW * i + 86));
  const advance = g.measureText('ЕЕЕЕЕЕЕЕЕЕ').width / 10;
  g.letterSpacing = '0px';
  g.font = '300px Tektur';
  g.fillText(WORD, 40, top + 250);
  const px = g.getImageData(0, 0, c.width, c.height).data;
  const lit = (x, y) => px[(y * ATLAS + x) * 4] > 24;
  const scan = (y0, y1) => {
    let x0 = ATLAS, x1 = -1, t = y1, b = y0;
    for (let y = y0; y < y1; y++) for (let x = 0; x < ATLAS; x++) {
      if (lit(x, y)) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); t = Math.min(t, y); b = Math.max(b, y); }
    }
    return [x0, t, x1 + 1, b + 1];
  };
  const rows = words.map((_, i) => scan(ROW * i, ROW * (i + 1)));
  const band = [Math.min(...rows.map(r => r[1] % ROW)), Math.max(...rows.map(r => (r[3] - 1) % ROW + 1))];
  // Capitals of the first row, which has no descender or accent.
  const caps = [rows[0][1], rows[0][3]];
  return { url: c.toDataURL('image/png'), height: c.height, advance, ink: rows.map(r => [r[0], r[2]]), band, caps, word: scan(top, top + WORD_H) };
};
await send('Runtime.enable');
const m = await send('Runtime.evaluate', {
  expression: `(${bake})(${JSON.stringify({ disket, tektur, words, WORD, ATLAS, ROW, SPACING, WORD_H })})`,
  awaitPromise: true, returnByValue: true,
});
ws.close();
browser.kill();
await sleep(300);
await rm(profile, { recursive: true, force: true }).catch(() => {});
if (m.result?.exceptionDetails) throw new Error(m.result.exceptionDetails.exception?.description ?? 'bake failed');
const r = m.result.result.value;

await writeFile(path.join(scene, 'assets/labels.png'), Buffer.from(r.url.split(',')[1], 'base64'));
const f = v => (Number.isInteger(v) ? `${v}.0` : `${Number(v.toFixed(3))}`);
await writeFile(path.join(scene, 'src/generated.rs'), `//! Generated by tools/prepare-assets.mjs from the words of the page.

/// The atlas: its width and height (px). Rows of \`ROW\` px hold the labels
/// in Disket Mono 64 px, letter spacing \`SPACING\`, written from x = \`TEXT_X\`;
/// below them the word the wind almost writes, in Tektur.
pub const ATLAS: [f32; 2] = [${f(ATLAS)}, ${f(r.height)}];
pub const ROW: f32 = ${f(ROW)};
pub const TEXT_X: f32 = 24.0;
pub const SPACING: f32 = ${f(SPACING)};
/// Disket Mono is monospaced: every letter, space and comma takes this much.
pub const ADVANCE: f32 = ${f(r.advance)};
/// Ink of every label row (x0, x1, px), in the order of lib.rs \`LABELS\`.
pub const LABEL_INK: [[f32; 2]; ${words.length}] = [
${r.ink.map(([a, b]) => `    [${f(a)}, ${f(b)}],`).join('\n')}
];
/// The labels' common ink band inside a row (top, bottom, px), commas and
/// descenders included, and where the capitals stand in it.
pub const LABEL_BAND: [f32; 2] = [${f(r.band[0])}, ${f(r.band[1])}];
pub const CAPS: [f32; 2] = [${f(r.caps[0])}, ${f(r.caps[1])}];
/// The ink of the word in the grass (x0, y0, x1, y1, px).
pub const WORD: [f32; 4] = [${r.word.map(f).join(', ')}];
/// Letters of each label.
pub const LABEL_CHARS: [f32; ${words.length}] = [${words.map(w => f([...w].length)).join(', ')}];
`);
console.log(`Prepared labels.png (${ATLAS} × ${r.height}) and src/generated.rs; advance ${r.advance.toFixed(2)} px, word ink ${r.word.join(', ')}.`);
