import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'file:///C:/Users/qtas5/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';

const assets = [
  { file: 'clear-format.svg', background: '#101925' },
  { file: 'clear-format-dark.svg', background: '#000000' },
  { file: 'clear-format-light.svg', background: '#FAE18F' },
];
const icons = await Promise.all(assets.map(async asset => ({
  ...asset,
  svg: await readFile(new URL(asset.file, import.meta.url), 'utf8'),
})));
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 600, height: 176 }, deviceScaleFactor: 2 });
  await page.setContent(`<html><head><style>
    *{box-sizing:border-box}body{margin:0;display:flex}
    .sample{width:200px;height:176px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:24px}
    .large svg{width:64px;height:64px;display:block}
    .small{display:flex;gap:18px;align-items:center}.small svg{display:block}
  </style></head><body>${icons.map(icon => `<div class="sample" style="background:${icon.background}"><div class="large">${icon.svg}</div><div class="small"><span style="display:block;width:16px;height:16px">${icon.svg.replace('width="24" height="24"', 'width="16" height="16"')}</span><span style="display:block;width:20px;height:20px">${icon.svg.replace('width="24" height="24"', 'width="20" height="20"')}</span><span>${icon.svg}</span></div></div>`).join('')}</body></html>`);
  await page.screenshot({ path: fileURLToPath(new URL('preview.png', import.meta.url)) });
  console.log('Rendered neutral, dark and light SVG icons at 16, 20, 24 and 64 pixels.');
} finally {
  await browser.close();
}
