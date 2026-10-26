// Platform bridge only. All geometry, movement, palette and GPU painting is Rust.
const output=document.querySelector('#output'),root=document.querySelector('#model'),atlas=document.createElement('canvas');
let renderer,id,vector=false,props={},job=0,loading=false,ready=false,lastReveal=-1,direct=false,frames=0,lastMetrics=0;
const send=data=>window.ReactNativeWebView?.postMessage(JSON.stringify(data));
function request(){if(!job&&renderer&&props.active&&!document.hidden)job=requestAnimationFrame(tick);}
function resize(){if(!renderer)return;const g=props.glass;renderer.resize(id,g?.width||innerWidth,g?.height||innerHeight,g?.path||`M0 0H${innerWidth}V${innerHeight}H0Z`,g?.background==='orbs');}
function tick(at){job=0;if(!props.active||document.hidden)return;try{
  const changed=renderer.frame(at);frames++;if(!direct&&(changed||!ready)){const r=renderer.rect(id);if(output.width!==r[2]||output.height!==r[3]){output.width=r[2];output.height=r[3];}const context=output.getContext('2d',{alpha:true});context.clearRect(0,0,output.width,output.height);context.drawImage(atlas,...r,0,0,r[2],r[3]);}
  if(!ready){ready=true;send({type:'watcher-art-ready'});}
  if(props.kind==='glass'){const value=renderer.reveal(id);if(value!==lastReveal){lastReveal=value;send({type:'watcher-glass-reveal',progress:value});}}
  if(at-lastMetrics>1000){lastMetrics=at;send({type:'watcher-art-activity',running:renderer.moving(id)});}
  if(renderer.moving(id))request();
}catch(error){send({type:'watcher-rust-error',message:String(error)});}}
async function update(next){props={...props,...next};if(!renderer){if(loading||!props.kind)return;loading=true;try{
  renderer=await module.ProductRenderer.create(atlas,true);renderer.palette(props.theme||0);
  const kind=props.kind;vector=!['glass','rain','attention','gallery','mirror','voice-presence','grounding-hero'].includes(kind);
  id=kind==='rain'?renderer.add_rain():kind==='attention'?renderer.add_observer():['gallery','mirror','voice-presence','grounding-hero'].includes(kind)?renderer.add_raster(kind):vector?renderer.add_vector(root,kind,props.presentation==='card'):renderer.add(props.scanOnMount!==false);
  direct=renderer.present_to(id,output);if(props.scanOnMount===false&&kind==='glass')renderer.active(id,true,true);
  const svg=root.querySelector('svg');if(svg)svg.style.visibility='hidden';
  const observer=new MutationObserver(()=>{const decoder=root.querySelector('.mx-decoder');if(decoder?.dataset.motionState==='settled'){send({type:'watcher-decoder-complete'});observer.disconnect();}});observer.observe(root,{subtree:true,attributes:true,attributeFilter:['data-motion-state']});
}catch(error){send({type:'watcher-rust-error',message:String(error)});return;}}
  renderer.palette(props.theme||0);resize();renderer.active(id,!!props.active,!!props.reducedMotion);
  if(vector){const s=props.spectrum||{},level=props.level||0;renderer.vector_audio(id,s.low??level,s.mid??level,s.high??level,new Float64Array(s.contour||[]),props.mode==='record'||props.mode==='playback',props.lockProgress||0,!!props.locked,props.mode==='playback');renderer.vector_decoder(id,!!props.decoderVisible);}
  cancelAnimationFrame(job);job=0;if(props.active){renderer.frame(performance.now());request();}else renderer.reset_clock();
}
window.WatcherArt={update,interact(value){if(!renderer)return;if(value.action==='benchmark'){renderer.benchmark(id,value.at||0);request();return;}if(vector)renderer.vector_interact(id,value.action,value.x||0,value.y||0);if(props.kind==='glass'||value.action.startsWith('glass-'))renderer.pointer(id,value.x??.5,value.y??.5,!['glass-release','release'].includes(value.action));request();}};
window.WatcherEffects={message(data){if(data.type==='watcher-art-ready-check'&&ready)send({type:'watcher-art-ready'});if(data.type==='watcher-quality'&&renderer){renderer.quality(data.density||2,data.cost||0,data.targetFps||60);request();}if(data.type==='watcher-clock-reset'&&renderer)renderer.reset_clock();}};
document.addEventListener('visibilitychange',()=>{cancelAnimationFrame(job);job=0;renderer?.reset_clock();request();});addEventListener('resize',()=>{resize();request();});
send({type:'ready'});
