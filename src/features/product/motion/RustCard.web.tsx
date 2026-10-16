import { useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import type { PointerEvent } from 'react';
import { RustGlass } from './RustGlass.web';
import { RustVector } from './RustVector.web';
import type { ArtController, ArtProps } from './types';

export function RustCard(props:ArtProps){
  const glass=useRef<ArtController|null>(null),pressed=useRef(false),point=useRef({x:.5,y:.5});
  function contact(event:PointerEvent<HTMLDivElement>,down:boolean){
    const bounds=event.currentTarget.getBoundingClientRect();point.current={x:(event.clientX-bounds.left)/bounds.width,y:(event.clientY-bounds.top)/bounds.height};
    glass.current?.interact({type:'watcher-art-interaction',action:down?'glass-press':'glass-release',...point.current});
  }
  return <View style={[{height:props.height,width:props.width??'100%'},props.style]}>
    <View pointerEvents="none" style={StyleSheet.absoluteFill}><RustGlass {...props} kind="glass" controllerRef={glass} onPress={undefined}/></View>
    <div style={{position:'absolute',inset:0}} onPointerDownCapture={event=>{if(event.isPrimary){pressed.current=true;contact(event,true);}}}
      onPointerMoveCapture={event=>{if(pressed.current)contact(event,true);}} onPointerUpCapture={event=>{pressed.current=false;contact(event,false);}}
      onPointerCancel={event=>{pressed.current=false;contact(event,false);}}>
      <RustVector {...props} presentation="artwork" onRevealProgress={undefined} style={undefined}/>
    </div>
  </View>;
}
