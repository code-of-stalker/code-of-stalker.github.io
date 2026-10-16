import type {PropsWithChildren} from 'react';
import { StyleSheet,View, type StyleProp, type ViewStyle } from 'react-native';
import { RustMotion } from './RustMotion.web';
import {ScanLight} from './ScanLight';
import material from '../../../../assets/product/motion/laboratory-glass.json';
import { PanelScanContext, useSharedPanelScan } from './PanelScanContext';
export function PanelScan({children,delay=0,reducedMotion=false,style,clipPath,testID}:PropsWithChildren<{delay?:number;reducedMotion?:boolean;style?:StyleProp<ViewStyle>;clipPath?:string;testID?:string}>) {
  const shared = useSharedPanelScan();
  if (shared) return <View testID={testID} style={style}>{children}</View>;
  const layout = StyleSheet.flatten(style) ?? {};
  return <View testID={testID} style={[{position:'relative'},style,{gap:0}]}>
    <RustMotion scanDuration={reducedMotion?undefined:material.scanDuration*1000} delay={reducedMotion?0:delay}
      style={{position:'relative',display:'flex',flexDirection:'column',width:'100%',minHeight:0,flexGrow:1,flexShrink:1,gap:layout.gap} as React.CSSProperties}>
      <PanelScanContext.Provider value>{children}</PanelScanContext.Provider>
    </RustMotion>
    <ScanLight clipPath={clipPath}/>
  </View>;
}
