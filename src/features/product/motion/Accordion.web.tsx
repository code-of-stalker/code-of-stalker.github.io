import { useState,type PropsWithChildren } from 'react';
import { RustMotion } from './RustMotion.web';
import { panelExpansionCurve, panelExpansionDuration } from './panelExpansion';
export function Accordion({children,expanded,height,reducedMotion=false,overflowWhenOpen='hidden'}:PropsWithChildren<{expanded:boolean;height:number;reducedMotion?:boolean;overflowWhenOpen?:'visible'|'hidden'}>) {
  const [present,setPresent]=useState(expanded),[previous,setPrevious]=useState(expanded),[settled,setSettled]=useState(expanded);
  if(previous!==expanded){setPrevious(expanded);setSettled(false);}
  if(expanded&&!present)setPresent(true);
  return <RustMotion height={expanded?height:0} initialHeight={expanded?height:0} target={[expanded?1:0,0,expanded?0:-8,1,0,100]}
    duration={reducedMotion?0:panelExpansionDuration} curve={panelExpansionCurve} onComplete={()=>{setSettled(true);if(!expanded)setPresent(false);}}
    style={{position:'relative',overflow:expanded&&settled?overflowWhenOpen:'hidden',pointerEvents:expanded?'auto':'none'}} aria-hidden={!expanded}>
    {present&&children}
  </RustMotion>;
}
