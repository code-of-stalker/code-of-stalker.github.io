import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

// Run the real component's effects across parent rerenders. Only the DOM/WASM
// adapters and the timers are fake; dependencies use React's Object.is comparison contract.
async function fixture({ engine = 'ok', controller: withController = true } = {}) {
  const slots=[],pending=[],calls=[],initials=[],timers=[];let cursor=0,job,completed=0,arrive;
  const same=(a,b)=>a&&b&&a.length===b.length&&a.every((v,i)=>Object.is(v,b[i]));
  const react={
    useRef(value){const id=cursor++;return slots[id]??=( {current:value} );},
    useState(value){const id=cursor++;if(!(id in slots))slots[id]=typeof value==='function'?value():value;return[slots[id],()=>{}];},
    useMemo(fn,deps){const id=cursor++;if(!same(slots[id]?.deps,deps))slots[id]={deps,value:fn()};return slots[id].value;},
    useEffect(fn,deps){const id=cursor++,old=slots[id];if(!same(old?.deps,deps)){slots[id]={deps,cleanup:old?.cleanup};pending.push(()=>{old?.cleanup?.();slots[id].cleanup=fn();});}},
  };react.useLayoutEffect=react.useEffect;
  const node={initial(values){initials.push(Array.from(values));},target(values,duration,delay,curve){calls.push({values:Array.from(values),duration,delay,curve:Array.from(curve)});},
    active(){},frame:()=>true,moving:()=>false,dispose(){},initial_height(){},target_height_curve(){},scan_reveal(){}};
  const controller={register:()=>()=>{},frameJob(fn){job=fn;return()=>{};},activity(){}};
  const element={dataset:{},style:{},dispatchEvent(){},hasAttribute:()=>false};
  const module={ElementTimeline:{create:()=>node}};
  const loadGraphics=engine==='failed'?()=>Promise.reject(new Error('engine failed'))
    :engine==='late'?()=>new Promise(resolve=>{arrive=()=>resolve(module);}):async()=>module;
  const exports={};
  const code=ts.transpileModule(readFileSync(new URL('./RustMotion.web.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  vm.runInNewContext(code,{exports,Float64Array,console:{error(){}},Event,queueMicrotask,Number,
    setTimeout:(fn,ms)=>{timers.push({fn,ms});return timers.length;},clearTimeout:id=>{if(id)timers[id-1].fn=null;},
    require:name=>{
    if(name==='react')return react;
    if(name==='react/jsx-runtime')return {jsx:(_tag,props)=>{if(props.ref&&!props.ref.current)props.ref.current=element;return props;}};
    if(name==='expo-router')return {useIsFocused:()=>true};
    if(name==='./EffectsQuality')return {useEffectsController:()=>withController?controller:null};
    if(name==='./useSystemReducedMotion.web')return {useSystemReducedMotion:()=>false};
    if(name==='./motion-visibility.web')return {motionSettledEvent:'watcher-motion-settled'};
    return {loadGraphics};
  }});
  const settle=()=>new Promise(resolve=>setTimeout(resolve,0));
  const render=async(patch={})=>{cursor=0;exports.RustMotion({target:[1,0,0,1,0,100],curve:[.22,.8,.2,1],onComplete:()=>completed++,...patch});pending.splice(0).forEach(fn=>fn());await settle();};
  // Fires every pending safety timer, as if its time had passed.
  const elapse=()=>{for(const timer of timers.splice(0)){const fn=timer.fn;timer.fn=null;fn?.();}};
  await render();
  return {render,calls,initials,element,elapse,timers,arrive:async()=>{arrive();await settle();},frame:()=>job?.(1000),completed:()=>completed};
}

test('audio/scroll rerenders do not resend equal transition values or repeat completion',async()=>{
  const f=await fixture();f.frame();assert.equal(f.completed(),1);
  for(let i=0;i<30;i++){await f.render();f.frame();}
  assert.equal(f.calls.length,1);assert.equal(f.completed(),1);
  await f.render({target:[0,0,10,1,0,100]});f.frame();
  assert.equal(f.calls.length,2);assert.equal(f.completed(),2);
  assert.deepEqual(f.calls[1].values,[0,0,10,1,0,100]);
  // The engine reported completion, so the safety net never fires a second one.
  f.elapse();assert.equal(f.completed(),2);
});

test('frozen scale survives parent updates while genuine easing/timing changes reach Rust',async()=>{
  const f=await fixture();await f.render({freezeScale:true});
  const count=f.calls.length;assert.ok(Number.isNaN(f.calls.at(-1).values[3]));
  await f.render({freezeScale:true,target:[1,0,0,.965,0,100]});assert.equal(f.calls.length,count);
  await f.render({duration:200,delay:80,curve:[.25,.46,.45,.94]});
  assert.equal(f.calls.at(-1).duration,200);assert.equal(f.calls.at(-1).delay,80);
  assert.deepEqual(f.calls.at(-1).curve,[.25,.46,.45,.94]);
});

test('without the engine every later transition shows its end values and completes once',async()=>{
  const f=await fixture({engine:'failed'});
  assert.equal(f.completed(),1);assert.equal(f.element.dataset.graphicsError,'Error: engine failed');
  // A sheet slides away: the closing callback (which unmounts it) must still arrive.
  await f.render({target:[1,0,500,1,0,100]});
  assert.equal(f.completed(),2);
  assert.equal(f.element.style.transform,'translate3d(0px,500px,0) scale(1) rotate(0deg)');
  assert.equal(f.element.style.opacity,'1');
  // Height and target change in the same commit: one completion, both end values written.
  await f.render({target:[0,0,-6,1,0,100],height:0});
  assert.equal(f.completed(),3);assert.equal(f.element.style.height,'0px');assert.equal(f.element.style.opacity,'0');
});

test('a missing effects controller settles instead of waiting forever',async()=>{
  const f=await fixture({controller:false});
  assert.equal(f.completed(),1);
  await f.render({target:[0,0,0,1,0,100]});assert.equal(f.completed(),2);assert.equal(f.element.style.opacity,'0');
});

test('a stalled frame loop is completed by the safety timeout, once',async()=>{
  const f=await fixture();f.frame();assert.equal(f.completed(),1);
  await f.render({target:[0,0,24,1,0,100],duration:300,delay:50});
  assert.equal(f.timers.at(-1).ms,300+50+1200);
  f.elapse();
  assert.equal(f.completed(),2);assert.equal(f.element.style.transform,'translate3d(0px,24px,0) scale(1) rotate(0deg)');
  f.frame();assert.equal(f.completed(),2);
});

test('an engine that arrives after the safety net continues from the end state instead of replaying',async()=>{
  const f=await fixture({engine:'late'});
  await f.render({target:[1,0,0,1,0,100]});
  f.elapse();assert.equal(f.completed(),1);
  await f.arrive();
  assert.deepEqual(f.initials.at(-1),[1,0,0,1,0,100]);
  assert.equal(f.calls.at(-1).duration,0);
  f.frame();assert.equal(f.completed(),1);
});
