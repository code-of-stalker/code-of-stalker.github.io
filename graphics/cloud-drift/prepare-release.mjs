import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { prepareWebCache } from '../../scripts/prepare-web-cache.mjs';
const root=process.cwd(), site=path.resolve(process.argv[2]), output=path.join(root,'.local-preview/cloud-site/release-dist');
const manifest=JSON.parse(await fs.readFile(path.join(site,'.openai/hosting.json'),'utf8'));
if(manifest.project_id!=='appgprj_6acce501d4988191938370d0410d080b')throw Error('Site identity mismatch');
await fs.mkdir(output,{recursive:false});
await fs.cp(path.join(root,'.expo-rust-web-export'),output,{recursive:true});
for(const name of ['watcher-family-preview.html','watcher-breath-preview.html'])await fs.copyFile(path.join(site,'dist',name),path.join(output,name));
const pkg=path.join(output,'graphics/pkg'), wasmPath=path.join(pkg,'watcher_graphics_bg.wasm');
const wasm=await fs.readFile(wasmPath);
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const sha256=hash(wasm);
// This release changes the cloud scene only; keep the published shared engine exact.
if(sha256!=='d7dc7770f633c317c69d21f8a9340f06ecc6ae213e9ef104840eb4081c895484')throw Error('Published shared engine changed');
const parts=[];
for(let offset=0,index=0;offset<wasm.length;offset+=16*1024*1024,index++){
  const data=wasm.subarray(offset,Math.min(offset+16*1024*1024,wasm.length));
  const name=`watcher_graphics_bg.${sha256.slice(0,12)}.part${index}.bin`;
  await fs.writeFile(path.join(pkg,name),data);parts.push({name,size:data.length});
}
const restored=Buffer.concat(await Promise.all(parts.map(p=>fs.readFile(path.join(pkg,p.name)))));
if(!wasm.equals(restored)||!WebAssembly.validate(restored))throw Error('WASM reconstruction mismatch');
const gluePath=path.join(pkg,'watcher_graphics.js');
let glue=await fs.readFile(gluePath,'utf8');
const needle='module_or_path = fetch(module_or_path);';
if(glue.split(needle).length!==2)throw Error('Unexpected WASM loader');
glue=glue.replace(needle,`module_or_path = (async () => {
  const parts = ${JSON.stringify(parts)};
  const buffers = await Promise.all(parts.map(async part => {
    const response = await fetch(new URL(part.name, import.meta.url));
    if (!response.ok) throw new Error('Graphics engine request failed: '+response.status);
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength !== part.size) throw new Error('Incomplete graphics engine');
    return bytes;
  }));
  const bytes = new Uint8Array(buffers.reduce((n, part) => n+part.length,0));
  let offset=0; for(const part of buffers){ bytes.set(part,offset); offset+=part.length; }
  return bytes;
})();`);
await fs.writeFile(gluePath,glue);await fs.unlink(wasmPath);
const html=path.join(output,'index.html');
await fs.writeFile(html,(await fs.readFile(html,'utf8')).replace('<html lang="en">','<html lang="ru">'));
const cache=await prepareWebCache(output);
for(const asset of cache.assets){
  const bytes=await fs.readFile(path.join(output,decodeURIComponent(asset.url.slice(1))));
  if(hash(bytes)!==asset.sha256)throw Error('Cache hash mismatch: '+asset.url);
}
const cloud=cache.assets.filter(a=>a.url.startsWith('/graphics/cloud-drift/'));
if(cloud.length!==6)throw Error('Cloud scene not completely cached: '+cloud.length);
const report={output,project_id:manifest.project_id,sharedEngineUnchanged:true,sha256,cacheVersion:cache.version,cloudAssets:cloud,cacheAssets:cache.assets.length};
await fs.writeFile(path.join(root,'.local-preview/cloud-site/release.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify({output,cacheVersion:cache.version,sharedEngineUnchanged:true,cloudAssets:cloud.length}));
