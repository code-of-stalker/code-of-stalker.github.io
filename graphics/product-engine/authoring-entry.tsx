// Build-only import of the approved authoring sources; absent from shipped JS.
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ArchitectureCover } from '../../scripts/product-art/src/laboratory/components/architecture/ArchitectureCover';
import { DiaryCover } from '../../scripts/product-art/src/laboratory/components/diary/DiaryCover';
import { BasicCover } from '../../scripts/product-art/src/BasicCover';
import { VoiceArtwork } from '../../scripts/product-art/src/VoiceArtwork';
import { MatrixInsight } from '../../scripts/product-art/src/MatrixInsight';
import { normalizeArchitectureSettings } from '../../scripts/product-art/src/laboratory/components/architecture/architectureSettings';
import { normalizeDiarySettings } from '../../scripts/product-art/src/laboratory/components/diary/diarySettings';
import { createGuidanceJunction } from '../../scripts/product-art/src/laboratory/components/architecture/guidanceRenderer';
import { createParallelPath } from '../../scripts/product-art/src/laboratory/components/architecture/parallelRenderer';
import { createSynchronizedMatrix } from '../../scripts/product-art/src/laboratory/components/architecture/synchronizationRenderer';
import { guidancePhase, guidanceDuration } from '../../scripts/product-art/src/laboratory/components/architecture/guidanceSettings';
import { parallelPhase, parallelDuration } from '../../scripts/product-art/src/laboratory/components/architecture/parallelSettings';
import { synchronizationPhase, synchronizationDuration } from '../../scripts/product-art/src/laboratory/components/architecture/synchronizationSettings';
import { distanceAnimationFrame,distanceTimeline,distanceScanLighting } from '../../scripts/product-art/src/laboratory/components/architecture/distanceGeometry';
import { architectureAnimationFrame } from '../../scripts/product-art/src/laboratory/components/architecture/architectureGeometry';
import { diaryAnimationFrame } from '../../scripts/product-art/src/laboratory/components/diary/diaryGeometry';
import { mountMatrixMotion } from '../../scripts/product-art/src/laboratory/components/matrix/matrixMotion';
import architecture from '../../assets/product/motion/laboratory-architecture.json';
import diary from '../../assets/product/motion/laboratory-diary.json';
import voice from '../../assets/product/motion/laboratory-voice.json';
export { architecture, diary, voice };
export function decoderMarkup() { return renderToStaticMarkup(<MatrixInsight active={false} decoderVisible={false}/>); }
export function still(kind: string) {
  const a = normalizeArchitectureSettings(architecture.settings); a.labels = false; a.frame = false;
  const d = normalizeDiarySettings(diary.settings); d.labels = false; d.frame = false;
  if (kind === 'basic') return renderToStaticMarkup(<BasicCover active={false} reducedMotion={false} />);
  if (kind === 'voice') return renderToStaticMarkup(<VoiceArtwork active={false} sample={() => ({ low: 0, mid: 0, high: 0 })} preset={voice} mode="idle" lockProgress={() => 0} locked={false} />);
  if (kind === 'diary') return renderToStaticMarkup(<DiaryCover active={false} presentation="artwork" interactive={false} settings={d} />);
  a.illustration = kind === 'distance' ? 'distance' : 'cell';
  return renderToStaticMarkup(<ArchitectureCover active={false} presentation="artwork" interactive={false} settings={a} />);
}
export function authored(svg: SVGSVGElement, kind: string) {
  const a = normalizeArchitectureSettings(architecture.settings), palette = { ink: a.color, warm: a.lightColor, guide: a.guidance.guideColor };
  if (kind === 'guidance') { const draw = createGuidanceJunction(svg, 'product-guide', palette); return { duration: guidanceDuration(a.guidance), draw: (t: number) => draw(guidancePhase(t, a.guidance), a.guidance) }; }
  if (kind === 'parallel') { const draw = createParallelPath(svg, 'product-parallel', { ...palette, guide: a.parallel.guideColor }, a.parallel); return { duration: parallelDuration(a.parallel), draw: (t: number) => draw(parallelPhase(t, a.parallel), a.parallel) }; }
  if (kind === 'intensive') { const draw = createSynchronizedMatrix(svg, 'product-sync', palette); return { duration: synchronizationDuration(a.synchronization), draw: (t: number) => draw(synchronizationPhase(t, a.synchronization), a.synchronization) }; }
  throw new Error('Unknown authored scene ' + kind);
}
/** Build-time knots from approved equations. No authoring code is imported by
 * the runtime: Rust evaluates the continuous timeline and interpolated geometry. */
