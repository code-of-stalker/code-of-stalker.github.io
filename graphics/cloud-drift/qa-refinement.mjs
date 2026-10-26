import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import sharp from 'file:///C:/Users/qtas5/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp/dist/index.mjs';
import { chromium } from 'file:///C:/Users/qtas5/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const output='.local-preview/cloud-refine-v98/qa';
await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const bytes=url=>Buffer.from(url.split(',')[1],'base64');
const raw=async image=>sharp(image).removeAlpha().raw().toBuffer();
const error=(a,b)=>{let n=0;for(let i=0;i<a.length;i++)n+=Math.abs(a[i]-b[i]);return n/a.length;};
const report={};
try {
  const page=await browser.newPage({viewport:{width:1000,height:760},deviceScaleFactor:1});
  await page.goto('http://127.0.0.1:8977/?qa');
  await page.waitForFunction(()=>window.cloudPreview);
  report.defaultStrength=await page.evaluate(()=>window.cloudPreview.renderer.motion_strength());
  assert.equal(report.defaultStrength,1.5);
  const render=async(time,scanner=true,bg=[0,0,0])=>bytes(await page.evaluate(({time,scanner,bg})=>{
    const {renderer:r,canvas:c}=window.cloudPreview;r.background(...bg);r.effects(true,true,scanner);r.seek(time);return c.toDataURL();
  },{time,scanner,bg}));
  report.scanOffOutsidePass=[];
  for(const time of [0,1,4,5.9,10.7,12,15.9]) {
    const a=await render(time,false),b=await render(time,true);assert(a.equals(b),`Contours leak outside pass at ${time}`);
    report.scanOffOutsidePass.push(time);
  }
  const plain=await raw(await render(8.3,false)),scan=await raw(await render(8.3,true));
  let dimmed=0,brightened=0,unchanged=0;
  for(let i=0;i<plain.length;i+=3){const delta=(scan[i]+scan[i+1]+scan[i+2])-(plain[i]+plain[i+1]+plain[i+2]);if(delta<-10)dimmed++;else if(delta>10)brightened++;if(delta===0)unchanged++;}
  assert(dimmed>50&&brightened>50,'Dimmed illustration and lit contours must coexist');
  assert(unchanged/(plain.length/3)>.8,'Scanner changes too much of the illustration');
  report.scanner={dimmed,brightened,unchangedFraction:unchanged/(plain.length/3)};
  await fs.writeFile(`${output}/scanner.png`,await render(8.3));
  report.edges=[];
  for(const bg of [[0,0,0],[13,21,32],[250,225,143],[13,20,38]]) {
    const png=await render(8.3,true,bg.map(v=>v/255));
    const {data,info}=await sharp(png).removeAlpha().raw().toBuffer({resolveWithObject:true});
    let maxDifference=0;
    for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++)if(x===0||y===0||x===info.width-1||y===info.height-1)for(let c=0;c<3;c++)maxDifference=Math.max(maxDifference,Math.abs(data[(y*info.width+x)*3+c]-bg[c]));
    assert(maxDifference<=1,`Hard edge in ${bg}: ${maxDifference}`);report.edges.push({background:bg,maxDifference});
  }
  await fs.writeFile(`${output}/neutral.png`,await render(4,false,[13/255,21/255,32/255]));
  await page.evaluate(async()=>{
    const old=await import('/before/runtime.js'),fresh=await import('/runtime.js');
    window.sampling={};
    for(const [name,module] of [['old',old],['new',fresh]]){
      const canvas=document.createElement('canvas');document.body.append(canvas);
      const renderer=await module.mount(canvas);renderer.strength(1.5);renderer.effects(false,false,false);
      window.sampling[name]={renderer,canvas};
    }
  });
  const sample=async(name,size)=>bytes(await page.evaluate(({name,size})=>{const {renderer:r,canvas:c}=window.sampling[name];r.resize(320*size,214*size);r.seek(3.3);return c.toDataURL();},{name,size}));
  const reference=await sharp(await sample('old',4)).resize(320,214).extract({left:40,top:40,width:240,height:134}).removeAlpha().raw().toBuffer();
  const before=await sample('old',1),after=await sample('new',1);
  const crop=image=>sharp(image).extract({left:40,top:40,width:240,height:134}).removeAlpha().raw().toBuffer();
  const beforeError=error(await crop(before),reference),afterError=error(await crop(after),reference);
  assert(afterError<beforeError,`Texture minification did not improve: ${beforeError} -> ${afterError}`);
  report.phoneSampling={beforeError,afterError};
  await fs.writeFile(`${output}/phone-before.png`,before);await fs.writeFile(`${output}/phone-after.png`,after);
  await page.evaluate(()=>{for(const {renderer} of Object.values(window.sampling)){renderer.dispose();renderer.free();}});
  assert.equal(await page.evaluate(()=>window.cloudPreview.renderer.gpu_error()),0);
  await fs.writeFile(`${output}/report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));
} finally {await browser.close();}
