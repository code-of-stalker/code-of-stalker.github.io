import {parsePath, serializePath, handles} from './path-data.mjs';

const $ = id => document.getElementById(id);
const ns = 'http://www.w3.org/2000/svg';
const state = {name:'', source:'', hash:'', originals:[], paths:[], selected:0, edits:new Map(), history:[], future:[], preview:null, time:0, lastFrame:-1, playing:true, stamp:0, drag:null, zoom:1, baseBox:null};
const message = (value, error=false) => { $('status').textContent=value; $('status').classList.toggle('error',error); };
async function api(url, options) { const response=await fetch(url,options); const body=await response.json(); if(!response.ok) throw new Error(body.error||`HTTP ${response.status}`); return body; }
const post = (url, data) => api(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
const selectedPath = () => state.paths[state.selected];
const snapshot = () => new Map(state.edits);
function updateButtons() { $('undo').disabled=!state.history.length; $('redo').disabled=!state.future.length; $('reset').disabled=!state.edits.size; $('save').disabled=!state.edits.size; }
function choose(index) {
  state.selected=index;
  state.paths.forEach((node,i)=>node.classList.toggle('selected',i===index));
  [...$('paths').children].forEach((button,i)=>button.classList.toggle('active',i===index));
  zoomTo();drawHandles();
}
function zoomTo() {
  if(!state.baseBox)return;
  const [x,y,width,height]=state.baseBox, focus=state.zoom>1?selectedPath()?.getBBox():null;
  const centerX=focus?focus.x+focus.width/2:x+width/2, centerY=focus?focus.y+focus.height/2:y+height/2;
  const w=width/state.zoom,h=height/state.zoom;
  $('assetSvg').setAttribute('viewBox',`${centerX-w/2} ${centerY-h/2} ${w} ${h}`);
  $('zoomLabel').textContent=`${state.zoom}×`;
  $('zoomOut').disabled=state.zoom===1;$('zoomIn').disabled=state.zoom===8;
}
function drawHandles() {
  const overlay=$('handles'); overlay.replaceChildren();
  const path=selectedPath(); if(!path) return;
  try {
    const points=handles(parsePath(path.getAttribute('d')||''));
    for(const point of points) {
      const circle=document.createElementNS(ns,'circle');
      circle.setAttribute('cx',point.x);circle.setAttribute('cy',point.y);
      circle.setAttribute('r',(point.control?1.3:1.65)/state.zoom);
      circle.setAttribute('class',`handle${point.control?' control':''}`);
      circle.dataset.command=point.command;circle.dataset.offset=point.offset;
      const title=document.createElementNS(ns,'title');title.textContent=`${point.control?'Curve control':'Anchor'}: ${point.x.toFixed(2)}, ${point.y.toFixed(2)}`;circle.append(title);
      overlay.append(circle);
    }
  } catch(error) { message(`This path cannot be edited: ${error.message}`,true); }
}
function previewEditedPath(index,d) {
  const group=$('artwork').firstElementChild;
  const className=group?.classList?.[0];
  const target=className && $('preview').querySelector(`.${CSS.escape(className)}`);
  const path=target?.querySelectorAll('path')[index];
  if(path) path.setAttribute('d',d);
}
function changePath(index,d) {
  state.paths[index].setAttribute('d',d);
  if(d===state.originals[index]) state.edits.delete(index); else state.edits.set(index,d);
  previewEditedPath(index,d); drawHandles(); updateButtons();
}
function applyEdits(next) {
  state.edits=new Map(next);
  state.paths.forEach((node,index)=>{ const d=state.edits.get(index)||state.originals[index];node.setAttribute('d',d);previewEditedPath(index,d); });
  drawHandles();updateButtons();
}
function undo() {
  if(!state.history.length)return false;
  state.future.push(snapshot());applyEdits(state.history.pop());return true;
}
function redo() {
  if(!state.future.length)return false;
  state.history.push(snapshot());applyEdits(state.future.pop());return true;
}
function point(event) { const p=$('assetSvg').createSVGPoint();p.x=event.clientX;p.y=event.clientY;return p.matrixTransform($('assetSvg').getScreenCTM().inverse()); }
function fitAsset() { try { const box=$('artwork').getBBox(),pad=Math.max(box.width,box.height)*.13||10;state.baseBox=[box.x-pad,box.y-pad,box.width+pad*2,box.height+pad*2];state.zoom=1;zoomTo(); } catch {} }
function setSource(data) {
  state.name=data.name;state.source=data.source;state.hash=data.hash;state.edits=new Map();state.history=[];state.future=[];
  const artwork=$('artwork'); artwork.innerHTML=data.source;
  state.paths=[...artwork.querySelectorAll('path')];state.originals=state.paths.map(node=>node.getAttribute('d')||'');
  const list=$('paths');list.replaceChildren();state.paths.forEach((node,index)=>{
    const button=document.createElement('button');button.textContent=`Path ${index+1}`;button.title=(node.getAttribute('d')||'').slice(0,95);button.onclick=()=>choose(index);list.append(button);
    node.addEventListener('pointerdown',event=>{ if(event.shiftKey) { choose(index);startDrag(event,'path'); } else choose(index); });
  });
  fitAsset();choose(Math.min(state.selected,state.paths.length-1));updateButtons();void loadBackups();
  message(`Loaded ${data.name}: ${state.paths.length} editable paths.`);
}
async function loadAsset() { try { setSource(await api(`/api/asset?name=${encodeURIComponent($('asset').value)}`)); } catch(error) {message(error.message,true);} }
async function loadBackups() { const {backups}=await api(`/api/backups?name=${encodeURIComponent(state.name)}`);$('backups').replaceChildren(...backups.map(name=>new Option(name.replace(`${state.name}.`,''),name)));$('restore').disabled=!backups.length; }
function startDrag(event,mode) {
  if(!selectedPath())return;
  event.preventDefault();
  const before=snapshot(),start=point(event),commands=parsePath(selectedPath().getAttribute('d')||'');
  state.drag={mode,index:state.selected,commands,start,before,command:Number(event.target.dataset.command),offset:Number(event.target.dataset.offset),changed:false};
  $('assetSvg').setPointerCapture(event.pointerId);
}
$('handles').addEventListener('pointerdown',event=>{if(event.target.classList.contains('handle'))startDrag(event,'handle');});
$('assetSvg').addEventListener('pointermove',event=>{
  const drag=state.drag;if(!drag)return;
  const now=point(event),dx=now.x-drag.start.x,dy=now.y-drag.start.y;
  const commands=structuredClone(drag.commands);
  if(drag.mode==='handle') {const v=commands[drag.command].values;v[drag.offset]+=dx;v[drag.offset+1]+=dy;}
  else for(const item of commands) for(const handle of handles([item])) {item.values[handle.offset]+=dx;item.values[handle.offset+1]+=dy;}
  const d=serializePath(commands);drag.changed=d!==serializePath(drag.commands);changePath(drag.index,d);
});
function endDrag() {if(!state.drag)return;if(state.drag.changed){state.history.push(state.drag.before);state.future=[];}state.drag=null;updateButtons();}
$('assetSvg').addEventListener('pointerup',endDrag);$('assetSvg').addEventListener('pointercancel',endDrag);
function frame() {
  const preview=state.preview;if(!preview)return;
  const index=Math.max(0,Math.min(preview.frames.length-1,Math.floor(state.time*preview.fps)));
  const svg=$('preview').querySelector('svg');
  if(index!==state.lastFrame){for(const update of preview.frames[index]) for(const node of svg.querySelectorAll(update.selector)) node.setAttribute(update.attribute,update.value);state.lastFrame=index;}
  $('time').value=String(Math.round(state.time/(preview.frames.length/preview.fps)*1000));$('clock').textContent=`${state.time.toFixed(1)} s`;
}
async function loadPreview() {
  message(`Building Rust preview for ${$('scene').value}…`);
  try {state.preview=await api(`/api/preview?kind=${encodeURIComponent($('scene').value)}`);$('preview').innerHTML=state.preview.svg;state.time=0;state.lastFrame=-1;frame();state.stamp=performance.now();
    for(const [index,d] of state.edits) previewEditedPath(index,d);
    message('Rust scene preview ready.');
  } catch(error) {message(`Preview unavailable: ${error.message}`,true);}
}
function tick(now) {if(state.playing&&state.preview){state.time=(state.time+Math.max(0,Math.min((now-state.stamp)/1000,.08)))%(state.preview.frames.length/state.preview.fps);frame();}state.stamp=now;requestAnimationFrame(tick);}
$('play').onclick=()=>{state.playing=!state.playing;$('play').textContent=state.playing?'Pause':'Play';};
$('time').oninput=()=>{if(state.preview){state.time=Number($('time').value)/1000*(state.preview.frames.length/state.preview.fps);frame();}};
$('zoomIn').onclick=()=>{state.zoom=Math.min(8,state.zoom*2);zoomTo();drawHandles();};
$('zoomOut').onclick=()=>{state.zoom=Math.max(1,state.zoom/2);zoomTo();drawHandles();};
$('zoomFit').onclick=()=>{state.zoom=1;zoomTo();drawHandles();};
$('undo').onclick=undo;
$('redo').onclick=redo;
document.addEventListener('keydown',event=>{
  if(event.defaultPrevented||event.isComposing||!event.ctrlKey||event.metaKey||event.shiftKey||!(event.code==='KeyZ'||event.key.toLowerCase()==='z'))return;
  if(event.target instanceof Element&&event.target.closest('input, textarea, [contenteditable]'))return;
  if((event.altKey?redo():undo()))event.preventDefault();
});
$('reset').onclick=()=>{state.history.push(snapshot());state.future=[];applyEdits(new Map());};
$('reload').onclick=async()=>{if(state.edits.size&&!confirm('Discard unsaved path edits?'))return;await loadAsset();await loadPreview();};
$('save').onclick=async()=>{try {const result=await post('/api/save',{name:state.name,baseHash:state.hash,changes:[...state.edits].map(([index,d])=>({index,d}))});setSource(result);await loadPreview();message(`Saved ${state.name}. Previous version is available under Earlier save.`);}catch(error){message(error.message,true);}};
$('restore').onclick=async()=>{const backupName=$('backups').value;if(!backupName)return;try{const result=await post('/api/restore',{name:state.name,baseHash:state.hash,backupName});setSource(result);await loadPreview();message(`Restored ${backupName}. The replaced version was backed up.`);}catch(error){message(error.message,true);}};
$('asset').onchange=async()=>{if(state.edits.size&&!confirm('Discard unsaved path edits?')){$('asset').value=state.name;return;}await loadAsset();await loadPreview();};$('scene').onchange=loadPreview;
window.addEventListener('beforeunload',event=>{if(state.edits.size){event.preventDefault();event.returnValue='';}});
try {const catalog=await api('/api/catalog');$('asset').replaceChildren(...catalog.assets.map(name=>new Option(name,name)));$('scene').replaceChildren(...catalog.scenes.map(name=>new Option(name,name)));$('asset').value='task-writing-hand.svg';$('scene').value='author-intention';await loadAsset();await loadPreview();}catch(error){message(error.message,true);}
requestAnimationFrame(tick);
