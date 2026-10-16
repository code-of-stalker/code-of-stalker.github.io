export type ObserverSample = {node:object|null;transform:string;playState:string};
export type ObserverPlayback = {
  status:'waiting'|'moving'|'restarted'|'stalled'|'paused'|'unavailable';
  samples:number;transformChanges:number;nodeReplacements:number;observedMs:number;
};

/** Sample the visible camera transform, not just a requested `playing` prop.
 * Called with the metrics publication (at most once per 700ms), never per frame. */
export function readObserverSample(root:ParentNode|null,reducedMotion=false):ObserverSample {
  const node=root?.querySelector('.maw-camera')??null;
  const style=node?getComputedStyle(node):null;
  return {node,transform:style?.transform??'',playState:reducedMotion?'paused':style?.animationPlayState??''};
}

export class ObserverPlaybackProbe {
  private previous:ObserverSample|null=null;
  private firstTime:number|null=null;
  private latestTime=0;
  private samples=0;
  private transformChanges=0;
  private nodeReplacements=0;

  observe(sample:ObserverSample,time:number):ObserverPlayback {
    this.firstTime??=time;this.latestTime=time;this.samples++;
    if(this.previous?.node&&sample.node){
      if(this.previous.node!==sample.node)this.nodeReplacements++;
      else if(sample.transform&&sample.transform!=='none'&&sample.transform!==this.previous.transform)this.transformChanges++;
    }
    this.previous=sample;
    return this.snapshot();
  }

  snapshot():ObserverPlayback {
    const observedMs=this.firstTime===null?0:Math.max(0,this.latestTime-this.firstTime);
    const status:ObserverPlayback['status']=!this.previous?'waiting':!this.previous.node?'unavailable':
      this.previous.playState==='paused'?'paused':this.nodeReplacements>0?'restarted':
      this.transformChanges>=2?'moving':observedMs>=14000?'stalled':'waiting';
    return {status,samples:this.samples,transformChanges:this.transformChanges,nodeReplacements:this.nodeReplacements,observedMs};
  }
}

export const observerPlaybackLabels:Record<ObserverPlayback['status'],string>={
  waiting:'ожидаем движение',moving:'движение подтверждено',restarted:'сбрасывается — замер неполный',
  stalled:'не движется — замер неполный',paused:'пауза',unavailable:'анимация не найдена',
};
