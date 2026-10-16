import { chromium } from 'file:///C:/Users/qtas5/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const output = path.dirname(fileURLToPath(import.meta.url));
await fs.mkdir(path.join(output, 'editable'), { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--enable-unsafe-webgpu'] });
const context = await browser.newContext({ viewport: { width: 1000, height: 800 }, hasTouch: true });
const page = await context.newPage(); page.setDefaultTimeout(30000);
const errors = []; page.on('pageerror', e => errors.push(String(e)));
const files = [];

async function capture(locator, filename, title, background) {
  await locator.waitFor(); await page.waitForTimeout(700);
  const data = await locator.evaluate(async (root, { title, background }) => {
    const ns = 'http://www.w3.org/2000/svg', bounds = root.getBoundingClientRect();
    const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
    const number = n => Number(n.toFixed(4)), definitions = [], text = [];
    let sequence = 0;
    const rect = (r, dx, dy) => ({ x: r.x + dx - bounds.x, y: r.y + dy - bounds.y, width: r.width, height: r.height });
    const canvas = document.createElement('canvas'), measure = canvas.getContext('2d');
    function normalizeReference(value) { return value.replace(/url\(["']?[^#)]*#([^"')]+)["']?\)/g, 'url(#$1)'); }
    function freezeSvg(original) {
      const clone = original.cloneNode(true), source = [original, ...original.querySelectorAll('*')], target = [clone, ...clone.querySelectorAll('*')];
      const props = ['display', 'visibility', 'fill', 'stroke', 'stroke-width', 'stroke-opacity', 'fill-opacity', 'stroke-linecap', 'stroke-linejoin', 'stroke-dasharray', 'stroke-dashoffset', 'opacity', 'color', 'stop-color', 'stop-opacity', 'filter', 'clip-path', 'mask'];
      for (let i = 0; i < source.length; i++) {
        const css = source[i].ownerDocument.defaultView.getComputedStyle(source[i]); target[i].removeAttribute('style');
        for (const property of props) {
          let value = normalizeReference(css.getPropertyValue(property));
          if (property === 'filter' && /^blur\((.*)px\)$/.test(value)) {
            const id = `blur-${++sequence}`, deviation = parseFloat(value.match(/^blur\((.*)px\)$/)[1]);
            definitions.push(`<filter id="${id}" x="-100%" y="-100%" width="300%" height="300%" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="${deviation}"/></filter>`); value = `url(#${id})`;
          }
          if (value) target[i].setAttribute(property, value);
        }
        for (const attr of [...target[i].attributes]) if (attr.name === 'class' || attr.name.startsWith('data-')) target[i].removeAttribute(attr.name);
      }
      // Resolve transforms relative to this SVG's coordinate system.
      for (let i = 0; i < source.length; i++) {
        const css = source[i].ownerDocument.defaultView.getComputedStyle(source[i]);
        if (source[i] !== original && css.transform !== 'none' && !source[i].hasAttribute('transform')) target[i].setAttribute('transform', css.transform);
      }
      clone.setAttribute('xmlns', ns); return clone;
    }
    async function walk(node, dx = 0, dy = 0) {
      if (node.nodeType === Node.TEXT_NODE) {
        if (!node.textContent.trim()) return '';
        const css = node.ownerDocument.defaultView.getComputedStyle(node.parentElement);
        measure.font = `${css.fontStyle} ${css.fontWeight} ${css.fontSize} ${css.fontFamily}`;
        const metrics = measure.measureText('Hg'); let svg = '';
        const content = css.textTransform === 'uppercase' ? node.textContent.toUpperCase() : node.textContent;
        for (let i = 0; i < node.textContent.length; i++) {
          const range = node.ownerDocument.createRange(); range.setStart(node, i); range.setEnd(node, i + 1);
          const raw = range.getBoundingClientRect(), box = rect(raw, dx, dy);
          if (!raw.height || !raw.width || /\s/.test(content[i])) continue;
          const id = `letter-${++sequence}`, baseline = box.y + metrics.fontBoundingBoxAscent;
          const item = { id, value: content[i], x: number(box.x), y: number(baseline), size: parseFloat(css.fontSize), family: css.fontFamily, weight: css.fontWeight, italic: css.fontStyle === 'italic', color: css.color };
          text.push(item);
          svg += `<text id="${id}" x="${item.x}" y="${item.y}" font-family="${escape(css.fontFamily)}" font-size="${item.size}" font-weight="${css.fontWeight}" font-style="${css.fontStyle}" fill="${escape(css.color)}">${escape(content[i])}</text>`;
          if (css.textDecorationLine.includes('underline')) svg += `<path d="M${number(box.x)} ${number(baseline + Math.max(1, item.size * .12))}h${number(box.width)}" fill="none" stroke="${escape(css.color)}" stroke-width="${Math.max(.6,item.size/16)}"/>`;
        }
        return svg;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return '';
      const css = node.ownerDocument.defaultView.getComputedStyle(node), raw = node.getBoundingClientRect(), box = rect(raw, dx, dy);
      if (css.display === 'none' || css.visibility === 'hidden' || Number(css.opacity) === 0) return '';
      if (['SCRIPT','STYLE','CANVAS'].includes(node.tagName)) return '';
      let result = '', clip = '';
      if (node.tagName.toLowerCase() === 'svg') {
        if (!raw.width || !raw.height) return '';
        const clone = freezeSvg(node); clone.setAttribute('x', String(number(box.x))); clone.setAttribute('y', String(number(box.y))); clone.setAttribute('width', String(number(box.width))); clone.setAttribute('height', String(number(box.height)));
        return new XMLSerializer().serializeToString(clone);
      }
      const radius = parseFloat(css.borderTopLeftRadius) || 0;
      if (css.backgroundColor !== 'rgba(0, 0, 0, 0)' && css.backgroundColor !== 'transparent') result += `<rect x="${number(box.x)}" y="${number(box.y)}" width="${number(box.width)}" height="${number(box.height)}" rx="${radius}" fill="${escape(css.backgroundColor)}"/>`;
      for (const [side, coordinates] of [['Top',[box.x,box.y,box.x+box.width,box.y]],['Bottom',[box.x,box.y+box.height,box.x+box.width,box.y+box.height]],['Left',[box.x,box.y,box.x,box.y+box.height]],['Right',[box.x+box.width,box.y,box.x+box.width,box.y+box.height]]]) {
        const thickness = parseFloat(css[`border${side}Width`]); if (thickness && css[`border${side}Style`] !== 'none') result += `<path d="M${number(coordinates[0])} ${number(coordinates[1])}L${number(coordinates[2])} ${number(coordinates[3])}" fill="none" stroke="${escape(css[`border${side}Color`])}" stroke-width="${thickness}"/>`;
      }
      if (node.tagName === 'IMG') {
        const source = await (await fetch(node.currentSrc || node.src)).text();
        const svg = new DOMParser().parseFromString(source, 'image/svg+xml').documentElement;
        if (svg.localName !== 'svg') throw new Error('Nonvector image in requested panel');
        svg.setAttribute('x', String(number(box.x))); svg.setAttribute('y', String(number(box.y))); svg.setAttribute('width', String(number(box.width))); svg.setAttribute('height', String(number(box.height)));
        result += new XMLSerializer().serializeToString(svg);
      } else if (node.tagName === 'IFRAME') {
        await node.contentDocument.fonts.ready;
        result += await walk(node.contentDocument.body, dx + raw.x, dy + raw.y);
      } else if (node.shadowRoot) {
        for (const child of node.shadowRoot.childNodes) result += await walk(child, dx, dy);
      } else {
        const children = [...node.childNodes].map((child, index) => ({ child, index, z: child.nodeType === Node.ELEMENT_NODE ? parseInt(node.ownerDocument.defaultView.getComputedStyle(child).zIndex) || 0 : 0 })).sort((a,b) => a.z-b.z || a.index-b.index);
        for (const {child} of children) result += await walk(child, dx, dy);
      }
      if (['hidden','auto','scroll'].includes(css.overflowY) || ['hidden','auto','scroll'].includes(css.overflowX)) {
        const id = `clip-${++sequence}`; definitions.push(`<clipPath id="${id}"><rect x="${number(box.x)}" y="${number(box.y)}" width="${number(box.width)}" height="${number(box.height)}" rx="${radius}"/></clipPath>`); clip = ` clip-path="url(#${id})"`;
      }
      return `<g${Number(css.opacity) !== 1 ? ` opacity="${css.opacity}"` : ''}${clip}>${result}</g>`;
    }
    const contents = await walk(root);
    const width = number(bounds.width), height = number(bounds.height);
    return { width, height, text, svg: `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="${ns}" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><title>${escape(title)}</title><defs>${definitions.join('')}</defs><rect width="${width}" height="${height}" fill="${background}"/>${contents}</svg>\n` };
  }, { title, background });
  if (data.width < 400 || data.height < 100 || !data.text.length) throw new Error('Invalid captured panel');
  await locator.screenshot({ path: path.join(output, `${filename}-source.png`) });
  await fs.writeFile(path.join(output,'editable',`${filename}.svg`), data.svg);
  await fs.writeFile(path.join(output,`${filename}.geometry.json`), JSON.stringify(data));
  files.push({ file: `${filename}.svg`, title, width: data.width, height: data.height, glyphs: data.text.length });
}

async function goDiary(theme) {
  await page.goto('http://127.0.0.1:8088/settings?graphics=rust-motion');
  await page.getByRole('radio', { name: theme, exact: true }).click();
  await page.waitForFunction(label => document.querySelector(`[role="radio"][aria-label="${label}"]`)?.getAttribute('aria-checked') === 'true', theme);
  await page.waitForTimeout(500);
  await page.goto('http://127.0.0.1:8088/diary?graphics=rust-motion');
  await page.getByTestId('diary-text').waitFor(); await page.waitForTimeout(600);
}
try {
  await page.goto('http://127.0.0.1:8088/launch?graphics=rust-motion');
  await page.getByRole('button', { name: 'ОТМЕНА', exact: true }).click();
  await page.getByTestId('device-optimization').waitFor({ state: 'detached' });
  await goDiary('НЕЙТРАЛЬНАЯ');
  await page.getByTestId('diary-text').fill('Сегодня заметил тишину. Она стала ощутимее.');
  await page.getByRole('button', { name: 'Назад', exact: true }).click();
  await capture(page.getByTestId('diary-sheet'), '01-unsaved-text', 'Текст не сохранён', '#101925');
  await page.getByRole('button', { name: 'ВЫЙТИ БЕЗ СОХРАНЕНИЯ', exact: true }).click();
  await goDiary('ТЁМНАЯ');
  await page.getByRole('button', { name: 'Записать наблюдение голосом', exact: true }).click();
  await page.getByTestId('diary-voice-capture').waitFor(); await page.waitForFunction(() => document.querySelector('[data-graphics="rust-motion-svg"]')?.shadowRoot?.querySelector('svg'));
  await capture(page.getByTestId('diary-voice-capture'), '02-new-voice-observation', 'Новое наблюдение', '#000000');
  await page.getByRole('button', { name: 'Закрыть запись', exact: true }).click(); await page.waitForTimeout(500);
  await page.getByRole('button', { name: 'Добавить отчёт о динамике', exact: true }).click();
  await capture(page.getByTestId('diary-sheet'), '03-dynamics-report', 'Отчёт о динамике', '#000000');
  await page.getByTestId('diary-sheet').getByRole('button', { name: 'Закрыть окно', exact: true }).click(); await page.waitForTimeout(500);
  await page.getByTestId('diary-text').fill('Заметил, как меняется моё состояние.\nСегодня легче оставаться внимательным.');
  await page.getByRole('button', { name: 'Раскрыть редактор текста', exact: true }).click();
  await page.frameLocator('[data-testid="diary-editor"]').locator('#editor').waitFor();
  await capture(page.getByTestId('diary-sheet'), '04-observation-text-editor', 'Текст наблюдения', '#000000');
  if (errors.length) throw new Error(errors.join('\n'));
  await fs.writeFile(path.join(output,'manifest.json'), JSON.stringify({ format: 'Standalone static SVG panels exported from the current app layout; no embedded screenshots', source: 'DiaryScreen / DiaryVoiceComposer / DiaryTextEditor; Rust SVG motion adapter frozen for voice artwork', files }, null, 2));
  console.log(JSON.stringify(files));
} finally { await browser.close(); }
