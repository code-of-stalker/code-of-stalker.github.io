import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'file:///C:/Users/qtas5/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const out = path.dirname(new URL(import.meta.url).pathname.replace(/^\/(?=[A-Za-z]:)/, ''));
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const errors = [], report = {};
try {
  const context = await browser.newContext({ viewport: { width: 1400, height: 940 }, hasTouch: true, acceptDownloads: true });
  const page = await context.newPage(); page.on('pageerror', error => errors.push(String(error)));
  await page.goto('http://127.0.0.1:7474/?component=architecture&illustration=guidance', { waitUntil: 'networkidle' });
  await page.clock.install();
  const editor = page.locator('.architecture-editor'), art = page.locator('.cw-home-scene .architecture-artwork').first();
  const cover = page.locator('.home-preview-cover--architecture button');
  const readPhase = async () => Number(await art.getAttribute('data-guidance-phase'));
  async function expand(name) { const b = editor.getByRole('button', { name, exact: true }); if (await b.getAttribute('aria-expanded') !== 'true') await b.click(); }
  await expand('Время и запуск');
  await editor.getByRole('button', { name: 'По удержанию', exact: true }).click();
  assert.equal(await readPhase(), 0); await page.clock.runFor(700); assert.equal(await readPhase(), 0);
  const box = await cover.boundingBox(), x = box.x + box.width / 2, y = box.y + box.height / 2;
  const cdp = await context.newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  await page.clock.runFor(1600);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  assert((await readPhase()) > .08);
  assert.equal(await page.locator('.cw-home-preview').getAttribute('data-section'), 'home');
  await page.clock.runFor(12000); assert.equal(await readPhase(), .89);
  report.hold = 'starts the sequence without navigation; one pass holds the final frame';
  await cover.tap(); await page.clock.runFor(1800);
  assert.equal(await page.locator('.cw-home-preview').getAttribute('data-section'), 'architecture');
  const section = page.locator('.home-section-preview');
  assert((await section.textContent()).includes('Водительство от проводника'));
  assert(!(await section.innerText()).includes('БАЗОВЫЙ'));
  await section.getByRole('button', { name: 'На главную', exact: true }).click(); await page.clock.runFor(1800);
  report.tap = 'opens the Guidance preview with the matching title';
  await editor.getByRole('button', { name: 'Автоматически', exact: true }).click();
  await editor.getByRole('button', { name: 'С начала', exact: true }).click();
  await page.clock.runFor(4000);
  await editor.getByRole('button', { name: 'Пауза', exact: true }).click();
  const paused = await readPhase(); await page.clock.runFor(2000); assert.equal(await readPhase(), paused);
  await editor.getByRole('button', { name: 'Продолжить', exact: true }).click(); await page.clock.runFor(400); assert((await readPhase()) > paused);
  report.pause = 'resumes from the same point';
  await page.getByRole('button', { name: 'Фон', exact: true }).click();
  const hidden = await readPhase(); await page.clock.runFor(2000); assert.equal(await readPhase(), hidden);
  await page.getByRole('button', { name: 'Компоненты', exact: true }).click(); await page.clock.runFor(300); assert((await readPhase()) > hidden);
  report.inactive = 'suspends when another Laboratory section is active';
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    assert.equal(overflow, false);
    await page.screenshot({ path: path.join(out, `guidance-mobile-${width}.png`) });
  }
  report.mobile = [390, 320];
  assert.deepEqual(errors, []); report.errors = errors;
  await fs.writeFile(path.join(out, 'interaction-report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally { await browser.close(); }
