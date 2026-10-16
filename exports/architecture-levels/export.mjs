import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { chromium } from 'file:///C:/Users/qtas5/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';

const output = path.dirname(fileURLToPath(import.meta.url));
const project = path.resolve(output, '../..');
const require = createRequire(path.join(project, 'package.json'));
const ts = require('typescript');
const architectureDirectory = path.join(project, 'scripts/product-art/src/laboratory/components/architecture');
const presetPath = path.join(project, 'assets/product/motion/laboratory-architecture.json');
const preset = JSON.parse(await fs.readFile(presetPath, 'utf8')).settings;
assert.equal(preset.guidanceVariant, 'parallel');
// Compile the actual application renderer without React or an animation timer.
const modules = await Promise.all(['parallelSettings', 'parallelGeometry', 'parallelRenderer', 'architectureGeometry'].map(async name => {
  const source = await fs.readFile(path.join(architectureDirectory, `${name}.ts`), 'utf8');
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } });
  return `${JSON.stringify(`./${name}`)}:function(module,exports,require){\n${outputText}\n}`;
}));
const parallelBundle = `(()=>{const factories={${modules.join(',')}},cache={};function require(name){if(!cache[name]){const module={exports:{}};cache[name]=module;factories[name](module,module.exports,require);}return cache[name].exports;}window.parallelArt={...require('./parallelRenderer'),...require('./parallelSettings'),...require('./architectureGeometry')};})();`;
const sourcePath = 'C:/Users/qtas5/.codex/visualizations/2026/10/08/01a11b44-4ab7-7a62-8c08-e66ecc7e19ae/architecture-focus.html';
const source = await fs.readFile(sourcePath, 'utf8');
const helpers = source.slice(source.indexOf('  const clamp='), source.indexOf('  const html='));
const artwork = source.slice(source.indexOf('  function light('), source.indexOf('  const apps='));
assert(helpers && artwork.includes('function art(kind)') && artwork.includes('function animate(svg,app)'));

