import type { EffectsController, GlassMetrics } from './EffectsController';
import { qualityDensity, glassRenderDensity } from './effectQuality';
import type { GlassShape } from './glassShape';
import { graphicsPalette } from './graphicsPalette';
type Renderer = { backend(): string; add(scan: boolean): number; add_rain(): number; add_observer(): number; add_raster(kind: string): number; remove(id: number): void;
  present_to(id: number, canvas: HTMLCanvasElement): boolean;
  add_vector(root: Element, kind: string, card: boolean): number;
  vector_audio(id: number, low: number, mid: number, high: number, contour: Float64Array, reacting: boolean, progress: number, locked: boolean, playback:boolean): void;
  vector_decoder(id: number, visible: boolean): void; vector_interact(id: number, action: string, x: number, y: number): void;
  vector_pointer_down(id: number, at: number, width: number, height: number, delay: number): void;
  vector_pointer_move(id: number, at: number, dx: number, dy: number): void; vector_pointer_up(id: number, at: number, inside: boolean): boolean;
  resize(id: number, width: number, height: number, path: string, orbs: boolean): void; quality(density: number, cost: number, fps: number): void; quality_pending(): boolean;
  active(id: number, active: boolean, reduced: boolean): void; pointer(id: number, x: number, y: number, pressed: boolean): void;
  palette(theme: number): void; benchmark(id: number, at: number): void;
  snapshot(): unknown; restore(state:unknown):void; reset_clock(): void; frame(at: number): boolean; reveal(id: number): number; replay_scan(id: number): void; moving(id: number): boolean;
  commits(id:number):number; rect(id: number): Float64Array; metrics(id: number): Float64Array; dispose(): void };
export type SvgTimeline = { active(value: boolean, reduced: boolean): void; resize(width: number, height: number): void; reset_clock(): void;
  pointer_down(at: number, width: number, height: number, delay: number): void; pointer_move(at: number, dx: number, dy: number): void; pointer_up(at: number, inside: boolean): boolean;
  interact(action: string, x: number, y: number): void; audio(low: number, mid: number, high: number, contour: Float64Array, reacting: boolean, progress: number, locked: boolean, playback:boolean): void;
  decoder_visible(value: boolean): void; frame(at: number): boolean; dispose(): void };
export type ElementTimeline = { active(value: boolean): void; reset_clock(): void; initial(values: Float64Array): void; target(values: Float64Array, duration: number, delay: number, curve: Float64Array): void;
  spring_scale(value: number, snap: boolean): void;
  initial_height(value: number): void; target_height(value: number, duration: number): void;
  target_height_curve(value: number, duration: number, curve: Float64Array): void;
  scan_reveal(duration: number, delay: number): void;
  loop(width: number, speed: number): void; frame(at: number): boolean; moving(): boolean; dispose(): void };
type Wasm = { default(options: { module_or_path: string }): Promise<unknown>; ProductRenderer: { create(canvas: HTMLCanvasElement, forceGl: boolean): Promise<Renderer> };
  TextTimeline: { create(root: HTMLElement, text: string, effect: number): { active(active: boolean, reduced: boolean): void; frame(at: number): boolean; resize(): void; reset_clock(): void; dispose(): void } };
  panel_reveal(root: HTMLElement, progress: number, reduced: boolean): void;
  level_panel_geometry(root: HTMLElement, width: number, height: number, level: string): void;
  panel_geometry(path: string, fromWidth: number, fromHeight: number, width: number, height: number): string;
  SvgTimeline: { create(root: Element, kind: string, card: boolean): SvgTimeline }; ElementTimeline: { create(root: HTMLElement): ElementTimeline } };
