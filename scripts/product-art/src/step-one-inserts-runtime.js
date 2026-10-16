(() => {
  const svg=document.querySelector('.step-one-insert'),prints=svg.dataset.kind==='identity-imprints';
  const all=s=>[...svg.querySelectorAll(s)],set=(node,key,value)=>{if(node&&node.getAttribute(key)!==String(value))node.setAttribute(key,String(value));};
  const specimens=all('.print-specimen').map(node=>{
    const ridges=[...node.querySelectorAll('.print-ridge')];
    const glints=[...node.querySelectorAll('.ridge-glints path')];
    glints.forEach((glint,i)=>set(glint,'d',ridges[3+i*3].getAttribute('d')));
    return{node,side:Number(node.dataset.side),light:node.querySelector('.print-light'),detail:node.querySelector('.print-detail'),glints};
  });
  const paths=all('.ribbon-light-gradient').map(node=>({node,lane:Number(node.dataset.lane)}));
  const sculpture=svg.querySelector('.path-sculpture'),difference=svg.querySelector('.difference-stroke');
  const systemReduced=matchMedia('(prefers-reduced-motion: reduce)');
  const clamp=x=>Math.max(0,Math.min(1,x)),smooth=(a,b,t)=>{const q=clamp((t-a)/(b-a));return q*q*q*(q*(q*6-15)+10);};
  const windowed=(a,b,c,d,t)=>smooth(a,b,t)*(1-smooth(c,d,t));
  let elapsed=0,last=null,request=0,active=false,reduced=false,soft=false,targetFps=60,lastPaint=0,reported=null;
  const still=()=>reduced||systemReduced.matches,running=()=>active&&!document.hidden&&!still();
  const send=value=>window.ReactNativeWebView?window.ReactNativeWebView.postMessage(JSON.stringify(value)):parent.postMessage(value,'*');
  function report(){const next=running();svg.dataset.running=String(next);if(next!==reported){reported=next;send({type:'watcher-art-activity',running:next});}}
  function paint(){
    const fixed=still(),t=fixed?12:elapsed%16;
    if(prints){
      const compare=fixed?0:windowed(1.4,5.8,9.4,13.8,t);
      specimens.forEach(({node,side,light,detail,glints},i)=>{
        const x=144+side*(60-compare*24),y=80+(fixed?0:Math.sin(elapsed*Math.PI*2/16+side*.5)*.55);
        const angle=side*(-6+compare*5),yaw=1-compare*.07;
        set(node,'transform',`translate(${x} ${y}) rotate(${angle}) matrix(${yaw} ${side*compare*.035} 0 1 0 0)`);
        const sweep=fixed?.6:(elapsed/7.7+i*.47)%1;
        set(light,'transform',`translate(${sweep*160} 0)`);set(light,'opacity',fixed?.3:Math.sin(Math.PI*sweep)*(soft?.55:.85));
        set(detail,'opacity',.25+compare*.6);
        glints.forEach((glint,j)=>{
          const q=fixed?0:(elapsed/6.4+i*.39+j*.19)%1;
          set(glint,'stroke-dashoffset',-q);set(glint,'opacity',fixed?0:Math.sin(Math.PI*q)*(soft?.45:.7));
        });
      });
      set(difference,'opacity',fixed?1:.25+.75*windowed(5.8,8.4,14,15.8,t));
      svg.dataset.phase=fixed?'still':compare>.95?'compare':compare<.05?'distinct':'approach';
    }else{
      set(sculpture,'transform',fixed?'':`translate(144 94) scale(${1+Math.sin(elapsed*Math.PI*2/16)*.012}) translate(-144 -94)`);
      paths.forEach(({node,lane})=>{
        // Equal pulse durations, different offsets and routes: neither track
        // leads to a shared source or consumes the other.
        const q=(elapsed/7.4+lane*.46)%1,head=25+(q*1.3-.15)*238;
        set(node,'x1',fixed?-100:head-24);set(node,'x2',fixed?-50:head+24);
      });
      svg.dataset.phase=fixed?'still':'independent';
    }
    svg.dataset.time=elapsed.toFixed(4);svg.dataset.cycle=String(Math.floor(elapsed/16));
  }
  function schedule(){cancelAnimationFrame(request);request=0;last=null;lastPaint=0;paint();report();if(running())request=requestAnimationFrame(tick);}
  function tick(now){
    request=0;if(!running()){report();return;}
    elapsed+=last===null?0:Math.min((now-last)/1000,.06);last=now;
    if(!lastPaint||now-lastPaint>=1000/targetFps-.5){paint();lastPaint=now;}
    if(running())request=requestAnimationFrame(tick);else report();
  }
  function update(props){
    if(typeof props.active==='boolean')active=props.active;if(typeof props.reducedMotion==='boolean')reduced=props.reducedMotion;
    if(props.bookPalette){for(const[key,value]of Object.entries(props.bookPalette.colors))if(/^#[0-9a-f]{6}$/i.test(value))document.documentElement.style.setProperty('--book-'+key,value);soft=props.bookPalette.soft===true;svg.dataset.palette=props.bookPalette.name;}
    schedule();
  }
  function message(data){
    if(data?.type==='watcher-art')update(data.props||{});
    if(data?.type==='watcher-art-ready-check'){send({type:'watcher-art-ready'});reported=null;report();}
    if(data?.type==='watcher-quality')targetFps=Math.max(30,Math.min(120,Number(data.targetFps)||60));
  }
  window.WatcherArt={update};window.WatcherEffects={message};window.addEventListener('message',event=>{if(event.source===parent)message(event.data);});
  document.addEventListener('visibilitychange',schedule);systemReduced.addEventListener('change',schedule);window.addEventListener('pagehide',()=>{cancelAnimationFrame(request);request=0;});
  paint();send({type:'watcher-art-ready'});report();
})();
