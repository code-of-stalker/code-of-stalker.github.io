import {useCallback,useEffect,useRef,useState} from 'react';
import {AppState} from 'react-native';
import {useIsFocused} from 'expo-router';
import {useWebUpdateBlock} from '../updates/webUpdateSafety';

type Playback={playing:boolean;loaded:boolean;durationMs:number;positionMs:number;error:string};
const empty:Playback={playing:false,loaded:false,durationMs:0,positionMs:0,error:''};
type Output={audio:HTMLAudioElement;context:AudioContext|null;gain:GainNode|null};

/** Own the media and gain graph explicitly. Gain works in iPad Safari where
 * HTMLMediaElement.volume (and Expo's web setter) cannot change loudness. */
export function useObservationPlayer(uri:string|null){
  const focused=useIsFocused(),[status,setStatus]=useState<Playback&{uri?:string|null}>(empty),[volume,setVolumeState]=useState(1),[muted,setMutedState]=useState(false);
  const output=useRef<Output|null>(null),settings=useRef({volume:1,muted:false});
  const pause=useCallback(()=>{output.current?.audio.pause();},[]);
  useEffect(()=>{
    if(!uri)return;
    const audio=new Audio(uri),node:Output={audio,context:null,gain:null};output.current=node;
    audio.preload='auto';audio.muted=settings.current.muted;
    let disposed=false,interval:ReturnType<typeof setInterval>|undefined;
    const read=()=>{
      if(disposed)return;
      setStatus({uri,playing:!audio.paused&&!audio.ended,loaded:audio.readyState>=2,durationMs:Number.isFinite(audio.duration)?Math.round(audio.duration*1000):0,
        positionMs:Math.round(audio.currentTime*1000),error:audio.error?'Не удалось открыть аудиофайл.':''});
    };
    const cadence=()=>{if(interval)clearInterval(interval);interval=audio.paused?undefined:setInterval(read,200);read();};
    const events=['loadedmetadata','canplay','durationchange','timeupdate','seeked','error'] as const;
    events.forEach(event=>audio.addEventListener(event,read));['playing','pause','ended'].forEach(event=>audio.addEventListener(event,cadence));
    const timeout=setTimeout(()=>{if(audio.readyState<2&&!disposed)setStatus({...empty,uri,error:'Аудиофайл не открылся. Попробуй снова.'});},8000);
    const subscription=AppState.addEventListener('change',state=>{if(state!=='active')audio.pause();});
    audio.load();
    return()=>{disposed=true;clearTimeout(timeout);if(interval)clearInterval(interval);subscription.remove();
      events.forEach(event=>audio.removeEventListener(event,read));['playing','pause','ended'].forEach(event=>audio.removeEventListener(event,cadence));
      audio.pause();audio.removeAttribute('src');audio.load();node.gain?.disconnect();if(node.context)void node.context.close().catch(()=>{});
      if(output.current===node)output.current=null;
    };
  },[uri]);
  useEffect(()=>{if(!focused)pause();},[focused,pause]);
  const applyGain=useCallback(()=>{const node=output.current;if(node?.gain&&node.context){
    node.gain.gain.setTargetAtTime(settings.current.muted?0:settings.current.volume,node.context.currentTime,.015);
  }else if(node)node.audio.volume=settings.current.volume;},[]);
  const setVolume=useCallback((value:number)=>{if(!Number.isFinite(value))return;const next=Math.max(0,Math.min(1,value));
    settings.current.volume=next;setVolumeState(next);applyGain();},[applyGain]);
  const setMuted=useCallback((value:boolean)=>{settings.current.muted=value;setMutedState(value);if(output.current)output.current.audio.muted=value;applyGain();},[applyGain]);
  const play=useCallback(async()=>{
    const node=output.current;if(!focused||!node||node.audio.readyState<2)return;
    try{
      // Creation/resume runs in the play gesture; no microphone feedback path.
      const Context=window.AudioContext??(window as typeof window&{webkitAudioContext?:typeof AudioContext}).webkitAudioContext;
      if(!node.context&&Context){const context=new Context(),gain=context.createGain();
        context.createMediaElementSource(node.audio).connect(gain);gain.connect(context.destination);
        gain.gain.value=settings.current.muted?0:settings.current.volume;node.context=context;node.gain=gain;
        node.audio.volume=1;
      }
      if(node.context)await node.context.resume();else node.audio.volume=settings.current.volume;
      if(output.current!==node||AppState.currentState!=='active')return;
      if(node.audio.ended||node.audio.currentTime>=node.audio.duration-.1)node.audio.currentTime=0;
      await node.audio.play();
    }catch{if(output.current===node)setStatus(previous=>({...previous,error:'Не удалось воспроизвести запись.'}));}
  },[focused]);
  const toggle=useCallback(async()=>{if(output.current&&!output.current.audio.paused)pause();else await play();},[pause,play]);
  const seekTo=useCallback(async(seconds:number)=>{const node=output.current;if(node&&Number.isFinite(seconds)&&seconds>=0)
    node.audio.currentTime=Math.min(Number.isFinite(node.audio.duration)?node.audio.duration:seconds,seconds);},[]);
  const current=status.uri===uri?status:empty;
  useWebUpdateBlock(current.playing);
  return {...current,loaded:!!uri&&current.loaded,loading:!!uri&&!current.loaded,volume,setVolume,muted,setMuted,play,pause,toggle,seekTo};
}
