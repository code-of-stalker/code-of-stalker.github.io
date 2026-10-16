import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import vm from 'node:vm';

test('only a settled ancestor refreshes visibility; scrolling offscreen still pauses and cleanup detaches',()=>{
  let callback,listener,observed=0,unobserved=0,disconnected=false;const states=[];
  class Element {constructor(child){this.child=child;}contains(value){return this.child===value;}}
  class Observer {constructor(fn){callback=fn;}observe(){observed++;}unobserve(){unobserved++;}disconnect(){disconnected=true;}}
  const element=new Element();element.ownerDocument={addEventListener:(_name,fn)=>{listener=fn;},removeEventListener:()=>{listener=undefined;}};
  const exports={},code=ts.transpileModule(readFileSync(new URL('./motion-visibility.web.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  vm.runInNewContext(code,{exports,Element,IntersectionObserver:Observer});
  const stop=exports.observeMotionVisibility(element,value=>states.push(value));
  callback([{isIntersecting:false}]);assert.deepEqual(states,[false]);
  listener({target:new Element()});assert.equal(observed,1);
  listener({target:new Element(element)});assert.equal(observed,2);assert.equal(unobserved,1);
  callback([{isIntersecting:false},{isIntersecting:true}]);assert.deepEqual(states,[false,true]);
  callback([{isIntersecting:false}]);assert.deepEqual(states,[false,true,false]);
  stop();assert.ok(disconnected);assert.equal(listener,undefined);
});
