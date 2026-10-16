import { Animated } from './RustAnimated';
import { useEffect,useState,type PropsWithChildren } from 'react';
import { type StyleProp, type ViewStyle, View } from 'react-native';
import { NativePanelReveal } from './PanelReveal';
import material from '../../../../assets/product/motion/laboratory-glass.json';
import { PanelScanContext, useSharedPanelScan } from './PanelScanContext';
export function PanelScan({children,delay=0,reducedMotion=false,style,testID}:PropsWithChildren<{delay?:number;reducedMotion?:boolean;style?:StyleProp<ViewStyle>;clipPath?:string;testID?:string}>) {
  const shared = useSharedPanelScan();
  const [progress]=useState(()=>new Animated.Value(reducedMotion?1:0)),[height,setHeight]=useState(1);
  useEffect(()=>{if(shared)return;const motion=Animated.timing(progress,{toValue:1,duration:reducedMotion?0:material.scanDuration*1000,delay:reducedMotion?0:delay,useNativeDriver:true});motion.start();return()=>motion.stop();},[progress,delay,reducedMotion,shared]);
  if (shared) return <View testID={testID} style={style}>{children}</View>;
  return <View testID={testID} onLayout={e=>setHeight(e.nativeEvent.layout.height)} style={[{position:'relative'},style]}>
    <PanelScanContext.Provider value>{children}</PanelScanContext.Provider><NativePanelReveal progress={progress} height={height}/>
  </View>;
}
