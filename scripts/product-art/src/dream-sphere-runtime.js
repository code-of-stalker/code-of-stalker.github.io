(() => {
  const svg=document.querySelector('.dream-sphere');
  const find=selector=>svg.querySelector(selector);
  const worlds=[...svg.querySelectorAll('.sphere-world')],cameras=worlds.map(world=>world.querySelector('.sphere-world-camera'));
  const fronts=[...svg.querySelectorAll('.sphere-ring-front')],backs=[...svg.querySelectorAll('.sphere-ring-back')],aura=find('.sphere-aura');
  const train=worlds[0].querySelector('.city-train'),walker=worlds[0].querySelector('.city-traveler'),passer=worlds[0].querySelector('.city-passer');
  const boat=worlds[1].querySelector('.lake-boat'),ripples=worlds[1].querySelector('.lake-ripples');
  const traveler=worlds[2].querySelector('.bridge-traveler'),orbitA=worlds[2].querySelector('.orbit-a'),orbitB=worlds[2].querySelector('.orbit-b');
  const fragments=[...worlds[2].querySelectorAll('.threshold-fragment')];
  const duration=24,clamp=n=>Math.max(0,Math.min(1,n)),mix=(a,b,t)=>a+(b-a)*t;
  const ease=(a,b,t)=>{const x=clamp((t-a)/(b-a));return x*x*x*(x*(x*6-15)+10);};
  const set=(node,key,value)=>node?.setAttribute(key,String(value));
  // A latitude circle lies ON the 3D sphere, in an inclined plane. Project its
  // near and far segments separately so the ring passes in front of the hero
  // and behind the scenery, rather than rotating a flat ellipse over a circle.
  const length=Math.hypot(.12,.93,.35),n=[.12/length,.93/length,.35/length];
  const span=Math.hypot(n[0],n[1]),u=[n[1]/span,-n[0]/span,0],v=[u[1]*n[2],-u[0]*n[2],span];
  function ringPoint(theta,height){
    const radius=Math.sqrt(Math.max(0,60*60-height*height)),c=Math.cos(theta)*radius,s=Math.sin(theta)*radius;
    return{x:144+n[0]*height+u[0]*c+v[0]*s,y:68+n[1]*height+u[1]*c+v[1]*s,z:n[2]*height+v[2]*s};
  }
  const xy=p=>p.x.toFixed(3)+' '+p.y.toFixed(3);
  function ringPaths(height){
    const paths={near:'',far:''};
    let previous=ringPoint(0,height),key=previous.z>=0?'near':'far';paths[key]='M'+xy(previous);
    for(let i=1;i<=96;i++){
      const next=ringPoint(i*Math.PI*2/96,height),nextKey=next.z>=0?'near':'far';
      if(key!==nextKey){
        const ratio=previous.z/(previous.z-next.z),cross={x:mix(previous.x,next.x,ratio),y:mix(previous.y,next.y,ratio)};
        paths[key]+='L'+xy(cross);paths[nextKey]+='M'+xy(cross);key=nextKey;
      }
      paths[key]+='L'+xy(next);previous=next;
    }
    return paths;
  }
  function ring(t){
    // Stagger the rings so a new one is already crossing the sphere while the
    // previous one leaves. Constant axial speed avoids a pause at either pole;
    // fade only at the poles so the invisible wrap never reverses direction.
    const heights=fronts.map((front,i)=>{
      const phase=(t/8+i/fronts.length)%1,height=mix(-60,60,phase),paths=ringPaths(height);
      const opacity=ease(0,.08,phase)*(1-ease(.9,1,phase));
      set(front,'d',paths.near);set(backs[i],'d',paths.far);
      set(front,'opacity',opacity);set(backs[i],'opacity',opacity);
      return height.toFixed(4);
    });
    svg.dataset.ringHeights=heights.join(',');
  }
  const systemReduced=matchMedia('(prefers-reduced-motion: reduce)');
  let elapsed=0,last=null,request=0,active=false,reduced=false,soft=false,fps=60,lastPaint=0,reported=null,loops=0;
  const still=()=>reduced||systemReduced.matches,running=()=>active&&!document.hidden&&!still();
  const send=value=>{if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(JSON.stringify(value));else parent.postMessage(value,'*');};
  function report(){const next=running();svg.dataset.running=String(next);if(next!==reported){reported=next;send({type:'watcher-art-activity',running:next});}}
  function paint(){
    const staticFrame=still(),t=staticFrame?10:elapsed,phase=t/8,index=Math.floor(phase)%3,fraction=phase-Math.floor(phase),blend=staticFrame?0:ease(.76,1,fraction);
    worlds.forEach((world,i)=>{
      const weight=i===index?1-blend:i===(index+1)%3?blend:0;
      set(world,'opacity',weight*(soft?.72:.86));
      const local=(t-i*8+duration)%duration,progress=clamp(local/8);
      set(cameras[i],'transform',`translate(${144+Math.sin(progress*Math.PI)*2} 68) scale(.46) translate(-144 -103)`);
    });
    const city=ease(-2,8,t>22?t-24:t);
    set(train,'transform',`translate(${mix(38,285,city)} 168)`);
    set(walker,'transform',`translate(${mix(108,151,city)} ${141-83*.4}) scale(.4)`);
    set(passer,'transform',`translate(${mix(212,178,city)} ${139-83*.32}) scale(.32)`);
    const lake=ease(6,16,t);
    set(boat,'transform',`translate(${mix(-22,28,lake)} ${Math.sin(lake*Math.PI*2)*.6})`);set(ripples,'transform',`translate(${mix(-22,28,lake)} 0)`);
    const walk=ease(16,23,t),scale=mix(.65,.34,walk),path=[[47,180],[83,166],[119,152],[155,138],[195,122]],part=Math.min(3,Math.floor(walk*4)),step=walk*4-part;
    const x=mix(path[part][0],path[part+1][0],step),y=mix(path[part][1],path[part+1][1],step)-Math.sin(step*Math.PI)*.65;
    set(traveler,'transform',`translate(${x} ${y-83*scale}) scale(${scale})`);
    set(orbitA,'transform',`rotate(${Math.sin((t-16)*.38)*5} 195 70)`);set(orbitB,'transform',`rotate(${-Math.sin((t-16)*.38+.8)*4} 195 70)`);
    fragments.forEach((node,i)=>set(node,'transform',`translate(0 ${Math.sin((t-16)*.38+i)*1.7})`));
    ring(t);
    set(aura,'opacity',(soft?.5:.75)*(.8+.2*Math.sin(t*Math.PI*2/8)));
    svg.dataset.progress=(staticFrame?.5:elapsed/duration).toFixed(4);svg.dataset.cycle=String(loops);svg.dataset.duration=String(duration);
    svg.dataset.world=String(index);svg.dataset.phase=staticFrame?'still':['city','lake','threshold'][index];svg.dataset.blend=blend.toFixed(4);
  }
  function schedule(){cancelAnimationFrame(request);request=0;last=null;lastPaint=0;paint();report();if(running())request=requestAnimationFrame(tick);}
  function tick(now){request=0;if(!running()){report();return;}elapsed+=last===null?0:Math.min((now-last)/1000,.06);last=now;if(elapsed>=duration){elapsed%=duration;loops++;}if(!lastPaint||now-lastPaint>=1000/fps-.5){paint();lastPaint=now;}if(running())request=requestAnimationFrame(tick);else report();}
  function update(props){
    if(typeof props.active==='boolean')active=props.active;if(typeof props.reducedMotion==='boolean')reduced=props.reducedMotion;
    if(props.bookPalette){for(const[key,value]of Object.entries(props.bookPalette.colors))if(/^#[0-9a-f]{6}$/i.test(value))document.documentElement.style.setProperty('--book-'+key,value);soft=props.bookPalette.soft===true;svg.dataset.palette=props.bookPalette.name;}schedule();
  }
  function message(data){if(data?.type==='watcher-art')update(data.props||{});if(data?.type==='watcher-art-ready-check'){send({type:'watcher-art-ready'});reported=null;report();}if(data?.type==='watcher-quality')fps=Math.max(30,Math.min(120,Number(data.targetFps)||60));}
  window.WatcherArt={update};window.WatcherEffects={message};window.addEventListener('message',event=>{if(event.source===parent)message(event.data);});document.addEventListener('visibilitychange',schedule);systemReduced.addEventListener('change',schedule);window.addEventListener('pagehide',()=>{cancelAnimationFrame(request);request=0;});paint();send({type:'watcher-art-ready'});report();
})();
