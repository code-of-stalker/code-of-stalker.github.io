import assert from 'node:assert/strict';
import { chromium } from 'file:///C:/Users/qtas5/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import sharp from 'file:///C:/Users/qtas5/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp/dist/index.mjs';
const browser = await chromium.launch({headless:true, executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
try {
  const page = await browser.newPage({viewport:{width:1536,height:1024},deviceScaleFactor:1});
  await page.goto((process.env.CLOUD_PREVIEW_URL ?? 'http://127.0.0.1:8976')+'/?qa&render');
  await page.waitForFunction(() => document.documentElement.dataset.ready === 'true');
  const capture = async (accent, scanner) => {
    await page.evaluate(({accent,scanner}) => {
      const r = window.cloudPreview.renderer;
      r.accent(...accent); r.effects(false,false,scanner); r.seek(8.3);
    }, {accent,scanner});
    return sharp(await page.locator('#scene').screenshot()).removeAlpha().raw().toBuffer();
  };
  const result = [];
  for (const hex of ['F5DD07','FF6600','86C9C7','6296F5']) {
    const accent = [0,2,4].map(i => parseInt(hex.slice(i,i+2),16)/255);
    const base = await capture(accent,false), scan = await capture(accent,true);
    let darkest = 0, changed = 0; const gain = [0,0,0];
    for(let i=0;i<base.length;i+=3) {
      for(let c=0;c<3;c++) darkest = Math.min(darkest,scan[i+c]-base[i+c]);
      if(Math.max(base[i],base[i+1],base[i+2]) > 5) continue;
      if(Math.max(scan[i]-base[i],scan[i+1]-base[i+1],scan[i+2]-base[i+2]) < 12) continue;
      changed++; for(let c=0;c<3;c++) gain[c]+=scan[i+c]-base[i+c];
    }
    assert(darkest < -10 && darkest > -125, `Expected restrained dimming under the contours: ${darkest}`);
    assert(changed>50, `No visible scanner in ${hex}`);
    const scale = Math.max(...gain), accentScale = Math.max(...accent);
    gain.forEach((value,c) => assert(Math.abs(value/scale-accent[c]/accentScale)<.045, `Wrong accent ${hex}`));
    result.push({accent:hex, darkestDelta:darkest, checkedPixels:changed});
  }
  assert.equal(await page.evaluate(() => window.cloudPreview.renderer.gpu_error()),0);
  console.log(JSON.stringify({scannerKeepsAccentWithDimmedArtwork:true,palettes:result}));
} finally { await browser.close(); }
