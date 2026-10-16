import {MatrixRainRenderer} from '../reference/src/backgrounds/MatrixRainRenderer';
import {defaultMatrixRainSettings} from '../reference/src/backgrounds/matrixRainSettings';
import {background} from './parameters';

export type SceneKind = 'static' | 'rain' | 'rain-observer';
export const sceneLabels:Record<SceneKind,string> = {
  static:'Только стекло', rain:'Стекло + дождь', 'rain-observer':'Стекло + дождь + Наблюдающий',
};
export const workloadVersion = 'rain-observer-v5-full-rust';
export const observerCycleSeconds = 11.2;

export class SceneClock {
  private previous:number|null = null;
  private elapsed = 0;
  private fixed:number|null=null;
  frame(now:number,moving:boolean) {
    if(this.fixed!==null)return this.elapsed=this.fixed;
    if (!moving) { this.suspend(); return this.elapsed; }
    // A slow frame must not slow the glass timeline relative to the browser SVG.
    // Background/pause time is excluded explicitly through suspend().
    if (this.previous!==null) this.elapsed+=Math.max(0,now-this.previous);
    this.previous=now;
    return this.elapsed;
  }
  suspend() { this.previous=null; }
  restart() { this.previous=null;this.elapsed=0; }
  seek(seconds:number|null){this.fixed=seconds===null?null:seconds*1000;this.elapsed=this.fixed??0;this.previous=null;}
}

/** Canvas reference for Current and Rust-glass; full Rust never constructs it. */
export class WorkloadSource {
  readonly canvas:HTMLCanvasElement;
  private rain:MatrixRainRenderer|null;
  private clock = new SceneClock();
  private width=1;
  private height=1;
  private ratio=2;
  private reduced=false;
  private pending=true;
  timeMilliseconds=0;
  constructor(readonly kind:SceneKind) {
    this.rain=kind==='static'?null:new MatrixRainRenderer({...defaultMatrixRainSettings});
    this.canvas=this.rain?.canvas??background();
  }
  configure(width:number,height:number,ratio:number,reduced:boolean) {
    this.width=width;this.height=height;this.ratio=Math.min(2,ratio);this.reduced=reduced;
    // The source must have its final dimensions before either engine configures its uniforms.
    this.rain?.update({...defaultMatrixRainSettings});
    this.clock.suspend();
    this.rain?.draw(this.timeMilliseconds/1000,width,height,this.ratio,reduced);
    this.pending=true;
  }
  draw(now:number) {
    const time=this.clock.frame(now,!this.reduced);
    this.timeMilliseconds=time;
    const painted=this.rain?.draw(time/1000,this.width,this.height,this.ratio,this.reduced)??false;
    const changed=this.pending||painted;this.pending=false;return changed;
  }
  restart() { this.clock.restart();this.timeMilliseconds=0;this.rain?.restart();this.pending=true; }
  suspend() { this.clock.suspend(); }
  seek(seconds:number|null){this.restart();this.clock.seek(seconds);this.rain?.seek(seconds??0);this.pending=true;}
  describe() {
    return {version:workloadVersion,scene:this.kind,timeBase:'active-wall-time; no slow-frame delta cap',
      background:this.rain?{kind:'matrix-rain',maxFps:30,settings:{...defaultMatrixRainSettings}}:{kind:'static-grid'},
      animation:this.kind==='rain-observer'?{id:'laboratory-attention-awareness',cycleSeconds:observerCycleSeconds}:null,
      source:{width:this.canvas.width,height:this.canvas.height},reducedMotion:this.reduced};
  }
  dispose() { this.rain?.dispose(); }
}
