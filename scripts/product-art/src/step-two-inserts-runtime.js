(()=>{
  const svg=document.querySelector('.step-insert'),reflection=svg.dataset.kind==='reflections';
  const find=s=>svg.querySelector(s),all=s=>[...svg.querySelectorAll(s)];
  const duration=reflection?8.4:7.8,hold=2,returnDuration=3.4,rest=.8,cycle=duration+hold+returnDuration+rest;
  const heart=find('.heart'),halo=find('.heart-halo'),inner=find('.heart-inner'),core=find('.heart-core');
  const ground=find('.ground'),body=find('.hero-body'),infusion=find('.hero-infusion'),column=find('.focus-column'),wave=find('.focus-wave');
  const fans=all('.projection-fan'),threads=all('.projection-thread'),traces=all('.projection-trace');
  const storyBack=find('.story-thread-back'),storyFront=find('.story-thread-front');
  const storyPaths={near:all('.story-front-soft,.story-front-core'),far:all('.story-back-soft,.story-back-core')};
  const shape=find('#insert-man-shape path'),length=shape.getTotalLength();
  const anchors=Array.from({length:12},(_,i)=>{const p=shape.getPointAtLength(length*(i+.3)/12);return{x:p.x*.054-27.65,y:p.y*.054+2.9};}).sort((a,b)=>a.y-b.y);
  const echoes=all('.echo').map((node,i)=>({node,side:Number(node.dataset.side),plane:node.querySelector('.echo-plane'),footing:node.querySelector('.echo-footing'),gradient:find('#echo-erode-'+i),scan:node.querySelector('.echo-scan'),band:node.querySelector('.echo-scan rect'),sheen:node.querySelector('.pane-sheen'),glint:node.querySelector('.pane-glint'),flecks:[...node.querySelectorAll('.echo-fleck')]}));
  const systemReduced=matchMedia('(prefers-reduced-motion: reduce)');
  let elapsed=0,last=null,request=0,active=false,reduced=false,soft=false,targetFps=60,lastPaint=0,reported=null,loops=0;
  const clamp=n=>Math.max(0,Math.min(1,n)),mix=(a,b,t)=>a+(b-a)*t;
  const smooth=(a,b,t)=>{const x=clamp((t-a)/(b-a));return x*x*x*(x*(x*6-15)+10);};
  const windowed=(a,b,c,d,t)=>smooth(a,b,t)*(1-smooth(c,d,t));
  const set=(node,key,value)=>node?.setAttribute(key,String(value));
  const send=value=>{if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(JSON.stringify(value));else parent.postMessage(value,'*');};
  const isReduced=()=>reduced||systemReduced.matches,running=()=>active&&!document.hidden&&!isReduced();
  function report(){const next=running();svg.dataset.running=String(next);if(next!==reported){reported=next;send({type:'watcher-art-activity',running:next});}}
  const helixPoint=q=>{const angle=-Math.PI/2+q*Math.PI*4,radius=22+5*Math.sin(q*Math.PI);return{x:144+Math.cos(angle)*radius,y:87-q*76+Math.sin(angle)*3,z:Math.sin(angle)};};
  const xy=p=>p.x.toFixed(3)+' '+p.y.toFixed(3);
  function storyThread(t,still){
    const progress=smooth(1.5,6.9,t),head=Math.min(1,progress*1.35),tail=Math.max(0,progress*1.35-.35),paths={near:'',far:''};
    if(head>tail){
      let previous=helixPoint(tail),key=previous.z>=0?'near':'far';paths[key]='M'+xy(previous);
      for(let i=1;i<=64;i++){
        const next=helixPoint(mix(tail,head,i/64)),nextKey=next.z>=0?'near':'far';
        if(nextKey!==key){const ratio=previous.z/(previous.z-next.z),cross={x:mix(previous.x,next.x,ratio),y:mix(previous.y,next.y,ratio)};paths[key]+='L'+xy(cross);paths[nextKey]+='M'+xy(cross);key=nextKey;}
        paths[key]+='L'+xy(next);previous=next;
      }
    }
    for(const key of['near','far'])storyPaths[key].forEach(node=>set(node,'d',paths[key]));
    const light=still?0:Math.sin(progress*Math.PI)*(soft?.75:1);
    set(storyBack,'opacity',light);set(storyFront,'opacity',light);
  }
  function paint(){
    const still=isReduced(),returning=elapsed>=duration+hold;
    // Reverse the authored construction field, including masks, planes and
    // contour fragments. Both ends of the loop are the same assembled scene.
    const t=still?2.8:elapsed<duration?elapsed:elapsed<duration+hold?duration:duration*(1-smooth(duration+hold,duration+hold+returnDuration,elapsed));
    const spread=still?1:smooth(.25,3.8,t),ignite=still?1:smooth(.4,3.5,t),isolate=still?1:smooth(1.5,7,t);
    const breath=still?.45:.5-.5*Math.cos(elapsed*Math.PI*6/cycle);
    echoes.forEach((echo,i)=>{
      const {node,side,plane,footing,gradient,scan,band,sheen,glint,flecks}=echo,sign=Math.sign(side),far=Math.abs(side)===2;
      let x,y,scale,yaw=0,erase;
      if(reflection){
        x=144+sign*(far?94+14*spread:52+20*spread);y=far?13:2;scale=far?.72:.9;
        yaw=sign*((far?.82:.42)-spread*(far?.12:.24));
        erase=still?0:smooth(4.2+(far?.25:0),7.7+(far?.25:0),t);
        set(node,'opacity',far?(soft?.38:.48):(soft?.65:.78));
        set(plane,'transform',`matrix(${Math.cos(yaw)} ${Math.sin(yaw)*.22} 0 1 0 0)`);
        set(sheen,'transform',`translate(${-46+92*smooth(.7,5.5,t)} 0)`);set(sheen,'opacity',still?.35:windowed(.4,1.2,5.2,6.3,t)*.7);
        set(glint,'stroke-dashoffset',-25-t*19-i*31);set(glint,'opacity',(soft?.32:.5)*windowed(.2,1,7.1,8.3,t));
      }else{
        x=144+side*(far?47:49)*(1+.16*isolate);y=(far?13:5)-5*isolate;scale=(far?.72:.86)*(1-.12*isolate);
        erase=still?1:smooth(far?.8:2.1,far?4.9:6.6,t);
        set(node,'opacity',far?(soft?.3:.4):(soft?.5:.63));
        set(plane,'transform','matrix(1 0 0 1 0 0)');
      }
      set(node,'transform',`translate(${x} ${y}) scale(${scale})`);
      set(footing,'opacity',reflection?.3:.4*(1-smooth(.6,1,erase)));
      const front=mix(-12,103,erase);
      set(gradient,'y1',front-3);set(gradient,'y2',front+3);set(band,'y',front-3.5);
      set(scan,'opacity',still?0:Math.sin(erase*Math.PI)*(soft?.65:.95));
      flecks.forEach((node,j)=>{
        const p=anchors[j],age=(front-p.y)/24,visible=!still&&age>0&&age<1;
        if(!visible){set(node,'opacity',0);return;}
        const fly=smooth(0,1,age),dx=sign*(2+fly*(5+j%3)),dy=-fly*(3+j%4);
        set(node,'d',`M${p.x+dx} ${p.y+dy}l${sign*(1.5+fly*1.5)} ${-1-fly}`);
        set(node,'opacity',Math.sin(age*Math.PI)*(soft?.3:.48));
      });
      // The fan and its light trace share the moving portrait's actual chest.
      const end={x,y:y+scale*(10+.9*22.4)},power=reflection?windowed(.45,2,7.4,8.4,t):0;
      const edge=-sign*21,edgeX=x+edge*Math.cos(yaw)*scale,slant=edge*Math.sin(yaw)*.22;
      set(fans[i],'d',`M144 22.4L${edgeX} ${y+(6+slant)*scale}L${edgeX} ${y+(94+slant)*scale}Z`);set(fans[i],'opacity',power*(far?.4:.7));
      set(threads[i],'d',`M144 22.4L${end.x} ${end.y}`);set(threads[i],'opacity',power*(soft?.11:.18));
      const pulse=smooth(.7+i*.16,3.4+i*.16,t),a=Math.max(0,pulse-.09);
      set(traces[i],'d',`M${mix(144,end.x,a)} ${mix(22.4,end.y,a)}L${mix(144,end.x,pulse)} ${mix(22.4,end.y,pulse)}`);
      set(traces[i],'opacity',power*Math.sin(pulse*Math.PI)*(soft?.42:.65));
    });
    const focus=reflection?ignite:isolate;
    set(column,'opacity',focus*(soft?.55:.8));
    set(body,'transform',`scale(${1+breath*.005} 1)`);set(infusion,'opacity',focus*(soft?.025:.045));
    set(heart,'opacity',.28+.72*ignite);set(halo,'r',12+focus*5+breath*1.2);set(halo,'opacity',(soft?.65:.88));
    set(inner,'r',3.2+focus*1.4+breath*.4);set(core,'r',.55+focus*.3+breath*.06);
    set(ground,'opacity',.25+focus*.4);
    if(wave){const w=smooth(.9,6.7,t);set(wave,'rx',4+w*124);set(wave,'ry',.5+w*11);set(wave,'opacity',still?0:Math.sin(w*Math.PI)*(soft?.16:.25));}
    if(storyFront)storyThread(t,still);
    svg.dataset.progress=(t/duration).toFixed(4);svg.dataset.cycle=String(loops);svg.dataset.duration=String(cycle);svg.dataset.authorTime=t.toFixed(4);
    svg.dataset.phase=still?'still':elapsed<duration?'reveal':elapsed<duration+hold?'hold':elapsed<duration+hold+returnDuration?'return':'rest';
    svg.dataset.direction=returning?'rebuilding':'outward';
  }
  function schedule(){cancelAnimationFrame(request);request=0;last=null;lastPaint=0;paint();report();if(running())request=requestAnimationFrame(tick);}
  function tick(now){
    request=0;if(!running()){report();return;}
    elapsed+=last===null?0:Math.min((now-last)/1000,.06);last=now;
    if(elapsed>=cycle){elapsed%=cycle;loops++;}
    if(!lastPaint||now-lastPaint>=1000/targetFps-.5){paint();lastPaint=now;}
    if(running())request=requestAnimationFrame(tick);else report();
  }
  function update(props){
    if(typeof props.active==='boolean')active=props.active;if(typeof props.reducedMotion==='boolean')reduced=props.reducedMotion;
    if(props.bookPalette){for(const [key,value]of Object.entries(props.bookPalette.colors))if(/^#[0-9a-f]{6}$/i.test(value))document.documentElement.style.setProperty('--book-'+key,value);soft=props.bookPalette.soft===true;svg.dataset.palette=props.bookPalette.name;}
    schedule();
  }
  function message(data){
    if(data?.type==='watcher-art')update(data.props||{});if(data?.type==='watcher-art-ready-check'){send({type:'watcher-art-ready'});reported=null;report();}
    if(data?.type==='watcher-quality')targetFps=Math.max(30,Math.min(120,Number(data.targetFps)||60));
  }
  window.WatcherArt={update};window.WatcherEffects={message};window.addEventListener('message',event=>{if(event.source===parent)message(event.data);});
  document.addEventListener('visibilitychange',schedule);systemReduced.addEventListener('change',schedule);window.addEventListener('pagehide',()=>{cancelAnimationFrame(request);request=0;});
  paint();send({type:'watcher-art-ready'});report();
})();
