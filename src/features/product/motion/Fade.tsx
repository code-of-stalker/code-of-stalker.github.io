import { Animated, Easing } from './RustAnimated';
import { useEffect, useState, type PropsWithChildren } from 'react';
import { type StyleProp, type ViewStyle } from 'react-native';
export function Fade({ children, opacity, duration=280, reducedMotion=false, style }: PropsWithChildren<{
  opacity:number; duration?:number; reducedMotion?:boolean; style?:StyleProp<ViewStyle>;
}>) {
  const [value]=useState(()=>new Animated.Value(opacity));
  useEffect(()=>{const animation=Animated.timing(value,{toValue:opacity,duration:reducedMotion?0:duration,easing:Easing.bezier(.22,.8,.2,1),useNativeDriver:true});
    animation.start();return()=>animation.stop();},[value,opacity,duration,reducedMotion]);
  return <Animated.View style={[style,{opacity:value}]}>{children}</Animated.View>;
}
