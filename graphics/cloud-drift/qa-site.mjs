import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chromium } from 'file:///C:/Users/qtas5/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const base = process.argv[2] ?? 'http://127.0.0.1:8980';
const output = '.local-preview/cloud-site';
await fs.mkdir(output,{recursive:true});
const browser = await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
try {
  const report=[];
  for(const [width,height,theme,reduced] of [[393,780,'dark',false],[320,568,'neutral',false],[1024,768,'violet',false],[393,780,'light',true]]) {
    // Disposable browser profiles only; no actual diary or user's progress is touched.
    const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,serviceWorkers:'block'});
    const page=await context.newPage(); const errors=[];
    page.on('pageerror',e=>errors.push(String(e)));
    await page.goto(base+'/practice');
    await page.waitForTimeout(1400);
    await page.evaluate(async ({theme,reduced})=>{
      const request=indexedDB.open('watcher-product-local-v1',1);
      request.onupgradeneeded=()=>request.result.createObjectStore('encrypted');
      const db=await new Promise((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
      const key=await crypto.subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt','decrypt']);
      const value={version:1,settings:{theme,startAt:'home',microphoneCheck:false,reducedMotion:reduced,smoothness:true,effectQuality:'balanced',effectTargetFps:60,testUnlockAll:true},progress:{selectedLevel:'basic',step:4,questionIndex:0,practiceStage:0,completedAt:null,availableAt:null,fourthStepUnlocked:true,stepFourReading:{page:1,offset:0}},observations:[],diaryEntries:[],listenLater:[]};
      const iv=crypto.getRandomValues(new Uint8Array(12));
      const bytes=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:new TextEncoder().encode('watcher.product.state.v1'),tagLength:128},key,new TextEncoder().encode(JSON.stringify(value)));
      await new Promise((resolve,reject)=>{const tx=db.transaction('encrypted','readwrite');const store=tx.objectStore('encrypted');store.put(key,'key');store.put({iv,bytes},'state');tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});
      db.close();
    },{theme,reduced});
    await page.reload();
    const canvas=page.locator('[data-graphics="rust-cloud-drift"]').first();
    try {
      await canvas.waitFor({state:'attached',timeout:60000});
      await canvas.scrollIntoViewIfNeeded();
      await page.waitForFunction(()=>{const c=document.querySelector('[data-graphics="rust-cloud-drift"]');return c?.style.visibility==='visible'||c?.dataset.graphicsError;},null,{timeout:60000});
    } catch(error) {await page.screenshot({path:`${output}/failed-${width}.png`});console.log((await page.locator('body').innerText()).slice(0,1800));throw error;}
    assert.equal(await canvas.getAttribute('data-graphics-error'),null);
    const expected={dark:'#F5DD07',neutral:'#86C9C7',violet:'#6296F5',light:'#FF6600'}[theme];
    assert.equal(await canvas.getAttribute('data-accent'),expected);
    await page.waitForTimeout(700);
    assert.equal(await canvas.getAttribute('data-running'),String(!reduced));
    const bounds=await canvas.boundingBox();
    assert(Math.abs(bounds.width/bounds.height-1.5)<.02,'Distorted illustration');
    assert(bounds.width<=width+1,'Mobile overflow');
    const first=await canvas.evaluate(c=>c.toDataURL());
    await page.waitForTimeout(350);
    const second=await canvas.evaluate(c=>c.toDataURL());
    assert.equal(first===second,reduced,'Wrong reduced-motion behavior');
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
    assert(overflow<=1,`Horizontal overflow: ${overflow}`);
    await page.screenshot({path:`${output}/${width}-${theme}.png`});
    assert.deepEqual(errors,[]);
    report.push({width,height,theme,accent:expected,reducedMotion:reduced,aspectRatio:bounds.width/bounds.height,overflow,errors});
    await context.close();
  }
  await fs.writeFile(`${output}/browser-report.json`,JSON.stringify({base,checks:report},null,2));
  console.log(JSON.stringify(report));
} finally {await browser.close();}
