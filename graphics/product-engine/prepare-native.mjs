/** Package the identical Rust graphics engine as a self-contained native asset.
 * Bootstrap decompression also runs in Rust. No network or JS scene fallback. */
import fs from 'node:fs';import {deflateSync} from 'node:zlib';
const pkg='public/graphics/pkg/',kernel='public/graphics/native-kernel/';
function glue(file,names){let source=fs.readFileSync(file,'utf8').replace(/^export\s*\{[^}]*\};?\s*$/mg,'').replace(/\bexport\s+(?=(?:async\s+)?function|class|const|let|var)/g,'').replaceAll('import.meta.url',"'about:blank'");return `(()=>{${source}\nreturn {${names.join(',')}};})()`;}
const boot=glue(kernel+'watcher_native_bridge.js',['initSync','NativeKernel','inflate_runtime','typography']);
const bootBytes=fs.readFileSync(kernel+'watcher_native_bridge_bg.wasm').toString('base64');
const init=`const decode=text=>Uint8Array.from(atob(text),c=>c.charCodeAt(0));const boot=${boot};boot.initSync({module:decode('${bootBytes}')});`;
const nativeKernelHtml=`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none';script-src 'unsafe-inline' 'wasm-unsafe-eval';style-src 'unsafe-inline'"><script>${init}
const core=boot.NativeKernel.create();let job=0,active=true;const send=value=>window.ReactNativeWebView?.postMessage(JSON.stringify(value));
function tick(at){job=0;if(!active)return;const values=core.frame(at),texts=JSON.parse(core.frame_text(at)),readings=core.frame_reading(at),focuses=JSON.parse(core.frame_reading_focus(at));if(values.length||texts.length||readings.length||focuses.length)send({type:'values',values:Array.from(values),texts,readings:Array.from(readings),focuses});if(core.moving())job=requestAnimationFrame(tick);}
function request(){if(!job&&active)job=requestAnimationFrame(tick);}
window.NativeMotion={command(name,args){if(name==='observe_reading'||name==='drag_reading')args[2]=performance.now();core[name](...args);if(name==='active')active=args[0];if(!active){cancelAnimationFrame(job);job=0;}else request();},typography(text,effect,time,reduced){return boot.typography(text,effect,time,reduced);}};
send({type:'ready'});</script>`;
fs.writeFileSync('src/features/product/motion/nativeKernel.generated.ts',`// Generated Rust/WASM bridge. Do not add animation logic here.\nexport const nativeKernelHtml=${JSON.stringify(nativeKernelHtml)};\n`);
const runtime=glue(pkg+'watcher_graphics.js',['initialize:__wbg_init','ProductRenderer','SvgTimeline','ElementTimeline','TextTimeline','provide_asset']);
// The web fetches the published inputs per scene; the native runtime bundles all of them.
const inputs=Object.fromEntries(fs.readdirSync(pkg+'assets').sort().map(file=>[file,fs.readFileSync(pkg+'assets/'+file).toString('base64')]));
const zipped=deflateSync(fs.readFileSync(pkg+'watcher_graphics_bg.wasm'),{level:9});
const fonts=[['DisketMono','Disket-Mono-Regular.ttf'],['DisketMonoBold','Disket-Mono-Bold.ttf'],['Tektur','Tektur-Variable.ttf']].map(([family,file])=>`@font-face{font-family:${family};src:url(data:font/ttf;base64,${fs.readFileSync('assets/product/fonts/'+file).toString('base64')})}`).join('');
const document=`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none';script-src 'unsafe-inline' 'wasm-unsafe-eval';style-src 'unsafe-inline';img-src data:;font-src data:"><style>html,body{margin:0;width:100%;height:100%;overflow:hidden;background:transparent}#model,canvas{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}</style></head><body><div id="model"></div><canvas id="output"></canvas><script>
(async()=>{${init}document.head.insertAdjacentHTML('beforeend',${JSON.stringify('<style>'+fonts+'</style>')});const module=${runtime};
// Both compilation AND instantiation must be asynchronous above 8 MiB.
// Use the installed wasm-bindgen initializer, without network access.
await module.initialize({module_or_path:boot.inflate_runtime(decode('${zipped.toString('base64')}'))});
for(const [file,bytes] of Object.entries(${JSON.stringify(inputs)}))module.provide_asset(file,decode(bytes));
${fs.readFileSync('graphics/product-engine/native-art-adapter.js','utf8')}
})().catch(error=>window.ReactNativeWebView?.postMessage(JSON.stringify({type:'watcher-rust-error',message:String(error)})));
</script></body></html>`;
fs.mkdirSync('assets/product/rust',{recursive:true});fs.writeFileSync('assets/product/rust/graphics-runtime.html',document);
console.log(JSON.stringify({nativeKernelBytes:Buffer.byteLength(nativeKernelHtml),nativeGraphicsBytes:Buffer.byteLength(document),rustWasmBytes:fs.statSync(pkg+'watcher_graphics_bg.wasm').size,compressedWasmBytes:zipped.length}));
