import { Animated, Easing } from './RustAnimated';
import {useEffect,useState,type PropsWithChildren} from 'react';

import { panelExpansionCurve, panelExpansionDuration } from './panelExpansion';
export function HeightMotion({children,height,reducedMotion=false}:PropsWithChildren<{height:number;reducedMotion?:boolean}>){
  const [amount]=useState(()=>new Animated.Value(height));
  useEffect(()=>{const motion=Animated.timing(amount,{toValue:height,duration:reducedMotion?0:panelExpansionDuration,easing:Easing.bezier(...panelExpansionCurve),useNativeDriver:false});motion.start();return()=>motion.stop();},[amount,height,reducedMotion]);
  return <Animated.View style={{height:amount}}>{children}</Animated.View>;
}
