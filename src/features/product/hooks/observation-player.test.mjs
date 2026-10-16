import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

test('a source-less web status never consumes the diary play request; a loaded decrypted source plays',async()=>{
  const status={isLoaded:true,playing:false,currentTime:0,duration:3,error:null,didJustFinish:false};
  const calls=[],refs=[],states=[];let cursor=0,focused=true;
  const player={play:()=>calls.push('play'),pause:()=>calls.push('pause'),seekTo:async()=>calls.push('seek')};
  const react={useRef(value){const id=cursor++;return refs[id]??={current:value};},
    useState(value){const id=cursor++;if(!(id in states))states[id]=value;return[states[id],next=>{states[id]=next;}];},
    useCallback:fn=>fn,useEffect:fn=>{fn();}};
  const exports={},code=ts.transpileModule(readFileSync(new URL('./useObservationPlayer.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  vm.runInNewContext(code,{exports,setTimeout:()=>0,clearTimeout(){},require:name=>{
    if(name==='react')return react;
    if(name==='react-native')return {AppState:{currentState:'active',addEventListener:()=>({remove(){}})}};
    if(name==='expo-router')return {useIsFocused:()=>focused};
    return {useAudioPlayer:()=>player,useAudioPlayerStatus:()=>status,setAudioModeAsync:async()=>calls.push('mode')};
  }});
  const render=uri=>{cursor=0;return exports.useObservationPlayer(uri);};
  const noSource=render(null);assert.equal(noSource.loaded,false);await noSource.play();assert.deepEqual(calls,[]);
  status.isLoaded=false;const loading=render('blob:test');assert.equal(loading.loaded,false);assert.equal(loading.loading,true);await loading.play();assert.deepEqual(calls,[]);
  status.isLoaded=true;const ready=render('blob:test');assert.equal(ready.loaded,true);await ready.play();assert.deepEqual(calls,['mode','play']);
  focused=false;await render('blob:test').play();assert.deepEqual(calls,['mode','play','pause']);
});
