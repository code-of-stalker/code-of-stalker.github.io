import type {CSSProperties} from 'react';
import {useThemeColors} from '../ProductTheme';
export function ScanLight({path,clipPath}:{path?:string;clipPath?:string}){
  const {accent}=useThemeColors();
  const rgb=[1,3,5].map(i=>parseInt(accent.slice(i,i+2),16)).join(',');
  return <div aria-hidden data-panel-scan-light style={{position:'absolute',inset:0,zIndex:101,pointerEvents:'none',backgroundImage:'none',
    clipPath:clipPath??(path?`path('${path}')`:undefined),'--panel-scan-rgb':rgb} as CSSProperties}/>;
}
