import { useEffect, useRef, useState } from 'react';
import { useIsFocused } from 'expo-router';
import { View } from 'react-native';
import { useEffectsController } from './EffectsQuality';
import { rustSession } from './rustEngine.web';
import type { RustSession } from './rustEngine.web';
import type { ArtProps } from './types';
import { ArtUnavailable } from './ArtUnavailable';
import { observeMotionVisibility } from './motion-visibility.web';

export function RustGlass(props: ArtProps) {
  const controller=useEffectsController(),focused=useIsFocused(),canvas=useRef<HTMLCanvasElement>(null);
  const [failed,setFailed]=useState<string>(),[visible,setVisible]=useState(true);
  const latest=useRef(props),activity=useRef({active:true,reduced:false}),handle=useRef<ReturnType<RustSession['add']>|null>(null);
  const point=useRef({x:.5,y:.5});
  const wasFocused=useRef(focused);
  useEffect(()=>{
    if(focused&&!wasFocused.current&&props.scanOnMount!==false)handle.current?.replayScan();
    wasFocused.current=focused;
  },[focused,props.scanOnMount]);
  useEffect(()=>{latest.current=props;activity.current={active:(props.active??true)&&visible&&focused,reduced:props.reducedMotion??false};handle.current?.active(activity.current.active,activity.current.reduced);},[props,visible,focused]);
  useEffect(()=>{
    if(failed||!controller||!canvas.current)return;
    let cancelled=false;const output=canvas.current;
    void rustSession(controller).then(session=>{
      if(cancelled)return;
      const current=latest.current,node=session.add(output,current.scanOnMount!==false,value=>latest.current.onRevealProgress?.(value),()=>latest.current.onReady?.(),current.kind==='rain',current.kind==='attention',undefined,current.kind==='gallery'||current.kind==='mirror'?current.kind:undefined);
      handle.current=node;if(current.glass)node.resize(current.glass);else if(current.kind!=='glass'){const {width,height}=output.getBoundingClientRect();if(width>0&&height>0)node.resize({width,height,path:`M0 0H${width}V${height}H0Z`,background:'clear'});}node.active(activity.current.active,activity.current.reduced);
      if(current.controllerRef)current.controllerRef.current={interact:value=>{if(value.action==='benchmark'){node.benchmark(value.at??0);return;}if(value.action.startsWith('glass-')){point.current={x:value.x??point.current.x,y:value.y??point.current.y};node.pointer(point.current.x,point.current.y,value.action!=='glass-release');}}};
    }).catch(problem=>{if(!cancelled){console.error('Rust effect creation:',latest.current.kind,problem);output.dataset.graphicsError=String(problem);setFailed(String(problem));}});
    return()=>{cancelled=true;handle.current?.release();handle.current=null;if(latest.current.controllerRef)latest.current.controllerRef.current=null;};
  },[controller,failed]);
  useEffect(()=>{if(props.glass)handle.current?.resize(props.glass);},[props.glass]);
  useEffect(()=>{if(props.kind==='glass'||!canvas.current)return;const element=canvas.current;const resize=()=>{const {width,height}=element.getBoundingClientRect();if(width>0&&height>0)handle.current?.resize({width,height,path:`M0 0H${width}V${height}H0Z`,background:'clear'});};const observer=new ResizeObserver(resize);observer.observe(element);resize();return()=>observer.disconnect();},[props.kind,props.width,props.height]);
  useEffect(()=>{if(!canvas.current)return;return observeMotionVisibility(canvas.current,setVisible);},[]);
  if(failed||!controller)return <ArtUnavailable {...props}/>;
  return <View style={[{height:props.height,width:props.width??'100%'},props.style]}><canvas ref={canvas} aria-hidden="true" data-graphics="rust" style={{width:'100%',height:'100%',display:'block',pointerEvents:'none'}}/></View>;
}