let runtime: Promise<Wasm> | undefined;
type EngineState = 'idle' | 'loading' | 'ready' | 'failed';
let engineState: EngineState = 'idle';
const engineListeners = new Set<() => void>();
const engineChanged = (state: EngineState) => { engineState = state; engineListeners.forEach(listener => listener()); };
/** Whether the shared engine has arrived; screens hold their place until it has. */
export const graphicsEngine = {
  state: () => engineState,
  subscribe(listener: () => void) { engineListeners.add(listener); return () => { engineListeners.delete(listener); }; },
};
export function loadGraphics() { return runtime ??= (async () => {
  engineChanged('loading');
  const module = await (Function('url', 'return import(url)') as (url: string) => Promise<Wasm>)('/graphics/pkg/watcher_graphics.js');
  await module.default({ module_or_path: '/graphics/pkg/watcher_graphics_bg.wasm' }); return module;
})().then(module => { engineChanged('ready'); return module; }, problem => { engineChanged('failed'); throw problem; }); }
async function openRenderer(forceGl:boolean){
  const module=await loadGraphics();let atlas=document.createElement('canvas');atlas.width=atlas.height=1;let renderer:Renderer;
  try{renderer=await module.ProductRenderer.create(atlas,forceGl);}
  catch(problem){if(forceGl)throw problem;console.warn('Rust WebGPU initialization, trying WebGL2:',problem);atlas=document.createElement('canvas');atlas.width=atlas.height=1;renderer=await module.ProductRenderer.create(atlas,true);}
  return{renderer,atlas};
}
type Scene = { id: number; token: object; output: HTMLCanvasElement; context: CanvasRenderingContext2D | null; direct: boolean; active: boolean; rain:boolean; reveal?: (progress: number) => void; ready?: () => void;
  drawCount:number;lastReveal: number; lastDraw?: number; intervals: number[]; postedAt: number; painted: boolean };
const sessions = new WeakMap<EffectsController, Promise<RustSession>>();
export function rustSession(controller: EffectsController) {
  let session = sessions.get(controller);
  if (!session) { session = RustSession.create(controller).catch(problem => { sessions.delete(controller); throw problem; }); sessions.set(controller, session); }
  return session;
}
/** WebGPU presents directly to visible surfaces on one shared device. WebGL2
 * retains the atlas-to-Canvas2D adapter; Rust owns all animation and painting. */
