import { Color } from 'three';
import layout from './uniforms.json';
import preset from './preset.json';
import { normalizeLiquidGlassSettings, type LiquidGlassSettings } from '../reference/src/liquid-glass/settings';
import { getOpticalTravel } from '../reference/src/liquid-glass/glassRefraction';
import { createBackgroundBlurKernel, getBackgroundBlurLayout } from '../reference/src/liquid-glass/backgroundBlur';
export const panel = { x:.5, y:.5, width:.86, height:.68 };
export const initial = normalizeLiquidGlassSettings({...preset,pixelRatio:2});
export type Settings = LiquidGlassSettings;
type Layout = Record<string,{slot:number;count:number}>;
export function pack(map:Layout,values:Record<string,number|number[]>) {
  const data=new Float32Array(512);
  for(const [name,value] of Object.entries(values)) {
    const descriptor=map[name]; if(!descriptor) throw new Error(`Unknown uniform ${name}`);
    if(typeof value==='number') data[descriptor.slot*4]=value;
    else value.forEach((v,i)=>{ data[descriptor.slot*4+i*(descriptor.count>1?4:1)]=v; });
  }
  return data;
}
export function parameters(s:Settings,width:number,height:number,reduced:boolean,sourceAspect=0.8) {
  const ratio=Math.min(2,Math.max(1,s.pixelRatio)),w=Math.floor(width*ratio),h=Math.floor(height*ratio);
  const values:Record<string,number|number[]>={};
  // Scalars retain the Laboratory shader's names and units.
  for(const [name] of Object.entries(layout.glass)) {
    const key=name==='uIOR'?'ior':name[1].toLowerCase()+name.slice(2);
    const value=s[key as keyof Settings];
    if(typeof value==='number'||typeof value==='boolean') values[name]=Number(value);
  }
  const color=(value:string)=>new Color(value).toArray();
  Object.assign(values,{uPixelRatio:ratio,uResolution:[w,h],uGlassVisible:1,uGlassPanel:[panel.x,1-panel.y,panel.width,panel.height],uGlassPanelEnabled:1,
    uSourceAspect:sourceAspect,uDecodeSourceTexture:0,uBlurEnabled:s.backgroundBlur>0?1:0,
    uHighlightColor:color(s.highlightColor),uFillColor:color(s.fillColor),uPulseColor:color(s.pulseColor),
    uGlassOptics:[Number(s.figmaGlassEnabled),s.figmaRefraction,s.figmaDepth,s.figmaDispersion],
    uOpticalTravel:getOpticalTravel(s.figmaDepth,s.figmaRefraction,Math.min(w*panel.width,h*panel.height)/ratio),
    uLightSplay:s.figmaSplay,uBorderThickness:s.edgeThickness,uFacet:[Number(s.facetEnabled),s.facetWidth,s.facetStrength],
    uCutCorners:[s.cutTopLeft,s.cutTopRight,s.cutBottomRight,s.cutBottomLeft].map(Number),
    uCutSizes:[s.cutSizeTopLeft,s.cutSizeTopRight,s.cutSizeBottomRight,s.cutSizeBottomLeft],
    uTouch:[.5,.5,0,0],uRim:[Number(s.rimEnabled),s.rimStrength,s.rimWidth],uDirectedLight:[-Math.SQRT1_2,Math.SQRT1_2],
    uScan:[1,s.scanSoftness,s.scanDirection,0],uPulseReveal:[width/2,height/2,1,Math.max(s.pulseCellSize,Math.sqrt(width*height*panel.width*panel.height/1100),Math.max(width*panel.width,height*panel.height)/60)],
    uPulseStyle:[s.pulseSoftness,s.pulseStrength],uTime:0,uRegionEdges:[s.regionTop,s.regionRight,s.regionBottom,s.regionLeft].map(Number)});
  const blur=getBackgroundBlurLayout(w,h,ratio,s.backgroundBlur);
  const hKernel=createBackgroundBlurKernel(blur.radiusX/blur.spacingX),vKernel=createBackgroundBlurKernel(blur.radiusY/blur.spacingY);
  const blurBase={uDecodeSourceTexture:0,uFrameAspect:w/h,uSourceAspect:sourceAspect};
  return {glass:pack(layout.glass,values),horizontal:pack(layout.blur,{...blurBase,uFirstPass:1,uDirection:[blur.spacingX/blur.width,0],uRadius:hKernel.radius,uWeights:Array.from(hKernel.weights)}),
    vertical:pack(layout.blur,{...blurBase,uFirstPass:0,uDirection:[0,blur.spacingY/blur.height],uRadius:vKernel.radius,uWeights:Array.from(vKernel.weights)}),blur,
    motion:new Float32Array([s.touchLag,s.scanDuration,s.pulseDuration,Number(s.touchEnabled),Number(s.scanEnabled),Number(s.pulseRevealEnabled),s.rimAngle,Number(reduced)])};
}
export function background() {
  const canvas=document.createElement('canvas');canvas.width=768;canvas.height=960;
  const ctx=canvas.getContext('2d',{willReadFrequently:true})!;
  ctx.fillStyle='#090c07';ctx.fillRect(0,0,768,960);
  const gradient=ctx.createRadialGradient(490,280,0,490,280,430);gradient.addColorStop(0,'#9d970c');gradient.addColorStop(.28,'#3e4009');gradient.addColorStop(1,'#090c07');ctx.fillStyle=gradient;ctx.fillRect(0,0,768,960);
  for(let x=0;x<=768;x+=48) {ctx.strokeStyle=x%96?'#424626':'#767d46';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,960);ctx.stroke();}
  for(let y=0;y<=960;y+=48) {ctx.strokeStyle=y%96?'#424626':'#767d46';ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(768,y);ctx.stroke();}
  for(const [x,y,r] of [[585,242,135],[125,725,108],[610,775,48]]) {ctx.strokeStyle='#e7e100';ctx.lineWidth=5;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.stroke();}
  return canvas;
}
