import { chromium } from 'file:///C:/Users/qtas5/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const dir = path.dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(await fs.readFile(path.join(dir, 'manifest.json'), 'utf8'));
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const checks = [];
try {
  const page = await browser.newPage({ viewport: { width: 1300, height: 410 } });
  const svgFiles = [];
  for (const file of manifest.files) {
    const svg = await fs.readFile(path.join(dir, file.file), 'utf8');
    assert.ok(!/<(?:image|foreignObject|script|text)\b/.test(svg), file.file + ': fully outlined vector');
    assert.ok(!/(?:https?:\/\/[^"']+(?:\.png|\.ttf)|currentColor|var\()/.test(svg));
    const ids = new Set([...svg.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]));
    for (const match of svg.matchAll(/url\(#([^\)]+)\)/g)) assert.ok(ids.has(match[1]), file.file + ': missing definition ' + match[1]);
    await page.setViewportSize({ width: file.width, height: file.height });
    await page.setContent(`<html><body style="margin:0;background:transparent"><img style="display:block" src="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}"/></body></html>`);
    await page.waitForFunction(() => document.images[0].complete && document.images[0].naturalWidth > 0);
    await page.screenshot({ path: path.join(dir, file.file.replace('.svg','-preview.png')) });
    checks.push({ file: file.file, width: file.width, height: file.height, bytes: Buffer.byteLength(svg), vector: true, rendered: true });
    svgFiles.push({ file, svg });
  }
  const width = 1300, height = 410;
  const gallery = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="${width}" height="${height}" fill="#2b2b2b"/>${svgFiles.map(({file,svg},index) => {
    const scale = Math.min(290 / file.width, 350 / file.height);
    // Separate root SVG viewports preserve each exported panel's local definitions.
    const scoped = svg.replace(/\bid="([^"]+)"/g, `id="panel-${index}-$1"`).replace(/url\(#([^\)]+)\)/g, `url(#panel-${index}-$1)`);
    const contents = scoped.replace(/<\?xml[^>]*>\s*/, '').replace(/<svg\b/, `<svg x="${20+index*320}" y="${(height-file.height*scale)/2}"`).replace(/width="[^"]+" height="[^"]+" viewBox=/, `width="${file.width*scale}" height="${file.height*scale}" viewBox=`);
    return contents;
  }).join('')}</svg>`;
  await fs.writeFile(path.join(dir,'all-screens.svg'), gallery);
  await page.setViewportSize({ width, height });
  await page.setContent(`<html><body style="margin:0"><img src="data:image/svg+xml;base64,${Buffer.from(gallery).toString('base64')}"/></body></html>`);
  await page.waitForFunction(() => document.images[0].complete && document.images[0].naturalWidth > 0);
  await page.screenshot({ path: path.join(dir, 'preview.png') });
  await fs.writeFile(path.join(dir,'verification.json'), JSON.stringify({ checks, passed: true }, null, 2));
  console.log(JSON.stringify(checks));
} finally { await browser.close(); }
