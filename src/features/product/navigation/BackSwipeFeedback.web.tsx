import { useEffect, useRef } from 'react';
import { useThemeColors } from '../ProductTheme';
import { useEffectsController } from '../motion/EffectsQuality';
import { loadGraphics, type ElementTimeline } from '../motion/rustEngine.web';
import { useSystemReducedMotion } from '../motion/useSystemReducedMotion.web';
import type { BackSwipeFeedbackProps } from './BackSwipeFeedback.types';

/** Touch events publish targets; the existing Rust clock draws their motion. */
export function BackSwipeFeedback({ children, feedbackRef, reducedMotion }: BackSwipeFeedbackProps) {
  const colors = useThemeColors(), controller = useEffectsController(), systemReduced = useSystemReducedMotion();
  const page = useRef<HTMLDivElement>(null), cue = useRef<HTMLDivElement>(null), label = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!page.current || !cue.current || !controller) return;
    const surface = page.current, indicator = cue.current, reduced = reducedMotion || systemReduced;
    let disposed = false, detach = () => {}, unregister = () => {}, stage: 'idle' | 'drag' | 'commit' | 'return' = 'idle';
    let body: ElementTimeline | undefined, hint: ElementTimeline | undefined, action: (() => void) | undefined;
    const curve = Float64Array.from([.22,.8,.2,1]), values = (opacity: number, x: number, scale=1) => Float64Array.from([opacity,x,0,scale,0,100]);
    const target = (node: ElementTimeline | undefined, opacity: number, x: number, duration: number, scale=1) => node?.target(values(opacity,x,scale), reduced ? 0 : duration,0,curve);
    const settle = () => { stage='return'; target(body,1,0,280); target(hint,0,-12,180); };
    feedbackRef.current = {
      move(distance, progress, y) {
        if (stage==='commit' || !body || !hint) return;
        stage='drag'; surface.dataset.backSwipe='dragging'; surface.dataset.backSwipeProgress=String(progress);
        indicator.style.top=`${Math.max(64,Math.min(innerHeight-100,y-26))}px`;
        if (label.current) label.current.textContent=progress>=1?'ОТПУСТИ':'НАЗАД';
        target(body,1,reduced?0:Math.min(104,distance*.38),70,reduced?1:1-Math.min(.008,progress*.008));
        target(hint,Math.min(1,progress*2),Math.min(12,distance*.04),90);
      },
      finish(commit, callback) {
        if (stage==='commit') { if(!commit){action=undefined;settle();}return; }
        if (!commit) { if(stage==='drag') settle(); return; }
        if (!body || !hint) { callback?.(); return; }
        action=callback;stage='commit';surface.dataset.backSwipe='committing';
        target(body,reduced?1:.28,reduced?0:132,170,reduced?1:.992);target(hint,0,24,150);
      },
    };
    void loadGraphics().then(module=>{
      if(disposed)return;
      body=module.ElementTimeline.create(surface);body.initial(values(1,0));
      hint=module.ElementTimeline.create(indicator);hint.initial(values(0,-12));
      const token={};unregister=controller.register(token,'Свайп назад · Rust',message=>{if((message as {type:string}).type==='watcher-clock-reset'){body?.reset_clock();hint?.reset_clock();}});
      detach=controller.frameJob(at=>{
        if(!body||!hint)return;
        body.active(!document.hidden);hint.active(!document.hidden);body.frame(at);hint.frame(at);
        const moving=body.moving()||hint.moving();controller.activity(token,!document.hidden,moving||stage==='drag');
        if(!moving&&stage==='commit'){
          const commit=action;action=undefined;stage='return';
          body.initial(values(reduced?1:.3,reduced?0:-14));target(body,1,0,240);
          commit?.();
        } else if(!moving&&stage==='return') {stage='idle';surface.dataset.backSwipe='idle';surface.dataset.backSwipeProgress='0';}
      });
    }).catch(()=>{feedbackRef.current={move(){},finish(commit,callback){if(commit)callback?.();}};});
    return()=>{disposed=true;feedbackRef.current=null;detach();unregister();body?.dispose();hint?.dispose();};
  },[controller,feedbackRef,reducedMotion,systemReduced]);
  return <div style={{flex:1,minHeight:0,display:'flex',position:'relative',overflow:'hidden',background:colors.background,touchAction:'pan-y pinch-zoom'}}>
    <div ref={page} data-back-swipe="idle" style={{flex:1,minWidth:0,minHeight:0,display:'flex',flexDirection:'column',transformOrigin:'right center',background:colors.background}}>{children}</div>
    <div ref={cue} aria-hidden data-back-swipe-cue style={{position:'absolute',left:12,top:100,opacity:0,pointerEvents:'none',zIndex:10000,color:colors.accent,display:'flex',flexDirection:'column',alignItems:'center',gap:7}}>
      <svg width="42" height="42" viewBox="0 0 42 42"><path d="M.25 .25H31.75L41.75 10.25V41.75H10.25L.25 31.75Z" fill={colors.background} stroke="currentColor" strokeWidth=".25"/><path d="M27 21H15m0 0 5-5m-5 5 5 5" fill="none" stroke="currentColor" strokeWidth=".75"/></svg>
      <span ref={label} style={{fontFamily:'DisketMono',fontSize:9,letterSpacing:.8}}>НАЗАД</span>
    </div>
  </div>;
}
