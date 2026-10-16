import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'file:///C:/Users/qtas5/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const out = path.dirname(new URL(import.meta.url).pathname.replace(/^\/(?=[A-Za-z]:)/, ''));
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const errors = [], report = {};
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto('http://127.0.0.1:7474/?component=architecture&illustration=guidance&guidance=parallel', { waitUntil: 'networkidle' });
  await page.clock.install();
  const editor = page.locator('.architecture-editor'), cover = page.locator('.cw-home-scene [data-guidance-variant="parallel"]');
  const expand = async name => { const b = editor.getByRole('button', { name, exact: true }); if (await b.getAttribute('aria-expanded') !== 'true') await b.click(); };
  const preset = () => page.evaluate(() => JSON.parse(localStorage.getItem('prince-architecture-cover-v1')).settings.parallel);
  await expand('Проводник и свет');
  const toggle = editor.getByRole('checkbox', { name: 'Усиливать второй огонёк при подъёме', exact: true });
  assert.equal(await toggle.isChecked(), false);
  await toggle.check();
  await editor.getByLabel('Усиление к вершине', { exact: true }).evaluate(input => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, '2.5'); input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  assert.equal((await preset()).selfRiseGain, 2.5);
  await editor.getByRole('button', { name: 'С начала', exact: true }).click();
  await page.clock.runFor(2900);
  await editor.getByRole('button', { name: 'Пауза', exact: true }).click();
  const beginning = await cover.locator('.parallel-self .parallel-bloom').getAttribute('r');
  await cover.screenshot({ path: path.join(out, 'light-during-ascent.png') });
  await editor.getByRole('button', { name: 'Продолжить', exact: true }).click();
  await page.clock.runFor(5800);
  await editor.getByRole('button', { name: 'Пауза', exact: true }).click();
  const ending = await cover.locator('.parallel-self .parallel-bloom').getAttribute('r');
  assert(+ending > +beginning);
  await cover.screenshot({ path: path.join(out, 'light-at-the-top.png') });
  await page.screenshot({ path: path.join(out, 'parallel-light-controls.png') });
  report.liveGrowth = { startingBloom: +beginning, finalBloom: +ending };
  report.joins = await page.evaluate(async () => {
    const { createParallelPath } = await import('/src/components/architecture/parallelRenderer.ts');
    const { defaultParallelSettings } = await import('/src/components/architecture/parallelSettings.ts');
    let checked = 0;
    const samples = [];
    for (const brightness of [.2, 1, 1.8]) for (const turns of [1, 2, 3]) {
      const s = { ...defaultParallelSettings, brightness, turns, selfRiseEnabled: true, selfRiseGain: 2.5 };
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      const draw = createParallelPath(svg, 'join-check', { ink: '#E7E100', warm: '#FFF7BA', guide: '#FFF7BA' }, s);
      for (const phase of [.58, .62, .66, .73, .83, .94, .98]) {
        draw(phase, s); const rails = svg.querySelectorAll('.parallel-edge'), exits = svg.querySelectorAll('.parallel-exit');
        for (let side = 0; side < 2; side++) {
          const rail = rails[(side + 1) * turns * 40 - 1], exit = exits[side];
          for (const attr of ['opacity', 'stroke-width', 'stroke-linecap']) if (rail.getAttribute(attr) !== exit.getAttribute(attr) && attr !== 'stroke-linecap') throw new Error('Join mismatch: ' + [brightness, turns, phase, attr]);
          if (rail.getAttribute('stroke-linecap') !== 'butt' || exit.parentElement.getAttribute('stroke-linecap') !== 'butt') throw new Error('Overlapping cap');
          checked++;
        }
        if (/(NaN|undefined|Infinity)/.test(svg.outerHTML)) throw new Error('Invalid SVG');
      }
      if (turns === 1) { draw(.85, s); samples.push({ brightness, rail: +svg.querySelectorAll('.parallel-edge')[39].getAttribute('opacity'), exit: +svg.querySelector('.parallel-exit').getAttribute('opacity'), horizon: +svg.querySelector('.parallel-horizon').getAttribute('opacity') }); }
      draw(.3, { ...s, selfRiseEnabled: false });
      const first = svg.querySelector('.parallel-self .parallel-bloom').getAttribute('r');
      draw(.94, { ...s, selfRiseEnabled: false });
      if (first !== svg.querySelector('.parallel-self .parallel-bloom').getAttribute('r')) throw new Error('Disabled growth changed the traveler');
    }
    return { checked, samples };
  });
  await page.reload({ waitUntil: 'networkidle' });
  assert.equal((await preset()).selfRiseEnabled, true); assert.equal((await preset()).selfRiseGain, 2.5);
  await expand('Сохранить и перенести');
  for (const [name, file] of [['TSX ↓', 'PrinceParallel.tsx'], ['JSON ↓', 'parallel-light.json']]) {
    const pending = page.waitForEvent('download'); await editor.getByRole('button', { name, exact: true }).click(); await (await pending).saveAs(path.join(out, file));
  }
  await page.getByRole('button', { name: 'EN', exact: true }).click();
  assert((await editor.innerText()).includes('Brightness gain at the top'.toUpperCase()) || (await editor.textContent()).includes('Brightness gain at the top'));
  assert(!/[А-Яа-яЁё]/.test(await editor.innerText()));
  report.persistence = 'enabled state and gain survive reload and export';
  assert.deepEqual(errors, []); report.errors = errors;
  await fs.writeFile(path.join(out, 'browser-report.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report, null, 2));
} finally { await browser.close(); }
