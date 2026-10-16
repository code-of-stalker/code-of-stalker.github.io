import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

// Run the real component's effects across parent rerenders. Only the DOM/WASM
// adapters are fake; dependencies use React's Object.is comparison contract.
async function fixture() {
  const slots=[],pending=[],calls=[];let cursor=0,job,completed=0;
  const same=(a,b)=>a&&b&&a.length===b.length&&a.every((v,i)=>Object.is(v,b[i]));
  const react={
    useRef(value){const id=cursor++;return slots[id]??=( {current:value} );},
    useState(value){const id=cursor++;if(!(id in slots))slots[id]=typeof value==='function'?value():value;return[slots[id],()=>{}];},
    useMemo(fn,deps){const id=cursor++;if(!same(slots[id]?.deps,deps))slots[id]={deps,value:fn()};return slots[id].value;},
    useEffect(fn,deps){const id=cursor++,old=slots[id];if(!same(old?.deps,deps)){slots[id]={deps,cleanup:old?.cleanup};pending.push(()=>{old?.cleanup?.();slots[id].cleanup=fn();});}},
  };react.useLayoutEffect=react.useEffect;
  const node={initial(){},target(values,duration,delay,curve){calls.push({values:Array.from(values),duration,delay,curve:Array.from(curve)});},active(){},frame:()=>true,moving:()=>false,dispose(){}};
  const controller={register:()=>()=>{},frameJob(fn){job=fn;return()=>{};},activity(){}};
  const exports={};
  const code=ts.transpileModule(readFileSync(new URL('./RustMotion.web.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  vm.runInNewContext(code,{exports,Float64Array,console,Event,require:name=>{
    if(name==='react')return react;
    if(name==='react/jsx-runtime')return {jsx:(_tag,props)=>{if(props.ref&&!props.ref.current)props.ref.current={dataset:{},style:{},dispatchEvent(){}};return props;}};
    if(name==='expo-router')return {useIsFocused:()=>true};
    if(name==='./EffectsQuality')return {useEffectsController:()=>controller};
    if(name==='./useSystemReducedMotion.web')return {useSystemReducedMotion:()=>false};
    if(name==='./motion-visibility.web')return {motionSettledEvent:'watcher-motion-settled'};
    return {loadGraphics:async()=>({ElementTimeline:{create:()=>node}})};
  }});
  const render=async(patch={})=>{cursor=0;exports.RustMotion({target:[1,0,0,1,0,100],curve:[.22,.8,.2,1],onComplete:()=>completed++,...patch});pending.splice(0).forEach(fn=>fn());await Promise.resolve();};
  await render();return {render,calls,frame:()=>job(1000),completed:()=>completed};
}

test('audio/scroll rerenders do not resend equal transition values or repeat completion',async()=>{
  const f=await fixture();f.frame();assert.equal(f.completed(),1);
  for(let i=0;i<30;i++){await f.render();f.frame();}
  assert.equal(f.calls.length,1);assert.equal(f.completed(),1);
  await f.render({target:[0,0,10,1,0,100]});f.frame();
  assert.equal(f.calls.length,2);assert.equal(f.completed(),2);
  assert.deepEqual(f.calls[1].values,[0,0,10,1,0,100]);
});

test('frozen scale survives parent updates while genuine easing/timing changes reach Rust',async()=>{
  const f=await fixture();await f.render({freezeScale:true});
  const count=f.calls.length;assert.ok(Number.isNaN(f.calls.at(-1).values[3]));
  await f.render({freezeScale:true,target:[1,0,0,.965,0,100]});assert.equal(f.calls.length,count);
  await f.render({duration:200,delay:80,curve:[.25,.46,.45,.94]});
  assert.equal(f.calls.at(-1).duration,200);assert.equal(f.calls.at(-1).delay,80);
  assert.deepEqual(f.calls.at(-1).curve,[.25,.46,.45,.94]);
});
