import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chromium } from 'file:///C:/Users/qtas5/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
try{
  const page=await browser.newPage({viewport:{width:1536,height:1024},deviceScaleFactor:1});
  await page.goto('http://127.0.0.1:8976/?qa&render');
  await page.waitForFunction(()=>document.documentElement.dataset.ready);
  const metadata=await page.evaluate(async()=>{
    const video=document.createElement('video');video.id='verification-video';video.muted=true;video.playsInline=true;
    video.style.cssText='position:fixed;inset:0;width:100%;height:100%;object-fit:contain;background:#000;z-index:100';
    document.body.append(video);
    const loaded=new Promise((resolve,reject)=>{video.onloadedmetadata=resolve;video.onerror=()=>reject(Error(video.error?.message));});
    video.src='./cloud-drift.mp4';await loaded;
    const seek=seconds=>new Promise((resolve,reject)=>{video.onseeked=resolve;video.onerror=reject;video.currentTime=seconds;});
    await seek(8);const afterSeek=video.currentTime;await video.play();
    await new Promise((resolve,reject)=>{
      let count=0;
      const timeout=setTimeout(()=>reject(Error(`Video stalled at ${video.currentTime}; readyState ${video.readyState}`)),8000);
      const next=()=>video.requestVideoFrameCallback(()=>{if(++count>=8){clearTimeout(timeout);resolve();}else next();});
      next();
    });
    video.pause();
    return {width:video.videoWidth,height:video.videoHeight,duration:video.duration,afterSeek,timeAfterPlay:video.currentTime,error:video.error?.message||null,quality:video.getVideoPlaybackQuality().totalVideoFrames};
  });
  console.log(metadata);
  assert.equal(metadata.width,1536);assert.equal(metadata.height,1024);assert.equal(metadata.duration,16);
  assert(metadata.timeAfterPlay>8.1);assert.equal(metadata.error,null);
  await page.locator('#verification-video').screenshot({path:'output/motion/man-in-clouds/qa/video-playback.png'});
  await fs.writeFile('output/motion/man-in-clouds/qa/video-report.json',JSON.stringify(metadata,null,2));
  console.log(JSON.stringify(metadata));
}finally{await browser.close();}
