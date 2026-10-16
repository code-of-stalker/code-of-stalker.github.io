(() => {
  const svg=document.querySelector('.inward-projection');
  const find=selector=>svg.querySelector(selector),all=selector=>[...svg.querySelectorAll(selector)];
  const stage=find('.inward-stage'),aura=find('.source-aura'),inner=find('.source-inner'),core=find('.source-core');
  const infusion=find('.hero-infusion'),axis=find('.source-axis'),ground=find('.gather-ground'),ring=find('.settle-ring');
  const gradients=all('.erode-gradient'),ribbons=all('.return-ribbon'),highlights=all('.return-highlight');
  const curtainLeft=find('.theatre-curtain-left'),curtainRight=find('.theatre-curtain-right');
  const center={x:144,y:50.4},duration=24;
  const clamp=n=>Math.max(0,Math.min(1,n));
  const mix=(a,b,t)=>a+(b-a)*t;
  const ease=(a,b,t)=>{const x=clamp((t-a)/(b-a));return x*x*x*(x*(x*6-15)+10);};
  const windowed=(a,b,c,d,t)=>ease(a,b,t)*(1-ease(c,d,t));
  const set=(node,key,value)=>node?.setAttribute(key,String(value));
  const point=(a,b,t)=>({x:mix(a.x,b.x,t),y:mix(a.y,b.y,t)});
  function split(p,t){
    const a=point(p[0],p[1],t),b=point(p[1],p[2],t),c=point(p[2],p[3],t),d=point(a,b,t),e=point(b,c,t),f=point(d,e,t);
    return[[p[0],a,d,f],[f,e,c,p[3]]];
  }
  const at=(p,t)=>split(p,t)[0][3];
  const curve=p=>`M${p[0].x} ${p[0].y}C${p[1].x} ${p[1].y} ${p[2].x} ${p[2].y} ${p[3].x} ${p[3].y}`;
  function segment(p,from,to){const end=split(p,to)[0];return curve(split(end,to>0?from/to:0)[1]);}
  const streams=all('.human-projection').map((node,i)=>{
    const x=Number(node.dataset.x),y=Number(node.dataset.y),scale=Number(node.dataset.scale),start=Number(node.dataset.start),side=x<center.x?-1:1;
    const shape=find('#inward-shape-'+node.dataset.person+' path'),length=shape.getTotalLength();
    // Sample the approved silhouette itself: each fragment leaves the real
    // contour when the dissolving front reaches it, never a random rectangle.
    const anchors=Array.from({length:26},(_,j)=>{
      const p=shape.getPointAtLength(length*(j+.37)/26);
      return{x:p.x*.054-27.65,y:p.y*.054+2.9};
    }).sort((a,b)=>a.y-b.y);
    const particles=[...svg.querySelectorAll(`[data-stream="${i}"] .return-particle`)].map((node,j)=>{
      const anchor=anchors[j],seed=((j*17+i*13)%29)/28;
      const p={x:x+anchor.x*scale,y:y+anchor.y*scale};
      const points=[p,{x:p.x-side*(15+seed*8),y:p.y-20-seed*12},{x:144+side*(22+seed*5),y:31-seed*9},center];
      const flight=1.05+Math.abs(p.x-144)/250+seed*.32;
      return{node,points,flight,seed,emit:start+clamp((anchor.y+8)/104)*4.8-.15,tail:node.querySelector('.particle-tail'),dot:node.querySelector('.particle-core')};
    });
    const origin={x,y:y+22.4*scale};
    const guide=[origin,{x:x-side*20,y:y-13},{x:144+side*28,y:20},center];
    set(ribbons[i],'d',curve(guide));
    return{node,x,y,scale,start,side,particles,guide,rim:node.querySelector('.projection-rim'),edge:node.querySelector('.projection-rim rect'),footing:node.querySelector('.projection-footing'),silhouette:node.querySelector('.projection-silhouette'),drawing:node.querySelector('.projection-drawing')};
  });
  const systemReduced=matchMedia('(prefers-reduced-motion: reduce)');
  let elapsed=0,curtainTime=0,last=null,request=0,active=false,reduced=false,soft=false,fps=60,lastPaint=0,reported=null,loops=0;
  const still=()=>reduced||systemReduced.matches;
  const running=()=>active&&!document.hidden&&!still();
  const send=value=>{if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(JSON.stringify(value));else parent.postMessage(value,'*');};
  function report(){const next=running();svg.dataset.running=String(next);if(next!==reported){reported=next;send({type:'watcher-art-activity',running:next});}}
  function paint(){
    const staticFrame=still(),rebuilding=!staticFrame&&elapsed>=11.6&&elapsed<22;
    // Replay the same construction field and actual particle paths in reverse.
    // Both ends of the loop are fully assembled, without an opacity reset.
    const t=staticFrame?2.2:elapsed<10.4?2.2+elapsed:elapsed<11.6?12.6:Math.max(2.2,12.6-(elapsed-11.6));
    const calm=.5-.5*Math.cos(t*Math.PI*2/5.3);
    // The rail stays fixed. A sub-degree shear lets the hems drift by less
    // than one artwork pixel; independent phases avoid mechanical symmetry.
    const leftSway=staticFrame?0:Math.sin(curtainTime*Math.PI*2/8.6)*.48;
    const rightSway=staticFrame?0:Math.sin(curtainTime*Math.PI*2/10.4)*-.42;
    set(curtainLeft,'transform',`translate(0 12) skewX(${leftSway}) translate(0 -12)`);
    set(curtainRight,'transform',`translate(0 12) skewX(${rightSway}) translate(0 -12)`);
    let arrived=0,visibleParticles=0;
    streams.forEach((stream,i)=>{
      const {node,start,guide,rim,edge,footing,silhouette,drawing}=stream;
      const formed=staticFrame?.58:ease(.35+i*.12,1.6+i*.12,t);
      const dissolved=staticFrame?0:clamp((t-start)/4.8),front=-8+104*dissolved;
      // Keep the body opaque so the floor and curtains cannot show through.
      // Only the authored dissolve mask removes it; line brightness stays soft.
      set(node,'opacity',1);
      const lineOpacity=formed*(soft?.62:.78)*.75;
      set(silhouette,'stroke-opacity',lineOpacity);set(drawing,'opacity',lineOpacity);
      set(gradients[i],'y1',front-4);set(gradients[i],'y2',front+4);
      set(rim,'opacity',staticFrame?0:windowed(start,start+.35,start+4.35,start+4.8,t)*.85);
      set(edge,'y',front-4.5);set(footing,'opacity',(1-ease(.72,1,dissolved))*.55);
      const transport=staticFrame?.38:windowed(start+.1,start+.8,start+5.7,start+6.3,t);
      set(ribbons[i],'opacity',transport*(soft?.1:.16));
      const head=staticFrame?.85:ease(start+.2,start+5.6,t),tail=Math.max(0,head-.24);
      set(highlights[i],'d',segment(guide,tail,head));set(highlights[i],'opacity',transport*(soft?.28:.4));
      stream.particles.forEach((particle,j)=>{
        const {node,points,flight,emit,seed,dot,tail}=particle;
        const age=(t-emit)/flight,q=staticFrame?([6,13,20].includes(j)?(j+2)/28:-1):age;
        const visible=q>=0&&q<=1;
        if(!staticFrame)arrived+=ease(emit+flight*.72,emit+flight+.18,t);
        if(!visible){set(node,'opacity',0);return;}
        const travel=ease(0,1,q),position=at(points,travel);
        const before=at(points,Math.max(0,travel-.012)),after=at(points,Math.min(1,travel+.012));
        const angle=Math.atan2(after.y-before.y,after.x-before.x)*180/Math.PI+(rebuilding?180:0);
        const opacity=staticFrame?.62:windowed(0,.12,.86,1,q)*(soft?.68:1);
        set(node,'transform',`translate(${position.x} ${position.y}) rotate(${angle})`);set(node,'opacity',opacity);
        set(dot,'r',.22+seed*.24);set(tail,'transform',`scale(${.6+Math.sin(Math.PI*q)*.75+seed*.2} .65)`);
        visibleParticles++;
      });
    });
    const gathered=staticFrame?.65:clamp(arrived/104)*(1-ease(12.6,16,t));
    const light=.22+calm*.035+gathered*.78;
    set(aura,'r',15+gathered*14);set(aura,'opacity',light*(soft?.66:.95));
    set(inner,'r',4+gathered*5);set(inner,'opacity',.5+gathered*.5);
    set(core,'r',.65+gathered*.5);set(axis,'opacity',.12+gathered*.2);
    set(infusion,'opacity',gathered*(soft?.045:.075));set(ground,'opacity',.5+gathered*.5);
    const wave=ease(9.7,12.7,t);
    set(ring,'rx',18+wave*42);set(ring,'ry',3.2+wave*7);set(ring,'opacity',staticFrame?0:Math.sin(Math.PI*wave)*.25);
    const z=1+gathered*.025;
    set(stage,'transform',`translate(144 70) scale(${z}) translate(-144 -70)`);
    svg.dataset.progress=(staticFrame?.5:elapsed/duration).toFixed(4);svg.dataset.cycle=String(loops);svg.dataset.duration=String(duration);
    svg.dataset.phase=staticFrame?'still':elapsed>=22||elapsed<.6?'assembled':rebuilding?'rebuilding':elapsed>=9?'source-hold':t<8.8?'dissolving':'gathering';
    svg.dataset.direction=rebuilding?'outward':'inward';svg.dataset.authorTime=t.toFixed(4);
    svg.dataset.particles=String(visibleParticles);svg.dataset.gathered=gathered.toFixed(4);
  }
  function schedule(){cancelAnimationFrame(request);request=0;last=null;lastPaint=0;paint();report();if(running())request=requestAnimationFrame(tick);}
  function tick(now){
    request=0;if(!running()){report();return;}
    const delta=last===null?0:Math.min((now-last)/1000,.06);
    elapsed+=delta;curtainTime+=delta;last=now;
    if(elapsed>=duration){elapsed%=duration;loops++;}
    if(!lastPaint||now-lastPaint>=1000/fps-.5){paint();lastPaint=now;}
    if(running())request=requestAnimationFrame(tick);else report();
  }
  function update(props){
    if(typeof props.active==='boolean')active=props.active;
    if(typeof props.reducedMotion==='boolean')reduced=props.reducedMotion;
    if(props.bookPalette){for(const[key,value]of Object.entries(props.bookPalette.colors))if(/^#[0-9a-f]{6}$/i.test(value))document.documentElement.style.setProperty('--book-'+key,value);soft=props.bookPalette.soft===true;svg.dataset.palette=props.bookPalette.name;}
    schedule();
  }
  function message(data){
    if(data?.type==='watcher-art')update(data.props||{});
    if(data?.type==='watcher-art-ready-check'){send({type:'watcher-art-ready'});reported=null;report();}
    if(data?.type==='watcher-quality')fps=Math.max(30,Math.min(120,Number(data.targetFps)||60));
  }
  window.WatcherArt={update};window.WatcherEffects={message};
  window.addEventListener('message',event=>{if(event.source===parent)message(event.data);});
  document.addEventListener('visibilitychange',schedule);systemReduced.addEventListener('change',schedule);
  window.addEventListener('pagehide',()=>{cancelAnimationFrame(request);request=0;});
  paint();send({type:'watcher-art-ready'});report();
})();
