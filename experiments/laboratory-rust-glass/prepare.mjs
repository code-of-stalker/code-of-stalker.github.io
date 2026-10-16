import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { createHash } from 'node:crypto';
const root = path.dirname(fileURLToPath(import.meta.url));
const lab = process.env.LABORATORY_SOURCE || 'C:/Code Of Stalker/Liquid_Prnc_Glass-main';
// The GPU kernel specializes the frozen benchmark preset. Refuse a silent
// workload mismatch if the Canvas reference preset is edited later.
const rain=JSON.parse(await readFile(path.join(root,'reference/presets/matrix-rain.json'),'utf8')).settings;
const gpuRain={fontSize:10,spacing:1.1,density:1,speed:.55,trailLength:23,glow:1,brightness:.51,depth:1,flicker:.22,color:'#E7E100',headColor:'#FFF7BF',backgroundColor:'#000000',characters:'katakana',seed:73,playing:true,direction:'down'};
if(Object.keys(rain).length!==Object.keys(gpuRain).length||Object.entries(gpuRain).some(([key,value])=>rain[key]!==value))throw new Error('Rain preset changed: update the Rust GPU kernel before comparing.');
const requireLab = createRequire(path.join(lab, 'package.json'));
const { build } = await import(pathToFileURL(requireLab.resolve('vite')).href);
const glassPath = path.join(root, 'reference/src/liquid-glass/WebGLVideoEdgeGlassRenderer.ts');
const blurPath = path.join(root, 'reference/src/liquid-glass/BackgroundBlurPass.ts');
for (const filename of [glassPath, blurPath]) {
  const source = await readFile(filename, 'utf8');
  await writeFile(filename, source.replace(/^const fragmentShader =/m, 'export const fragmentShader ='));
}
await mkdir(path.join(root,'.cache'), { recursive:true });
const entry = path.join(root,'.cache/extract.ts');
await writeFile(entry, `export {fragmentShader as glass} from ${JSON.stringify(glassPath)}; export {fragmentShader as blur} from ${JSON.stringify(blurPath)}; import {ShaderChunk} from 'three'; export const color = ShaderChunk.colorspace_pars_fragment;`);
const bundle = await build({ configFile: false, logLevel: 'warn',
  resolve: { alias: { three: path.join(path.dirname(requireLab.resolve('three')), 'three.module.js') } },
  build: { write: false, minify: false, lib: {entry,formats:['es']}, target:'es2020' },
});
const code = (Array.isArray(bundle) ? bundle[0] : bundle).output.find(o => o.type === 'chunk').code;
const shaders = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
const meta = {};
await mkdir(path.join(root, 'engine/shaders'), { recursive: true });
for (const kind of ['glass', 'blur']) {
  let source = shaders[kind], slot = 0;
  const uniforms = {};
  source = source.replace(/uniform\s+(\w+)\s+(\w+)(?:\[(\d+)\])?\s*;/g, (_, type, name, length) => {
    if (type === 'sampler2D') return '';
    uniforms[name] = { slot, type, count: Number(length || 1) };
    slot += Number(length || 1);
    return '';
  });
  const definitions = Object.entries(uniforms).map(([name, value]) => {
    if (value.count > 1) {
      source = source.replace(new RegExp(`${name}\\[([^\\]]+)\\]`, 'g'), `_data[${value.slot} + int($1)].x`);
      return '';
    }
    const size = Number(value.type.slice(-1)) || 1;
    const expression = `_data[${value.slot}].${'xyzw'.slice(0,size)}`;
    return `#define ${name} ${value.type === 'int' ? `int(${expression})` : expression}`;
  }).join('\n');
  source = source.replace(/precision highp float;/g, '').replace('varying vec2 vUv;', 'layout(location=0) in vec2 vUv;')
    .replaceAll('gl_FragColor', 'fragColor')
    .replace(/texture2D\(uSourceTexture\s*,/g, 'readSource(').replace(/texture2D\(uInput\s*,/g, 'readSource(')
    .replace(/texture2D\(uBlurTexture\s*,/g, 'readBlur(');
  const prefix = `#version 450
layout(std140,set=0,binding=0) uniform Params { vec4 _data[128]; };
layout(set=0,binding=1) uniform texture2D texSource;
layout(set=0,binding=2) uniform texture2D texBlur;
layout(set=0,binding=3) uniform sampler linearSampler;
layout(location=0) out vec4 fragColor;
${definitions}
vec4 readSource(vec2 uv) { return textureLod(sampler2D(texSource,linearSampler),vec2(uv.x,1.0-uv.y),0.0); }
vec4 readBlur(vec2 uv) { return textureLod(sampler2D(texBlur,linearSampler),vec2(uv.x,1.0-uv.y),0.0); }
${shaders.color}
vec4 linearToOutputTexel(vec4 color) { return _data[127].x > 0.5 ? sRGBTransferOETF(color) : color; }
`;
  if (slot >= 127) throw new Error('uniform capacity exceeded');
  await writeFile(path.join(root, `engine/shaders/${kind}.frag`), prefix + source);
  meta[kind] = uniforms;
}
await writeFile(path.join(root, 'src/uniforms.json'), JSON.stringify(meta, null, 2));
const constants = Object.entries(meta.glass).map(([name,{slot}]) => `pub const ${name.replace(/([A-Z])/g,'_$1').toUpperCase()}: usize = ${slot*4};`).join('\n');
await writeFile(path.join(root, 'engine/src/uniforms.rs'), '// Generated from the Laboratory shader.\n#![allow(dead_code)]\n' + constants + '\n');
await writeFile(path.join(root, 'reference/SNAPSHOT.json'), JSON.stringify({ source:lab, copiedAt:'2026-10-09',
  shaderSha256:createHash('sha256').update(shaders.glass).digest('hex'),
  observerSha256:createHash('sha256').update(await readFile(path.join(root,'reference/src/assets/attention-awareness.svg'))).digest('hex'),
  changes:['Export fragment source for build-time GLSL-to-WGSL translation.','Expose interactive render, clock reset and finish-reveal preview for a shared RAF; glass equations preserved.','Expose canvas-frame invalidation matching the native rain/video update path.','AttentionAwareness SVG unchanged; component memoizes its innerHTML object. All v5 modes use the same larger illustration box, without foreground labels.','v5 rain uses bundled Noto JP fallback instead of OS fonts and uncapped active delta so slow frames do not change animation speed; seek added for visual QA.','Full Rust v5 uses GPU rain, tessellated original SVG paths, stencil occlusion, cached original-path glow and MSAA4. Main figures are not raster sprites.'],
},null,2));
console.log('Prepared original Laboratory shaders and aligned uniform layouts.');
