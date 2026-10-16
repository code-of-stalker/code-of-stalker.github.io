import { Animated, Easing } from '../motion/RustAnimated';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { useThemeColors } from '../ProductTheme';
import type { BackSwipeFeedbackProps } from './BackSwipeFeedback.types';
export function BackSwipeFeedback({children,feedbackRef,reducedMotion}:BackSwipeFeedbackProps){
  const colors=useThemeColors(),[offset]=useState(()=>new Animated.Value(0)),[opacity]=useState(()=>new Animated.Value(0));
  useEffect(()=>{
    const reset=()=>Animated.parallel([Animated.timing(offset,{toValue:0,duration:reducedMotion?0:260,easing:Easing.out(Easing.cubic),useNativeDriver:true}),Animated.timing(opacity,{toValue:0,duration:180,useNativeDriver:true})]).start();
    feedbackRef.current={move(distance,progress){offset.setValue(reducedMotion?0:Math.min(104,distance*.38));opacity.setValue(Math.min(1,progress*2));},finish(commit,action){if(commit)action?.();reset();}};
    return()=>{feedbackRef.current=null;offset.stopAnimation();opacity.stopAnimation();};
  },[feedbackRef,offset,opacity,reducedMotion]);
  return <View style={{flex:1,overflow:'hidden',backgroundColor:colors.background}}><Animated.View style={{flex:1,transform:[{translateX:offset}]}}>{children}</Animated.View><Animated.View pointerEvents="none" style={{position:'absolute',top:'42%',left:12,opacity}}><Text style={{color:colors.accent,fontSize:30}}>‹</Text><Text style={{color:colors.accent,fontSize:9}}>НАЗАД</Text></Animated.View></View>;
}
