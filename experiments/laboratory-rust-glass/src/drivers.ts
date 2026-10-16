import {WebGLVideoEdgeGlassRenderer} from '../reference/src/liquid-glass/WebGLVideoEdgeGlassRenderer';
import {panel,parameters,type Settings} from './parameters';
import {WorkloadSource,type SceneKind} from './workload';
import type {FrameWork} from './benchmark';
import type {ObserverSample} from './observerPlayback';
import {defaultMatrixRainSettings} from '../reference/src/backgrounds/matrixRainSettings';
import {workloadVersion,observerCycleSeconds} from './workload';

export type EngineName='current'|'rust'|'rust-full';
type RustEngine={backend():string;diagnostics():Float64Array;resize(w:number,h:number,r:number):void;configure(a:Float32Array,b:Float32Array,c:Float32Array,w:number,h:number,m:Float32Array):void;update_canvas_source(source:HTMLCanvasElement):void;pointer(x:number,y:number,down:boolean):void;replay():void;render(t:number):number;render_full(t:number):number;observer_state():Float64Array;restart_scene():void;seek_scene(t:number):void;reset_clock():void;dispose():void;free():void};
type RustModule={default():Promise<{memory:WebAssembly.Memory}>;GlassEngine:{create(canvas:HTMLCanvasElement,gl:boolean,source:HTMLCanvasElement):Promise<RustEngine>;create_full(canvas:HTMLCanvasElement,gl:boolean,kind:number):Promise<RustEngine>}};
export type ResourceSnapshot={wasmBytes:number;texturesAllocated:number;blurViewsAllocated:number;sourceUploads:number;blurPasses:number;submittedFrames:number;surfaceSkips:number;gpuRainUpdates:number;gpuObserverFrames:number;vectorVertices:number;vectorIndices:number};
export type Driver={backend:string;dispose():void;render(t:number):FrameWork;resources():ResourceSnapshot|null;observerSample?():ObserverSample;configure(s:Settings,w:number,h:number,reduced:boolean):void;pointer(x:number,y:number,down:boolean):void;replay():void;resetClock():void;restartScene():void;seekScene(t:number|null):void;describe():ReturnType<WorkloadSource['describe']>};

async function loadRust(){const url=new URL('./pkg/laboratory_glass.js',document.baseURI).href;return await import(/* @vite-ignore */url) as RustModule;}
function resources(rust:RustEngine,memory:WebAssembly.Memory):ResourceSnapshot{
  const d=rust.diagnostics();return {wasmBytes:memory.buffer.byteLength,texturesAllocated:d[0],blurViewsAllocated:d[1],sourceUploads:d[2],blurPasses:d[3],submittedFrames:d[4],surfaceSkips:d[5],gpuRainUpdates:d[6],gpuObserverFrames:d[7],vectorVertices:d[8],vectorIndices:d[9]};
}

async function createFullDriver(forceGL:boolean,scene:SceneKind,canvas:HTMLCanvasElement,width:number,height:number,reduced:boolean):Promise<Driver>{
  const wasm=await loadRust(),module=await wasm.default();
  const rust=await wasm.GlassEngine.create_full(canvas,forceGL,scene==='static'?0:scene==='rain'?1:2);
  let size={width,height},paused=reduced;
  const work:FrameWork={sourceUpdated:false,sourceCpuMs:0,commandsCpuMs:0,sceneTimeMs:0};
  return {backend:rust.backend(),dispose:()=>{rust.dispose();rust.free();},
    render:now=>{const start=performance.now(),encoded=rust.render_full(now);work.sourceUpdated=encoded>0&&scene!=='static';work.sceneTimeMs=Math.abs(encoded)-1;work.sourceCpuMs=0;work.commandsCpuMs=performance.now()-start;return work;},
    resources:()=>resources(rust,module.memory),
    observerSample:()=>{const s=rust.observer_state();return {node:s[3]>0?rust:null,transform:`matrix(${s[0]},0,0,${s[0]},${s[1]},${s[2]})`,playState:paused?'paused':'running'};},
    configure:(s,w,h,r)=>{const ratio=Math.min(2,s.pixelRatio,2048/Math.max(w,h));size=scene==='static'?{width:768,height:960}:{width:Math.round(w*ratio),height:Math.round(h*ratio)};paused=r;rust.resize(w,h,s.pixelRatio);const p=parameters(s,w,h,r,size.width/size.height);rust.configure(p.glass,p.horizontal,p.vertical,p.blur.width,p.blur.height,p.motion);},
    pointer:(x,y,d)=>rust.pointer(x,y,d),replay:()=>rust.replay(),resetClock:()=>rust.reset_clock(),restartScene:()=>rust.restart_scene(),seekScene:t=>rust.seek_scene(t??-1),
    describe:()=>({version:workloadVersion,scene,timeBase:'active-wall-time; no slow-frame delta cap',
      background:scene==='static'?{kind:'static-grid'}:{kind:'matrix-rain',maxFps:30,settings:{...defaultMatrixRainSettings}},
      animation:scene==='rain-observer'?{id:'laboratory-attention-awareness',cycleSeconds:observerCycleSeconds}:null,source:size,reducedMotion:paused}),
  };
}