export class RustSession {
  private scenes = new Map<number, Scene>(); private pending = false;
  private qualityReportPending = false;
  private detachPalette: () => void;
  private referenceCount = 0; private detach: () => void; private qualityKey = '';
  private teardown?: ReturnType<typeof setTimeout>;
  private recovering=false;private recoveryAttempts=0;private disposed=false;private deferredSizes=new Map<number,GlassShape>();
  private constructor(private controller: EffectsController, private renderer: Renderer, private atlas: HTMLCanvasElement) {
    renderer.palette(graphicsPalette.get());
    this.detachPalette = graphicsPalette.subscribe(light => { this.renderer.palette(light); this.pending = true; });
    this.detach = controller.frameJob(at => this.frame(at));
  }
  static async create(controller: EffectsController) {
    const {renderer,atlas}=await openRenderer(new URLSearchParams(location.search).get('graphics-backend')==='webgl2');
    const session = new RustSession(controller, renderer, atlas), policy = controller.policy;
    renderer.quality(qualityDensity[policy.level], policy.cost, policy.smooth ? policy.targetFps : 60); return session;
  }
  add(output: HTMLCanvasElement, scan: boolean, reveal?: Scene['reveal'], ready?: Scene['ready'],rain=false,observer=false,vector?: { root: Element; kind: string; card: boolean },raster?: string) {
    clearTimeout(this.teardown);
    const id = raster ? this.renderer.add_raster(raster) : vector ? this.renderer.add_vector(vector.root, vector.kind, vector.card) : rain ? this.renderer.add_rain() : observer ? this.renderer.add_observer() : this.renderer.add(scan);
    let direct: boolean, context: CanvasRenderingContext2D | null;
    try {
      direct = this.renderer.present_to(id, output);
      context = direct ? null : output.getContext('2d', { alpha: true });
      if (!direct && !context) throw new Error('Canvas presentation is unavailable');
    } catch (problem) { this.renderer.remove(id); throw problem; }
    const token = {}, scene: Scene = { id, token, output, context, direct, active: false, rain: rain || observer || !!vector || !!raster, reveal, ready, drawCount:-1,lastReveal: -1, intervals: [], postedAt: 0, painted: false };
    this.referenceCount++;
    output.dataset.graphicsSurface = scene.rain ? 'artwork' : 'glass';
    output.dataset.graphicsPresentation = direct ? 'direct-gpu' : 'atlas-canvas2d';
    this.scenes.set(id, scene);
    const unregister = this.controller.register(token, raster ? `${raster} · Rust GPU` : vector ? `${vector.kind} · Rust vectors` : rain?'Матричный дождь · Rust':observer?'Наблюдающий · Rust GPU':'Стекло · Rust', value => {
      const data = value as { type: string; density?: number; cost?: number; targetFps?: number };
      if (data.type === 'watcher-quality') { const key = `${data.density}|${data.cost}|${data.targetFps}`; if(key !== this.qualityKey) {this.qualityKey=key;if(!this.recovering)this.renderer.quality(data.density!, data.cost!, data.targetFps!);this.pending = true;this.qualityReportPending = true;} }
      if (data.type === 'watcher-clock-reset') { this.renderer.reset_clock(); this.scenes.forEach(s => { s.lastDraw = undefined; s.intervals = []; }); }
      if (data.type === 'watcher-graphics-recover') void this.recover('Проверка восстановления графических ресурсов');
    }); this.pending = true;
    return {
      resize: (shape: GlassShape) => { if(this.recovering)this.deferredSizes.set(id,shape);else this.renderer.resize(id, shape.width, shape.height, shape.path, shape.background === 'orbs'); this.pending = true; },
      active: (active: boolean, reduced: boolean) => { if(scene.active !== active) {scene.lastDraw = undefined;scene.intervals = [];}scene.active = active;output.dataset.graphicsActive=String(active);this.renderer.active(id,active,reduced);this.controller.activity(token,active,!reduced&&this.renderer.moving(id));this.pending = true; },
      pointer: (x: number,y: number,pressed: boolean) => {this.renderer.pointer(id,x,y,pressed);this.pending = true;},
      benchmark: (at: number) => { this.renderer.benchmark(id, at); this.pending = true; },
      audio: (low: number, mid: number, high: number, contour: Float64Array, reacting: boolean, progress: number, locked: boolean, playback:boolean) => { this.renderer.vector_audio(id, low, mid, high, contour, reacting, progress, locked,playback); this.pending = true; },
      decoder: (visible: boolean) => { this.renderer.vector_decoder(id, visible); this.pending = true; },
      replayScan: () => { this.renderer.replay_scan(id); scene.lastReveal = -1; this.pending = true; },
      interact: (action: string, x = 0, y = 0) => { this.renderer.vector_interact(id, action, x, y); this.pending = true; },
      down: (at: number, width: number, height: number, delay: number) => { this.renderer.vector_pointer_down(id, at, width, height, delay); this.pending = true; },
      move: (at: number, dx: number, dy: number) => { this.renderer.vector_pointer_move(id, at, dx, dy); this.pending = true; },
      up: (at: number, inside: boolean) => { const tapped = this.renderer.vector_pointer_up(id, at, inside); this.pending = true; return tapped; },
      release: () => {unregister();this.renderer.remove(id);this.scenes.delete(id);this.pending = true;
        if(--this.referenceCount===0)this.teardown=setTimeout(()=>{this.disposed=true;this.detach();this.detachPalette();this.renderer.dispose();sessions.delete(this.controller);},1000);},
    };
  }
  private async recover(problem:unknown) {
    if(this.recovering||this.disposed)return;this.recovering=true;this.recoveryAttempts++;
    this.scenes.forEach(scene=>{scene.output.dataset.graphicsRecovery='Восстанавливаем графику с сохранением состояния';scene.lastDraw=undefined;scene.drawCount=-1;scene.intervals=[];});
    console.warn('Rust graphics recovery:',problem);
    let replacement: Renderer | undefined;
    try {
      const {renderer,atlas}=await openRenderer(this.renderer.backend().includes('Gl'));replacement=renderer;
      if(this.disposed){renderer.dispose();return;}
      if(this.renderer.backend().includes('BrowserWebGpu') !== renderer.backend().includes('BrowserWebGpu')) throw new Error('GPU recovery cannot reuse a canvas with a different browser context');
      const state=this.renderer.snapshot();this.renderer.dispose();renderer.restore(state);this.renderer=renderer;this.atlas=atlas;replacement=undefined;
      renderer.palette(graphicsPalette.get());
      this.scenes.forEach(scene => { scene.direct = renderer.present_to(scene.id, scene.output); scene.output.dataset.graphicsPresentation = scene.direct ? 'direct-gpu' : 'atlas-canvas2d'; });
      const policy=this.controller.policy;this.renderer.quality(qualityDensity[policy.level],policy.cost,policy.smooth?policy.targetFps:60);
      for(const [id,shape] of this.deferredSizes){if(this.scenes.has(id))this.renderer.resize(id,shape.width,shape.height,shape.path,shape.background==='orbs');}this.deferredSizes.clear();
      this.scenes.forEach(scene=>{delete scene.output.dataset.graphicsError;delete scene.output.dataset.graphicsRecovery;});this.pending=true;this.controller.resetWindow();
    }catch(error){replacement?.dispose();this.scenes.forEach(scene=>{scene.active=false;scene.output.dataset.graphicsError=String(error);delete scene.output.dataset.graphicsRecovery;this.controller.activity(scene.token,false,false);});console.error('Rust graphics recovery failed:',error);}
    finally{this.recovering=false;}
  }
  private frame(at: number) {
    if(this.recovering||this.disposed)return;
    const active=[...this.scenes.values()].filter(scene=>scene.active); if(!active.length)return;
    const moving=active.some(scene=>this.renderer.moving(scene.id));if(!this.pending&&!moving&&!this.renderer.quality_pending())return;
    try {
      const reportQuality=this.qualityReportPending,changed=this.renderer.frame(at);this.pending=false;
      if(!changed&&!reportQuality)return;this.qualityReportPending=false;
      for(const scene of active){
        const [x,y,width,height]=this.renderer.rect(scene.id);if(!width||!height)continue;
        if(!scene.direct&&(scene.output.width!==width||scene.output.height!==height)){scene.output.width=width;scene.output.height=height;}
        const commits=this.renderer.commits(scene.id),updated=scene.drawCount!==commits;
        if(updated){if(scene.context){scene.context.clearRect(0,0,width,height);scene.context.drawImage(this.atlas,x,y,width,height,0,0,width,height);}scene.drawCount=commits;}
        const progress=this.renderer.reveal(scene.id);if(progress!==scene.lastReveal){scene.lastReveal=progress;scene.reveal?.(progress);}
        if(!scene.painted){scene.painted=true;scene.ready?.();}
        const running=this.renderer.moving(scene.id);this.controller.activity(scene.token,true,running);
        if(updated&&running&&scene.lastDraw!==undefined){scene.intervals.push(at-scene.lastDraw);if(scene.intervals.length>180)scene.intervals.shift();}if(updated)scene.lastDraw=at;
        if(at-scene.postedAt>=500||reportQuality){
          const [dx,dy,w,h,bw,bh,draws,blurUpdates,sourceUpdates,contourUpdates,,count,textures,textureBytes,sw,sh,vectorUploadBytes,filterAllocations,,transitioning]=this.renderer.metrics(scene.id);
          const intervals=[...scene.intervals].sort((a,b)=>a-b),samples=intervals.length;
          const metrics:GlassMetrics={level:this.controller.policy.level,density:Math.min(dx,dy),densityX:dx,densityY:dy,buffer:[w,h],source:scene.rain?[0,0]:[sw,sh],blur:scene.rain?[0,0]:[bw,bh],draws,blurUpdates,sourceUpdates,contourUpdates,idle:!running,backend:this.renderer.backend(),scenes:count,textures,textureBytes,budgetExceeded:w*h>384000,transitioning:!!transitioning,
            ...(running&&samples>=6?{cadence:{p95:intervals[Math.ceil(samples*.95)-1],fps:1000*samples/intervals.reduce((a,b)=>a+b,0),samples}}:{})};
          metrics.surface = scene.rain ? 'artwork' : 'glass';
          metrics.presentation = scene.direct ? 'direct-gpu' : 'atlas-canvas2d';
          metrics.vectorUploadBytes = vectorUploadBytes; metrics.filterAllocations = filterAllocations;
          metrics.requestedDensity = scene.rain ? qualityDensity[this.controller.policy.level] : glassRenderDensity;
          this.controller.report(scene.token,metrics);scene.postedAt=at;
          scene.output.dataset.graphicsDensity=metrics.density.toFixed(3);scene.output.dataset.graphicsBackend=metrics.backend;
          scene.output.dataset.graphicsDraws=String(draws);scene.output.dataset.graphicsTextures=String(textures);
        }
      }
    }catch(problem){if(String(problem).includes('Graphics surface')&&this.recoveryAttempts<2){void this.recover(problem);return;}this.scenes.forEach(scene=>{scene.active=false;this.controller.activity(scene.token,false,false);scene.output.dataset.graphicsError=String(problem);});console.error('Rust graphics surface:',problem);}
  }
}
