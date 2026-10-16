import type { SynchronizationSettings } from './synchronizationSettings'
import { synchronizationTimeAtPhase } from './synchronizationSettings'

type SynchronizationPoint = [number, number]
type SynchronizationPalette = { ink: string; warm: string }
function synchronizationSelect(root: ParentNode, selector: string): SVGElement {
  const element = root.querySelector<SVGElement>(selector)
  if (!element) throw new Error('Missing synchronization layer: ' + selector)
  return element
}

/** SVG layers ported from the approved Live Matrix concept. No React updates per frame. */
function createLiveMatrix(svg: SVGSVGElement, id: string, palette: SynchronizationPalette) {
  const clamp=(v: number,a=0,b=1)=>Math.min(b,Math.max(a,v));
  const ease=(a: number,b: number,t: number)=>{const q=clamp((t-a)/(b-a));return q*q*(3-2*q);};
  const attr=(el: Element,key: string,value: string | number)=>el.setAttribute(key,typeof value==='number'?value.toFixed(3):value);
  const poly=(points: readonly (readonly number[])[])=>`M${points.map(([x,y])=>`${x.toFixed(3)} ${y.toFixed(3)}`).join('L')}`;
  const order=[[4,0],[3,0],[3,1],[3,2],[2,2],[1,2],[1,3],[1,4],[0,4]];
  const centers: { r: number; c: number; x: number; y: number; step: number }[]=[],routeIndices=order.map(([r,c])=>r*5+c);
  for(let r=0;r<5;r++)for(let c=0;c<5;c++)centers.push({r,c,x:144+(c-r)*23,y:35+(c+r)*10,step:order.findIndex(p=>p[0]===r&&p[1]===c)});
  const outerY=21*10/23,innerY=15*10/23;
  const tiles=centers.map(({r,c,x,y},i)=>`<g class="matrix-tile" data-index="${i}" data-row="${r}" data-col="${c}" opacity="0"><path class="matrix-top" d="M${x-21} ${y}L${x} ${y-outerY}L${x+21} ${y}L${x} ${y+outerY}Z" fill="currentColor" fill-opacity=".035"/><path d="M${x-21} ${y}v4l21 ${outerY} 21 ${-outerY}v-4M${x} ${y+outerY}v4" opacity=".22"/><path class="matrix-inset" d="M${x-15} ${y}l15 ${-innerY} 15 ${innerY}-15 ${innerY}Z" stroke-width=".45" opacity=".2"/></g>`);
  const backgroundTiles=tiles.filter((_,i)=>centers[i].step<0).join(''),platformTiles=tiles.filter((_,i)=>centers[i].step>=0).join('');
  svg.innerHTML=`<defs><radialGradient id="${id}-energy"><stop stop-color="${palette.warm}" stop-opacity=".8"/><stop offset=".16" stop-color="${palette.ink}" stop-opacity=".32"/><stop offset="1" stop-color="${palette.ink}" stop-opacity="0"/></radialGradient><filter id="${id}-bloom" x="-150%" y="-150%" width="400%" height="400%"><feGaussianBlur stdDeviation="3"/></filter></defs><g class="matrix-system"><g class="matrix-foundation" opacity="0"><path d="M39 102L144 147 251 101M34 70h9m-4-4v8M251 67h9m-4-4v8" opacity=".22"/></g>${backgroundTiles}</g><g class="matrix-platforms">${platformTiles}<path class="matrix-route" stroke="${palette.warm}" opacity="0"/></g><g class="matrix-source" data-energy="" opacity="0"><circle r="15" fill="url(#${id}-energy)" stroke="none"/><circle r="4" fill="${palette.warm}" stroke="none" opacity=".45" filter="url(#${id}-bloom)"/><circle r="1.45" fill="${palette.warm}" stroke="none"/><path d="M-5 0H5M0-2.5V2.5" stroke="${palette.warm}" opacity=".25" stroke-width=".55"/></g>`;
  const tilesEl=centers.map((_,i)=>synchronizationSelect(svg,`[data-index="${i}"]`)),tops=tilesEl.map(el=>synchronizationSelect(el,'.matrix-top')),insets=tilesEl.map(el=>synchronizationSelect(el,'.matrix-inset'));
  const foundation=synchronizationSelect(svg,'.matrix-foundation'),system=synchronizationSelect(svg,'.matrix-system'),platforms=synchronizationSelect(svg,'.matrix-platforms'),route=synchronizationSelect(svg,'.matrix-route'),source=synchronizationSelect(svg,'.matrix-source');
  const applyBrightness=(el: SVGElement,value: number)=>{el.style.opacity=String(Math.min(1,value/100));el.style.filter=value>100?`brightness(${value/100})`:'none';};
  let lastBrightness: number | undefined, lastPlatformBrightness: number | undefined, lastStroke: number | undefined, lastAmount: number | undefined; let points: number[][] = [];
  return (t: number,settings: SynchronizationSettings)=>{
    const amount=clamp(settings.amount,.5,12),brightness=clamp(settings.brightness??100,0,200),platformBrightness=clamp(settings.platformBrightness??100,0,200);
    if(brightness!==lastBrightness){applyBrightness(system,brightness);lastBrightness=brightness;}
    if(platformBrightness!==lastPlatformBrightness){applyBrightness(platforms,platformBrightness);lastPlatformBrightness=platformBrightness;}
    if(settings.stroke!==lastStroke){svg.style.strokeWidth=String(settings.stroke);lastStroke=settings.stroke;}
    const elevation=3.5*amount;
    // A fixed isometric path: moving platforms never steer the light.
    if(amount!==lastAmount){points=routeIndices.map(i=>[centers[i].x,centers[i].y-elevation]);lastAmount=amount;}
    const fade=1-ease(.91,.995,t),ignition=ease(.06,.14,t),progress=clamp((t-.16)/.54);
    const travelled=progress*(order.length-1);
    centers.forEach((cell,i)=>{
      const isPlatform=cell.step>=0;
      // Settle before the light crosses the platform edge (0.45 cell from its center).
      const rise=!isPlatform?0:cell.step===0?ease(.005,.055,t):ease(cell.step-1.10,cell.step-.50,travelled);
      const visible=!isPlatform?ease(.70+(cell.r+4-cell.c)*.008,.765+(cell.r+4-cell.c)*.008,t):cell.step===0?ease(.085,.155,t):ease(cell.step-.65,cell.step-.15,travelled);
      const height=rise*elevation;
      attr(tilesEl[i],'transform',`translate(0 ${(-height).toFixed(3)})`);
      attr(tilesEl[i],'opacity',visible*fade*(isPlatform?.94:.62));
      attr(tops[i],'fill-opacity',isPlatform?.14:.035);
      attr(insets[i],'opacity',isPlatform?.61:.14);
    });
    const segment=Math.min(order.length-2,Math.floor(travelled)),fraction=travelled-segment;
    const from=points[segment],to=points[segment+1];
    const position=[from[0]+(to[0]-from[0])*fraction,from[1]+(to[1]-from[1])*fraction];
    // Both the visible trail and light use this exact, unchanging centerline.
    attr(route,'d',poly([...points.slice(0,segment+1),position]));
    attr(route,'opacity',ignition*fade*.65);
    attr(foundation,'opacity',ease(.76,.84,t)*fade);
    attr(source,'transform',`translate(${position[0].toFixed(3)} ${position[1].toFixed(3)})`);
    attr(source,'opacity',ignition*fade);
    svg.dataset.phase=t.toFixed(4);
  };
}

