import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
const here = path.dirname(fileURLToPath(import.meta.url)), project = path.resolve(here, '../..');
const lab = createRequire('C:/Code Of Stalker/Liquid_Prnc_Glass-main/package.json');
const { build } = await import(pathToFileURL(lab.resolve('vite')).href);
const cache = path.join(here, '.cache'); await mkdir(cache, {recursive:true});
const files = ['WebGLVideoEdgeGlassRenderer.ts','BackgroundBlurPass.ts'].map(n => path.join(project, 'scripts/product-art/src/laboratory/liquid-glass', n));
const entry = path.join(cache, 'shaders.ts');
await writeFile(entry, `export {fragmentShader as glass} from ${JSON.stringify(files[0])}; export {fragmentShader as blur} from ${JSON.stringify(files[1])}; import {ShaderChunk} from 'three'; export const color=ShaderChunk.colorspace_pars_fragment;`);
const result = await build({configFile:false,logLevel:'warn', plugins:[{name:'export-authoring-shaders',transform(code,id){if(files.some(f=>f.replaceAll('\\','/')===id.replaceAll('\\','/')))return code.replace(/^const fragmentShader =/m,'export const fragmentShader =');}}],
  resolve:{alias:{three:path.join(path.dirname(lab.resolve('three')),'three.module.js')}},build:{write:false,minify:false,lib:{entry,formats:['es']},target:'es2022'}});
