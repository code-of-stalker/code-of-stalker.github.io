import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const exports = {};
vm.runInNewContext(ts.transpileModule(readFileSync(new URL('./effectQuality.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { exports });
const { QualityPolicy, glassBufferLayout, artworkBufferLayout, qualityDensity, glassRenderDensity } = exports;
const controllerExports = {};
vm.runInNewContext(ts.transpileModule(readFileSync(new URL('./EffectsController.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { exports: controllerExports, require: () => exports });
const { EffectsController } = controllerExports;
test('new controllers start at 60 FPS while retaining independent density limits', () => {
  const controller = new EffectsController();
  assert.equal(controller.policy.targetFps,60);
  assert.equal(controller.getSnapshot().targetFps,60);
  assert.equal(qualityDensity[controller.policy.level],2.5);
  assert.equal(glassRenderDensity,1);
});
test('device quality survives screen changes and bounds automatic recovery', () => {
  const policy = new QualityPolicy(); policy.setPreferred('balanced');
  const time = clock(policy); time.run(60000, 1000 / 60); assert.equal(policy.level, 'balanced');
  policy.resetScreen(); assert.equal(policy.level, 'balanced'); assert.equal(policy.cost, 0);
  policy.setPreferred('economy'); assert.equal(policy.level, 'economy'); assert.equal(policy.cost, 3);
  policy.resetScreen(); assert.equal(policy.level, 'economy'); assert.equal(policy.cost, 3);
});
test('disabled smoothness leaves the selected quality fixed under good and bad cadence', () => {
  const policy = new QualityPolicy(); policy.setPreferred('balanced'); policy.setTarget(60, false);
  const time = clock(policy); time.run(10000, 1000 / 15); time.run(60000, 1000 / 60);
  assert.equal(policy.level, 'balanced'); assert.equal(policy.cost, 0);
});
test('optimization owns probe settings and restores ordinary device preferences on finish', () => {
  const controller = new EffectsController(); controller.preferred('balanced'); controller.probe('economy', 120);
  controller.target(60, false); controller.preferred('high');
  assert.equal(controller.policy.targetFps, 120); assert.equal(controller.policy.level, 'economy'); assert.equal(controller.policy.cost, 3);
  controller.finishOptimization('balanced', 60, false); assert.equal(controller.optimizing, false);
  assert.equal(controller.getSnapshot().level, 'balanced'); assert.equal(controller.getSnapshot().reference, null); assert.equal(controller.getSnapshot().smooth, false);
  controller.screenChanged('/diary'); assert.equal(controller.getSnapshot().level, 'balanced');
});
function clock(policy) {
  let at = 0;
  const changes = [];
  return { run(ms, dt, active = true) {
    const end = at + ms;
    for (; at < end; at += dt) { const result = policy.observe(at, active); if (result) changes.push(result); }
    return changes;
  }, get at() { return at; } };
}
test('glass buffers and source resolution stay at one independently of artwork quality or a soft pixel budget', () => {
  for (const [w,h] of [[44,42],[335.3,306.9],[416,520],[800,1600],[2400,3000]]) {
    for (const requested of [1,1.5,2,2.5,3]) {
      const result = glassBufferLayout(w,h,requested);
      assert.equal(result.density,1);
      assert.equal(result.width,Math.ceil(w));
      assert.equal(result.height,Math.ceil(h));
      assert.equal(result.budgetExceeded,result.width*result.height>384000);
    }
  }
  assert.equal(glassRenderDensity,1);
  assert.equal(glassBufferLayout(NaN,Infinity,3).width,1);
});
test('normal artwork buffers stay at least 2.00; only emergency quality permits the 1.50 floor', () => {
  for (const [w,h] of [[44,42],[335.3,306.9],[416,520],[800,1600],[2400,3000]]) {
    for (const tier of ['economy','reduced','balanced','high']) {
      const result = artworkBufferLayout(w,h,qualityDensity[tier]);
      const floor = tier==='economy'?1.5:2;
      assert.ok(result.density >= floor && result.density <= 2.5);
      assert.ok(result.width/w >= floor && result.height/h >= floor);
      assert.ok(result.width/w <= 2.5 && result.height/h <= 2.5);
      assert.equal(result.budgetExceeded, result.width*result.height > 384000);
    }
  }
  assert.equal(artworkBufferLayout(800,1600,2.5).density,2.5);
  assert.equal(artworkBufferLayout(800,1600,1.5).density,1.5);
  assert.equal(artworkBufferLayout(44,42,3).density,2.5);
});
test('one screen controller broadcasts separate glass and artwork density on every reference and FPS change', () => {
  const controller = new EffectsController(), sent = [[],[]];
  const detach = sent.map((messages,i)=>controller.register({},i?'Artwork':'Glass',message=>messages.push(message)));
  for(const level of ['high','reduced','economy','balanced']) {
    controller.reference(level);
    controller.target(120);
    for(const messages of sent) {
      const last = messages.at(-1);
      assert.equal(last.type,'watcher-quality');
      assert.equal(last.density,qualityDensity[level]);
      assert.equal(last.glassDensity,1);
      assert.equal(last.targetFps,120);
    }
  }
  detach.forEach(fn=>fn());
});
test('quality changes retain the last labelled FPS and dimensions while collecting fresh measurements', () => {
  const controller=new EffectsController(),id={};
  controller.register(id,'Artwork',()=>{});controller.activity(id,true,true);
  const metric={level:'high',density:2.5,buffer:[1000,235],source:[0,0],blur:[0,0],draws:120,blurUpdates:0,sourceUpdates:0,contourUpdates:0,idle:false,cadence:{p95:1000/60,fps:60,samples:60}};
  controller.report(id,metric);
  for(let at=0;at<=2000;at+=1000/60)controller.sample(at);
  const previous=controller.getSnapshot().cadence;
  assert.ok(previous && previous.samples>=6);
  controller.reference('economy');
  const switching=controller.getSnapshot();
  assert.equal(switching.cadence,previous);
  assert.equal(switching.cadencePending,true);
  assert.equal(switching.frames[0].metrics,metric);
  assert.equal(switching.frames[0].awaitingGlass,true);
  assert.equal(controller.policy.metrics,null); // Fresh policy evidence, retained display only.
  controller.report(id,{...metric,level:'economy',transitioning:true,cadence:{p95:100,fps:10,samples:60}});
  for(let at=2100;at<3100;at+=1000/60)controller.sample(at);
  assert.ok(controller.policy.metrics.fps>59,'Old/transitioning effect statistics cannot govern the new quality');
  controller.report(id,{...metric,level:'economy',density:1.5,buffer:[600,141],transitioning:false});
  for(let at=3100;at<4200;at+=1000/60)controller.sample(at);
  assert.equal(controller.getSnapshot().cadencePending,false);
  assert.equal(controller.getSnapshot().frames[0].awaitingGlass,false);
  assert.equal(controller.getSnapshot().frames[0].metrics.density,1.5);
});
test('changing screens discards a retained FPS rather than presenting it for another screen', () => {
  const controller=new EffectsController();
  for(let at=0;at<=2000;at+=1000/60)controller.sample(at);
  controller.reference('economy');assert.equal(controller.getSnapshot().cadencePending,true);
  controller.screenChanged('/practice');
  assert.equal(controller.getSnapshot().cadence,null);
  assert.equal(controller.getSnapshot().cadencePending,false);
});
test('refresh cadence is calibrated for 30/60/90/120Hz; stable work at the requested target upgrades after 18s', () => {
  for (const hz of [30,60,90,120]) {
    const policy = new QualityPolicy(), time = clock(policy);
    policy.level='balanced'; // Exercise recovery from a deliberately reduced tier.
    time.run(2000,1000/hz,false);
    assert.ok(Math.abs(policy.refreshMs - 1000/hz)<.01);
    time.run(15000,1000/hz);
    assert.equal(policy.level,'balanced');
    time.run(6000,1000/hz);
    assert.equal(policy.level,'high');
  }
});
test('idle never qualifies for an upgrade; a paused 30fps effect does not dictate UI cadence', () => {
  const policy = new QualityPolicy(), time = clock(policy);
  time.run(60000,1000/60,false);
  assert.equal(policy.level,'high');
  // The policy receives UI rAF only, regardless of the separate renderer's 30fps clock.
  time.run(10000,1000/60,true);
  assert.ok(policy.metrics.missedShare < .001);
  assert.equal(policy.level,'high');
});
test('severe 2fps stalls still trigger one density step instead of waiting for twelve samples', () => {
  const policy = new QualityPolicy(), time = clock(policy);
  time.run(2000,1000/60,false); time.run(4500,500);
  assert.equal(policy.level,'balanced');
});
test('sustained drops simplify three cost stages at 2.00 before emergency 1.50, including during upgrade cooldown', () => {
  const policy = new QualityPolicy(), time = clock(policy);
  time.run(2000,1000/60,false); time.run(21000,1000/60);
  assert.equal(policy.level,'high');
  const overloadedAt = time.at;
  const changes = time.run(21000,1000/30).filter(change=>change.at>=overloadedAt);
  assert.deepEqual(changes.map(change=>[change.to,change.cost]),[
    ['balanced',0],['reduced',1],['reduced',2],['reduced',3],['economy',3],
  ]);
  for(const change of changes.slice(0,-1)) assert.ok(qualityDensity[change.to]>=2);
  assert.equal(policy.level,'economy');
  assert.equal(policy.cost,3);
  assert.ok(policy.refreshMs < 17); // Dropped 60Hz frames must not redefine the display as 30Hz.
});
test('a brief stall, hidden-tab gap and orientation reset cannot accumulate bad time', () => {
  const policy = new QualityPolicy(), time = clock(policy);
  time.run(2000,1000/60,false); time.run(2000,1000/60);
  time.run(1000,1000/30); time.run(3000,1000/60);
  assert.equal(policy.level,'high');
  policy.resetWindow();
  policy.observe(time.at+60000,true); policy.observe(time.at+60016,true);
  assert.ok(policy.metrics === null || policy.metrics.samples < 3); assert.equal(policy.level,'high');
});
test('idle pauses the stable timer and upgrades have a cooldown, but fixed references are measured', () => {
  const policy = new QualityPolicy(), time = clock(policy);
  policy.level='economy';
  time.run(2000,1000/60,false); time.run(15000,1000/60); time.run(5000,1000/60,false);
  time.run(15000,1000/60);
  assert.equal(policy.level,'economy');
  time.run(6000,1000/60);
  assert.equal(policy.level,'reduced');
  time.run(16000,1000/60);
  assert.equal(policy.level,'reduced');
  time.run(7000,1000/60);
  assert.equal(policy.level,'balanced');
  policy.setReference('high'); time.run(10000,1000/30);
  assert.equal(policy.level,'high'); assert.ok(policy.metrics.missedShare>.4);
});
test('90 FPS rAF with actual 30 FPS effects cannot promote and is reported honestly', () => {
  const policy = new QualityPolicy();
  policy.setTarget(90);
  for (let at=0;at<18000;at+=1000/90) policy.observe(at,true,[{fps:30,p95:1000/30,samples:30}]);
  assert.equal(policy.level,'economy');
  assert.ok(policy.cost>0);
  assert.ok(policy.metrics.fps<=30);
  assert.ok(policy.metrics.overloaded);
});
test('emergency quality follows all cost reductions; idle cannot restore it, and recovery restores sharpness first', () => {
  const policy = new QualityPolicy(), time = clock(policy);
  time.run(2000,1000/60,false); time.run(22000,1000/30,true);
  assert.equal(policy.level,'economy'); assert.equal(policy.cost,3);
  assert.equal(qualityDensity[policy.level],1.5);
  time.run(30000,1000/60,false); assert.equal(policy.cost,3);
  time.run(21000,1000/60,true); assert.equal(policy.cost,3); assert.equal(policy.level,'reduced');
  assert.equal(qualityDensity[policy.level],2);
  time.run(24000,1000/60,true); assert.equal(policy.cost,2); assert.equal(policy.level,'reduced');
});
test('90 FPS target respects a 60 Hz screen, with optional 120 FPS and no reset of density on mode changes', () => {
  const policy = new QualityPolicy(), time = clock(policy);
  policy.setTarget(90);
  time.run(2000,1000/60,false); time.run(3000,1000/60,true);
  assert.ok(Math.abs(policy.metrics.targetMs-1000/60)<.01);
  policy.level='economy'; policy.setTarget(120);
  assert.equal(policy.level,'economy'); assert.equal(policy.targetFps,120);
});
test('90 FPS effect on a 120 Hz display can promote despite alternating display slots', () => {
  const policy=new QualityPolicy();
  policy.setTarget(90);
  for(let at=0;at<23000;at+=1000/120)policy.observe(at,true,[{fps:90,p95:1000/60,samples:90}]);
  assert.equal(policy.level,'high');assert.ok(policy.metrics.missedShare<.01);
});
test('an effect stuck at 60 FPS on a 120 Hz screen cannot masquerade as meeting the 90 FPS target', () => {
  const policy = new QualityPolicy();
  policy.setTarget(90);
  for (let at=0; at<18000; at+=1000/120) policy.observe(at,true,[{fps:60,p95:1000/60,samples:60}]);
  assert.equal(policy.level,'economy');
  assert.ok(policy.cost>0);
  assert.equal(policy.metrics.fps,60);
  assert.ok(policy.metrics.overloaded);
});
test('fast rAF slots calibrate a high refresh screen despite occasional delayed frames', () => {
  const policy = new QualityPolicy();
  let at=0;
  for(let frame=0;frame<400;frame++) {
    at += frame%4===0 ? 1000/60 : 1000/120;
    policy.observe(at,true);
  }
  assert.equal(policy.calibrated,true);
  assert.ok(Math.abs(policy.refreshMs-1000/120)<.01);
});
