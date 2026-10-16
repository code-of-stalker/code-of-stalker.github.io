(() => {
  const svg = document.querySelector('.dream-cinema'), kind = svg.dataset.kind;
  const find = selector => svg.querySelector(selector), all = selector => [...svg.querySelectorAll(selector)];
  const stage = find('.cinema-stage'), camera = find('.sleep-camera'), room = find('.sleep-room');
  const headLight = find('.head-light');
  const focus = find('.dream-focus'), focusSolid = find('.focus-solid'), focusSurface = find('.focus-surface');
  const focusContour = find('.focus-contour'), focusHalo = find('.focus-halo'), focusCrater = find('.focus-crater');
  const worlds = all('.cinema-world');
  const memories = all('.memory'), threads = find('.memory-threads'), recollection = find('.recollection-light');
  const memoryThreads = all('.memory-threads path');
  const memoryBlockers = all('.memory-thread-blocker');
  const cities = all('.city-traveler'), passers = all('.city-passer'), trains = all('.city-train'), lights = all('.city-lights');
  const boats = all('.lake-boat'), ripples = all('.lake-ripples'), birds = all('.lake-birds');
  const travelers = all('.bridge-traveler'), doors = all('.bridge-door-light'), sparks = all('.bridge-spark');
  const orbitA=all('.orbit-a'), orbitB=all('.orbit-b'), fragmentA=all('.fragment-a'), fragmentB=all('.fragment-b');
  const systemReduced = matchMedia('(prefers-reduced-motion: reduce)');
  const duration = kind === 'dream-world' ? 26 : 18;
  const anchor = { x:195, y:70 };
  // Pose-sheet coordinates: inside the skull, toward the crown/back of the head.
  const crown = kind === 'dream-world' ? [49,112] : [80,64];
  const dreamEnd=4.6+(33.7-8.8)/1.4;
  const clamp = n => Math.max(0, Math.min(1, n));
  const mix = (a, b, t) => a + (b-a)*t;
  const ease = (a, b, t) => { const x = clamp((t-a)/(b-a)); return x*x*x*(x*(x*6-15)+10); };
  const windowed = (start, peak, out, end, t) => ease(start, peak, t)*(1-ease(out, end, t));
  function storyTime(seconds) {
    if(seconds<.7) return seconds*3.8/.7;
    if(seconds<4.6) return 3.8+(seconds-.7)*5/3.9;
    if(seconds<dreamEnd) return 8.8+(seconds-4.6)*1.4;
    return 33.7+(seconds-dreamEnd)*4.3/(26-dreamEnd);
  }
  // One closed contour evolves from the entrance circle into the moon, then a door.
  function focusPath(radius, door) {
    const w=mix(radius,24,door), h=mix(radius,44,door), bottom=radius*(1-door), k=.55228475;
    return `M0 ${-h}C${w*k} ${-h} ${w} ${-h+w*(1-k)} ${w} ${-h+w}L${w} ${h-bottom}C${w} ${h-bottom*(1-k)} ${w-bottom*(1-k)} ${h} ${w-bottom} ${h}L${-w+bottom} ${h}C${-w+bottom*(1-k)} ${h} ${-w} ${h-bottom*(1-k)} ${-w} ${h-bottom}L${-w} ${-h+w}C${-w} ${-h+w*(1-k)} ${-w*k} ${-h} 0 ${-h}Z`;
  }
  const set = (node, key, value) => { if (node) node.setAttribute(key, String(value)); };
  function breathOffset(x,y) {
    // Authoring coordinates of the seated drawing. The mattress, blanket, lap
    // and hands are outside this field; the chest expands with a small shoulder
    // lift, smoothly tapering into the unchanged neck and lower arm contours.
    const localX=x-990;
    const side=ease(170,200,localX)*(1-ease(345,380,localX));
    const anchor=1-ease(425,470,y);
    const chest=ease(300,355,y)*(1-ease(410,465,y));
    return [(localX-238)*.052*chest*side*anchor,-1.8*side*anchor];
  }
  const breathingPaths=kind==='dream-wake'?all('.approved-hero path').map(node=>{
    const d=node.getAttribute('d'),numbers=[...d.matchAll(/-?\d+(?:\.\d+)?/g)];
    const chunks=[],points=[];let cursor=0;
    // Potrace's source contains absolute M/L/C pairs. Keep all static text
    // byte-for-byte and only prepare the points touched by the breathing field.
    for(let i=0;i+1<numbers.length;i+=2){
      const a=numbers[i],b=numbers[i+1],x=Number(a[0]),y=Number(b[0]),[dx,dy]=breathOffset(x,y);
      if(Math.abs(dx)+Math.abs(dy)<.001)continue;
      chunks.push(d.slice(cursor,a.index));points.push([x,y,dx,dy]);cursor=b.index+b[0].length;
    }
    chunks.push(d.slice(cursor));return{node,chunks,points};
  }):[];
  const send = value => { if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(value)); else parent.postMessage(value, '*'); };
  let elapsed = 0, last = null, request = 0, active = false, reduced = false, soft = false, fps = 60, lastPaint = 0, reported = null, loops = 0;
  const still = () => reduced || systemReduced.matches;
  const running = () => active && !document.hidden && !still();
  function report() {
    const next = running(); svg.dataset.running = String(next);
    if (next !== reported) { reported = next; send({ type: 'watcher-art-activity', running: next }); }
  }
  function body(breath=0) {
    for(const {node,chunks,points} of breathingPaths){
      let d=chunks[0];
      points.forEach(([x,y,dx,dy],i)=>{d+=(x+dx*breath).toFixed(3)+' '+(y+dy*breath).toFixed(3)+chunks[i+1];});
      set(node,'d',d);
    }
    const delta=kind==='dream-wake'?breathOffset(1238,232):[0,0];
    const head=[crown[0]+delta[0]*breath*.25,crown[1]+delta[1]*breath*.25];
    set(headLight,'transform',`translate(${head[0]} ${head[1]})`);
    svg.dataset.breath=breath.toFixed(4);
    return head;
  }
  function places(t, waking) {
    const cityTime = waking ? t-1.4 : t-8;
    const lakeTime = waking ? t-9.2 : t-16;
    const bridgeTime = waking ? t-17 : t-23;
    for (const node of cities) set(node,'transform',`translate(${108+clamp(cityTime/10)*43} ${141-83*.4}) scale(.4)`);
    for (const node of passers) set(node,'transform',`translate(${212-clamp(cityTime/10)*34} ${139-83*.32}) scale(.32)`);
    // Ten carriages keep the tail beyond the left crop throughout the pass.
    for (const node of trains) set(node,'transform',`translate(${mix(38,285,clamp(cityTime/10))} 168)`);
    for (const node of lights) set(node,'opacity',.66+.16*Math.sin(cityTime*.65));
    for (const node of boats) set(node,'transform',`translate(${mix(-20,30,clamp(lakeTime/10))} ${Math.sin(lakeTime*.85)*.65})`);
    for (const node of ripples) { set(node,'transform',`translate(${mix(-20,30,clamp(lakeTime/10))} 0)`); set(node,'opacity',.5+.2*Math.sin(lakeTime)); }
    for (const node of birds) set(node,'transform',`translate(${clamp(lakeTime/10)*42} ${-Math.sin(lakeTime*.6)*1.5})`);
    const walk = ease(0,8,bridgeTime), scale = mix(.65,.34,walk);
    const path=[[47,180],[83,166],[119,152],[155,138],[195,122]], segment=Math.min(3,Math.floor(walk*4)),fraction=walk*4-segment;
    for (const node of travelers) {
      const feetX=mix(path[segment][0],path[segment+1][0],fraction),feetY=mix(path[segment][1],path[segment+1][1],fraction)-Math.sin(fraction*Math.PI)*.65;
      set(node,'transform',`translate(${feetX} ${feetY-83*scale}) scale(${scale})`);
    }
    for (const node of doors) set(node,'opacity',.55+.4*walk);
    for (const node of sparks) set(node,'opacity',.5+.5*walk);
    const drift=bridgeTime*.38;
    for(const node of orbitA)set(node,'transform',`rotate(${Math.sin(drift)*5} 195 70)`);
    for(const node of orbitB)set(node,'transform',`rotate(${-Math.sin(drift+.8)*4} 195 70)`);
    for(const node of fragmentA)set(node,'transform',`translate(0 ${Math.sin(drift)*1.7})`);
    for(const node of fragmentB)set(node,'transform',`translate(0 ${-Math.sin(drift+.7)*2})`);
  }
  function paint() {
    const t = still() ? (kind === 'dream-world' ? 13 : 15) : kind==='dream-world' ? storyTime(elapsed) : elapsed*28/18;
    // Four complete breaths per waking loop, independent of memory playback.
    const breath = still()?0:(.5-.5*Math.cos(elapsed*Math.PI*2/4.5))*(soft?.65:1);
    svg.dataset.still=String(still());
    set(stage,'opacity',1);
    let phase;
    if (kind === 'dream-world') {
      const head=body();
      const approach = ease(3.8,9.3,t)*(1-ease(32,36.5,t));
      const scale = mix(1,6.7,approach);
      const focusX=mix(head[0],anchor.x,approach),focusY=mix(head[1],anchor.y,approach);
      set(camera,'transform',`translate(${focusX-head[0]*scale} ${focusY-head[1]*scale}) scale(${scale})`);
      set(room,'opacity',1-windowed(7.7,9.3,32,35,t));
      const focusVisible=windowed(6.6,8.3,32,34,t),door=ease(23.8,25.5,t);
      set(headLight,'opacity',(.08+.65*approach)*(1-focusVisible)*(soft ? .7 : 1));
      const radius=mix(mix(2.4,30,ease(6.6,8.3,t)),14,ease(8.3,10.4,t));
      const contour=focusPath(radius,door);
      set(focus,'opacity',focusVisible);
      set(focus,'transform',`translate(${focusX} ${focusY})`);
      set(focusSolid,'d',contour);set(focusSurface,'d',contour);set(focusContour,'d',contour);
      set(focusSolid,'opacity',ease(8.3,10.4,t)*(1-door));
      set(focusSurface,'opacity',1-door);
      set(focusHalo,'r',radius+22);set(focusHalo,'opacity',(1-door*.7)*(soft?.45:.75));
      set(focusCrater,'opacity',ease(8.3,10.4,t)*(1-door)*.3);
      const windows = [[8.8,10.4,16,17.8],[16.4,18,23.5,25.3],[23.8,25.5,31.7,33.7]];
      worlds.forEach((world,i) => {
        const [start,peak,out,end]=windows[i], reveal=windowed(start,peak,out,end,t);
        set(world,'opacity',reveal);
        const drift=clamp((t-start)/(end-start)), z=i===2?1:.96+drift*.08;
        set(world.firstElementChild,'transform',`translate(${anchor.x} ${anchor.y}) scale(${z}) translate(${-anchor.x} ${-anchor.y})`);
      });
      places(t,false);
      phase=t<3.8?'sleep':t<9.3?'enter-mind':t<17?'night-city':t<24.3?'mountain-lake':t<32?'threshold':'return-to-sleeper';
      if (still()) {
        // A complete static story, with the sleeping figure below the imagined city.
        set(camera,'transform','translate(21 43) scale(.84)'); set(room,'opacity',.8); set(headLight,'opacity',.4);
        set(worlds[0],'transform','translate(39 -2) scale(.73)');
        set(focus,'opacity',0);
      } else set(worlds[0],'transform','');
    } else {
      const head=body(breath);
      set(camera,'transform',''); set(room,'opacity',1);
      set(headLight,'opacity',.08+(.19+breath*.04)*windowed(1,4,24,28,t));
      const points=[[178,43],[224,87],[174,103]],windows=[[1.4,3.4,9,11.6],[9.2,11.2,16.7,19.2],[17,19,23,25.5]];
      let total=0;
      memories.forEach((memory,i) => {
        const [start,peak,out,end]=windows[i], visible=windowed(start,peak,out,end,t);
        const arrive=ease(start,peak,t), recall=ease(out,end,t);
        const [px,py]=points[i], x=mix(mix(head[0],px,arrive),head[0],recall*.2),y=mix(mix(head[1],py,arrive),head[1],recall*.2);
        const z=mix(.16,.34,arrive)*(1-recall*.2);
        const transform=`translate(${x} ${y}) scale(${z}) translate(-144 -103)`;
        set(memory,'transform',transform);
        set(memory,'opacity',visible*(soft?.75:.92)); total+=visible;
        set(memoryBlockers[i],'transform',transform);
        set(memoryBlockers[i],'opacity',visible>.001?1:0);
        const dx=x-head[0],dy=y-head[1],edge=1/Math.max(Math.abs(dx)/(120*z+2),Math.abs(dy)/(80*z+2));
        const endX=x-dx*Math.min(1,edge),endY=y-dy*Math.min(1,edge);
        set(memoryThreads[i],'opacity',visible*ease(1,1.35,1/edge));
        set(memoryThreads[i],'d',`M${head[0]} ${head[1]}Q${(endX+head[0])/2} ${Math.min(endY,head[1])-12} ${endX} ${endY}`);
      });
      set(threads,'opacity',total*.45);
      set(recollection,'transform',`translate(${head[0]} ${head[1]})`);
      set(recollection,'opacity',Math.min(1,total)*.55+windowed(23.5,25.3,26,28,t)*.65);
      places(t,true);
      phase=t<1.4?'awake':t<9.5?'remember-city':t<17.5?'remember-lake':t<25.5?'remember-threshold':t<28.5?'awake':'rest';
      if (still()) {
        memories.forEach((memory,i)=>set(memory,'opacity',i===0?.42:0));
        set(memories[0],'transform','translate(178 43) scale(.31) translate(-144 -103)');
        set(threads,'opacity',0);set(recollection,'opacity',0);
      }
    }
    svg.dataset.progress = (still() ? .5 : elapsed/duration).toFixed(4); svg.dataset.cycle = String(loops);
    svg.dataset.phase = still() ? 'still' : phase;
    svg.dataset.duration = String(duration);
    svg.dataset.storyTime=t.toFixed(4);
  }
  function schedule() {
    cancelAnimationFrame(request); request=0; last=null; lastPaint=0;
    paint(); report(); if(running()) request=requestAnimationFrame(tick);
  }
  function tick(now) {
    request=0; if(!running()) { report(); return; }
    elapsed+=last===null?0:Math.min((now-last)/1000,.06); last=now;
    if(elapsed>=duration) { elapsed%=duration; loops++; }
    if(!lastPaint||now-lastPaint>=1000/fps-.5) { paint(); lastPaint=now; }
    if(running()) request=requestAnimationFrame(tick); else report();
  }
  function update(props) {
    if(typeof props.active==='boolean') active=props.active;
    if(typeof props.reducedMotion==='boolean') reduced=props.reducedMotion;
    if(props.bookPalette) {
      for(const [key,value] of Object.entries(props.bookPalette.colors)) if(/^#[0-9a-f]{6}$/i.test(value)) document.documentElement.style.setProperty('--book-'+key,value);
      soft=props.bookPalette.soft===true; svg.dataset.palette=props.bookPalette.name;
    }
    schedule();
  }
  function message(data) {
    if(data?.type==='watcher-art') update(data.props||{});
    if(data?.type==='watcher-art-ready-check') { send({type:'watcher-art-ready'}); reported=null; report(); }
    if(data?.type==='watcher-quality') fps=Math.max(30,Math.min(120,Number(data.targetFps)||60));
  }
  window.WatcherArt={update}; window.WatcherEffects={message};
  window.addEventListener('message',event=>{if(event.source===parent)message(event.data);});
  document.addEventListener('visibilitychange',schedule); systemReduced.addEventListener('change',schedule);
  window.addEventListener('pagehide',()=>{cancelAnimationFrame(request);request=0;});
  paint();send({type:'watcher-art-ready'});report();
})();
