import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

async function fixture(direct) {
  let job, committed=0, copies=0, contexts=0, removed=0; const signals=[];
  const renderer={backend:()=>direct?'Rust / wgpu BrowserWebGpu':'Rust / wgpu Gl',add:()=>1,present_to:()=>direct,
    quality(){},palette(){},resize(){},active(){},pointer(){},reset_clock(){},moving:()=>true,frame:()=>{committed++;return true;},
    rect:()=>[0,0,400,300],commits:()=>committed,reveal:()=>1,metrics:()=>[1,1,400,300,200,150,committed,0,0,0,0,1,5,10,400,300],
    remove(){removed++;},dispose(){}};
  const policy={level:'high',cost:0,targetFps:60,smooth:true};
  const controller={policy,frameJob:fn=>{job=fn;return()=>{};},register:(_id,_label,fn)=>{fn({type:'watcher-quality',density:2.5,cost:0,targetFps:60});return()=>{};},activity(){},report(){}};
  const output={width:1,height:1,dataset:{},getContext(){contexts++;return{clearRect(){},drawImage(){copies++;}};}};
  const exports={}, module={default:async()=>{},ProductRenderer:{create:async()=>renderer}};
  const code=ts.transpileModule(readFileSync(new URL('./rustEngine.web.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  vm.runInNewContext(code,{exports,require:()=>({qualityDensity:{high:2.5},glassRenderDensity:1,graphicsPalette:{get:()=>false,subscribe:()=>()=>{}}}),Function:()=>()=>Promise.resolve(module),
    document:{createElement:()=>({width:1,height:1})},location:{search:''},URLSearchParams,console,clearTimeout(){},setTimeout:()=>0,
    window:{dispatchEvent:event=>signals.push(event.type)},Event});
  const session=await exports.rustSession(controller),handle=session.add(output,false);handle.active(true,false);
  return {handle,output,signals,run:()=>job(1000),counts:()=>({copies,contexts,removed})};
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
