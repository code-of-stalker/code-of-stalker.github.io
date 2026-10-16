import { Animated, Easing } from './RustAnimated';
import {useEffect,useState,type PropsWithChildren} from 'react';

import { panelExpansionCurve, panelExpansionDuration } from './panelExpansion';
export function Accordion({children,expanded,height,reducedMotion=false,overflowWhenOpen='hidden'}:PropsWithChildren<{expanded:boolean;height:number;reducedMotion?:boolean;overflowWhenOpen?:'visible'|'hidden'}>) {
  const [present,setPresent]=useState(expanded),[amount]=useState(()=>new Animated.Value(expanded?height:0)),[previous,setPrevious]=useState(expanded),[settled,setSettled]=useState(expanded);
  if(previous!==expanded){setPrevious(expanded);setSettled(false);}
  if(expanded&&!present)setPresent(true);
  useEffect(()=>{const motion=Animated.timing(amount,{toValue:expanded?height:0,duration:reducedMotion?0:panelExpansionDuration,easing:Easing.bezier(...panelExpansionCurve),useNativeDriver:false});
    motion.start(({finished})=>{if(finished){setSettled(true);if(!expanded)setPresent(false);}});return()=>motion.stop();},[amount,expanded,height,reducedMotion]);
  return <Animated.View pointerEvents={expanded?'auto':'none'} accessibilityElementsHidden={!expanded} importantForAccessibility={expanded?'auto':'no-hide-descendants'} style={{height:amount,overflow:expanded&&settled?overflowWhenOpen:'hidden'}}>{present&&children}</Animated.View>;
}
