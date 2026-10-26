// Capture the Rust renderer at deterministic times. No scene logic is implemented here.
// WebCodecs produces AVC; this minimal single-track muxer only packages those bytes.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { chromium } from 'file:///C:/Users/qtas5/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const output=path.resolve('output/motion/man-in-clouds/cloud-drift.mp4');
const u32=n=>{const b=Buffer.alloc(4);b.writeUInt32BE(n);return b;};
const u16=n=>{const b=Buffer.alloc(2);b.writeUInt16BE(n);return b;};
const zero=n=>Buffer.alloc(n);
const box=(type,...body)=>{const b=Buffer.concat(body);return Buffer.concat([u32(b.length+8),Buffer.from(type),b]);};
const full=(type,flags,...body)=>box(type,u32(flags),...body);
const matrix=Buffer.concat([u32(65536),u32(0),u32(0),u32(0),u32(65536),u32(0),u32(0),u32(0),u32(1073741824)]);
function mux(samples,avcc,width,height,fps){
  const duration=samples.length/fps;
  const ftyp=box('ftyp',Buffer.from('isom'),u32(512),Buffer.from('isomiso2avc1mp41'));
  const movie=offset=>{
    const mvhd=full('mvhd',0,zero(8),u32(1000),u32(Math.round(duration*1000)),u32(65536),u16(256),zero(10),matrix,zero(24),u32(2));
    const tkhd=full('tkhd',7,zero(8),u32(1),zero(4),u32(Math.round(duration*1000)),zero(8),zero(8),matrix,u32(width*65536),u32(height*65536));
    const mdhd=full('mdhd',0,zero(8),u32(fps*1000),u32(samples.length*1000),u16(0x55c4),zero(2));
    const hdlr=full('hdlr',0,zero(4),Buffer.from('vide'),zero(12),Buffer.from('Rust cloud illustration\0'));
    const compressor=Buffer.alloc(32);compressor[0]=9;compressor.write('CloudDrift',1);
    const avc1=box('avc1',zero(6),u16(1),zero(16),u16(width),u16(height),u32(0x00480000),u32(0x00480000),zero(4),u16(1),compressor,u16(24),u16(65535),box('avcC',avcc));
    const stsd=full('stsd',0,u32(1),avc1);
    const stts=full('stts',0,u32(1),u32(samples.length),u32(1000));
    const stsc=full('stsc',0,u32(1),u32(1),u32(samples.length),u32(1));
    const stsz=full('stsz',0,u32(0),u32(samples.length),...samples.map(s=>u32(s.data.length)));
    const stco=full('stco',0,u32(1),u32(offset));
    const keys=samples.flatMap((s,i)=>s.key?[u32(i+1)]:[]);
    const stss=full('stss',0,u32(keys.length),...keys);
    const stbl=box('stbl',stsd,stts,stsc,stsz,stco,stss);
    const dinf=box('dinf',full('dref',0,u32(1),full('url ',1)));
    const minf=box('minf',full('vmhd',1,zero(8)),dinf,stbl);
    return box('moov',mvhd,box('trak',tkhd,box('mdia',mdhd,hdlr,minf)));
  };
  const moov=movie(ftyp.length+movie(0).length+8);
  return Buffer.concat([ftyp,moov,box('mdat',...samples.map(s=>s.data))]);
}
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const samples=[];let avcc;
try{
  const page=await browser.newPage({viewport:{width:1536,height:1024},deviceScaleFactor:1});
  await page.exposeFunction('encodedChunk',value=>{
    samples.push({data:Buffer.from(value.bytes,'base64'),key:value.key,timestamp:value.timestamp});
    if(value.description)avcc=Buffer.from(value.description,'base64');
  });
  await page.exposeFunction('exportProgress',n=>console.log(`Rendered ${n}/480 frames`));
  await page.goto('http://127.0.0.1:8976/?qa&render');
  await page.waitForFunction(()=>document.documentElement.dataset.ready);
  await page.evaluate(async()=>{
    const config={codec:'avc1.420034',width:1536,height:1024,bitrate:14000000,framerate:30,latencyMode:'realtime',avc:{format:'avc'}};
    const support=await VideoEncoder.isConfigSupported(config);
    if(!support.supported)throw Error('AVC encoding is unavailable');
    const base64=bytes=>{let s='';for(let i=0;i<bytes.length;i+=8192)s+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(s);};
    const pending=[];let failure;
    const encoder=new VideoEncoder({
      output:(chunk,meta)=>{
        const bytes=new Uint8Array(chunk.byteLength);chunk.copyTo(bytes);
        pending.push(window.encodedChunk({bytes:base64(bytes),key:chunk.type==='key',timestamp:chunk.timestamp,description:meta.decoderConfig?.description?base64(new Uint8Array(meta.decoderConfig.description)):null}));
      },error:error=>{failure=error;}
    });
    encoder.configure(config);
    for(let i=0;i<480;i++){
      window.cloudPreview.seek(i/30);
      const frame=new VideoFrame(window.cloudPreview.canvas,{timestamp:Math.round(i*1000000/30),duration:Math.round(1000000/30)});
      encoder.encode(frame,{keyFrame:i%60===0});frame.close();
      if(encoder.encodeQueueSize>6)await encoder.flush();
      if(failure)throw failure;
      if((i+1)%60===0)await window.exportProgress(i+1);
    }
    await encoder.flush();encoder.close();await Promise.all(pending);
    if(failure)throw failure;
  });
  assert.equal(samples.length,480);assert(avcc?.length>0);
  assert(samples.every((s,i)=>i===0||s.timestamp>samples[i-1].timestamp),'AVC samples must be in presentation order');
  const movie=mux(samples,avcc,1536,1024,30);
  await fs.writeFile(output,movie);
  console.log(JSON.stringify({output,bytes:movie.length,frames:480,duration:16,width:1536,height:1024}));
}finally{await browser.close();}