export function approvedTimeline(svg:SVGSVGElement,kind:string) {
 const a=normalizeArchitectureSettings(architecture.settings),d=normalizeDiarySettings(diary.settings);
 const one=(s:string)=>svg.querySelector(s)!;
 const set=(s:string,key:string,value:unknown)=>one(s)?.setAttribute(key,String(value));
 if(kind==='distance') {
  const light=distanceScanLighting(a.distance.scanStrength,a.distance.scanBlur);
  return {duration:distanceTimeline(a.distance).cycle,draw:(t:number)=>{
   const m=distanceAnimationFrame(t,a);
   set('[data-distance-person]','transform',`translate(${m.shift} 0)`);
   set('[data-distance-base]','opacity',m.profileOpacity);set('[data-distance-plane]','opacity',m.planeOpacity);
   set('[data-distance-source]','transform',`translate(${m.sourceX} ${m.sourceY})`);set('[data-distance-source]','opacity',m.light);
   set('[data-distance-halo]','transform',`scale(${m.haloScale})`);set('[data-distance-flare]','transform',`scale(${a.distance.lightSize}) rotate(${m.phase*18-9})`);
   set('[data-distance-projection]','opacity',m.projection);set('[data-distance-beam]','opacity',m.scanOpacity);
   for(const key of ['beam-glow','scan-ray'])set(`[data-distance-${key}]`,'d',m.scanRay);
   set('[data-distance-scan-front]','d',m.scanFront);
   for(const [key,value] of Object.entries({x1:m.sourceX,y1:m.sourceY,x2:m.rayEndX,y2:m.rayEndY}))set('[data-distance-gradient]',key,value);
   svg.querySelectorAll('[data-distance-ray]').forEach((n,i)=>n.setAttribute('d',m.rays[i]));
   set('[data-distance-band]','x',-144+m.shift);set('[data-distance-band]','y',m.scanTop);set('[data-distance-band]','height',m.scanBottom-m.scanTop);set('[data-distance-band]','transform',`translate(${-m.shift} 0)`);
   set('[data-distance-scan-gradient]','y1',m.scanTop);set('[data-distance-scan-gradient]','y2',m.scanBottom);
   svg.querySelectorAll('[data-distance-scan-filter]').forEach(n=>{n.setAttribute('y',String(m.scanTop-64));n.setAttribute('height',String(a.distance.scanWidth+128));});
   set('[data-distance-scan]','opacity',m.scanOpacity);set('[data-distance-aura-gain]','slope',light.auraGain*m.voice.scanGain);set('[data-distance-core-gain]','slope',light.coreGain*m.voice.scanGain);
   set('[data-distance-scan-white]','opacity',Math.min(.95,light.whiteOpacity*m.voice.scanGain));
   set('[data-distance-voice]','transform',`translate(${m.voice.mouthX} ${m.voice.mouthY}) rotate(${m.voice.angle})`);
   svg.querySelectorAll('[data-distance-voice-wave]').forEach((n,i)=>{const w=m.voice.waves[i%m.voice.waves.length];n.setAttribute('d',w.path);n.setAttribute('opacity',String(w.opacity));n.setAttribute('stroke-width',String(w.width));});
   set('[data-distance-mouth]','r',.45+m.voice.level*.35);set('[data-distance-mouth]','opacity',m.voice.level*a.distance.voiceOpacity*.7);
  }};
 }
 if(kind==='cells')return {duration:a.cycle,draw:(t:number)=>{
  const m=architectureAnimationFrame(t,a);
  svg.querySelectorAll('[data-architecture-cell]').forEach((n,i)=>{const v=m.cells[i];n.setAttribute('transform',`translate(${v.x} ${v.y}) scale(${a.cellSize})`);n.setAttribute('opacity',String(v.opacity));});
  set('[data-architecture-person]','transform',`translate(144 ${m.personY}) scale(${m.personScale})`);
  set('[data-architecture-corners]','transform',`translate(144 77) scale(${m.frameScale}) translate(-144 -77)`);set('[data-architecture-corners]','opacity',m.frameOpacity);
  set('[data-architecture-light]','transform',`translate(144 ${m.lightY}) scale(${a.lightSize})`);set('[data-architecture-light]','opacity',Math.min(1,m.lightOpacity));
  set('[data-architecture-scan]','y',m.scanY);set('[data-architecture-scan]','opacity',m.scanOpacity);
  set('[data-architecture-ripple]','r',m.rippleRadius);set('[data-architecture-ripple]','cy',m.lightY);set('[data-architecture-ripple]','opacity',m.rippleOpacity);
 }};
 if(kind==='diary')return {duration:35,draw:(t:number)=>{
  const m=diaryAnimationFrame(t,d);
  svg.querySelectorAll('[data-diary-layer]').forEach(n=>n.setAttribute('transform',`translate(0 ${m.offsets[Number(n.getAttribute('data-diary-layer'))]})`));
  svg.querySelectorAll('[data-diary-scan]').forEach(n=>{n.setAttribute('opacity',String(Math.min(1,m.scan)));n.setAttribute('y',String(m.scanY-d.scanWidth/2));});
  svg.querySelectorAll('[data-diary-signal]').forEach(group=>[...group.children].forEach((n,i)=>{const v=m.signal[i%m.signal.length];if(n.tagName==='line'){n.setAttribute('y1',String(-v.height));n.setAttribute('y2',String(v.height));}else if(n.tagName==='rect')n.setAttribute('fill-opacity',String(Math.min(1,v.opacity*d.signalAmount/2)));}));
  set('[data-diary-halo]','opacity',Math.min(1,m.halo));set('[data-diary-glow]','opacity',Math.min(1,m.glow));set('[data-diary-trace]','stroke-dashoffset',m.traceOffset);
  set('[data-diary-indicator]','opacity',.35+.2*Math.sin(t*1.5)**2);
 }};
 if(kind==='basic')return {duration:8,draw:(seconds:number)=>{
  const t=seconds/8,clamp=(v:number)=>Math.max(0,Math.min(1,v)),smooth=(a:number,b:number)=>{const u=clamp((t-a)/(b-a));return u*u*(3-2*u);};
  const q=smooth(.1,.44)*(1-smooth(.8,.98)),power=smooth(.045,.16)*(1-smooth(.82,.99)),p=clamp((t-.4)/.36);
  set('.af-traveller','transform',`translate(${43+48*q} ${126-21*q-Math.sin(q*Math.PI)*18})`);set('.af-traveller','opacity',power*.85);
  set('.af-step-fill','opacity',q*.1);set('.af-floor-light','opacity',q*.22*.75);set('.af-step-wave','rx',6+p*28);set('.af-step-wave','ry',3+p*9);set('.af-step-wave','opacity',p>0&&p<1?(1-p)*.48:0);
 }};
 throw new Error('Unknown product timeline '+kind);
}
export function insightTimeline(svg:SVGSVGElement,decoder:HTMLElement,tick:(at:number)=>void) {
 const current=mountMatrixMotion(svg,decoder,'rust-insight',{waitForDecoder:true});
 current.setDecoderVisible(false);tick(1);
 return {duration:13.2,draw:(seconds:number)=>tick(1+seconds*1000),dispose:()=>current.dispose()};
}