const samples = [
  { kind: 'basic', file: '01-basic.svg', title: 'Базовый', phase: .44 },
  { kind: 'intensive', file: '02-intensive.svg', title: 'Интенсив', phase: .70 },
  { kind: 'guidance', file: '03-guidance.svg', title: 'Водительство от проводника · Параллельный путь', phase: .42 },
];
const settings = { glow: .75, matrixScenario: 'sync', matrixCycle: 11.5, matrixGlow: .3, matrixAmount: 2.5, matrixBrightness: 100, matrixPlatformBrightness: 100, matrixStroke: .75 };
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1000, height: 310 }, deviceScaleFactor: 2 });
  await page.setContent(`<!doctype html><html lang="ru"><head><meta charset="utf-8"><style>
    body{margin:0;background:#070802;color:#e7e100;font:14px sans-serif;padding:20px;display:flex;gap:20px}
    figure{margin:0;width:300px}figcaption{margin-bottom:16px}section{height:230px;display:flex;align-items:center}
    .af-art{display:block;width:100%;height:100%;fill:none;stroke:currentColor;stroke-width:.85;stroke-linecap:round;stroke-linejoin:round;color:#e7e100;--af-ink:#e7e100;--af-warm:#fff7bf;--af-card:#070802}
    .af-dim{opacity:.24}.af-mid{opacity:.52}.af-surface{fill:var(--af-card)}.af-solid{fill:currentColor;stroke:none}.af-warm{color:var(--af-warm)}.af-bloom{filter:blur(4px)}.af-hairline{stroke-width:.5}
  </style></head><body></body></html>`);
  await page.addScriptTag({ content: `${helpers}\nlet svgSerial=0;\n${artwork}\nwindow.levelArt={art,animate};` });
  await page.addScriptTag({ content: parallelBundle });
  const exports = await page.evaluate(({ samples, settings, preset }) => samples.map(sample => {
    const figure = document.createElement('figure');
    const caption = document.createElement('figcaption'); caption.textContent = sample.title;
    const stage = document.createElement('section');
    if (sample.kind === 'guidance') {
      stage.innerHTML = `<svg viewBox="0 0 288 160" width="288" height="160" fill="none" color="${preset.color}" stroke="${preset.color}" stroke-width="${preset.parallel.stroke}" stroke-linecap="round" stroke-linejoin="round" style="width:100%;height:100%"><g transform="${window.parallelArt.architectureArtworkTransform(preset)}"><svg width="288" height="160" viewBox="0 0 288 160" overflow="visible"></svg></g></svg>`;
    } else stage.innerHTML = window.levelArt.art(sample.kind);
    figure.append(caption, stage); document.body.append(figure);
    const original = stage.querySelector('svg');
    if (sample.kind === 'guidance') {
      const parallel = window.parallelArt.normalizeParallelSettings(preset.parallel);
      window.parallelArt.createParallelPath(original.querySelector('svg'), 'guidance-spiral', { ink: preset.color, warm: preset.lightColor, guide: parallel.guideColor }, parallel)(sample.phase, parallel);
      assertSpiral(original);
    } else window.levelArt.animate(original, { settings })(sample.phase, settings.glow, settings);
    function assertSpiral(svg) { if (svg.querySelectorAll('.parallel-edge').length < 80) throw new Error('The current double-helix renderer did not produce its rails'); }

    const clone = original.cloneNode(true);
    // Freeze the source frame and resolve all external CSS/custom properties.
    const originals = [original, ...original.querySelectorAll('*')];
    const clones = [clone, ...clone.querySelectorAll('*')];
    const properties = ['fill', 'fill-opacity', 'stroke', 'stroke-width', 'stroke-opacity', 'stroke-linecap', 'stroke-linejoin', 'stroke-dasharray', 'stroke-dashoffset', 'opacity', 'color', 'stop-color', 'stop-opacity', 'filter', 'mask', 'clip-path'];
    for (let i = 0; i < originals.length; i++) {
      const computed = getComputedStyle(originals[i]);
      clones[i].removeAttribute('style');
      for (const property of properties) {
        let value = computed.getPropertyValue(property);
        value = value.replace(/url\(["']?(?:[^#)]*)#([^"')]+)["']?\)/g, 'url(#$1)');
        if (property === 'filter' && value === 'blur(4px)') value = 'url(#level-soft-glow)';
        if (value && value !== 'none' && !(property === 'stroke-dasharray' && value === '0px')) clones[i].setAttribute(property, value);
        else if (['fill', 'stroke', 'filter', 'mask', 'clip-path'].includes(property)) clones[i].setAttribute(property, value || 'none');
      }
      for (const attribute of [...clones[i].attributes]) {
        if (attribute.name === 'class' || attribute.name.startsWith('data-') || attribute.name === 'aria-hidden') clones[i].removeAttribute(attribute.name);
      }
    }
    const ns = 'http://www.w3.org/2000/svg';
    if (clone.querySelector('[filter="url(#level-soft-glow)"]')) {
      const filter = document.createElementNS(ns, 'filter');
      filter.setAttribute('id', 'level-soft-glow'); filter.setAttribute('x', '-150%'); filter.setAttribute('y', '-150%'); filter.setAttribute('width', '400%'); filter.setAttribute('height', '400%'); filter.setAttribute('color-interpolation-filters', 'sRGB');
      const blur = document.createElementNS(ns, 'feGaussianBlur'); blur.setAttribute('stdDeviation', '4'); filter.append(blur);
      clone.querySelector('defs').append(filter);
    }
    if (sample.kind === 'intensive') {
      // At this source frame synchronization is complete. Flatten its now-uniform masks.
      clones[originals.indexOf(original.querySelector('.matrix-unsynchronized'))].remove();
      clones[originals.indexOf(original.querySelector('.matrix-unified'))].removeAttribute('mask');
    }
    for (const element of [...clone.querySelectorAll('[opacity="0"], [opacity="0.000"]')]) if (!element.closest('defs')) element.remove();
    // Retain only referenced definitions, recursively following their dependencies.
    const definitions = clone.querySelector('defs');
    const used = new Set();
    function collect(node) {
      for (const element of [node, ...node.querySelectorAll('*')]) for (const attribute of element.attributes) {
        for (const match of attribute.value.matchAll(/url\(#([^\)]+)\)/g)) used.add(match[1]);
      }
    }
    for (const element of [...clone.children]) if (element !== definitions) collect(element);
    let size = -1;
    while (size !== used.size) { size = used.size; for (const definition of [...definitions.children]) if (used.has(definition.id)) collect(definition); }
    for (const definition of [...definitions.children]) if (!used.has(definition.id)) definition.remove();
    const viewBox = clone.getAttribute('viewBox').split(' ').map(Number);
    clone.setAttribute('xmlns', ns); clone.setAttribute('width', String(viewBox[2])); clone.setAttribute('height', String(viewBox[3]));
    const title = document.createElementNS(ns, 'title'); title.textContent = sample.title; clone.prepend(title);
    const svg = `<?xml version="1.0" encoding="UTF-8"?>\n${new XMLSerializer().serializeToString(clone)}\n`;
    return { ...sample, svg, width: viewBox[2], height: viewBox[3] };
  }), { samples, settings, preset });

  for (const item of exports) {
    assert(!item.svg.includes('var(') && !item.svg.includes('currentColor'));
    assert(!/<(?:script|image|foreignObject)\b/.test(item.svg));
    assert(item.svg.includes('<path'));
    const missing = [...item.svg.matchAll(/url\(#([^\)]+)\)/g)].filter(match => !item.svg.includes(`id="${match[1]}"`));
    assert.equal(missing.length, 0);
    await fs.writeFile(path.join(output, item.file), item.svg);
  }
  // Verify the exported files themselves, including image-mode SVG rendering.
  await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0;background:#070802;color:#e7e100;font:14px sans-serif;padding:20px;display:flex;gap:20px}figure{margin:0;width:300px}figcaption{margin-bottom:16px}img{width:300px;height:230px;object-fit:contain}</style></head><body>${exports.map(item => `<figure><figcaption>${item.title}</figcaption><img src="data:image/svg+xml;base64,${Buffer.from(item.svg).toString('base64')}"/></figure>`).join('')}</body></html>`);
  await page.waitForFunction(() => [...document.images].every(image => image.complete && image.naturalWidth > 0));
  await page.screenshot({ path: path.join(output, 'preview.png') });
  await fs.writeFile(path.join(output, 'manifest.json'), JSON.stringify({ sources: { basicAndIntensive: sourcePath, guidance: path.join(architectureDirectory, 'parallelRenderer.ts'), guidancePreset: presetPath }, format: 'Static SVG frames, transparent canvas, inline vector styling, no embedded raster images', files: exports.map(({ svg, ...item }) => ({ ...item, bytes: Buffer.byteLength(svg) })) }, null, 2) + '\n');
  console.log(JSON.stringify(exports.map(({ svg, ...item }) => ({ ...item, bytes: Buffer.byteLength(svg) })), null, 2));
} finally { await browser.close(); }
