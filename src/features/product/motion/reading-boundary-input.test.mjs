import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function load(name) {
 const exports={};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL(name+'.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports,Math,Date,require:id=>load(id)});
 return exports;
}
const {consumesReadingInput,createReadingBoundaryInput}=load('./reading-boundary-input');
function setup() {
 let back=0,progress=0; const drags=[];
 const state={enabled:true,onDrag:d=>drags.push(d),retreat:{atRest:true,onRetreat:()=>back++,onProgress:p=>progress=p}};
 return {state,drags,input:createReadingBoundaryInput(()=>state),back:()=>back,progress:()=>progress};
}
test('collapsed reader hands only reverse boundary input to its existing gate',()=>{
 assert.equal(consumesReadingInput({locked:true,atRest:true},-40,true),false);
 assert.equal(consumesReadingInput({locked:true,atRest:true},40,true),true);
 assert.equal(consumesReadingInput({locked:true,atRest:false},-40,true),true);
 assert.equal(consumesReadingInput({locked:false,atRest:false},-40,true),true);
 assert.equal(consumesReadingInput({locked:false,atRest:false},-40,false),false);
 // Steps that do not opt into boundary retreat keep their existing behavior.
 assert.equal(consumesReadingInput({locked:true},-40,true),true);
});
test('hero wheel retreats once and cannot double-fire on momentum',()=>{
 const s=setup();for(let i=0;i<20;i++)s.input.wheel(-80,i*20);
 assert.equal(s.back(),1);assert.equal(s.progress(),-1);assert.deepEqual(s.drags,[]);
});
test('collapse wheel tail cannot become navigation; fresh pull can',()=>{
 const s=setup();s.state.retreat.atRest=false;s.input.wheel(-80,0);
 s.state.retreat.atRest=true;for(let i=1;i<20;i++)s.input.wheel(-80,i*20);
 assert.equal(s.back(),0);
 for(let i=0;i<4;i++)s.input.wheel(-80,800+i*20);
 assert.equal(s.back(),1);
});
test('reversed partial wheel pull resets, opening remains possible',()=>{
 const s=setup();s.input.wheel(-80,0);assert(s.progress()<0);
 s.input.wheel(40,30);assert.equal(s.progress(),0);assert.deepEqual(s.drags,[40]);
 for(let i=0;i<4;i++)s.input.wheel(-80,400+i*20);assert.equal(s.back(),1);
});
test('touch retreat uses existing 140px threshold and locks once',()=>{
 const s=setup();s.input.start(200);s.input.move(270);assert.equal(s.progress(),-.5);
 s.input.move(350);s.input.move(500);assert.equal(s.back(),1);
});
test('interrupted touch resets and a fresh gesture is not trapped',()=>{
 const s=setup();s.input.start(200);s.input.move(270);s.input.end(true);
 assert.equal(s.progress(),0);assert.equal(s.back(),0);
 s.input.start(300);s.input.move(450);assert.equal(s.back(),1);
});
test('touch collapsing the reader stays reading until released',()=>{
 const s=setup();s.state.retreat.atRest=false;s.input.start(200);s.input.move(260);
 s.state.retreat.atRest=true;s.input.move(500);assert.equal(s.back(),0);
 s.input.end();s.input.start(200);s.input.move(350);assert.equal(s.back(),1);
});
test('menu/gesture block discards partial progress and resumes safely',()=>{
 const s=setup();s.input.start(200);s.input.move(270);s.state.enabled=false;s.input.block();s.input.move(500);
 assert.equal(s.back(),0);assert.equal(s.progress(),0);
 s.state.enabled=true;s.input.start(200);s.input.move(350);assert.equal(s.back(),1);
});
