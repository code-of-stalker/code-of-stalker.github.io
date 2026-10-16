/** Offline authoring compiler. Original approved authoring scripts are executed
 * only here. The shipped product contains SVG contours and numeric motion data;
 * Rust owns interpolation, active time, reduced motion and presentation. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import { chromium } from 'file:///C:/Users/qtas5/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import { createHash } from 'node:crypto';
import { deflateSync } from 'node:zlib';
const cache = new Map();
function load(file) {
  file = path.resolve(file); if (cache.has(file)) return cache.get(file);
  const exports = {}; cache.set(file, exports);
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,
    {exports,require:name=>load(path.resolve(path.dirname(file),name+'.ts'))});
  return exports;
}
const root='src/features/product/motion/', output='graphics/product-engine/engine/assets/reading';
fs.mkdirSync(output,{recursive:true});
const html = {
  book:()=>load(root+'bookProjection.ts').bookProjectionHtml(false),
  reflections:()=>load(root+'stepTwoInserts.ts').stepTwoInsertHtml('reflections',false),
  'single-hero':()=>load(root+'stepTwoInserts.ts').stepTwoInsertHtml('single-hero',false),
  'identity-imprints':()=>load(root+'stepOneInserts.ts').stepOneInsertHtml('identity-imprints',false),
  'lived-paths':()=>load(root+'stepOneInserts.ts').stepOneInsertHtml('lived-paths',false),
  ...Object.fromEntries(['dream-world','dream-wake','dream-inward','dreamer'].map(kind=>[kind,()=>load(root+'dreamInserts.ts').dreamInsertHtml(kind,false)])),
};
const durations={book:16,reflections:14.6,'single-hero':14,'identity-imprints':16,'lived-paths':16,'dream-world':26,'dream-wake':18,'dream-inward':24,dreamer:24};
const numeric=/-?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][+-]?\d+)?/g;
function value(text) {
  let numbers=[],literals=[],last=0;
  for(const match of text.matchAll(numeric)){literals.push(text.slice(last,match.index));numbers.push(Number(match[0]));last=match.index+match[0].length;}
  literals.push(text.slice(last));return {literals,numbers};
}
function simplify(frames,tolerance) {
  if(frames.length<3)return frames;
  const keep=new Set([0,frames.length-1]);
  for(let i=1;i<frames.length;i++)if(frames[i].format!==frames[i-1].format){keep.add(i-1);keep.add(i);}
  const anchors=[...keep].sort((a,b)=>a-b);
  function split(a,b){if(b<=a+1)return;let error=0,index=-1;
    for(let i=a+1;i<b;i++){const p=(frames[i].at-frames[a].at)/(frames[b].at-frames[a].at);let e=0;
      for(let j=0;j<frames[i].numbers.length;j++)e=Math.max(e,Math.abs(frames[i].numbers[j]-(frames[a].numbers[j]+(frames[b].numbers[j]-frames[a].numbers[j])*p)));
      if(e>error){error=e;index=i;}}
    if(error>tolerance&&index>=0){keep.add(index);split(a,index);split(index,b);}
  }
  for(let i=1;i<anchors.length;i++)if(frames[anchors[i-1]].format===frames[anchors[i]].format)split(anchors[i-1],anchors[i]);
  return [...keep].sort((a,b)=>a-b).map(i=>frames[i]);
}
class Binary {
  chunks=[];
  u32(n){const b=Buffer.alloc(4);b.writeUInt32LE(n);this.chunks.push(b);}
  f32(n){if(!Number.isFinite(n))throw Error('Nonfinite motion value');const b=Buffer.alloc(4);b.writeFloatLE(n);this.chunks.push(b);}
  string(text){const b=Buffer.from(text);this.u32(b.length);this.chunks.push(b);}
  finish(){return Buffer.concat(this.chunks);}
}
function pack(fields,duration) {
  const b=new Binary();b.chunks.push(Buffer.from('WRC1'));b.f32(duration);b.u32(fields.length);
  for(const field of fields){b.u32(field.node);b.string(field.name);b.u32(field.formats.length);
    for(const literals of field.formats){b.u32(literals.length);for(const literal of literals)b.string(literal);}
    b.u32(field.frames.length);for(const frame of field.frames){b.f32(frame.at);b.u32(frame.format);for(const n of frame.numbers)b.f32(n);}
  }
  return b.finish();
}
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}),catalog=[];
try {
  for(const [kind,source] of Object.entries(html)){
    if(process.argv[2]&&process.argv[2]!==kind)continue;
    const duration=durations[kind],page=await browser.newPage({viewport:{width:576,height:412}});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    let document=source();
    const setter=kind==='book'?`elapsed=Math.min(time,14);loops=Math.floor(time/16);`:`elapsed=time%${duration};loops=Math.floor(time/${duration});${kind==='dream-inward'?'curtainTime=time;':''}`;
    const hook=`window.__authorFrame=(time,staticFrame,softTheme)=>{${setter}reduced=staticFrame;${kind==='book'?'settings.glow=softTheme?.55:.8;settings.beam=softTheme?.4:.6;settings.particles=!softTheme;':'soft=softTheme;'}paint();};`;
    if(!/function schedule\s*\(\)\s*\{/.test(document))throw Error('Missing author hook '+kind);
    document=document.replace(/function schedule\s*\(\)\s*\{/,hook+'function schedule(){');
    await page.setContent(document);await page.waitForFunction(()=>window.__authorFrame);
    await page.evaluate(()=>{window.WatcherArt.update({active:false});const svg=document.querySelector('svg');[svg,...svg.querySelectorAll('*')].forEach((node,index)=>node.setAttribute('data-rust-node',index));window.__nodes=[svg,...svg.querySelectorAll('*')];});
    let base, baseAttributes;
    const counts={};
    for(const soft of [false,true]) {
      // All scene mutations are attributes. A fixed 40 Hz authoring grid is
      // simplified with a bounded error; playback is continuously interpolated.
      const samples=await page.evaluate(({duration,soft})=>{
        // The book changes painter order when its rigid cover and bending
        // leaves cross. Attribute curves alone cannot preserve DOM reordering.
        const capture=()=>{
          for(const parent of document.querySelectorAll('.wbq-book'))[...parent.children].forEach((node,index)=>node.setAttribute('data-paint-order',index));
          return window.__nodes.map(node=>Object.fromEntries([...node.attributes].filter(a=>!['id','class','xmlns','data-rust-node'].includes(a.name)&&(!a.name.startsWith('data-')||a.name==='data-phase'||a.name==='data-paint-order')).map(a=>[a.name,a.value])));
        };
        const rows=[];for(let i=0;i<=Math.round(duration*40);i++){
          const time=i/Math.round(duration*40)*duration;window.__authorFrame(time,false,soft);
          if(window.__nodes.length!==document.querySelectorAll('svg *').length+1)throw Error('Scene topology changed');
          rows.push({time,attrs:capture()});
        }
        window.__authorFrame(0,true,soft);const still=capture();
        window.__authorFrame(0,false,false);capture();return {rows,still,svg:document.querySelector('svg').outerHTML};
      },{duration,soft});
      if(!soft){base=samples.svg;baseAttributes=samples.rows[0].attrs;}
      const fields=[];
      for(let node=0;node<samples.rows[0].attrs.length;node++){
        const names=new Set(samples.rows.flatMap(row=>Object.keys(row.attrs[node])));
        for(const name of names){
          const strings=samples.rows.map(row=>row.attrs[node][name]??'');
          if(new Set(strings).size===1&&strings[0]===samples.still[node][name]&&(!soft||strings[0]===baseAttributes[node][name]))continue;
          const formats=[],map=new Map(),frames=strings.map((text,i)=>{const v=value(text),key=JSON.stringify(v.literals);if(!map.has(key)){map.set(key,formats.length);formats.push(v.literals);}return {at:samples.rows[i].time,format:map.get(key),numbers:v.numbers};});
          // SVG flags and path command topology remain literal/discrete.
          const tolerance=/opacity|offset|^r$|^s/.test(name)?.00002:/transform/.test(name)?.0002:.002;
          fields.push({node,name,formats,frames:simplify(frames,tolerance)});
        }
      }
      const stillFields=[];
      samples.still.forEach((attrs,node)=>{for(const[name,text]of Object.entries(attrs)){if(text===samples.rows[0].attrs[node][name])continue;const v=value(text);stillFields.push({node,name,formats:[v.literals],frames:[{at:0,format:0,numbers:v.numbers}]});}});
      const motion=pack(fields,duration),still=pack(stillFields,0),variant=soft?'soft':'full';
      fs.writeFileSync(`${output}/${kind}.${variant}.wrc`,motion);fs.writeFileSync(`${output}/${kind}.${variant}.still.wrc`,still);
      fs.writeFileSync(`${output}/${kind}.${variant}.wrc.z`,deflateSync(motion,{level:9}));fs.writeFileSync(`${output}/${kind}.${variant}.still.wrc.z`,deflateSync(still,{level:9}));
      counts[variant]={fields:fields.length,knots:fields.reduce((n,f)=>n+f.frames.length,0),bytes:motion.length};
    }
    if(errors.length)throw Error(errors.join('\n'));
    if(/<script\b|onload=|requestAnimationFrame/.test(base))throw Error('Runtime script leaked into asset');
    fs.writeFileSync(`${output}/${kind}.svg`,base);
    const entry={kind,duration,sourceSha256:createHash('sha256').update(source()).digest('hex'),svgBytes:Buffer.byteLength(base),...counts};catalog.push(entry);console.log(JSON.stringify(entry));await page.close();
  }
  const catalogPath=`${output}/catalog.json`;
  const retained=process.argv[2]&&fs.existsSync(catalogPath)?JSON.parse(fs.readFileSync(catalogPath,'utf8')).filter(entry=>!catalog.some(next=>next.kind===entry.kind)):[];
  fs.writeFileSync(catalogPath,JSON.stringify([...retained,...catalog],null,2));
}finally{await browser.close();}