export function createSynchronizedMatrix(svg: SVGSVGElement, id: string, palette: SynchronizationPalette) {
  const drawWalk=createLiveMatrix(svg,id,palette),ns='http://www.w3.org/2000/svg';
  const clamp=(v: number,a=0,b=1)=>Math.min(b,Math.max(a,v)),mix=(a: number,b: number,p: number)=>a+(b-a)*p;
  const ease=(a: number,b: number,t: number)=>{const p=clamp((t-a)/(b-a));return p*p*(3-2*p);};
  const attr=(el: Element,key: string,value: string | number)=>el.setAttribute(key,typeof value==='number'?value.toFixed(3):value);
  const poly=(points: readonly (readonly number[])[])=>`M${points.map(([x,y])=>`${x.toFixed(3)} ${y.toFixed(3)}`).join('L')}`;
  const brightness=(el: SVGElement,value: number)=>{el.style.opacity=String(Math.min(1,value/100));el.style.filter=value>100?`brightness(${value/100})`:'none';};
  const system=synchronizationSelect(svg,'.matrix-system'),platforms=synchronizationSelect(svg,'.matrix-platforms'),source=synchronizationSelect(svg,'.matrix-source'),route=synchronizationSelect(svg,'.matrix-route'),foundation=synchronizationSelect(svg,'.matrix-foundation');
  const tiles=[...svg.querySelectorAll<SVGElement>('.matrix-tile')],camera=document.createElementNS(ns,'g'),remaining=document.createElementNS(ns,'g');
  camera.setAttribute('class','matrix-camera');remaining.setAttribute('class','matrix-unsynchronized');
  svg.insertBefore(camera,system);camera.append(remaining);remaining.append(system,platforms);
  const project=(x: number,y: number): SynchronizationPoint=>[144+(x-y)*23,25+(x+y)*10];
  const corners=[project(0,0),project(5,0),project(5,5),project(0,5)];
  const order=[[4,0],[3,0],[3,1],[3,2],[2,2],[1,2],[1,3],[1,4],[0,4]];
  const timing={arrival:.32,revealEnd:.365,lowerStart:.385,lowerEnd:.465,syncStart:.465,syncEnd:.585,liftStart:.605,liftEnd:.70,projectStart:.72,projectEnd:.77,fadeStart:.94,fadeEnd:.999};
  const routeStart=.16*timing.arrival/.70,routeDuration=timing.arrival-routeStart;
  const planeRatio=10/23,waveOrigin=[236,75],waveReach=Math.max(...corners.map(([x,y])=>Math.hypot(x-waveOrigin[0],(y-waveOrigin[1])/planeRatio)))+18;
  const defs=synchronizationSelect(svg,'defs');
  defs.insertAdjacentHTML('beforeend',`<linearGradient id="${id}-trail" class="matrix-trail-gradient" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="1" y2="0"><stop stop-color="${palette.warm}" stop-opacity="0"/><stop offset=".25" stop-color="${palette.warm}" stop-opacity=".04"/><stop offset=".6" stop-color="${palette.warm}" stop-opacity=".22"/><stop offset=".85" stop-color="${palette.warm}" stop-opacity=".55"/><stop offset="1" stop-color="${palette.warm}"/></linearGradient><linearGradient id="${id}-projection" class="matrix-projection-gradient" gradientUnits="userSpaceOnUse" x1="144" y1="25" x2="144" y2="129"><stop stop-color="${palette.warm}" stop-opacity=".34"/><stop offset=".14" stop-color="${palette.ink}" stop-opacity=".21"/><stop offset=".64" stop-color="${palette.ink}" stop-opacity=".065"/><stop offset="1" stop-color="${palette.ink}" stop-opacity="0"/></linearGradient><radialGradient id="${id}-projection-pool"><stop stop-color="${palette.warm}" stop-opacity=".75"/><stop offset=".35" stop-color="${palette.ink}" stop-opacity=".4"/><stop offset="1" stop-color="${palette.ink}" stop-opacity="0"/></radialGradient><radialGradient id="${id}-projected-lines" gradientUnits="userSpaceOnUse" cx="144" cy="75" r="112" gradientTransform="translate(0 40.5) scale(1 .46)"><stop stop-color="${palette.warm}"/><stop offset=".5" stop-color="${palette.warm}" stop-opacity=".6"/><stop offset="1" stop-color="${palette.ink}" stop-opacity="0"/></radialGradient><filter id="${id}-projection-soft" x="-25%" y="-40%" width="150%" height="180%"><feGaussianBlur stdDeviation="1.8"/></filter><clipPath id="${id}-projection-floor"><path d="${poly(corners)}Z"/></clipPath>`);
  const trailGradient=synchronizationSelect(defs,'.matrix-trail-gradient'),projectionGradient=synchronizationSelect(defs,'.matrix-projection-gradient');
  const waveTransform=`translate(0 ${75*(1-planeRatio)}) scale(1 ${planeRatio})`;
  defs.insertAdjacentHTML('beforeend',`<radialGradient id="${id}-sync-reveal-gradient" class="matrix-sync-reveal-gradient" gradientUnits="userSpaceOnUse" cx="236" cy="75" r=".001" gradientTransform="${waveTransform}"><stop stop-color="white"/><stop class="matrix-sync-reveal-feather" offset="0" stop-color="white"/><stop offset="1" stop-color="white" stop-opacity="0"/></radialGradient><radialGradient id="${id}-sync-remaining-gradient" class="matrix-sync-remaining-gradient" gradientUnits="userSpaceOnUse" cx="236" cy="75" r=".001" gradientTransform="${waveTransform}"><stop stop-color="white" stop-opacity="0"/><stop class="matrix-sync-remaining-feather" offset="0" stop-color="white" stop-opacity="0"/><stop offset="1" stop-color="white"/></radialGradient><mask id="${id}-sync-reveal" maskUnits="userSpaceOnUse" x="0" y="0" width="288" height="160" style="mask-type:alpha"><rect width="288" height="160" fill="url(#${id}-sync-reveal-gradient)"/></mask><mask id="${id}-sync-remaining" maskUnits="userSpaceOnUse" x="0" y="0" width="288" height="160" style="mask-type:alpha"><rect width="288" height="160" fill="url(#${id}-sync-remaining-gradient)"/></mask>`);
  const revealGradient=synchronizationSelect(defs,'.matrix-sync-reveal-gradient'),remainingGradient=synchronizationSelect(defs,'.matrix-sync-remaining-gradient');
  const revealFeather=synchronizationSelect(defs,'.matrix-sync-reveal-feather'),remainingFeather=synchronizationSelect(defs,'.matrix-sync-remaining-feather');
  route.setAttribute('stroke',`url(#${id}-trail)`);
  const projection=document.createElementNS(ns,'g');projection.setAttribute('class','matrix-projection');projection.setAttribute('opacity','0');
  projection.innerHTML=`<path class="matrix-projection-volume" fill="url(#${id}-projection)" stroke="none" filter="url(#${id}-projection-soft)"/><path class="matrix-projection-core" fill="url(#${id}-projection)" stroke="none" opacity=".65" filter="url(#${id}-projection-soft)"/>`;
  svg.insertBefore(projection,camera);
  const volume=synchronizationSelect(projection,'.matrix-projection-volume'),core=synchronizationSelect(projection,'.matrix-projection-core');
  const guides=document.createElementNS(ns,'g');guides.setAttribute('class','matrix-projection-guides');guides.setAttribute('opacity','0');
  guides.innerHTML=corners.map(()=>`<path fill="none" stroke="${palette.warm}" stroke-width=".65" stroke-dasharray="2.2 4" stroke-linecap="round"/>`).join('');
  svg.insertBefore(guides,source);
  const lines=[];
  for(let i=0;i<=5;i++){lines.push([project(i,0),project(i,5)]);lines.push([project(0,i),project(5,i)]);}
  const mesh=lines.map(points=>`<path d="${poly(points)}"/>`).join('');
  const unified=document.createElementNS(ns,'g');unified.setAttribute('class','matrix-unified');
  unified.setAttribute('mask',`url(#${id}-sync-reveal)`);
  unified.innerHTML=`<g class="matrix-unified-level"><path d="${poly(corners)}Z" fill="currentColor" fill-opacity=".025" stroke="none"/><g class="matrix-projection-pool" opacity="0" clip-path="url(#${id}-projection-floor)"><ellipse cx="144" cy="75" rx="114" ry="49" fill="url(#${id}-projection-pool)" stroke="none"/></g><g class="matrix-unified-lines">${mesh}</g><g class="matrix-projected-lines" opacity="0" stroke="url(#${id}-projected-lines)" stroke-width="1.1">${mesh}</g><path d="M29 75v4l115 50 115-50v-4M144 125v4" opacity=".28"/></g>`;
  camera.append(unified);
  const pulse=document.createElementNS(ns,'g');pulse.setAttribute('class','matrix-sync-pulse');
  pulse.innerHTML=`<g clip-path="url(#${id}-projection-floor)"><ellipse class="matrix-sync-wave matrix-sync-wave-bloom" cx="236" cy="75" rx="0" ry="0" fill="none" stroke="${palette.warm}" stroke-width="4" opacity=".48" filter="url(#${id}-bloom)"/><ellipse class="matrix-sync-wave matrix-sync-wave-edge" cx="236" cy="75" rx="0" ry="0" fill="none" stroke="${palette.warm}" stroke-width="1.15"/></g>`;
  camera.append(pulse);
  const waveEllipses=[...pulse.querySelectorAll<SVGElement>('.matrix-sync-wave')];
  const pool=synchronizationSelect(unified,'.matrix-projection-pool'),projectedLines=synchronizationSelect(unified,'.matrix-projected-lines');
  const sourceCircles=[...source.querySelectorAll<SVGElement>('circle')];
  const trailTiles=order.map(([r,c],step)=>{const tile=synchronizationSelect(svg,`[data-index="${r*5+c}"]`);return{top:synchronizationSelect(tile,'.matrix-top'),inset:synchronizationSelect(tile,'.matrix-inset'),birth:routeStart+step/8*routeDuration};});
  return(t: number,settings: SynchronizationSettings)=>{
    const arriving=t>=timing.arrival,baseTime=arriving?.85:t*.70/timing.arrival;
    drawWalk(baseTime,settings);
    const fade=1-ease(timing.fadeStart,timing.fadeEnd,t),appearance=ease(timing.arrival,timing.revealEnd,t),lower=ease(timing.lowerStart,timing.lowerEnd,t);
    const sync=clamp((t-timing.syncStart)/(timing.syncEnd-timing.syncStart)),join=ease(timing.lowerEnd-.025,timing.syncStart+.01,t);
    const rise=ease(timing.liftStart,timing.liftEnd,t),zoom=rise,scale=1-clamp(settings.distance,0,35)/100*zoom;
    const elevation=3.5*clamp(settings.amount,.5,12),height=elevation*(1-lower),finalBrightness=clamp(settings.brightness??100,0,200);
    const platformBrightness=clamp(settings.platformBrightness??75,0,200),syncGlow=clamp(settings.syncGlow,0,2);
    const elapsed=synchronizationTimeAtPhase(t,settings),trailDuration=settings.trailDuration;
    const routeStartTime=synchronizationTimeAtPhase(routeStart,settings),routeDurationTime=synchronizationTimeAtPhase(timing.arrival,settings)-routeStartTime;
    // The gradient moves beyond the endpoint after arrival, so old light decays in place.
    const trailHead=52+184*(elapsed-routeStartTime)/routeDurationTime,trailSpan=184/routeDurationTime*trailDuration;
    attr(trailGradient,'x1',trailHead-trailSpan);attr(trailGradient,'x2',trailHead);
    trailTiles.forEach(({top,inset,birth},step)=>{
      const igniting=ease(step===0?.04:birth-.022,birth,t),age=Math.max(0,elapsed-synchronizationTimeAtPhase(birth,settings));
      const heat=igniting*(1-ease(0,trailDuration,age));
      attr(top,'fill-opacity',.035+.105*heat);attr(inset,'opacity',.14+.47*heat);
    });
    brightness(system,settings.initialBrightness);
    brightness(platforms,platformBrightness);
    brightness(unified.firstElementChild as SVGElement,finalBrightness);
    attr(camera,'transform',`translate(144 ${(75+12*zoom).toFixed(3)}) scale(${scale.toFixed(5)}) translate(-144 -75)`);
    // One continuous wave reveals the assembled surface; its inverse removes the old tiles.
    const radius=Math.max(.001,waveReach*sync),feather=clamp((radius-settings.waveSoftness)/radius,0,.9999);
    attr(revealGradient,'r',radius);attr(remainingGradient,'r',radius);
    attr(revealFeather,'offset',feather);attr(remainingFeather,'offset',feather);
    remaining.setAttribute('mask',t>=timing.syncStart?`url(#${id}-sync-remaining)`:'none');
    attr(unified,'opacity',(t>=timing.syncStart?1:0)*fade);
    const wavePower=ease(timing.syncStart,timing.syncStart+.008,t)*(1-ease(timing.syncEnd-.012,timing.syncEnd+.012,t))*clamp(syncGlow*1.5,0,2);
    attr(pulse,'opacity',wavePower*fade*(settings.waveEnabled?1:0));
    waveEllipses.forEach(el=>{attr(el,'rx',radius-0.001);attr(el,'ry',(radius-0.001)*planeRatio);});
    if(arriving){
      for(const tile of tiles){
        const isPlatform=tile.parentNode===platforms,row=Number(tile.dataset.row),col=Number(tile.dataset.col),x=144+(col-row)*23,y=35+(col+row)*10;
        const cellHeight=isPlatform?height:0,growth=mix(1,23/21,join);
        attr(tile,'transform',`translate(0 ${(-cellHeight).toFixed(3)}) translate(${x} ${y}) scale(${growth.toFixed(5)}) translate(${-x} ${-y})`);
        attr(tile,'opacity',(isPlatform?.94:appearance)*fade);
      }
      attr(foundation,'opacity',appearance*.5*(1-join)*fade);
      const points=order.map(([r,c])=>[144+(c-r)*23,35+(c+r)*10-height]);
      attr(route,'d',poly(points));attr(route,'opacity',.65*(1-join)*fade);
      const lift=clamp(settings.observerHeight??62,30,76)*rise;
      const x=144+(236-144)*scale*(1-rise),y=75-height*scale+12*zoom-lift;
      attr(source,'transform',`translate(${x.toFixed(3)} ${y.toFixed(3)}) scale(${(1+.16*rise).toFixed(4)})`);
      attr(source,'opacity',fade);
    }
    // The filled light volume starts only after the source has reached the center and stopped.
    const projectionPhase=ease(timing.projectStart,timing.projectEnd,t),breath=1+settings.projectionPulse*Math.sin((elapsed-synchronizationTimeAtPhase(timing.projectStart,settings))*Math.PI*2/2.8);
    const projectionPower=projectionPhase*settings.projectionGlow*breath*(settings.projectionEnabled?1:0);
    const lightPosition=(source as SVGGElement).transform.baseVal.consolidate()!.matrix;
    const screen=([x,y]: SynchronizationPoint): SynchronizationPoint=>[144+(x-144)*scale,75+(y-75)*scale+12*zoom];
    const screenCorners=corners.map(screen),[,right,front,left]=screenCorners,centerY=75+12*zoom;
    const apex=[lightPosition.e,lightPosition.f];
    attr(projectionGradient,'x1',apex[0]);attr(projectionGradient,'y1',apex[1]);
    attr(projectionGradient,'x2',144);attr(projectionGradient,'y2',front[1]);
    attr(volume,'d',`${poly([apex,left,front,right])}Z`);
    attr(core,'d',`${poly([apex,[144-25*scale,centerY],[144,centerY+20*scale],[144+25*scale,centerY]])}Z`);
    const guidePower=ease(.04,.4,rise)*(settings.projectionEnabled?1-ease(timing.projectStart,timing.projectEnd-.005,t):1);
    attr(guides,'opacity',guidePower*settings.guideOpacity*fade*(settings.guidesEnabled?1:0));
    [...guides.children].forEach((el,i)=>{attr(el,'d',poly([apex,screenCorners[i]]));attr(el,'stroke-dashoffset',-(elapsed-synchronizationTimeAtPhase(timing.liftStart,settings))*3);});
    attr(projection,'opacity',projectionPower*fade);
    attr(pool,'opacity',projectionPower*.24);attr(projectedLines,'opacity',projectionPower*.62);
    const confirmation=ease(timing.syncStart,timing.syncStart+.01,t)*(1-ease(timing.syncStart+.025,timing.syncStart+.055,t))*syncGlow;
    const auraRadius=Math.min(15+11*projectionPhase*breath+8*confirmation,Math.max(6,(apex[1]-2)/(1+.16*rise)));
    attr(sourceCircles[0],'r',auraRadius); attr(sourceCircles[0],'opacity',Math.min(1,settings.glow));
    attr(sourceCircles[1],'r',(4+2.2*projectionPhase*breath+1.5*confirmation)*settings.lightSize); attr(sourceCircles[1],'opacity',Math.min(1,settings.glow*.75));
    attr(sourceCircles[2],'r',(1.45+.4*projectionPhase*breath)*settings.lightSize);
    route.style.display=settings.trailEnabled?'':'none';
    waveEllipses.forEach((el,i)=>attr(el,'stroke-width',settings.waveWidth*(i===0?3.5:1)));
    svg.dataset.elapsed=elapsed.toFixed(4);
    svg.dataset.phase=t.toFixed(4);
    svg.dataset.stage=t<timing.arrival?'route':t<timing.lowerStart?'matrix-25':t<timing.syncStart?'descending':t<timing.liftStart?'synchronizing':t<timing.liftEnd?'distance':t<timing.projectStart?'guides':t<timing.fadeStart?'projection':'fade';
    svg.dataset.synchronization=sync.toFixed(4);
    svg.dataset.distance=rise.toFixed(4);
    svg.dataset.projection=projectionPhase.toFixed(4);
  };
}
