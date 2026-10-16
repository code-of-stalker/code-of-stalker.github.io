import {parseSvg,matchesChain,matrix} from './svg-dom.mjs';
const esc=value=>String(value).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;');
const declarations=body=>Object.fromEntries([...body.matchAll(/([\w-]+)\s*:\s*([^;{}]+)(?:;|$)/g)].map(m=>[m[1],m[2].trim()]));
const resolve=value=>value.replace(/var\([^,()]+,\s*([^()]+)\)/g,'$1').replace(/!important/g,'').trim();
function blocks(css){const out=[];let p=0;while(p<css.length){const open=css.indexOf('{',p);if(open<0)break;let depth=1,end=open+1;for(;end<css.length&&depth;end++){if(css[end]==='{')depth++;else if(css[end]==='}')depth--;}
 out.push([css.slice(p,open).trim(),css.slice(open+1,end-1)]);p=end;}return out;}
function transform(value,origin){const normalized=value.replaceAll('translateX(','translate(').replaceAll('translateY(','translateY(').replaceAll('scaleX(','scaleX(');
 const v=normalized.replace(/translateY\(([^)]+)\)/g,'translate(0 $1)').replace(/scaleX\(([^)]+)\)/g,'scale($1 1)').replace(/scaleY\(([^)]+)\)/g,'scale(1 $1)').replaceAll('px','').replaceAll('deg','');
 const point=(origin??'0 0').match(/[-+]?\d*\.?\d+/g)?.map(Number)??[0,0];const m=matrix(`translate(${point[0]} ${point[1]??0}) ${v} translate(${-point[0]} ${-(point[1]??0)})`);return [m.a,m.b,m.c,m.d,m.e,m.f].join(' ');}
export function compileCssMotion(source){
 const svg=parseSvg(source),nodes=[svg,...svg.querySelectorAll('*')],css=svg.querySelector('style')?.textContent??'';
 const rules=blocks(css.replace(/\/\*[\s\S]*?\*\//g,'')),keyframes=new Map(rules.filter(([key])=>key.startsWith('@keyframes')).map(([key,body])=>[key.split(/\s+/)[1],blocks(body)]));
 const statics=rules.filter(([key])=>!key.startsWith('@')),fields=[];
 nodes.forEach((node,index)=>{
  node.setAttribute('data-rust-node',index);let style={};
  for(const [selector,body] of statics)if(selector.split(',').some(s=>matchesChain(node,s.trim())))style={...style,...declarations(body)};
  for(const [name,value] of Object.entries(style))if(['fill','stroke','color','opacity','stroke-width','stroke-dasharray','stroke-dashoffset','stop-color','stop-opacity','fill-rule'].includes(name))node.setAttribute(name,resolve(value));
  if(style.transform)node.setAttribute('transform',`matrix(${transform(style.transform,style['transform-origin'])})`);
  const animation=style.animation;if(!animation)return;
  const resolved=resolve(animation),name=resolved.split(/\s+/)[0],seconds=Number(resolved.match(/([\d.]+)s/)?.[1]??0),steps=keyframes.get(name);if(!seconds||!steps)return;
  const bezier=resolved.match(/cubic-bezier\(([^)]+)\)/)?.[1]??(resolved.includes('ease-in-out')?'.42 0 .58 1':resolved.includes('linear')?'0 0 1 1':'.25 .1 .25 1');
  const attributes=new Map();
  for(const [times,body] of steps)for(const [prop,raw] of Object.entries(declarations(body))){const value=prop==='transform'?transform(resolve(raw),style['transform-origin']):resolve(raw);
   const frames=attributes.get(prop)??[];for(const time of times.split(','))frames.push([Number(time.replace('%',''))*.01*seconds,value]);attributes.set(prop,frames);}
  for(const [prop,values] of attributes){values.sort((a,b)=>a[0]-b[0]);fields.push(`<field node="${index}" name="css:${esc(prop)}" duration="${seconds}" curve="${esc(bezier.replaceAll(',',' '))}">${values.map(([t,v])=>`<v t="${t}" value="${esc(v)}"/>`).join('')}</field>`);}
 });
 // Browser CSS never advances the scene. Rust supplies every intermediate frame.
 const style=svg.querySelector('style');if(style)style.textContent+='\n[data-rust-node]{animation:none!important;transition:none!important}';
 return {svg:svg.outerHTML,tracks:'<tracks duration="0">'+fields.join('')+'</tracks>',fields:fields.length};
}
