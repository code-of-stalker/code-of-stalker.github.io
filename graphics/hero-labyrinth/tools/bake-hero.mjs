// Bakes assets/hero.png from assets/hero.svg: the hero of the site's crowd as
// three channels the shader reads (R body, G drawn lines, B a soft glow of the
// body), feet 0.2 of the figure's height above the bottom edge, the figure's
// height 1/1.4 of the image. Run it after changing hero.svg, then
// `python graphics/lossless-webp.py`.
//   node graphics/hero-labyrinth/tools/bake-hero.mjs
// Uses the system Chrome (or CHROME=<path>) over the DevTools protocol, so it
// needs no Playwright.
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scene = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const svg = readFileSync(path.join(scene, 'assets/hero.svg'), 'utf8');
const WIDTH = 512, HEIGHT = 720, GLOW = 18;
const chrome = process.env.CHROME ?? [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
].find(existsSync);
if (!chrome) throw new Error('No Chrome found; set CHROME=<path to chrome>');

const page = `(async () => {
  const ns = 'http://www.w3.org/2000/svg';
  const source = new DOMParser().parseFromString(${JSON.stringify(svg)}, 'image/svg+xml');
  const group = id => source.getElementById(id).innerHTML;
  const probe = document.createElementNS(ns, 'svg');
  probe.innerHTML = '<g>' + group('body') + '</g>';
  document.body.append(probe);
  const box = probe.firstElementChild.getBBox();
  probe.remove();
  const s = ${HEIGHT} / 1.4 / box.height;
  const tx = ${WIDTH} / 2 - (box.x + box.width / 2) * s;
  const ty = ${HEIGHT} - 0.2 * ${HEIGHT} / 1.4 - (box.y + box.height) * s;
  const draw = inner => new Promise((done, fail) => {
    const image = new Image();
    image.onload = () => done(image);
    image.onerror = fail;
    image.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
      '<svg xmlns="' + ns + '" width="${WIDTH}" height="${HEIGHT}" style="color:#fff">'
      + '<g transform="translate(' + tx + ' ' + ty + ') scale(' + s + ')" fill="#fff">' + inner + '</g></svg>');
  });
  const [body, lines] = await Promise.all([draw(group('body')), draw(group('lines'))]);
  const canvas = document.createElement('canvas');
  canvas.width = ${WIDTH}; canvas.height = ${HEIGHT};
  const c = canvas.getContext('2d', { willReadFrequently: true });
  const grab = (image, blur) => {
    c.filter = 'none'; c.fillStyle = '#000'; c.fillRect(0, 0, ${WIDTH}, ${HEIGHT});
    c.filter = blur ? 'blur(' + blur + 'px)' : 'none';
    c.drawImage(image, 0, 0);
    return c.getImageData(0, 0, ${WIDTH}, ${HEIGHT}).data;
  };
  const r = grab(body, 0), g = grab(lines, 0), b = grab(body, ${GLOW});
  const out = c.createImageData(${WIDTH}, ${HEIGHT});
  for (let i = 0; i < out.data.length; i += 4) {
    out.data[i] = r[i]; out.data[i + 1] = g[i]; out.data[i + 2] = b[i]; out.data[i + 3] = 255;
  }
  c.filter = 'none';
  c.putImageData(out, 0, 0);
  return canvas.toDataURL('image/png');
})()`;

const profile = mkdtempSync(path.join(tmpdir(), 'bake-hero-'));
const port = 9400 + Math.floor(Math.random() * 400);
const browser = spawn(chrome, [`--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--headless=new', 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(done => setTimeout(done, ms));
try {
  let target;
  for (let i = 0; i < 80 && !target; i++) {
    try { target = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find(t => t.type === 'page'); } catch { /* not up yet */ }
    if (!target) await sleep(250);
  }
  if (!target) throw new Error('Chrome did not open a page');
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise(done => socket.addEventListener('open', done));
  const reply = await new Promise(done => {
    socket.addEventListener('message', event => { const m = JSON.parse(event.data); if (m.id === 1) done(m); });
    socket.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression: page, awaitPromise: true, returnByValue: true } }));
  });
  socket.close();
  const url = reply.result?.result?.value;
  if (typeof url !== 'string') throw new Error('Bake failed: ' + JSON.stringify(reply.result?.exceptionDetails ?? reply).slice(0, 600));
  const file = path.join(scene, 'assets/hero.png');
  writeFileSync(file, Buffer.from(url.slice(url.indexOf(',') + 1), 'base64'));
  console.log(`${file}: ${WIDTH}×${HEIGHT}`);
} finally {
  browser.kill();
  await sleep(300);
  rmSync(profile, { recursive: true, force: true });
}
