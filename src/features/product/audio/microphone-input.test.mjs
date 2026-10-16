import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import ts from 'typescript';
const api={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL('./microphone-input.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports:api,Error,Set});
const input=(id,label)=>({kind:'audioinput',deviceId:id,label}),phone=input('phone','Built-in microphone'),usb=input('usb','USB OTG Receiver');
function stream(id){const track={label:id,getSettings:()=>({deviceId:id}),stops:0,stop(){this.stops++;}};return {track,getTracks:()=>[track],getAudioTracks:()=>[track]};}
function port(devices=[phone,usb]){const calls=[],streams=[];return {calls,streams,enumerateDevices:async()=>devices,getUserMedia:async constraints=>{calls.push(constraints);const s=stream(constraints.audio.deviceId?.exact??'phone');streams.push(s);return s;}};}
test('automatic capture immediately uses the browser route without enumeration or source switching',async()=>{
const p=port(),opened=await api.openMicrophone(p);assert.equal(opened.deviceId,'phone');assert.equal(p.calls.length,1);
assert.equal(p.calls[0].audio,true);
});
test('a manual input takes precedence over USB automatic preference',async()=>{const p=port();assert.equal((await api.openMicrophone(p,'phone')).deviceId,'phone');});
test('slow or hung enumeration cannot block capture and a revealed USB input never tears it down',async()=>{
const p=port();p.enumerateDevices=()=>{throw new Error('enumeration must stay out of capture');};const opened=await api.openMicrophone(p);
assert.equal(opened.deviceId,'phone');assert.equal(p.calls.length,1);assert.equal(p.streams[0].track.stops,0);
});
test('fallback preserves an explicitly chosen input',async()=>{
const p=port(),get=p.getUserMedia;p.getUserMedia=async c=>{if(!p.calls.length){p.calls.push(c);throw Object.assign(new Error(),{name:'OverconstrainedError'});}return get(c);};
await api.openMicrophone(p,'usb');assert.equal(p.calls.length,2);assert.equal(p.calls[1].audio.deviceId.exact,'usb');assert.equal(p.calls[1].audio.echoCancellation,undefined);
});
test('permission denial is not retried as a different source',async()=>{const p=port();p.getUserMedia=async c=>{p.calls.push(c);throw Object.assign(new Error(),{name:'NotAllowedError'});};await assert.rejects(api.openMicrophone(p));assert.equal(p.calls.length,1);});
test('a disconnected explicit microphone is not replaced by the phone',async()=>{const p=port([phone]);p.getUserMedia=async c=>{p.calls.push(c);throw Object.assign(new Error(),{name:'NotFoundError'});};await assert.rejects(api.openMicrophone(p,'usb'));assert.equal(p.calls.length,1);assert.equal(p.calls[0].audio.deviceId.exact,'usb');});
test('a browser returning a different device releases it and reports the mismatch',async()=>{const p=port(),wrong=stream('phone');p.getUserMedia=async()=>wrong;await assert.rejects(api.openMicrophone(p,'usb'),/не переключился/);assert.equal(wrong.track.stops,1);});
test('cancellation after a late grant stops the stream and never switches devices',async()=>{const p=port();let active=true;p.getUserMedia=async()=>{active=false;const s=stream('phone');p.streams.push(s);return s;};await assert.rejects(api.openMicrophone(p,'',()=>active),/отменена/);assert.equal(p.streams.length,1);assert.equal(p.streams[0].track.stops,1);});
test('manual capture keeps USB raw audio without forcing its native format',async()=>{const p=port();await api.openMicrophone(p,'usb');const audio=p.calls[0].audio;assert.equal(audio.deviceId.exact,'usb');assert.equal(audio.echoCancellation,false);assert.equal(audio.noiseSuppression,false);assert.equal(audio.autoGainControl,false);assert.equal(audio.channelCount,undefined);assert.equal(audio.sampleRate,undefined);});
test('capture is still available when enumeration is unsupported',async()=>{const p=port();p.enumerateDevices=undefined;assert.equal((await api.openMicrophone(p)).deviceId,'phone');});
test('a stream with no audio tracks is stopped instead of recording an empty input',async()=>{const p=port(),s=stream('usb');s.getAudioTracks=()=>[];p.getUserMedia=async()=>s;await assert.rejects(api.openMicrophone(p),/звуковой поток/);assert.equal(s.track.stops,1);});
test('the list excludes speakers, pseudo IDs and inaccessible IDs',async()=>{const p=port([phone,usb,input('default','Default'),input('communications','Communication'),input('',''),{kind:'audiooutput',deviceId:'speaker',label:'Speaker'}]);assert.deepEqual(JSON.parse(JSON.stringify(await api.listMicrophoneInputs(p))).map(x=>x.deviceId),['phone','usb']);});
test('missing sound gets a grace period and a warning; speech clears it',()=>{const s=api.createMicrophoneSignalMonitor();for(let i=0;i<20;i++)s.sample(0);assert.equal(s.warning(1000),'');assert.ok(s.warning(4000));assert.equal(s.silent(),true);s.sample(.0001);assert.equal(s.warning(10000),'');assert.equal(s.silent(),false);for(let i=0;i<20;i++)s.sample(0);assert.equal(s.warning(20000),'');});
test('an unavailable analyser or invalid samples cannot produce a false silence warning',()=>{const s=api.createMicrophoneSignalMonitor();s.sample(NaN);assert.equal(s.warning(20000),'');assert.equal(s.silent(),false);});
