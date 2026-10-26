import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import sharp from 'file:///C:/Users/qtas5/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp/dist/index.mjs';
import { chromium } from 'file:///C:/Users/qtas5/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const output = path.resolve('output/motion/man-in-clouds/qa');
await fs.mkdir(output,{recursive:true});
const report = {checks:[], errors:[], measurements:{}};
const browser = await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const difference = async(a,b) => {
  const aa = await sharp(a).removeAlpha().raw().toBuffer();
  const bb = await sharp(b).removeAlpha().raw().toBuffer();
  assert.equal(aa.length,bb.length);
  let sum=0;for(let i=0;i<aa.length;i++)sum+=Math.abs(aa[i]-bb[i]);
  return sum/aa.length;
};
try {
  for(const [name,width,height] of [['desktop',1200,930],['phone',393,780],['small',320,568]]){
    const page = await browser.newPage({viewport:{width,height},deviceScaleFactor:1});
    page.on('pageerror',e=>report.errors.push(String(e)));
    page.on('console',m=>{if(m.type()==='error') report.errors.push(m.text());});
    await page.goto('http://127.0.0.1:8976/?qa');
    await page.waitForFunction(()=>document.documentElement.dataset.ready||document.documentElement.dataset.error);
    assert.equal(await page.evaluate(()=>document.documentElement.dataset.error),undefined);
    const frame=async(t,label)=>{
      await page.evaluate(s=>window.cloudPreview.seek(s),t);
      return page.locator('#scene').screenshot({path:path.join(output,`${name}-${label}.png`)});
    };
    const a=await frame(0,'start');const b=await frame(8,'middle');const c=await frame(16,'loop');
    if(name==='desktop'){await frame(4,'quarter');await frame(12,'three-quarter');}
    const movement=await difference(a,b),loop=await difference(a,c);
    assert(movement>2,`${name}: scene is static`);assert(loop<0.05,`${name}: loop seam ${loop}`);
    assert.equal(await page.evaluate(()=>window.cloudPreview.renderer.gpu_error()),0);
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
    assert.equal(overflow,0);
    await page.screenshot({path:path.join(output,`${name}-page.png`)});
    await page.locator('#original').click();
    const original=await page.locator('#scene').screenshot();
    await page.evaluate(()=>window.cloudPreview.seek(5));
    assert.equal(await difference(original,await page.locator('#scene').screenshot()),0);
    await page.locator('#original').click();
    await page.emulateMedia({reducedMotion:'reduce'});
    const reduced=await page.locator('#scene').screenshot();
    await page.evaluate(()=>window.cloudPreview.seek(11));
    assert.equal(await difference(reduced,await page.locator('#scene').screenshot()),0);
    report.measurements[name]={movement,loop,overflow};
    report.checks.push(`${name}: motion, closed loop, GPU, fit, original, reduced motion`);
    await page.close();
  }
  const page=await browser.newPage({viewport:{width:1000,height:850}});
  await page.goto('http://127.0.0.1:8976/');
  await page.waitForFunction(()=>document.documentElement.dataset.ready);
  await page.locator('#pause').click();
  const before=await page.evaluate(()=>window.cloudPreview.renderer.frame_count());
  await page.waitForTimeout(250);
  assert.equal(await page.evaluate(()=>window.cloudPreview.renderer.frame_count()),before);
  await page.locator('#pause').click();
  await page.waitForTimeout(400);
  assert(await page.evaluate(()=>window.cloudPreview.renderer.frame_count())>before);
  report.checks.push('Pause stops drawing; resume restarts it');
  assert.equal(report.errors.length,0,report.errors.join('\n'));
  await fs.writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
} finally {await browser.close();}