await writeFile(path.join(cache,'shaders.mjs'),(Array.isArray(result)?result[0]:result).output.find(o=>o.type==='chunk').code);
const shaders=await import(pathToFileURL(path.join(cache,'shaders.mjs')).href), meta={};
for(const kind of ['glass','blur']) {
  let source=shaders[kind],slot=0;const uniforms={};
  source=source.replace(/uniform\s+(\w+)\s+(\w+)(?:\[(\d+)\])?\s*;/g,(_,type,name,count)=>{if(type==='sampler2D')return '';uniforms[name]={slot,type,count:Number(count||1)};slot+=Number(count||1);return '';});
  const defs=Object.entries(uniforms).map(([name,v])=>{
    if(v.count>1){source=source.replace(new RegExp(`${name}\\[([^\\]]+)\\]`,'g'),`_data[${v.slot}+int($1)].x`);return '';}
    const expr=`_data[${v.slot}].${'xyzw'.slice(0,Number(v.type.slice(-1))||1)}`;return `#define ${name} ${v.type==='int'?`int(${expr})`:expr}`;
  }).join('\n');
  source=source.replace(/precision highp float;/g,'').replace('varying vec2 vUv;','layout(location=0) in vec2 vUv;').replaceAll('gl_FragColor','fragColor')
    .replace(/texture2D\(uSourceTexture\s*,/g,'readSource(').replace(/texture2D\(uInput\s*,/g,'readSource(').replace(/texture2D\(uBlurTexture\s*,/g,'readBlur(').replace(/texture2D\(uContourTexture\s*,/g,'readContour(');
  if(slot>=127)throw Error('Uniform capacity exceeded');
  const prefix=`#version 450\nlayout(std140,set=0,binding=0) uniform Params {vec4 _data[128];};\nlayout(set=0,binding=1) uniform texture2D texSource;\nlayout(set=0,binding=2) uniform texture2D texBlur;\nlayout(set=0,binding=3) uniform sampler linearSampler;\nlayout(set=0,binding=4) uniform texture2D texContour;\nlayout(location=0) out vec4 fragColor;\n${defs}\nvec4 readSource(vec2 uv){return textureLod(sampler2D(texSource,linearSampler),vec2(uv.x,1.-uv.y),0.);}\nvec4 readBlur(vec2 uv){return textureLod(sampler2D(texBlur,linearSampler),vec2(uv.x,1.-uv.y),0.);}\nvec4 readContour(vec2 uv){return textureLod(sampler2D(texContour,linearSampler),uv,0.);}\n${shaders.color}\nvec4 linearToOutputTexel(vec4 c){return _data[127].x>.5?sRGBTransferOETF(c):c;}\n`;
  await writeFile(path.join(here,`engine/shaders/${kind}.frag`),prefix+source); meta[kind]=uniforms;
}
await writeFile(path.join(here,'engine/src/uniforms.rs'),'// Generated from the actual product shader.\n#![allow(dead_code)]\n'+Object.entries(meta.glass).map(([name,{slot}])=>`pub const ${name.replace(/([A-Z])/g,'_$1').toUpperCase()}:usize=${slot*4};`).join('\n'));
await writeFile(path.join(here,'engine/assets/uniforms.json'),JSON.stringify(meta));
// Freeze the approved product material in Rust, rather than configure it per frame in JS.
const s=JSON.parse(await readFile(path.join(project,'assets/product/motion/laboratory-glass.json'),'utf8'));
const values=Array(512).fill(0), put=(name,...v)=>v.forEach((x,i)=>values[meta.glass[name].slot*4+i]=Number(x));
const color=n=>{const rgb=s[n].match(/[0-9a-f]{2}/gi).map(v=>parseInt(v,16)/255);return rgb.map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);};
const scalars={uBackgroundBlur:'backgroundBlur',uLightSplay:'figmaSplay',uFillOpacity:'fillOpacity',uTouchRadius:'touchRadius',uTouchStrength:'touchStrength',uScanStrength:'scanStrength',uPulseOpacity:'pulseOpacity',uIOR:'ior',uBorderThickness:'edgeThickness',uCornerRadius:'cornerRadius',uDispersion:'dispersion',uEdgeDarkening:'edgeDarkening',uHighlightStrength:'highlightStrength',uExposure:'exposure',uBrightness:'brightness',uContrast:'contrast',uSaturation:'saturation',uTemperature:'temperature',uTint:'tint',uGamma:'gamma',uFieldCurve:'fieldCurve',uFieldEnabled:'fieldEnabled',uFieldFadeMode:'fieldFadeMode',uFieldSoftness:'fieldSoftness',uFieldStart:'fieldStart',uFieldStrength:'fieldStrength',uFlowBoundaryDamping:'flowBoundaryDamping',uFlowEnabled:'flowEnabled',uFlowLayerMix:'flowLayerMix',uFlowMode:'flowMode',uFlowScale:'flowScale',uFlowSpeed:'flowSpeed',uFlowStrength:'flowStrength',uFlowTurbulence:'flowTurbulence',uRegionSoftness:'regionSoftness',uRegionWidth:'regionWidth',uShapeType:'shapeType',uShapeWarp:'shapeWarp'};
Object.entries(scalars).forEach(([u,k])=>put(u,s[k]));
put('uHighlightColor',...color('highlightColor'));put('uPulseColor',...color('pulseColor'));put('uFillColor',...color('fillColor'));
put('uGlassOptics',s.figmaGlassEnabled,s.figmaRefraction,s.figmaDepth,s.figmaDispersion);put('uFacet',s.facetEnabled,s.facetWidth,s.facetStrength);
put('uCutCorners',s.cutTopLeft,s.cutTopRight,s.cutBottomRight,s.cutBottomLeft);put('uCutSizes',s.cutSizeTopLeft,s.cutSizeTopRight,s.cutSizeBottomRight,s.cutSizeBottomLeft);
put('uRim',s.rimEnabled,s.rimStrength,s.rimWidth);put('uDirectedLight',-.70710677,.70710677);put('uTouch',.5,.5,0,0);
put('uScan',1,s.scanSoftness,s.scanDirection,0);put('uExternalReveal',1);put('uPulseReveal',0,0,1,s.pulseCellSize);put('uPulseStyle',s.pulseSoftness,s.pulseStrength);
put('uRegionEdges',s.regionTop,s.regionRight,s.regionBottom,s.regionLeft);put('uGlassVisible',1);put('uTransparentSurface',1);put('uContourEnabled',1);put('uPixelRatio',s.pixelRatio);put('uGlassPanel',.5,.5,1,1);put('uGlassPanelEnabled',1);
const float=n=>Number(n).toString().includes('.')||Number(n).toString().includes('e')?Number(n).toString():`${Number(n)}.0`;
await writeFile(path.join(here,'engine/src/material.rs'),`pub const DEFAULTS:[f32;512]=[${values.map(float).join(',')}];\npub const MOTION:[f32;8]=[${[s.touchLag,s.scanDuration,s.pulseDuration,s.touchEnabled,s.scanEnabled,s.pulseRevealEnabled,s.rimAngle,0].map(float).join(',')}];\n`);
console.log('Prepared actual product contour shader and material.');
