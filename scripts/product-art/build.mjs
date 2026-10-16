import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { createHash } from 'node:crypto';

const here = path.dirname(fileURLToPath(import.meta.url));
const project = path.resolve(here, '../..');
const require = createRequire(import.meta.url);
// A local copy of the original Laboratory toolchain can be reused for development.
let vitePath;
try { vitePath = require.resolve('vite'); }
catch { vitePath = createRequire(path.join(process.env.LABORATORY_SOURCE || 'C:/Code Of Stalker/Liquid_Prnc_Glass-main', 'package.json')).resolve('vite'); }
const { build } = await import(pathToFileURL(vitePath).href);
const projectRequire = createRequire(path.join(project, 'package.json'));
const reactDirectory = path.dirname(projectRequire.resolve('react/package.json'));
const reactDomDirectory = path.dirname(projectRequire.resolve('react-dom/package.json'));
const labRequire = createRequire(path.join(process.env.LABORATORY_SOURCE || 'C:/Code Of Stalker/Liquid_Prnc_Glass-main', 'package.json'));
// Use the ESM entry with the existing Laboratory toolchain.
const threeEntry = path.join(path.dirname(labRequire.resolve('three')), 'three.module.js');
const result = await build({
  configFile: false, root: here, logLevel: 'warn',
  resolve: { alias: { 'react-dom': reactDomDirectory, react: reactDirectory, three: threeEntry } },
  define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  oxc: { jsx: { runtime: 'automatic', importSource: 'react' } },
  build: { write: false, minify: true, target: 'es2020', cssCodeSplit: false,
    lib: { entry: path.join(here, 'src/entry.tsx'), name: 'WatcherArtwork', formats: ['iife'] } },
});
const output = (Array.isArray(result) ? result[0] : result).output;
const js = output.filter(item => item.type === 'chunk').map(item => item.code).join('\n');
const fontCss = (await Promise.all([['Regular', 400], ['Bold', 700]].map(async ([style, weight]) => `@font-face{font-family:'Disket Mono';src:url(data:font/ttf;base64,${(await readFile(path.join(project, `assets/product/fonts/Disket-Mono-${style}.ttf`))).toString('base64')}) format('truetype');font-weight:${weight};font-style:normal;font-display:block}`))).join('');
const css = fontCss + output.filter(item => item.type === 'asset' && item.fileName.endsWith('.css')).map(item => item.source).join('\n');
const notices = await Promise.all(['LABORATORY-LICENSE.txt', 'REACT-LICENSE.txt', 'REACT-DOM-LICENSE.txt', 'THREE-LICENSE.txt'].map(async name => `${name}\n${await readFile(path.join(here, name), 'utf8')}`));
const legal = `<!-- Artwork and runtime license notices\n${notices.join('\n\n').replaceAll('--', '—')}\n-->`;
const token = '__WATCHER_ART_INITIAL_JSON__';
const prelude = `window.__WATCHER_ART_INITIAL__=${token};
if(!Array.prototype.at)Object.defineProperty(Array.prototype,'at',{value:function(index){index=Math.trunc(index)||0;return this[index<0?this.length+index:index];},configurable:true,writable:true});
if(!String.prototype.replaceAll)Object.defineProperty(String.prototype,'replaceAll',{value:function(search,value){return this.split(search).join(value);},configurable:true,writable:true});
(() => { let reduced=!!window.__WATCHER_ART_INITIAL__.reducedMotion;
 const original=window.matchMedia.bind(window), listeners=new Set();
 window.matchMedia=query=>query.includes('prefers-reduced-motion')?{media:query,get matches(){return reduced},onchange:null,addEventListener:(type,fn)=>listeners.add(fn),removeEventListener:(type,fn)=>listeners.delete(fn),addListener:fn=>listeners.add(fn),removeListener:fn=>listeners.delete(fn),dispatchEvent:()=>true}:original(query);
 window.__watcherReduced=value=>{if(reduced===value)return;reduced=value;listeners.forEach(fn=>fn({matches:reduced,media:'(prefers-reduced-motion: reduce)'}));};
})();`;
const head = `<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:; connect-src 'none';"><style>html,body{width:100%;height:100%;margin:0;background:transparent;overflow:hidden}</style><script>${prelude}</script>`;
const react = `${head}${legal}<style>${css}</style></head><body><div id="art"></div><script>${js.replace(/<\/script/gi, '<\\/script')}</script></body></html>`;
const assets = path.join(project, 'assets/product/motion');
const heroMask = `data:image/svg+xml;base64,${(await readFile(path.join(project, 'assets/product/step-hero-mask.svg'))).toString('base64')}`;
async function hero(name, key, source, id, prefix) {
  const fragment = await readFile(path.join(assets, name), 'utf8');
  const bridge = `window.WatcherArt={update(props){window.__WATCHER_ART_INITIAL__={...window.__WATCHER_ART_INITIAL__,...props};const p=window.__WATCHER_ART_INITIAL__;window.__watcherReduced(!!p.reducedMotion);window.dispatchEvent(new CustomEvent('openai:set_globals',{detail:{globals:{widgetState:{${key}:{source:'${source}',playing:p.active!==false&&!p.reducedMotion}}}}}));}};
window.addEventListener('message',event=>{try{const data=typeof event.data==='string'?JSON.parse(event.data):event.data;if(data&&data.type==='watcher-art')window.WatcherArt.update(data.props);}catch{}});
window.WatcherArt.update(window.__WATCHER_ART_INITIAL__);window.ReactNativeWebView?.postMessage('ready');`;
  return `${head}<style>#${id},#${id}[data-actual='true']{max-width:none!important;width:100%;height:100%;pointer-events:none;mask-image:url('${heroMask}');-webkit-mask-image:url('${heroMask}');mask-size:100% 100%;-webkit-mask-size:100% 100%;mask-repeat:no-repeat}#${id} .${prefix}-stage{width:100%;height:100%;aspect-ratio:auto}#${id} .${prefix}-controls{display:none!important}</style></head><body>${fragment}<script>${bridge}</script></body></html>`;
}
const gallery = await hero('gallery-motion-approved-2026-10-08.fragment.html', 'galleryMotion', 'portraits-v3', 'prince-gallery-motion', 'gm');
const mirror = await hero('matrix-mirror-approved-2026-10-08.fragment.html', 'matrixMirror', 'matrix-wall-v1', 'prince-matrix-mirror', 'mm');
const generated = path.join(project, 'src/features/product/motion/art.generated.ts');
const strings = { laboratoryHtml: react, galleryHtml: gallery, mirrorHtml: mirror };
await writeFile(generated, '// Generated by scripts/product-art/build.mjs. Preserve Laboratory attribution.\n' + Object.entries(strings).map(([key, value]) => `export const ${key} = ${JSON.stringify(value)};`).join('\n') + '\n');
await mkdir(path.join(here, 'preview'), { recursive: true });
for (const kind of ['distance', 'cells', 'diary', 'basic', 'intensive', 'guidance', 'parallel', 'comparison', 'attention', 'crowd', 'voice', 'gallery', 'mirror', 'insight', 'glass', 'rain']) {
  const html = kind === 'gallery' ? gallery : kind === 'mirror' ? mirror : react;
  await writeFile(path.join(here, 'preview', `${kind}.html`), html.replace(token, JSON.stringify({ kind, active: true, reducedMotion: false, level: kind === 'voice' ? .18 : 0,
    ...(kind === 'glass' ? {glass:{width:375,height:812,path:'M0 0H375V812H0Z',background:'clear'}} : {}) })));
}
console.log(JSON.stringify({ generated: path.relative(project, generated), javascriptBytes: Buffer.byteLength(js), htmlBytes: Object.fromEntries(Object.entries(strings).map(([k,v]) => [k, Buffer.byteLength(v)])), sha256: createHash('sha256').update(react).digest('hex') }));
