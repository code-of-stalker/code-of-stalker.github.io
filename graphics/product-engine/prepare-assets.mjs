import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { SvgNode, parseSvg, installAuthoringDom, matrix } from './svg-dom.mjs';
import { compileCssMotion } from './css-motion.mjs';
const here = path.dirname(fileURLToPath(import.meta.url)), project = path.resolve(here, '../..');
const requestedKind = process.argv.find(arg => arg.startsWith('--kind='))?.slice(7);
const kinds = ['distance','cells','diary','basic','voice','guidance','parallel','intensive','insight','attention','comparison','crowd','gallery','mirror'];
if (requestedKind && !kinds.includes(requestedKind)) throw new Error('Unknown scene ' + requestedKind);
const selected = kind => !requestedKind || kind === requestedKind;
const lab = createRequire('C:/Code Of Stalker/Liquid_Prnc_Glass-main/package.json');
const { build } = await import(pathToFileURL(lab.resolve('vite')).href);
const rootRequire = createRequire(path.join(project, 'package.json'));
const result = await build({ configFile: false, logLevel: 'warn', define: { 'process.env.NODE_ENV': '"production"' },
  resolve: { alias: { react: path.dirname(rootRequire.resolve('react/package.json')), 'react-dom': path.dirname(rootRequire.resolve('react-dom/package.json')), three: path.join(path.dirname(lab.resolve('three')), 'three.module.js') } },
  oxc: { jsx: { runtime: 'automatic', importSource: 'react' } },
  build: { write: false, minify: false, lib: { entry: path.join(here, 'authoring-entry.tsx'), formats: ['es'] }, target: 'es2022' } });
const output = (Array.isArray(result) ? result[0] : result).output;
const js = output.find(o => o.type === 'chunk').code;
const cache = path.join(here, '.cache'); await mkdir(cache, { recursive: true });
const bundlePath = path.join(cache, 'authoring.mjs'); await writeFile(bundlePath, js);
const authored = await import(pathToFileURL(bundlePath).href);
const authoringDom=installAuthoringDom();
const assets = path.join(here, 'engine/assets'); await mkdir(assets, { recursive: true });
const css = output.filter(o => o.type === 'asset' && o.fileName.endsWith('.css')).map(o => o.source).join('\n')
  + await readFile(path.join(project, 'scripts/product-art/src/style.css'), 'utf8');
