// The approved Matrix sphere/reveal animation, ported from matrix-motion.html.
// SVG paths and their light gradients update together; no React renders per frame.
import { decoderFrame } from '../../../decoderFrame';
interface MotionNode extends SVGElement {
  setAttribute(name: string, value: string | number): void
}
type Pixel = { row: number; column: number; opacity: string; element: MotionNode }
type Ring = { group: MotionNode; gradient: MotionNode; stops: MotionNode[]; lightLevels: number[]; glow: MotionNode; core: MotionNode }
type Circle = { mask: MotionNode; pixels: Pixel[]; solid: MotionNode; halo: MotionNode; shape: MotionNode; outlines: MotionNode[] }
type Scene = {
  diagram: SVGSVGElement; insight: HTMLButtonElement;
  diagramWidth: number; diagramHeight: number; radius: number; sideRadius: number; cx: number; cy: number;
  sideCenters: number[]; connectionRoutes: { start: number; end: number }[];
  pulseGlowFilter: MotionNode; ringGlowFilter: MotionNode;
  shellGradient: MotionNode; rimGradient: MotionNode; sourceAura: MotionNode; revealed: MotionNode;
  axisGradient: MotionNode; axis: MotionNode; guides: MotionNode; connections: MotionNode[];
  sideCircles: Circle[]; sphereGroup: MotionNode; shell: MotionNode; shellHalo: MotionNode; rings: Ring[];
  shellRim: MotionNode; orbitGradient: MotionNode; shellOrbit: MotionNode; shellOrbitGlow: MotionNode; shellOrbitCore: MotionNode;
  insightStart: number; insightSettings: { duration: number; glow: number }; insightMotionKey: string; decodeKey: string;
  glyphs: { el: HTMLElement; symbol: HTMLElement; char: string }[];
}
const ns = 'http://www.w3.org/2000/svg'
const settings = { rotation: 32, light: 0.65, glow: 1.05 }
const timing = { revealCycle: 12.8 }
const make = (tag: string, attributes: Record<string, string | number>, parent: SVGElement) => {
  const element = document.createElementNS(ns, tag) as MotionNode
  Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, String(value)))
  parent.appendChild(element)
  return element
}
const arcPath = (cx: number, cy: number, r: number, from: number, to: number) =>
  `M${cx+Math.cos(from)*r} ${cy+Math.sin(from)*r}A${r} ${r} 0 ${Math.abs(to-from)>Math.PI?1:0} ${to>=from?1:0} ${cx+Math.cos(to)*r} ${cy+Math.sin(to)*r}`
const pathAttrs = { fill: 'none', stroke: 'currentColor', 'stroke-width': 0.7, 'stroke-linecap': 'round' }

