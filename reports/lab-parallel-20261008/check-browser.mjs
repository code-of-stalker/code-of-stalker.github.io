import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'file:///C:/Users/qtas5/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const out = path.dirname(new URL(import.meta.url).pathname.replace(/^\/(?=[A-Za-z]:)/, ''));
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const errors = [], report = {};
try {
  const context = await browser.newContext({ viewport: { width: 1536, height: 1000 }, hasTouch: true, acceptDownloads: true });
  const page = await context.newPage(); page.on('pageerror', e => errors.push(String(e)));
  await page.goto('http://127.0.0.1:7474/?component=architecture&illustration=guidance&guidance=parallel', { waitUntil: 'networkidle' });
  await page.clock.install();
  const editor = page.locator('.architecture-editor'), home = page.locator('.cw-home-scene');
  const cover = home.locator('[data-guidance-variant="parallel"]');
  const art = () => cover.locator('.architecture-artwork');
  const phase = async () => Number(await art().getAttribute('data-parallel-phase'));
  const preset = () => page.evaluate(() => JSON.parse(localStorage.getItem('prince-architecture-cover-v1')).settings);
  const expand = async name => { const button = editor.getByRole('button', { name, exact: true }); if (await button.getAttribute('aria-expanded') !== 'true') await button.click(); };
  const range = async (label, value) => editor.getByLabel(label, { exact: true }).evaluate((input, next) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, String(next)); input.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
  await cover.waitFor();
  assert.equal((await preset()).guidanceVariant, 'parallel');
  await editor.getByRole('button', { name: 'Пауза', exact: true }).click();
  await editor.getByRole('button', { name: 'С начала', exact: true }).click();
  assert.equal(await phase(), 0); assert.equal(await cover.locator('.parallel-guide').getAttribute('opacity'), '0.0000');
  assert.equal(await cover.locator('.parallel-self').getAttribute('opacity'), '0.0000');
  await editor.getByRole('button', { name: 'Продолжить', exact: true }).click();
  await page.clock.runFor(3850);
  await editor.getByRole('button', { name: 'Пауза', exact: true }).click();
  assert((await phase()) > .3 && (await phase()) < .4);
  report.card = await home.locator('.home-preview-cover--architecture').evaluate(node => ({ width: node.offsetWidth, height: node.offsetHeight }));
  assert.deepEqual(report.card, { width: 288, height: 200 });
  await page.screenshot({ path: path.join(out, 'parallel-laboratory-desktop.png') });
  await page.locator('.cw-board:visible').screenshot({ path: path.join(out, 'parallel-home.png') });
  for (const [name, mode] of [['Рядом', 'together'], ['Диалог', 'dialogue'], ['Световая лента', 'ribbon']]) {
    await editor.getByRole('button', { name, exact: true }).click();
    assert.equal((await preset()).parallel.mode, mode);
    await home.locator('.home-preview-cover--architecture').screenshot({ path: path.join(out, `parallel-${mode}.png`) });
  }
  await expand('Геометрия спирали'); await range('Ширина спирали', 55);
  await expand('Проводник и свет'); await range('Яркость проводника', 1.65);
  await editor.getByRole('button', { name: 'Подсказка в узле', exact: true }).click();
  assert.equal((await preset()).guidanceVariant, 'junction');
  await expand('Проводник и огоньки'); await range('Яркость проводника', 1.9);
  await editor.getByRole('button', { name: 'Параллельный путь', exact: true }).click();
  let s = await preset(); assert.equal(s.parallel.mode, 'ribbon'); assert.equal(s.parallel.radius, 55); assert.equal(s.parallel.guideBrightness, 1.65); assert.equal(s.guidance.guideBrightness, 1.9);
  await expand('Время и запуск');
  const input = editor.getByRole('spinbutton', { name: 'Пауза и затухание (секунды)', exact: true });
  await input.fill('4.8'); await input.press('Enter');
  await page.goto('http://127.0.0.1:7474/?component=architecture', { waitUntil: 'networkidle' });
  assert.equal((await preset()).guidanceVariant, 'parallel'); assert.equal((await preset()).parallel.finalDuration, 4.8);
  await expand('Сохранить и перенести');
  for (const [name, file] of [['TSX ↓', 'PrinceParallel.tsx'], ['SVG ↓', 'prince-parallel.svg'], ['JSON ↓', 'prince-parallel.json']]) {
    const pending = page.waitForEvent('download'); await editor.getByRole('button', { name, exact: true }).click(); await (await pending).saveAs(path.join(out, file));
  }
  const svgText = await fs.readFile(path.join(out, 'prince-parallel.svg'), 'utf8');
  assert(svgText.includes('xmlns="http://www.w3.org/2000/svg"')); assert(svgText.includes('parallel-rails')); assert(!svgText.includes('var(--'));
  await editor.getByRole('button', { name: 'Вернуть утверждённый вариант', exact: true }).click();
  assert.equal((await preset()).parallel.radius, 43); assert.equal((await preset()).guidance.guideBrightness, 1.9);
  await editor.locator('input[type=file]').setInputFiles(path.join(out, 'prince-parallel.json'));
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('prince-architecture-cover-v1')).settings.parallel.radius === 55);
  report.persistence = 'junction and parallel remain independent through switching, reload, reset and JSON import';
  report.geometryAndModes = await page.evaluate(async () => {
    const { createParallelPath } = await import('/src/components/architecture/parallelRenderer.ts');
    const { defaultParallelSettings, parallelBounds } = await import('/src/components/architecture/parallelSettings.ts');
    let frames = 0;
    for (const mode of ['together', 'dialogue', 'ribbon']) for (const finale of ['confirm', 'echo', 'quiet']) for (const extreme of [null, 0, 1]) {
      const s = { ...defaultParallelSettings, mode, finale };
      if (extreme !== null) for (const [key, bounds] of Object.entries(parallelBounds)) s[key] = bounds[extreme];
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      const draw = createParallelPath(svg, 'check-parallel', { ink: '#E7E100', warm: '#FFF7BA', guide: '#FFF7BA' }, s);
      let settled;
      for (const t of [0, .1, .2, .35, .51, .6, .66, .73, .78, .83, .89, .94, .955, 1]) {
        draw(t, s); frames++;
        if (/(?:NaN|undefined|Infinity)/.test(svg.outerHTML)) throw new Error('Invalid SVG');
        const points = ['.parallel-guide', '.parallel-self'].map(selector => svg.querySelector(selector).getAttribute('transform'));
        if (t === .66) settled = points.join('|');
        if (t > .66 && settled !== points.join('|')) throw new Error('Finale moved a light after settling');
        if (t === 0 && +svg.querySelector('.parallel-guide').getAttribute('opacity') !== 0) throw new Error('Light starts on');
        if (t === .73 && finale === 'quiet' && +svg.querySelector('.parallel-confirm').getAttribute('opacity') !== 0) throw new Error('Quiet finale should not flash');
      }
    }
    return { frames, finalPositionsStable: true, startsWithoutLight: true };
  });
  // Return to the approved geometry for motion and finale screenshots.
  await editor.getByRole('button', { name: 'Вернуть утверждённый вариант', exact: true }).click();
  await editor.getByRole('button', { name: 'Продолжить', exact: true }).click();
  await editor.getByRole('button', { name: 'С начала', exact: true }).click();
  await page.clock.runFor(8300);
  await editor.getByRole('button', { name: 'Пауза', exact: true }).click();
  assert((await phase()) > .73 && (await phase()) < .8);
  await home.locator('.home-preview-cover--architecture').screenshot({ path: path.join(out, 'parallel-final-impulse.png') });
  const settled = await cover.locator('.parallel-guide').getAttribute('transform');
  await editor.getByRole('button', { name: 'Продолжить', exact: true }).click(); await page.clock.runFor(1800);
  await editor.getByRole('button', { name: 'Пауза', exact: true }).click();
  assert.equal(await cover.locator('.parallel-guide').getAttribute('transform'), settled);
  await home.locator('.home-preview-cover--architecture').screenshot({ path: path.join(out, 'parallel-final-hold.png') });
  await expand('Время и запуск'); await editor.getByRole('button', { name: 'По удержанию', exact: true }).click();
  await editor.getByRole('button', { name: 'Продолжить', exact: true }).click();
  await page.clock.runFor(400); assert.equal(await phase(), 0);
  const box = await cover.boundingBox(), cdp = await context.newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x + box.width / 2, y: box.y + box.height / 2 }] });
  await page.clock.runFor(1700); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  assert((await phase()) > .1); assert.equal(await page.locator('.cw-home-preview').getAttribute('data-section'), 'home');
  await page.clock.runFor(12000); assert.equal(await phase(), .94);
  report.touch = 'hold starts, release continues, single pass keeps the calm final frame';
  await cover.tap(); await page.clock.runFor(1500);
  const section = page.locator('.home-section-preview');
  assert((await section.textContent()).includes('ПАРАЛЛЕЛЬНЫЙ ПУТЬ'));
  await section.getByRole('button', { name: 'На главную', exact: true }).click(); await page.clock.runFor(1500);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForFunction(() => document.querySelector('[data-guidance-variant="parallel"] .architecture-artwork')?.dataset.parallelPhase === '0.94');
  report.reducedMotion = await phase();
  await page.getByRole('button', { name: 'EN', exact: true }).click(); assert(!/[А-Яа-яЁё]/.test(await editor.innerText()));
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: path.join(out, `parallel-mobile-${width}.png`) });
  }
  report.mobile = [390, 320]; report.errors = errors; assert.deepEqual(errors, []);
  await fs.writeFile(path.join(out, 'browser-report.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report, null, 2));
} finally { await browser.close(); }
