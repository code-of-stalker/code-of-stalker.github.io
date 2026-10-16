import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
const root=path.dirname(fileURLToPath(import.meta.url));
const labRequire=createRequire(path.join(process.env.LABORATORY_SOURCE||'C:/Code Of Stalker/Liquid_Prnc_Glass-main','package.json'));
const cache=new Map();
function load(filename){
  if(filename.endsWith('.json'))return JSON.parse(readFileSync(filename,'utf8'));
  if(cache.has(filename))return cache.get(filename);
  const exports={};cache.set(filename,exports);
  const source=ts.transpileModule(readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
  vm.runInNewContext(source,{exports,Float32Array,Math,Number,JSON,require(specifier){if(!specifier.startsWith('.'))return labRequire(specifier);const resolved=path.resolve(path.dirname(filename),specifier);return load(existsSync(resolved)?resolved:resolved+'.ts');}},{filename});return exports;
}
const {parameters,initial}=load(path.join(root,'src/parameters.ts'));
const uniforms=load(path.join(root,'src/uniforms.json'));
test('both renderers receive finite uniforms at narrow and wide sizes with ratio capped at two',()=>{
  for(const width of [288,343,414,540])for(const ratio of [1,1.5,2,3]){
    const p=parameters({...initial,pixelRatio:ratio},width,width/0.8,false);
    assert.ok([...p.glass,...p.horizontal,...p.vertical].every(Number.isFinite));
    assert.equal(p.glass[uniforms.glass.uPixelRatio.slot*4],Math.min(2,ratio));
    assert.equal(p.glass[uniforms.glass.uResolution.slot*4],Math.floor(width*Math.min(2,ratio)));
    assert.ok(Math.abs(p.glass[uniforms.glass.uBorderThickness.slot*4]-initial.edgeThickness)<1e-6);
  }
});
test('blur kernels preserve uniform brightness and zero blur is disabled',()=>{
  for(const radius of [0,1,6,30]){
    const p=parameters({...initial,backgroundBlur:radius},343,428,false);
    assert.equal(p.glass[uniforms.glass.uBlurEnabled.slot*4],Number(radius>0));
    for(const data of [p.horizontal,p.vertical]){
      const base=uniforms.blur.uWeights.slot*4;
      let sum=data[base];for(let i=1;i<37;i++)sum+=2*data[base+i*4];assert.ok(Math.abs(sum-1)<1e-5);
    }
  }
});
test('frame report includes slow frames rather than removing them',()=>{
  const {summarize}=load(path.join(root,'src/metrics.ts'));
  const summary=summarize([16,16,16,16,100],[1,2]);
  assert.equal(summary.frames,5);assert.equal(summary.over34,20);assert.equal(summary.cpuMs,1.5);assert.equal(summary.p95,100);assert.ok(summary.fps<31);
});

test('animated source aspect is shared by the glass and both blur passes after resize',()=>{
  for(const [width,height] of [[326,408],[538,673],[740,925]]) {
    const aspect=width/height;
    const p=parameters(initial,width,height,false,aspect);
    assert.ok(Math.abs(p.glass[uniforms.glass.uSourceAspect.slot*4]-aspect)<1e-6);
    assert.ok(Math.abs(p.horizontal[uniforms.blur.uSourceAspect.slot*4]-aspect)<1e-6);
    assert.ok(Math.abs(p.vertical[uniforms.blur.uSourceAspect.slot*4]-aspect)<1e-6);
  }
});

test('scene replay repeats its starting phase and suspension excludes time in the background',()=>{
  const {SceneClock}=load(path.join(root,'src/workload.ts'));
  const clock=new SceneClock();
  assert.equal(clock.frame(100,true),0);
  assert.equal(clock.frame(116,true),16);
  clock.suspend();
  assert.equal(clock.frame(60116,true),16);
  assert.equal(clock.frame(60132,true),32);
  assert.equal(clock.frame(70000,false),32);
  assert.equal(clock.frame(80000,true),32);
  clock.restart();
  assert.equal(clock.frame(90000,true),0);
  assert.equal(clock.frame(90016,true),16);
  assert.equal(clock.frame(91016,true),1016);
});

test('observer monitor requires visible transform changes on the same SVG node',()=>{
  const {ObserverPlaybackProbe}=load(path.join(root,'src/observerPlayback.ts'));
  const probe=new ObserverPlaybackProbe(),node={};
  const sample=(transform,playState='running')=>({node,transform,playState});
  assert.equal(probe.observe(sample('matrix(3.2,0,0,3.2,-352,-6.4)'),0).status,'waiting');
  assert.equal(probe.observe(sample('matrix(3.2,0,0,3.2,-352,-6.4)'),2100).status,'waiting');
  assert.equal(probe.observe(sample('matrix(2.4,0,0,2.4,-220,0)'),3000).status,'waiting');
  const result=probe.observe(sample('matrix(1.18,0,0,1.18,-28.8,12)'),7000);
  assert.equal(result.status,'moving');assert.equal(result.nodeReplacements,0);assert.equal(result.transformChanges,2);
  assert.equal(probe.observe(sample('matrix(1.18,0,0,1.18,-28.8,12)','paused'),7100).status,'paused');
});

test('observer monitor rejects SVG replacement even if the playing flag stays true',()=>{
  const {ObserverPlaybackProbe}=load(path.join(root,'src/observerPlayback.ts'));
  const probe=new ObserverPlaybackProbe();
  for(let i=0;i<20;i++)probe.observe({node:{},transform:'matrix(3.2,0,0,3.2,-352,-6.4)',playState:'running'},i*700);
  assert.equal(probe.snapshot().status,'restarted');assert.equal(probe.snapshot().nodeReplacements,19);
  assert.equal(probe.snapshot().transformChanges,0);
});

test('observer monitor does not accept a still or missing illustration as animation load',()=>{
  const {ObserverPlaybackProbe}=load(path.join(root,'src/observerPlayback.ts'));
  const probe=new ObserverPlaybackProbe(),sample={node:{},transform:'none',playState:'running'};
  probe.observe(sample,0);assert.equal(probe.observe(sample,14000).status,'stalled');
  assert.equal(probe.observe({...sample,node:null},15000).status,'unavailable');
});

test('frame interval uses preceding work and excludes suspension time',()=>{
  const {FrameSampler}=load(path.join(root,'src/benchmark.ts'));
  const sampler=new FrameSampler(),work={sourceUpdated:true,sourceCpuMs:2,commandsCpuMs:3,sceneTimeMs:0};
  assert.equal(sampler.frame(1000,work,5),null);
  work.sourceCpuMs=20;work.sourceUpdated=false;
  const frame=sampler.frame(1016,work,25);
  assert.equal(frame.endMs-frame.startMs,16);assert.equal(frame.sourceCpuMs,2);assert.equal(frame.cpuMs,5);assert.equal(frame.sourceUpdated,true);
  sampler.reset();assert.equal(sampler.frame(80000,work,25),null);
});

test('warmup boundary is excluded from the sustained result without clipping the slow frame',()=>{
  const {summarizeRun}=load(path.join(root,'src/benchmark.ts'));
  const make=(start,end)=>({startMs:start,endMs:end,cpuMs:5,sourceCpuMs:2,commandsCpuMs:3,sourceUpdated:true,sceneTimeMs:start});
  const report=summarizeRun([make(14900,15200),make(15200,15220),make(59980,60120)],0);
  assert.equal(report.frames,2);assert.equal(report.seconds,.16);assert.equal(report.p95,140);
  assert.equal(report.warmup.frames,1);assert.equal(report.warmup.p95,300);
  assert.equal(report.timeline.reduce((sum,b)=>sum+b.frames,0),3);
  assert.equal(report.actualFromMs,15200);assert.equal(report.actualToMs,60120);
});

test('five-second timeline shows a sustained slowdown hidden by an overall average',()=>{
  const {summarizeRun}=load(path.join(root,'src/benchmark.ts'));
  const frames=[];
  for(let t=0;t<60000;){const end=t+(t<10000?20:40);frames.push({startMs:100000+t,endMs:100000+end,cpuMs:t<10000?4:8,sourceCpuMs:2,commandsCpuMs:t<10000?2:6,sourceUpdated:true,sceneTimeMs:t});t=end;}
  const report=summarizeRun(frames,100000);
  assert.equal(report.timeline.length,12);assert.equal(report.timeline[0].fps,50);assert.equal(report.timeline[3].fps,25);assert.equal(report.timeline[11].fps,25);
  assert.equal(report.fps,25);assert.equal(report.seconds,45);assert.equal(report.cpuMs,8);
  assert.equal(report.timeline.reduce((sum,b)=>sum+b.frames,0),frames.length);
  assert.equal(report.timeline[2].phase,'warmup');assert.equal(report.timeline[3].phase,'measurement');
});

test('missing five-second windows stay empty and long stalls remain visible',()=>{
  const {summarizeRun}=load(path.join(root,'src/benchmark.ts'));
  const report=summarizeRun([{startMs:1000,endMs:20000,cpuMs:5,sourceCpuMs:1,commandsCpuMs:4,sourceUpdated:true,sceneTimeMs:0}],0);
  assert.equal(report.timeline[0].p95,19000);assert.equal(report.timeline[1].frames,0);
  assert.equal(report.frames,0);assert.equal(report.actualFromMs,null);
});
