import {useState,type PropsWithChildren} from 'react';
import {RustMotion} from './RustMotion.web';
import { panelExpansionCurve, panelExpansionDuration } from './panelExpansion';
export function HeightMotion({children,height,reducedMotion=false}:PropsWithChildren<{height:number;reducedMotion?:boolean}>){
  const [initial]=useState(height);
  return <RustMotion height={height} initialHeight={initial} duration={reducedMotion?0:panelExpansionDuration} curve={panelExpansionCurve} style={{display:'flex',flexDirection:'column'}}>{children}</RustMotion>;
}