const catalog = requestedKind ? JSON.parse(await readFile(path.join(assets, 'catalog.json'), 'utf8')).filter(scene => scene.kind !== requestedKind) : [];
for (const kind of ['distance', 'cells', 'diary', 'basic', 'voice'].filter(selected)) {
  const markup = authored.still(kind), root = parseSvg('<root>' + markup + '</root>');
  const svg = root.querySelector('svg.architecture-artwork') ?? root.querySelector('svg.diary-artwork') ?? root.querySelector('svg.vr-art') ?? root.querySelector('svg');
  if (!svg) throw new Error('Missing approved vector scene ' + kind);
  svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  svg.prepend(Object.assign(new SvgNode('style'), { textContent: css }));
  const source = svg.outerHTML; await writeFile(path.join(assets, kind + '.svg'), source);
  if(kind==='voice')await writeFile(path.join(assets,'voice.html'),'<style>'+css+'</style>'+markup);
  catalog.push({ kind, sourceSha256: createHash('sha256').update(markup).digest('hex'), vectors: svg.querySelectorAll('path,circle,ellipse,line,rect').length });
}
const escape = v => String(v).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
for (const kind of ['guidance', 'parallel', 'intensive','distance','cells','diary','basic','insight'].filter(selected)) {
  let svg,animation;
  if(['guidance','parallel','intensive'].includes(kind)) {
    svg = new SvgNode('svg', { xmlns: 'http://www.w3.org/2000/svg', viewBox: '0 0 288 156', fill: 'none', stroke: '#E7E100', 'stroke-width': '.75', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
    animation = authored.authored(svg,kind);
  }else if(kind==='insight') {
    svg=new SvgNode('svg',{xmlns:'http://www.w3.org/2000/svg',viewBox:'0 0 400 94',fill:'none',color:'#f5dd07'});svg.clientWidth=400;svg.clientHeight=94;
    const decoder=new SvgNode('button');animation=authored.insightTimeline(svg,decoder,authoringDom.tick);
  }else{svg=parseSvg(await readFile(path.join(assets,kind+'.svg'),'utf8'));animation=authored.approvedTimeline(svg,kind);}
  animation.draw(0);
  const base = svg.outerHTML, nodes = [svg, ...svg.querySelectorAll('*')];
  nodes.forEach((node, index) => node.setAttribute('data-rust-node', index));
  const samples = Math.ceil(animation.duration * 30), tracks = nodes.map(() => new Map());
  for (let frame = 0; frame <= samples; frame++) {
    const seconds = frame / samples * animation.duration; animation.draw(seconds);
    nodes.forEach((node, index) => {
      const attrs = { ...node.attrs, ...node.styles };
      if (attrs.transform) { const m = matrix(attrs.transform); attrs.transform = [m.a,m.b,m.c,m.d,m.e,m.f].join(' '); }
      for (const [name, value] of Object.entries(attrs)) {
        if (['id','class','data-rust-node','data-role'].includes(name) || name.startsWith('data-')) continue;
        const list = tracks[index].get(name) ?? []; list.push([seconds, String(value)]); tracks[index].set(name, list);
      }
    });
  }
  const fields = tracks.flatMap((node, index) => [...node].filter(([_, frames]) => new Set(frames.map(f => f[1])).size > 1).map(([name, frames]) =>
    '<field node="' + index + '" name="' + name + '">' + frames.map(([time, value]) => '<v t="' + time.toFixed(6) + '" value="' + escape(value) + '"/>').join('') + '</field>')).join('');
  await writeFile(path.join(assets, kind + '.svg'), svg.outerHTML);
  if (kind === 'insight') await writeFile(path.join(assets, 'insight.html'), '<style>' + css + '</style>' + authored.decoderMarkup().replace(/<svg\b[^>]*>.*?<\/svg>/s, svg.outerHTML));
  await writeFile(path.join(assets, kind + '.tracks.xml'), '<tracks duration="' + animation.duration + '">' + fields + '</tracks>');
  catalog.push({ kind, duration: animation.duration, sourceSha256: createHash('sha256').update(base).digest('hex'), vectors: svg.querySelectorAll('path,circle,ellipse,line,rect').length, fields: tracks.reduce((count, node) => count + [...node.values()].filter(f => new Set(f.map(v => v[1])).size > 1).length, 0), interpolation: 'Rust continuous timeline; 30 samples/second are build-time knots, not runtime FPS' });
  animation.dispose?.();authoringDom.clear();
}
for (const kind of ['attention','comparison','crowd'].filter(selected)) {
  const name={attention:'attention-awareness.svg',comparison:'comparison-scan.svg',crowd:'crowd-awareness.svg'}[kind];
  const source = await readFile(path.join(project,'scripts/product-art/src/laboratory/assets', name), 'utf8'),compiled=compileCssMotion(source);
  await writeFile(path.join(assets,kind+'.svg'),compiled.svg);await writeFile(path.join(assets,kind+'.tracks.xml'),compiled.tracks);
  catalog.push({ kind, sourceSha256: createHash('sha256').update(source).digest('hex'),fields:compiled.fields });
}
for (const kind of ['gallery','mirror'].filter(selected)) {
  const name = kind === 'gallery' ? 'gallery-motion-approved-2026-10-08.fragment.html' : 'matrix-mirror-approved-2026-10-08.fragment.html';
  const source = await readFile(path.join(project, 'assets/product/motion', name), 'utf8');
  const image = source.match(/data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)/);
  if (!image) throw new Error('Missing approved hero asset ' + kind);
  await writeFile(path.join(project, 'public/graphics', kind + '.' + image[1]), Buffer.from(image[2], 'base64'));
  catalog.push({ kind, sourceSha256: createHash('sha256').update(source).digest('hex'), image: kind + '.' + image[1], note: 'Original supplied raster artwork; immutable atlas, motion and shader rendered by Rust/wgpu' });
}
const rustSettings = Object.entries({ architecture: authored.architecture.settings, diary: authored.diary.settings }).map(([module, data]) => {
  const fields = [];
  function collect(values, prefix = '') { for (const [key, value] of Object.entries(values)) {
    const name = (prefix + key).replace(/([a-z])([A-Z])/g, '$1_$2').toUpperCase();
    if (typeof value === 'number') fields.push(`pub const ${name}:f64=${Number.isInteger(value) ? value + '.0' : value};`);
    else if (typeof value === 'boolean') fields.push(`pub const ${name}:bool=${value};`);
    else if (typeof value === 'string') fields.push(`pub const ${name}:&str=${JSON.stringify(value)};`);
    else if (value && typeof value === 'object') collect(value, name + '_');
  } }
  collect(data); return `#[allow(dead_code)]pub mod ${module}{\n${fields.join('\n')}\n}`;
}).join('\n');
if (!requestedKind) await writeFile(path.join(assets, 'settings.rs'), '// Generated from actual approved product settings.\n' + rustSettings);
const scenes = [...catalog.reduce((map, scene) => map.set(scene.kind, { ...map.get(scene.kind), ...scene, runtime: 'Rust/wgpu' }), new Map()).values()];
await writeFile(path.join(assets, 'catalog.json'), JSON.stringify(scenes, null, 2));
console.log(JSON.stringify(scenes));
// Authoring modules install Laboratory timers. They never ship in the Rust runtime.
process.exit(0);
