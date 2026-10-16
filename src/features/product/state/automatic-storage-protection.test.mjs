import assert from 'node:assert/strict';
import test from 'node:test';
import { registerHooks } from 'node:module';
registerHooks({ resolve(specifier, context, next) {
  return next(specifier.startsWith('.') && !/\.(ts|mjs|js)(\?|$)/.test(specifier) ? specifier + '.ts' : specifier, context);
} });
const { enableAutomaticStorageProtection } = await import('./automatic-storage-protection.web.ts');
const tick = () => new Promise(resolve => setImmediate(resolve));
async function environment(storage, permission, run) {
  const names = ['navigator','window'], previous = names.map(name => Object.getOwnPropertyDescriptor(globalThis,name));
  const window = new EventTarget(), input = new EventTarget();
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{storage,permissions:{query:async()=>({state:permission})}}});
  Object.defineProperty(globalThis,'window',{configurable:true,value:window});
  let clean;
  try { clean = enableAutomaticStorageProtection(input); await tick(); await run(input,window,clean); }
  finally { clean?.(); names.forEach((name,i)=>{if(previous[i])Object.defineProperty(globalThis,name,previous[i]);else delete globalThis[name];}); }
}
test('startup persistence grant requires no settings or subsequent user interaction', async () => {
  let requests = 0, granted = false;
  await environment({ persisted:async()=>granted, persist:async()=>{requests++;granted=true;return true;}, estimate:async()=>({}) },'prompt',async input=>{
    assert.equal(requests,1); input.dispatchEvent(new Event('pointerup')); await tick(); assert.equal(requests,1); assert.equal(granted,true);
  });
});
test('a browser requiring interaction gets one retry, without overlapping permission requests', async () => {
  let requests = 0, finish;
  await environment({ persisted:async()=>false, persist:async()=>++requests===1?false:await new Promise(resolve=>{finish=resolve;}), estimate:async()=>({}) },'prompt',async input=>{
    assert.equal(requests,1); input.dispatchEvent(new Event('pointerup')); await tick(); input.dispatchEvent(new Event('keydown')); input.dispatchEvent(new Event('pointerup')); assert.equal(requests,2); finish(true); await tick(); input.dispatchEvent(new Event('pointerup')); await tick(); assert.equal(requests,2);
  });
});
test('explicit denial and unsupported storage do not cause automatic re-prompts', async () => {
  let requests=0;
  await environment({persisted:async()=>false,persist:async()=>{requests++;return false;},estimate:async()=>({})},'denied',async input=>{
    input.dispatchEvent(new Event('pointerup')); await tick(); assert.equal(requests,1);
  });
  await environment(undefined,'prompt',async input=>{ input.dispatchEvent(new Event('keydown')); await tick(); assert.equal(requests,1); });
});
test('teardown ignores late grants and releases interaction retries', async () => {
  let resolveGrant,notifications=0,requests=0;
  await environment({persisted:async()=>false,persist:async()=>{requests++;return await new Promise(resolve=>{resolveGrant=resolve;});},estimate:async()=>({})},'prompt',async(input,window,clean)=>{
    window.addEventListener('watcher-storage-protection',()=>notifications++); clean(); resolveGrant(true); await tick(); input.dispatchEvent(new Event('pointerup')); await tick(); assert.equal(requests,1);assert.equal(notifications,0);
  });
});
