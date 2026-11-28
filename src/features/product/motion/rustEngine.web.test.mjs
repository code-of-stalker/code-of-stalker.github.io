import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

async function fixture(direct, poison = { on: false, calls: 0 }) {
  let job, committed=0, copies=0, contexts=0, removed=0; const signals=[], failures=[];
  const methods={backend:()=>direct?'Rust / wgpu BrowserWebGpu':'Rust / wgpu Gl',add:()=>1,present_to:()=>direct,
    quality(){},palette(){},resize(){},active(){},pointer(){},reset_clock(){},moving:()=>true,frame:()=>{committed++;return true;},
    rect:()=>[0,0,400,300],commits:()=>committed,reveal:()=>1,metrics:()=>[1,1,400,300,200,150,committed,0,0,0,0,1,5,10,400,300],
    remove(){removed++;},dispose(){}};
  // Once poisoned, every call throws what wasm-bindgen throws for an object a Rust panic left borrowed.
  const renderer=new Proxy(methods,{get:(target,key)=>typeof target[key]!=='function'?target[key]:(...args)=>{
    if(poison.on){poison.calls++;throw new Error('recursive use of an object detected which would lead to unsafe aliasing in rust');}
    return target[key](...args);}});
  const policy={level:'high',cost:0,targetFps:60,smooth:true};
  const controller={policy,frameJob:fn=>{job=fn;return()=>{};},register:(_id,_label,fn)=>{fn({type:'watcher-quality',density:2.5,cost:0,targetFps:60});return()=>{};},activity(){},report(){}};
  const output={width:1,height:1,dataset:{},getContext(){contexts++;return{clearRect(){},drawImage(){copies++;}};}};
  const exports={}, module={default:async()=>{},ProductRenderer:{create:async()=>renderer}};
  const code=ts.transpileModule(readFileSync(new URL('./rustEngine.web.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  vm.runInNewContext(code,{exports,require:()=>({qualityDensity:{high:2.5},glassRenderDensity:1,graphicsPalette:{get:()=>false,subscribe:()=>()=>{}}}),Function:()=>()=>Promise.resolve(module),
    document:{createElement:()=>({width:1,height:1})},location:{search:''},URLSearchParams,console,clearTimeout(){},setTimeout:()=>0,
    window:{dispatchEvent:event=>signals.push(event.type)},Event});
  const session=await exports.rustSession(controller),handle=session.add(output,false,undefined,undefined,false,false,undefined,undefined,problem=>failures.push(String(problem)));handle.active(true,false);
  return {crashed:exports.crashedGraphics,session,handle,output,signals,failures,poison,run:()=>job(1000),counts:()=>({copies,contexts,removed})};
}
test('WebGPU presents directly without acquiring Canvas2D or overwriting its surface dimensions',async()=>{
  const f=await fixture(true);f.run();
  assert.deepEqual(f.signals,['watcher-graphics-ready']); // The offline snapshot waits for this.
  assert.equal(f.output.dataset.graphicsPresentation,'direct-gpu');
  assert.deepEqual(f.counts(),{copies:0,contexts:0,removed:0});
  assert.equal(f.output.width,1); // The Rust surface, not JavaScript, owns these dimensions.
  f.handle.release();assert.equal(f.counts().removed,1);
});
test('WebGL2 keeps the compatible atlas adapter and releases the scene',async()=>{
  const f=await fixture(false);f.run();
  assert.equal(f.output.dataset.graphicsPresentation,'atlas-canvas2d');
  assert.deepEqual(f.counts(),{copies:1,contexts:1,removed:0});
  assert.equal(f.output.width,400);assert.equal(f.output.height,300);
  f.handle.active(false,false);f.run();assert.equal(f.counts().copies,1);
  f.handle.release();assert.equal(f.counts().removed,1);
});
test('a renderer that crashes outside drawing stops once and every later call stays quiet',async()=>{
  const f=await fixture(true);f.run();
  f.poison.on=true;
  assert.doesNotThrow(()=>f.handle.resize({width:10,height:10,path:'',background:'none'}));
  assert.equal(f.failures.length,1);assert.match(f.failures[0],/recursive use of an object/);
  assert.match(f.output.dataset.graphicsError,/recursive use of an object/);
  const calls=f.poison.calls; // The failed call and the attempt to free the renderer.
  assert.doesNotThrow(()=>{f.handle.active(true,false);f.handle.pointer(1,1,true);f.handle.replayScan();f.run();});
  assert.equal(f.handle.up(0,true),false);
  assert.equal(f.poison.calls,calls);assert.equal(f.failures.length,1);
  // Later scenes fall back at once instead of asking the crashed renderer for more.
  assert.throws(()=>f.session.add({width:1,height:1,dataset:{}},false),/stopped after a renderer failure/);
  assert.doesNotThrow(()=>f.handle.release());
});
test('a renderer that crashes while drawing hands its scenes to their fallback',async()=>{
  const f=await fixture(false);f.run();
  f.poison.on=true;
  assert.doesNotThrow(()=>f.run());
  assert.equal(f.failures.length,1);assert.match(f.output.dataset.graphicsError,/recursive use of an object/);
  const calls=f.poison.calls;f.run();f.run();assert.equal(f.poison.calls,calls);
  assert.equal(f.crashed(new Error('unreachable executed')),true);
  assert.equal(f.crashed(new WebAssembly.RuntimeError('memory access out of bounds')),true);
  assert.equal(f.crashed(new Error('Canvas presentation is unavailable')),false); // A refusal, not a crash.
});
