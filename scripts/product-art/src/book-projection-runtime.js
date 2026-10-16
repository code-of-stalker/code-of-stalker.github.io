// Embedded after the approved geometry/draw functions by build-book-projection.mjs.
let elapsed=0,last=0,request=0,active=false,reduced=false,reported=null,loops=0;
const closedHold=2;
let qualityCost=0,targetFps=60,lastDraw=0;
const systemReduced=matchMedia('(prefers-reduced-motion: reduce)');
const send=value=>{if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(JSON.stringify(value));else parent.postMessage(value,'*');};
const isReduced=()=>reduced||systemReduced.matches;
function running(){return active&&!document.hidden&&!isReduced();}
function report(){const value=running();svg.dataset.running=String(value);if(value!==reported){reported=value;send({type:'watcher-art-activity',running:value});}}
function paint(){
  draw(isReduced()?.65:Math.min(1,elapsed/settings.cycle),isReduced()?0:Math.min(elapsed,settings.cycle));
  svg.dataset.loop=String(loops);
  svg.dataset.phase=isReduced()?'still':elapsed>=settings.cycle?'closed':'playing';
}
function schedule(){
  cancelAnimationFrame(request);request=0;last=0;lastDraw=0;
  paint();report();if(running())request=requestAnimationFrame(tick);
}
function tick(now){
  request=0;if(!running()){report();return;}
  const dt=last?Math.min((now-last)/1000,.06):0;last=now;
  const before=elapsed,total=settings.cycle+closedHold,next=elapsed+dt;
  const wrapped=next>=total;
  if(wrapped)loops++;
  elapsed=next%total;
  // Hold the exact closed pose without redrawing its geometry every frame.
  const closed=before<settings.cycle&&elapsed>=settings.cycle;
  if(wrapped||closed||(elapsed<settings.cycle&&(!lastDraw||now-lastDraw>=1000/targetFps-.5))){paint();lastDraw=now;}
  if(running())request=requestAnimationFrame(tick);else report();
}
function update(props){
  if(typeof props.active==='boolean')active=props.active;
  if(typeof props.reducedMotion==='boolean')reduced=props.reducedMotion;
  if(props.bookPalette){
    for(const [key,value]of Object.entries(props.bookPalette.colors))if(/^#[0-9a-f]{6}$/i.test(value))document.documentElement.style.setProperty('--book-'+key,value);
    const soft=props.bookPalette.soft===true;
    settings.glow=soft?.55:.8;settings.beam=soft?.4:.6;settings.particles=!soft&&qualityCost<2;
    svg.dataset.palette=props.bookPalette.name;
  }
  schedule();
}
function message(data){
  if(data?.type==='watcher-art')update(data.props||{});
  if(data?.type==='watcher-art-ready-check'){send({type:'watcher-art-ready'});reported=null;report();}
  if(data?.type==='watcher-quality'){
    qualityCost=Number(data.cost)||0;targetFps=Math.max(30,Math.min(120,Number(data.targetFps)||60));
    settings.particles=svg.dataset.palette!=='neutral'&&qualityCost<2;paint();
  }
}
window.WatcherArt={update};window.WatcherEffects={message};
window.addEventListener('message',event=>{if(event.source===parent)message(event.data);});
document.addEventListener('visibilitychange',schedule);
systemReduced.addEventListener('change',schedule);
window.addEventListener('pagehide',()=>{cancelAnimationFrame(request);request=0;});
paint();send({type:'watcher-art-ready'});report();