export async function createDriver(engine:EngineName,forceGL:boolean,scene:SceneKind,canvas:HTMLCanvasElement,settings:Settings,width:number,height:number,reduced:boolean,reveal:(value:number)=>void):Promise<Driver> {
  if(scene!=='static')await Promise.all([document.fonts.load('10px "Disket Mono"'),document.fonts.load('10px "Noto Rain"')]);
  if(engine==='rust-full')return createFullDriver(forceGL,scene,canvas,width,height,reduced);
  const source=new WorkloadSource(scene);
  const work:FrameWork={sourceUpdated:false,sourceCpuMs:0,commandsCpuMs:0,sceneTimeMs:0};
  const profile=(submit:(changed:boolean)=>void)=>(now:number)=>{
    const start=performance.now(),changed=source.draw(now),prepared=performance.now();
    submit(changed);
    work.sourceUpdated=changed;work.sourceCpuMs=prepared-start;work.commandsCpuMs=performance.now()-prepared;work.sceneTimeMs=source.timeMilliseconds;
    return work;
  };
  source.configure(width,height,settings.pixelRatio,reduced);
  try {
    if(engine==='current'){
      const reference=new WebGLVideoEdgeGlassRenderer({canvas,source:source.canvas,sourceNaturalSize:{width:source.canvas.width,height:source.canvas.height},settings,glassPanel:panel,autoResize:false,onRevealProgress:reveal});
      let pressed=false;
      return {backend:'Three.js / WebGL2',
        dispose:()=>{reference.dispose();source.dispose();},
        render:profile(changed=>{if(changed)reference.updateCanvasSource();reference.renderInteractiveFrame(source.timeMilliseconds);}),
        resources:()=>null,
        configure:(s,w,h,r)=>{source.configure(w,h,s.pixelRatio,r);reference.updateCanvasSource();reference.updateSettings({...s,pixelRatio:Math.min(2,s.pixelRatio)});reference.setReducedMotion(r);},
        pointer:(x,y,down)=>{reference.updatePointer(x,y,down);if(down&&!pressed)reference.triggerPulse(x,y);pressed=down;},
        replay:()=>reference.replayReveal(),resetClock:()=>{reference.resetFrameClock();source.suspend();},
        restartScene:()=>{source.restart();reference.resetFrameClock();reference.replayReveal();},seekScene:t=>{source.seek(t);reference.resetFrameClock();reference.finishRevealForPreview();},describe:()=>source.describe()};
    }
    const wasm=await loadRust();const module=await wasm.default();
    const rust=await wasm.GlassEngine.create(canvas,forceGL,source.canvas);
    return {backend:rust.backend(),dispose:()=>{rust.dispose();rust.free();source.dispose();},
      render:profile(changed=>{if(changed)rust.update_canvas_source(source.canvas);reveal(rust.render(source.timeMilliseconds));}),
      resources:()=>resources(rust,module.memory),
      configure:(s,w,h,r)=>{source.configure(w,h,s.pixelRatio,r);rust.resize(w,h,s.pixelRatio);const p=parameters(s,w,h,r,source.canvas.width/source.canvas.height);rust.configure(p.glass,p.horizontal,p.vertical,p.blur.width,p.blur.height,p.motion);},
      pointer:(x,y,d)=>rust.pointer(x,y,d),replay:()=>rust.replay(),resetClock:()=>{rust.reset_clock();source.suspend();},
      restartScene:()=>{source.restart();rust.reset_clock();rust.replay();},seekScene:t=>{source.seek(t);rust.seek_scene(t??-1);},describe:()=>source.describe()};
  } catch(error) {source.dispose();throw error;}
}
