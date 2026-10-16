import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'file:///C:/Users/qtas5/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const output = path.dirname(new URL(import.meta.url).pathname.replace(/^\/(?=[A-Za-z]:)/, ''));
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const errors = [], report = {};
try {
  const page = await browser.newPage({ viewport: { width: 1536, height: 1000 }, deviceScaleFactor: 1, acceptDownloads: true });
  page.on('pageerror', error => errors.push(String(error)));
  await page.goto('http://127.0.0.1:7474/?component=architecture&illustration=guidance', { waitUntil: 'networkidle' });
  await page.clock.install();
  const home = page.locator('.cw-home-scene'), card = home.locator('.architecture-cover[data-illustration="guidance"]');
  const editor = page.locator('.architecture-editor'), art = card.locator('.architecture-artwork');
  const preset = () => page.evaluate(() => JSON.parse(localStorage.getItem('prince-architecture-cover-v1')).settings);
  const phase = async () => Number(await art.getAttribute('data-guidance-phase'));
  const expand = async name => { const b = editor.getByRole('button', { name, exact: true }); if (await b.getAttribute('aria-expanded') !== 'true') await b.click(); };
  const range = async (label, value) => editor.getByLabel(label, { exact: true }).evaluate((input, next) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, String(next));
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
  await card.waitFor();
  assert.equal((await preset()).illustration, 'guidance');
  assert.equal(await home.locator('.home-preview-cover').count(), 2);
  await editor.getByRole('button', { name: 'Пауза', exact: true }).click();
  await editor.getByRole('button', { name: 'С начала', exact: true }).click();
  assert.equal(await phase(), 0);
  assert.equal(await card.locator('.guidance-guide').getAttribute('opacity'), '0.0000');
  assert.equal(await card.locator('.guidance-self').getAttribute('opacity'), '0.0000');
  await editor.getByRole('button', { name: 'Продолжить', exact: true }).click();
  await page.clock.runFor(4750);
  await editor.getByRole('button', { name: 'Пауза', exact: true }).click();
  assert((await phase()) > .39 && (await phase()) < .5);
  report.geometry = await home.locator('.home-preview-cover--architecture').evaluate(el => ({ width: el.offsetWidth, height: el.offsetHeight }));
  assert.deepEqual(report.geometry, { width: 288, height: 200 });
  await page.screenshot({ path: path.join(output, 'laboratory-guidance-desktop.png') });
  await home.locator('.cw-board').count();
  await page.locator('.cw-board:visible').screenshot({ path: path.join(output, 'guidance-home.png') });
  await expand('Проводник и огоньки');
  await range('Яркость проводника', 1.65);
  assert.equal((await preset()).guidance.guideBrightness, 1.65);
  for (const [name, mode] of [['Пунктир', 'hint'], ['Импульс', 'pulse'], ['Световой путь', 'beam']]) {
    await editor.getByRole('button', { name, exact: true }).click();
    assert.equal((await preset()).guidance.mode, mode);
    assert.equal((await preset()).guidance.guideBrightness, 1.65);
    await page.locator('.home-preview-cover--architecture').screenshot({ path: path.join(output, `guidance-${mode}.png`) });
  }
  await expand('Развилка и направление'); await editor.getByRole('button', { name: 'Вверх', exact: true }).click();
  await expand('Время и запуск');
  const time = editor.getByRole('spinbutton', { name: 'Подсказка и пауза (секунды)', exact: true });
  await time.fill('5.2'); await time.press('Enter');
  assert.equal((await preset()).guidance.hintDuration, 5.2);
  await page.reload({ waitUntil: 'networkidle' });
  assert.equal((await preset()).guidance.mode, 'beam'); assert.equal((await preset()).guidance.branch, 'upper');
  assert.equal((await preset()).guidance.hintDuration, 5.2); assert.equal((await preset()).guidance.guideBrightness, 1.65);
  await editor.getByRole('button', { name: 'Синхронизация', exact: true }).click();
  await editor.getByRole('button', { name: 'Водительство', exact: true }).click();
  assert.equal((await preset()).guidance.hintDuration, 5.2); assert.equal((await preset()).guidance.mode, 'beam');
  await expand('Сохранить и перенести');
  for (const [name, file] of [['TSX ↓', 'PrinceGuidance.tsx'], ['SVG ↓', 'prince-guidance.svg'], ['JSON ↓', 'prince-guidance.json']]) {
    const pending = page.waitForEvent('download'); await editor.getByRole('button', { name, exact: true }).click();
    await (await pending).saveAs(path.join(output, file));
  }
  const svg = await fs.readFile(path.join(output, 'prince-guidance.svg'), 'utf8');
  assert(svg.includes('xmlns="http://www.w3.org/2000/svg"')); assert(!svg.includes('var(--'));
  await editor.getByRole('button', { name: 'Вернуть утверждённый вариант', exact: true }).click();
  assert.equal((await preset()).guidance.guideBrightness, 1.3);
  await editor.locator('input[type=file]').setInputFiles(path.join(output, 'prince-guidance.json'));
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('prince-architecture-cover-v1')).settings.guidance.guideBrightness === 1.65);
  report.persistence = 'settings survive modes, illustrations, reload and JSON roundtrip';
  report.renderer = await page.evaluate(async () => {
    const { createGuidanceJunction } = await import('/src/components/architecture/guidanceRenderer.ts');
    const { defaultGuidanceSettings, guidanceBounds } = await import('/src/components/architecture/guidanceSettings.ts');
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 288 160'); svg.setAttribute('fill', 'none'); svg.setAttribute('stroke', '#E7E100');
    const render = createGuidanceJunction(svg, 'qa-guidance', { ink: '#E7E100', warm: '#FFF7BA', guide: '#FFF7BA' });
    let frames = 0;
    for (const mode of ['hint', 'pulse', 'beam']) for (const branch of ['upper', 'middle', 'lower', 'alternate']) for (const extreme of [null, 0, 1]) {
      const s = { ...defaultGuidanceSettings, mode, branch };
      if (extreme !== null) for (const [key, bounds] of Object.entries(guidanceBounds)) s[key] = bounds[extreme];
      for (const phase of [0, .1, .2, .33, .36, .4, .46, .53, .54, .7, .84, .89, .97, 1]) {
        render(phase, s, 4); frames++;
        if (/(?:NaN|undefined|Infinity)/.test(svg.outerHTML)) throw new Error('Invalid SVG at ' + [mode, branch, phase]);
      }
    }
    render(.5, defaultGuidanceSettings);
    const guide = svg.querySelector('.guidance-guide .guidance-bloom'), self = svg.querySelector('.guidance-self .guidance-bloom');
    if (+guide.getAttribute('opacity') <= +self.getAttribute('opacity')) throw new Error('Guide should be brighter');
    return { frames, guideBrighter: true, svgNodes: svg.querySelectorAll('*').length };
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForFunction(() => document.querySelector('.cw-home-scene .architecture-artwork')?.dataset.guidancePhase === '0.89');
  report.reducedMotion = await phase();
  await page.getByRole('button', { name: 'EN', exact: true }).click();
  assert(!/[А-Яа-яЁё]/.test(await editor.innerText()));
  report.english = true;
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: path.join(output, 'guidance-mobile.png') });
  report.mobile = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth }));
  assert(report.mobile.scrollWidth <= 390);
  assert.deepEqual(errors, []);
  report.errors = errors;
  await fs.writeFile(path.join(output, 'browser-report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally { await browser.close(); }
