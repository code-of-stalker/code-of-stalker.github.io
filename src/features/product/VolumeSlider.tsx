import {useRef} from 'react';
import {Pressable,View} from 'react-native';
import {useThemeColors} from './ProductTheme';
export function VolumeSlider({value,onChange,disabled=false}:{value:number;onChange(value:number):void;disabled?:boolean}){
  const colors=useThemeColors(),root=useRef<View>(null);
  const change=(pageX:number)=>{if(disabled)return;root.current?.measureInWindow((left,_top,width)=>{if(width>0)onChange(Math.max(0,Math.min(1,(pageX-left)/width)));});};
  return <View ref={root} style={{flex:1}}><Pressable accessibilityRole="adjustable" accessibilityLabel="Громкость записи" accessibilityValue={{min:0,max:100,now:Math.round(value*100)}}
    accessibilityActions={[{name:'increment'},{name:'decrement'}]} onAccessibilityAction={e=>onChange(Math.max(0,Math.min(1,value+(e.nativeEvent.actionName==='increment'?.1:-.1))))}
    disabled={disabled} onPress={e=>change(e.nativeEvent.pageX)} onTouchMove={e=>change(e.nativeEvent.pageX)} style={{height:44,justifyContent:'center'}}>
    <View style={{height:2,backgroundColor:colors.accent}}/><View style={{position:'absolute',left:`${value*100}%`,marginLeft:-3.5,width:7,height:16,backgroundColor:colors.accent}}/>
  </Pressable></View>;
}
