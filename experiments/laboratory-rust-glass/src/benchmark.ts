import {summarize} from './metrics';

export const benchmarkProtocol = {
  id:'cold-engine-v5', warmupMs:15_000, measureMs:45_000, bucketMs:5_000, liveWindowMs:5_000,
  recreateEngineBeforeRun:true, startAt:'first RAF render of newly created engine',
  restartBeforeRun:true,
  frameMetric:'requestAnimationFrame intervals; not a count of physically presented frames',
  cpuMetric:'CPU preparation/submission only; excludes asynchronous GPU execution and SVG paint',
  windowBoundary:'Complete intervals assigned by their start; no clipping or removal of slow frames',
} as const;
export const runDurationMs = benchmarkProtocol.warmupMs + benchmarkProtocol.measureMs;

export type FrameWork = {sourceUpdated:boolean;sourceCpuMs:number;commandsCpuMs:number;sceneTimeMs:number};
export type FrameSample = FrameWork & {startMs:number;endMs:number;cpuMs:number};

/** Associate an interval with the work that preceded it, not the next frame's work. */
export class FrameSampler {
  private previous:({time:number;cpuMs:number}&FrameWork)|null=null;
  frame(time:number,work:FrameWork,cpuMs:number):FrameSample|null {
    const previous=this.previous;
    this.previous={time,cpuMs,...work};
    if(!previous||time<=previous.time)return null;
    return {startMs:previous.time,endMs:time,cpuMs:previous.cpuMs,
      sourceCpuMs:previous.sourceCpuMs,commandsCpuMs:previous.commandsCpuMs,
      sourceUpdated:previous.sourceUpdated,sceneTimeMs:previous.sceneTimeMs};
  }
  reset(){this.previous=null;}
}

export function frameStats(frames:FrameSample[],origin=0){
  const intervals=frames.map(f=>f.endMs-f.startMs);
  const seconds=intervals.reduce((sum,ms)=>sum+ms,0)/1000;
  const average=(key:'sourceCpuMs'|'commandsCpuMs')=>frames.length?frames.reduce((sum,f)=>sum+f[key],0)/frames.length:0;
  const sourceUpdates=frames.reduce((sum,f)=>sum+Number(f.sourceUpdated),0);
  return {...summarize(intervals,frames.map(f=>f.cpuMs)),seconds,sourceUpdates,
    sourceFps:seconds?sourceUpdates/seconds:0,sourceCpuMs:average('sourceCpuMs'),commandsCpuMs:average('commandsCpuMs'),
    actualFromMs:frames.length?frames[0].startMs-origin:null,actualToMs:frames.length?frames[frames.length-1].endMs-origin:null,
    sceneTimeFromMs:frames[0]?.sceneTimeMs??null,sceneTimeToMs:frames[frames.length-1]?.sceneTimeMs??null};
}

export function summarizeRun(frames:FrameSample[],startMs:number){
  const window=(from:number,to:number)=>frames.filter(f=>f.startMs>=startMs+from&&f.startMs<startMs+to);
  const timeline=Array.from({length:runDurationMs/benchmarkProtocol.bucketMs},(_,index)=>{
    const fromMs=index*benchmarkProtocol.bucketMs,toMs=fromMs+benchmarkProtocol.bucketMs;
    return {fromMs,toMs,phase:fromMs<benchmarkProtocol.warmupMs?'warmup':'measurement',...frameStats(window(fromMs,toMs),startMs)};
  });
  return {...frameStats(window(benchmarkProtocol.warmupMs,runDurationMs),startMs),timeline,
    warmup:frameStats(window(0,benchmarkProtocol.warmupMs),startMs)};
}