export function mountMatrixMotion(diagram: SVGSVGElement, decoder: HTMLButtonElement, index: string, options: { waitForDecoder?: boolean } = {}) {
  diagram.replaceChildren()
  const scene = { diagram, insight: decoder, insightStart: options.waitForDecoder ? Infinity : 4.4, insightSettings: { duration: 3.1, glow: 0.6 },
    decodeKey: '', insightMotionKey: '',
    glyphs: [...decoder.querySelectorAll<HTMLElement>('.mx-code-glyph')].map(el => ({
      el, symbol: el.querySelector<HTMLElement>('.mx-code-symbol')!, char: el.dataset.character ?? '',
    })),
  } as Scene
    const defs = make('defs',{},diagram);
    const glow = make('filter',{id:`mx-halo-${index}`,filterUnits:'userSpaceOnUse',x:-12,y:-12,width:440,height:190},defs);
    scene.pulseGlowFilter = glow;
    make('feGaussianBlur',{stdDeviation:2.3},glow);
    const sphereGlow = make('filter',{id:`mx-sphere-glow-${index}`,x:'-70%',y:'-70%',width:'240%',height:'240%'},defs);
    make('feGaussianBlur',{stdDeviation:3},sphereGlow);
    const wireGlow = make('filter',{id:`mx-wire-glow-${index}`,filterUnits:'userSpaceOnUse',x:-12,y:-12,width:440,height:190},defs);
    scene.ringGlowFilter = wireGlow;
    make('feGaussianBlur',{stdDeviation:1.5},wireGlow);
    [0,1].forEach(side=>{
      const circleFill = make('radialGradient',{id:`mx-circle-fill-${index}-${side}`,cx:side===0?'32%':'68%',cy:'32%',r:'78%'},defs);
      [[0,'#080900'],[0.42,'#111400'],[0.70,'#373900'],[0.90,'#817b00'],[1,'#c7b800']].forEach(([offset,color])=>make('stop',{offset,'stop-color':color},circleFill));
    });
    scene.shellGradient = make('radialGradient',{id:`mx-shell-fill-${index}`,cx:'35%',cy:'28%',r:'78%'},defs);
    [[0,'#f7ec65',0.12],[0.34,'#a79b19',0.07],[0.68,'#454609',0.06],[0.88,'#807910',0.12],[1,'#e0d743',0.20]].forEach(([offset,color,opacity])=>make('stop',{offset,'stop-color':color,'stop-opacity':opacity},scene.shellGradient));
    scene.rimGradient = make('linearGradient',{id:`mx-rim-light-${index}`,gradientUnits:'userSpaceOnUse'},defs);
    [[0,0.05],[0.40,0.12],[0.76,0.65],[1,1]].forEach(([offset,opacity])=>make('stop',{offset,'stop-color':'#fff5a2','stop-opacity':opacity},scene.rimGradient));
    const auraGradient = make('radialGradient',{id:`mx-source-aura-${index}`},defs);
    [[0,0],[0.50,0],[0.62,0.045],[0.72,0.34],[0.80,0.20],[0.90,0.06],[1,0]].forEach(([offset,opacity])=>make('stop',{offset,'stop-color':'#eee532','stop-opacity':opacity},auraGradient));
    scene.sourceAura = make('circle',{fill:`url(#mx-source-aura-${index})`,'data-emission':'local-aura'},diagram);
    scene.revealed = make('g',{'data-revealed-by':'sphere','data-reveal-style':'pixel-assembly'},diagram);
    const axisGradient = make('linearGradient',{id:`mx-axis-${index}`,gradientUnits:'userSpaceOnUse',x1:0,x2:400},defs);
    scene.axisGradient = axisGradient;
    [[0,0],[0.08,0.60],[0.25,0.85],[0.5,0.95],[0.75,0.85],[0.92,0.60],[1,0]].forEach(([offset,opacity]) => make('stop',{offset,'stop-color':'currentColor','stop-opacity':opacity},axisGradient));
    scene.axis = make('path',{fill:'none',stroke:`url(#mx-axis-${index})`,'stroke-width':1.1,opacity:0},scene.revealed);
    scene.guides = make('g',{opacity:0,stroke:'currentColor','stroke-width':0.9,fill:'none','data-ornament':'reference-reticle'},scene.revealed);
    scene.connections = [0,1].map(side=>make('path',{d:'',fill:'none',stroke:'currentColor','stroke-width':1,'stroke-linecap':'butt',visibility:'hidden','data-connection':side},scene.revealed));
    scene.sideCircles = [0,1].map(side=>{
      const mask=make('mask',{id:`mx-fill-assembly-${index}-${side}`,maskUnits:'userSpaceOnUse',maskContentUnits:'userSpaceOnUse',style:'mask-type:alpha'},defs);
      const pixels=Array.from({length:64},(_,i)=>({
        row:Math.floor(i/8),column:i%8,opacity:'0',
        element:make('rect',{fill:'#ffffff',opacity:0,'data-pixel':i},mask)
      }));
      const solid=make('rect',{fill:'#ffffff',opacity:0,'data-pixel-fusion':'solid'},mask);
      return {
        mask,pixels,solid,
        halo:make('circle',{fill:'none',stroke:'currentColor','stroke-width':2,opacity:0,filter:`url(#mx-halo-${index})`},scene.revealed),
        shape:make('circle',{fill:`url(#mx-circle-fill-${index}-${side})`,mask:`url(#mx-fill-assembly-${index}-${side})`,'data-shape':'circle','data-side':side===0?'left':'right'},scene.revealed),
        outlines:[0,1].map(half=>make('path',{d:'',fill:'none',stroke:'currentColor','stroke-width':1.05,'stroke-linecap':'butt',visibility:'hidden','data-outline-half':`${side}-${half}`},scene.revealed))
      };
    });
    scene.sphereGroup = make('g',{'data-motion':'scan-and-meridian'},diagram);
    scene.shell = make('circle',{fill:`url(#mx-shell-fill-${index})`,stroke:'currentColor','stroke-width':0.8,'stroke-opacity':0.66,'data-shape':'sphere'},scene.sphereGroup);
    scene.shellHalo = make('circle',{fill:'none',stroke:`url(#mx-rim-light-${index})`,'stroke-width':4.5,opacity:0.8,filter:`url(#mx-sphere-glow-${index})`,'data-emission':'rim'},scene.sphereGroup);
    scene.rings = [0,1].map(i=>{
      const group=make('g',{'data-inner-ring':i+1,'data-ring-plane':i===0?'vertical':'horizontal','data-ring-motion':i===0?'rotate':'scan'},scene.sphereGroup);
      const gradient=make('linearGradient',{id:`mx-ring-depth-${index}-${i}`,gradientUnits:'userSpaceOnUse','data-ring-light':i+1},defs);
      const lightLevels=[0.23,0.31,0.53,0.82,1];
      const stops=lightLevels.map((level,j)=>make('stop',{offset:j/4,'stop-color':i===0?'#f9ee86':'#fff4a5','stop-opacity':level},gradient));
      return {
        group,gradient,stops,lightLevels,
        glow:make('path',{...pathAttrs,stroke:`url(#mx-ring-depth-${index}-${i})`,'stroke-width':3.2,opacity:0.6,filter:`url(#mx-wire-glow-${index})`,'data-emission':'ring'},group),
        core:make('path',{...pathAttrs,stroke:`url(#mx-ring-depth-${index}-${i})`,'stroke-width':i===0?1.15:1.3,'data-ring-core':i+1},group)
      };
    });
    scene.shellRim = make('circle',{fill:'none',stroke:`url(#mx-rim-light-${index})`,'stroke-width':1.35,'data-shell-light':'synchronized'},scene.sphereGroup);
    scene.orbitGradient=make('linearGradient',{id:`mx-orbit-fade-${index}`,gradientUnits:'userSpaceOnUse'},defs);
    [[0,0],[0.18,0.3],[0.45,0.85],[0.72,1],[0.92,0.45],[1,0]].forEach(([offset,opacity])=>make('stop',{offset,'stop-color':'#fff6af','stop-opacity':opacity},scene.orbitGradient));
    scene.shellOrbit = make('g',{'data-shell-motion':'orbiting-arc'},scene.sphereGroup);
    scene.shellOrbitGlow = make('path',{fill:'none',stroke:`url(#mx-orbit-fade-${index})`,'stroke-width':3.6,filter:`url(#mx-wire-glow-${index})`,opacity:0.75},scene.shellOrbit);
    scene.shellOrbitCore = make('path',{fill:'none',stroke:`url(#mx-orbit-fade-${index})`,'stroke-width':1.5,'stroke-linecap':'round',opacity:1},scene.shellOrbit);

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
  let clock = 0, last = 0, raf = 0
  let decoderVisible = false, decoderStarted = false, decoderElapsed = 0
  let paused = false, inView = true, disposed = false
  function decoderTime() { if (options.waitForDecoder) scene.insightStart = decoderStarted ? clock - decoderElapsed : Infinity }
  const running = () => !disposed && !paused && inView && !document.hidden && !reduced.matches
  function tick(now: number) {
    raf = 0
    if (!running()) { last = 0; return }
    if (last) {
      const elapsed = Math.min((now-last)/1000, 0.06)
      clock += elapsed
      if (decoderStarted && decoderVisible) decoderElapsed += elapsed
    }
    decoderTime()
    last = now
    draw(scene, clock, true)
    raf = requestAnimationFrame(tick)
  }
  function sync() {
    if (disposed) return
    if (reduced.matches) draw(scene, 5, false)
    if (running() && !raf) { last = 0; raf = requestAnimationFrame(tick) }
    if (!running()) { cancelAnimationFrame(raf); raf = 0; last = 0 }
  }
  function resize() {
    if (disposed) return
    layout(scene)
    draw(scene, reduced.matches ? 5 : clock, !reduced.matches)
    sync()
  }
  const resizeObserver = new ResizeObserver(resize)
  const intersections = new Map<Element, boolean>()
  const visibility = new IntersectionObserver(entries => {
    entries.forEach(entry => intersections.set(entry.target, entry.isIntersecting))
    inView = [...intersections.values()].some(Boolean)
    sync()
  })
  resizeObserver.observe(diagram)
  visibility.observe(diagram)
  visibility.observe(decoder)
  const replayDecoder = () => {
    if (options.waitForDecoder && !decoderVisible) return
    decoderStarted = true; decoderElapsed = 0; scene.insightStart = clock
    drawInsight(scene, clock, !reduced.matches); sync()
  }
  decoder.addEventListener('click', replayDecoder)
  document.addEventListener('visibilitychange', sync)
  reduced.addEventListener('change', sync)
  resize()
  return {
    setPaused(value: boolean) { paused = value; sync() },
    setDecoderVisible(value: boolean) {
      decoderVisible = value
      if (value && !decoderStarted) { decoderStarted = true; decoderElapsed = 0 }
      decoderTime(); drawInsight(scene, clock, !reduced.matches); sync()
    },
    replay() { clock = 0; last = 0; decoderElapsed = 0; decoderStarted = decoderVisible; scene.insightStart = options.waitForDecoder ? decoderVisible ? 0 : Infinity : 4.4; resize() },
    dispose() {
      disposed = true
      cancelAnimationFrame(raf)
      resizeObserver.disconnect()
      visibility.disconnect()
      document.removeEventListener('visibilitychange', sync)
      reduced.removeEventListener('change', sync)
      decoder.removeEventListener('click', replayDecoder)
      diagram.replaceChildren()
    },
  }
}
  function layout(scene: Scene) {
    const w = scene.diagram.clientWidth || 360;
    const h = scene.diagram.clientHeight || 164;
    scene.diagramWidth = w;
    scene.diagramHeight = h;
    scene.diagram.setAttribute('viewBox',`0 0 ${w} ${h}`);
    [scene.pulseGlowFilter,scene.ringGlowFilter].forEach(filter=>Object.entries({width:w+24,height:h+24}).forEach(([k,v])=>filter.setAttribute(k,v)));
      // Smaller spheres span the same full-width diagram; motion timings stay intact.
      scene.radius = w*0.07;
    scene.sideRadius = scene.radius*0.62;
    scene.cx = w/2;
      const spacing = Math.min(w/2-scene.sideRadius-12,w*0.37);
    scene.sideCenters = [scene.cx-spacing,scene.cx+spacing];
    scene.cy = h/2;
    const {cx,cy,radius:r,sideRadius:sr,sideCenters:[left,right]} = scene;
    const routeRadius = sr + 0.65;
    scene.axis.setAttribute('d',`M0 ${cy}H${left-routeRadius}M${left+routeRadius} ${cy}H${cx-r}M${cx+r} ${cy}H${right-routeRadius}M${right+routeRadius} ${cy}H${w}`);
    scene.axisGradient.setAttribute('x2',w);
    scene.sideCircles.forEach((circle,side)=>{
      const x=scene.sideCenters[side];
      [circle.shape,circle.halo].forEach(el=>Object.entries({cx:x,cy,r:sr}).forEach(([k,v])=>el.setAttribute(k,v)));
      Object.entries({x:x-sr,y:cy-sr,width:sr*2,height:sr*2}).forEach(([k,v])=>circle.mask.setAttribute(k,v));
      Object.entries({x:x-sr,y:cy-sr,width:sr*2,height:sr*2}).forEach(([k,v])=>circle.solid.setAttribute(k,v));
      const cellSize=sr*2/8;
      const gap=Math.min(0.28,cellSize*0.04);
      circle.pixels.forEach(pixel=>Object.entries({
        x:x-sr+pixel.column*cellSize+gap/2,
        y:cy-sr+pixel.row*cellSize+gap/2,
        width:cellSize-gap,height:cellSize-gap
      }).forEach(([k,v])=>pixel.element.setAttribute(k,v)));
    });
    scene.connectionRoutes=[{start:cx-r,end:left+sr},{start:cx+r,end:right-sr}];
    [scene.shell,scene.shellHalo,scene.shellRim].forEach(el=>Object.entries({cx,cy,r}).forEach(([k,v])=>el.setAttribute(k,v)));
    Object.entries({cx,cy,r:r*1.4}).forEach(([k,v])=>scene.sourceAura.setAttribute(k,v));
    scene.guides.replaceChildren();
    const square=(x: number,y: number,size: number,parent: MotionNode,opacity=1)=>make('rect',{x:x-size/2,y:y-size/2,width:size,height:size,fill:'#030402',opacity},parent);
    const outerLength=left-sr;
    [outerLength*0.42,w-outerLength*0.42].forEach(x=>square(x,cy,3.8,scene.guides));
    [outerLength*0.76,w-outerLength*0.76].forEach(x=>make('path',{d:`M${x} ${cy-3}V${cy+3}`,opacity:0.75},scene.guides));
    [left,right].forEach((x,side)=>{
      const reticle=make('g',{'data-side-ornament':side,opacity:0.8},scene.guides);
      [[-1.33,-0.28],[0.15,1.13],[1.78,2.78],[3.35,4.36]].forEach(([from,to])=>make('path',{d:arcPath(x,cy,sr+5.5,from,to),'stroke-width':0.75,opacity:0.62},reticle));
      [-1,1].forEach(sign=>{
        square(x,cy+sign*(sr+7),2.2,reticle,0.95);
        make('path',{d:`M${x+sign*(sr+3)} ${cy-3}V${cy+3}`,'stroke-width':1},reticle);
      });
      const direction=side===0?1:-1;
      const start=x+direction*(sr+8),end=cx-direction*(r+8);
      const gap=end-start;
      square(start+gap*0.52,cy,2.7,scene.guides,0.95);
      [0.12,0.86].forEach((fraction,i)=>{
        const px=start+gap*fraction;
        make('path',{d:`M${px} ${cy-3.5}V${cy+3.5}M${px-2} ${cy+(i===0?-6:6)}H${px+2}`,opacity:0.7,'stroke-width':0.8},scene.guides);
      });
    });
    [-1,1].forEach(sign=>{
      const y1=cy+sign*(r+6),y2=cy+sign*(r+23);
      make('path',{d:`M${cx} ${y1}V${y2}`,'stroke-dasharray':'1.5 3','stroke-width':0.85,opacity:0.8},scene.guides);
      square(cx,cy+sign*(r+14),2.8,scene.guides,1);
    });
    [[-1.32,-0.82],[0.22,0.72],[1.82,2.32],[3.36,3.86]].forEach(([from,to])=>make('path',{d:arcPath(cx,cy,r+7,from,to),'stroke-width':0.7,opacity:0.48},scene.guides));
  }
  function sphere(scene: Scene,angle: number) {
    // A horizontal spherical cross-section scans vertically; the meridian rotates independently.
    const pitch=0.27,cp=Math.cos(pitch),sp=Math.sin(pitch);
    const scanHeight=0.76*Math.sin(angle*2);
    const scanRadius=Math.sqrt(1-scanHeight*scanHeight);
    const yaw=angle+0.52;
    scene.rings.forEach((ring,index)=>{
      const project=(theta: number)=>{
        const u=Math.cos(theta),v=Math.sin(theta);
        const point=index===0
          ? {x:v*Math.sin(yaw),y:u,z:v*Math.cos(yaw)}
          : {x:u*scanRadius,y:scanHeight,z:v*scanRadius};
        return {
          x:scene.cx+point.x*scene.radius*0.97,
          y:scene.cy+(point.y*cp-point.z*sp)*scene.radius*0.97,
          z:point.y*sp+point.z*cp
        };
      };
      const points: string[]=[];
      for(let i=0;i<128;i++) {
        const point=project(i*Math.PI*2/128);
        points.push(`${i===0?'M':'L'}${point.x.toFixed(3)} ${point.y.toFixed(3)}`);
      }
      const geometry=points.join(' ')+' Z';
      ring.core.setAttribute('d',geometry);
      ring.glow.setAttribute('d',geometry);
      // The light uses the same projected ring and frame; no front/back path seam.
      const depthU=index===0?sp:0;
      const depthV=index===0?Math.cos(yaw)*cp:scanRadius*cp;
      const nearAngle=Math.atan2(depthV,depthU);
      const near=project(nearAngle),far=project(nearAngle+Math.PI);
      const span=Math.hypot(near.x-far.x,near.y-far.y);
      const halfSpan=Math.max(span/2,scene.radius*0.12);
      const ux=span>0.00001?(near.x-far.x)/span:0;
      const uy=span>0.00001?(near.y-far.y)/span:1;
      const midX=(near.x+far.x)/2,midY=(near.y+far.y)/2;
      Object.entries({x1:midX-ux*halfSpan,y1:midY-uy*halfSpan,x2:midX+ux*halfSpan,y2:midY+uy*halfSpan}).forEach(([key,value])=>ring.gradient.setAttribute(key,value));
      const soften=(value: number)=>{const p=Math.max(0,Math.min(1,value));return p*p*(3-2*p)};
      const contrast=soften(span/(scene.radius*0.35))*soften(Math.hypot(depthU,depthV)/0.4);
      ring.stops.forEach((stop,i)=>stop.setAttribute('stop-opacity',0.65+(ring.lightLevels[i]-0.65)*contrast));
      if(index===1)ring.group.setAttribute('data-scan-height',scanHeight.toFixed(3));
    });
    const direction=angle*2-Math.PI*0.65;
    const dx=Math.cos(direction)*scene.radius,dy=Math.sin(direction)*scene.radius;
    Object.entries({x1:scene.cx-dx,y1:scene.cy-dy,x2:scene.cx+dx,y2:scene.cy+dy}).forEach(([name,value])=>scene.rimGradient.setAttribute(name,value));
    scene.shellGradient.setAttribute('cx',`${50+Math.cos(direction)*24}%`);
    scene.shellGradient.setAttribute('cy',`${50+Math.sin(direction)*24}%`);
    const arcStart=direction-0.74,arcEnd=direction+0.12;
    const startX=scene.cx+Math.cos(arcStart)*scene.radius,startY=scene.cy+Math.sin(arcStart)*scene.radius;
    const endX=scene.cx+Math.cos(arcEnd)*scene.radius,endY=scene.cy+Math.sin(arcEnd)*scene.radius;
    const arc=`M${startX} ${startY}A${scene.radius} ${scene.radius} 0 0 1 ${endX} ${endY}`;
    scene.shellOrbitGlow.setAttribute('d',arc);
    scene.shellOrbitCore.setAttribute('d',arc);
    Object.entries({x1:startX,y1:startY,x2:endX,y2:endY}).forEach(([key,value])=>scene.orbitGradient.setAttribute(key,value));
  }
  function drawInsight(scene: Scene,t: number,moving: boolean) {
    const elapsed=t-scene.insightStart;
    const { waiting, progress:p, opacity }=decoderFrame(t,scene.insightStart,moving,scene.insightSettings.duration);
    const smooth=(a: number,b: number,v: number)=>{const q=Math.max(0,Math.min(1,(v-a)/(b-a)));return q*q*(3-2*q)};
    const settled=smooth(0.36,0.92,p);
    const active=!waiting&&p<1;
    const el=scene.insight;
    const state=waiting?'waiting':active?'revealing':'settled';
    const motionKey=state+':'+p.toFixed(3)+':'+scene.insightSettings.glow.toFixed(3);
    if(scene.insightMotionKey===motionKey)return;
    scene.insightMotionKey=motionKey;
    el.dataset.motionState=state;
    el.style.visibility=waiting?'hidden':'visible';
    el.style.opacity=String(opacity);
    el.style.setProperty('--iw-light',(scene.insightSettings.glow*(0.35+settled*0.65)).toFixed(3));
    el.style.setProperty('--iw-scan',(smooth(0.08,0.95,p)*100).toFixed(2)+'%');
    el.style.setProperty('--iw-scan-opacity',(active?Math.sin(p*Math.PI)*0.9:0).toFixed(3));
    if(scene.glyphs.length) {
      const locked=Math.floor(smooth(0.1,0.95,p)*scene.glyphs.length);
      const phase=Math.floor(Math.max(0,elapsed)*7);
      const key=waiting?'waiting':p===1?'settled':locked+':'+phase;
      if(key!==scene.decodeKey) {
        scene.decodeKey=key;
        const symbols=['0','1','┐','└','─','·'];
        scene.glyphs.forEach(({el,symbol,char},i)=>{
          const isLocked=waiting||i<locked||p===1;
          symbol.textContent=isLocked?char:symbols[(i*5+phase+Math.floor(i/3))%symbols.length];
          el.dataset.locked=String(isLocked);
          el.dataset.active=String(!waiting&&i===locked&&p<1);
        });
      }
    }
  }
  function draw(scene: Scene,t: number,moving: boolean) {
    sphere(scene,t/settings.rotation*Math.PI*2+0.32);
    drawInsight(scene,t,moving);
    const smooth=(a: number,b: number,value: number)=>{const u=Math.max(0,Math.min(1,(value-a)/(b-a)));return u*u*(3-2*u)};
    const phase=t%timing.revealCycle;
    const fade=moving?1-smooth(10.3,12.6,phase):1;
    const connection=moving?smooth(0.3,1.15,phase):1;
    const contour=moving?smooth(1.05,2.7,phase):1;
    const filled=moving?smooth(2.65,4.3,phase):1;
    const ornament=moving?smooth(2.4,3.9,phase):1;
    scene.revealed.setAttribute('opacity',fade);
    scene.axis.setAttribute('opacity',ornament*0.92);
    scene.guides.setAttribute('opacity',ornament*0.82);
    scene.connections.forEach((path,side)=>{
      const route=scene.connectionRoutes[side];
      path.setAttribute('d',connection>0.001?`M${route.start} ${scene.cy}H${route.start+(route.end-route.start)*connection}`:'');
      path.setAttribute('visibility',connection>0.001?'visible':'hidden');
      path.setAttribute('opacity',(0.4+settings.light*0.25)*smooth(0,0.04,connection));
    });
    scene.sideCircles.forEach((circle,side)=>{
      circle.outlines.forEach((path,half)=>{
        const start=side===0?0:Math.PI;
        const end=start+(half===0?-1:1)*Math.PI*contour;
        path.setAttribute('d',contour>0.001?arcPath(scene.sideCenters[side],scene.cy,scene.sideRadius,start,end):'');
        path.setAttribute('visibility',contour>0.001?'visible':'hidden');
        path.setAttribute('opacity',smooth(0,0.04,contour));
      });
      circle.halo.setAttribute('opacity',filled*0.22);
      circle.solid.setAttribute('opacity',moving?smooth(4.05,4.85,phase):1);
      circle.pixels.forEach(pixel=>{
        const depth=side===0?7-pixel.column:pixel.column;
        const stagger=(pixel.row+depth)%2*0.035;
        const start=2.65+depth*0.12+Math.abs(pixel.row-3.5)*0.075+stagger;
        const opacity=(moving?smooth(start,start+0.3,phase):1).toFixed(3);
        if(opacity!==pixel.opacity){
          pixel.element.setAttribute('opacity',opacity);
          pixel.opacity=opacity;
        }
      });
    });
    const charge=moving&&phase<2?Math.sin(Math.PI*phase/2):0;
    const emission=settings.glow*(1+0.12*charge);
    scene.shellHalo.setAttribute('opacity',Math.min(1,0.78*emission));
    scene.rings.forEach(ring=>ring.glow.setAttribute('opacity',Math.min(0.85,0.52*emission)));
    scene.sourceAura.setAttribute('opacity',Math.min(1,emission*0.95));
    scene.shellOrbit.setAttribute('opacity',Math.min(1,0.65+emission*0.25));
  }
