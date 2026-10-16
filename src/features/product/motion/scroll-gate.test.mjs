import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const exports = {};
vm.runInNewContext(ts.transpileModule(readFileSync(new URL('./scroll-gate-model.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText, { exports, Date, Math });
function setup() {
  let progress = 0, advances = 0;
  const gate = exports.createScrollGate(value => { progress = value; }, () => { advances++; });
  return { gate, progress: () => progress, advances: () => advances };
}
test('reading gesture cannot skip the scene when it reaches the bottom', () => {
  const s = setup(); s.gate.start(500, false); s.gate.move(0);
  s.gate.wheel(200, false, 0);
  for (let time = 20; time < 180; time += 20) s.gate.wheel(200, true, time);
  assert.equal(s.progress(), 0); assert.equal(s.advances(), 0);
});
test('a fresh deliberate upward pull completes exactly one transition', () => {
  const s = setup(); s.gate.start(500, true); s.gate.move(430);
  assert.equal(s.progress(), .5); assert.equal(s.advances(), 0);
  s.gate.move(340); s.gate.move(200); s.gate.wheel(400, true, 300);
  assert.equal(s.advances(), 1);
});

test('one continuous touch can finish reading and pull into the next scene', () => {
  const s = setup();
  s.gate.start(600, false);
  s.gate.move(400, false); // reading
  s.gate.move(180, true); // newly reached edge, no reading distance carried over
  assert.equal(s.progress(), 0); assert.equal(s.advances(), 0);
  s.gate.move(110, true);
  assert.equal(s.progress(), .5);
  s.gate.move(20, true); s.gate.move(0, true);
  assert.equal(s.advances(), 1);
});

test('leaving the edge cancels its pull, then the same touch can reach it again', () => {
  const s = setup(); s.gate.start(500, true); s.gate.move(430, true);
  assert.equal(s.progress(), .5);
  s.gate.move(460, false); assert.equal(s.progress(), 0);
  s.gate.move(420, true); assert.equal(s.progress(), 0);
  s.gate.move(260, true); assert.equal(s.advances(), 1);
});

test('a released or reset touch cannot use later movement to skip a scene', () => {
  const s = setup(); s.gate.start(500, false); s.gate.end(); s.gate.move(0, true);
  assert.equal(s.advances(), 0);
  s.gate.start(500, true); s.gate.move(430, true); s.gate.end(true);
  assert.equal(s.progress(), 0);
  s.gate.start(500, true); s.gate.reset(); s.gate.move(0, true);
  assert.equal(s.advances(), 0);
});

test('a partial deliberate pull can continue after lifting the finger', () => {
  const s = setup(); s.gate.start(500, true); s.gate.move(430, true); s.gate.end();
  s.gate.start(500, true); s.gate.move(420, true);
  assert.equal(s.advances(), 1);
});
test('reversing an incomplete pull cancels its progress', () => {
  const s = setup(); s.gate.start(500, true); s.gate.move(430); s.gate.move(510);
  assert.equal(s.progress(), 0); assert.equal(s.advances(), 0);
});
test('wheel is rearmed after reading stops, with a visible gradual cue', () => {
  const s = setup(); s.gate.wheel(400, false, 0); s.gate.wheel(400, true, 30);
  s.gate.wheel(400, true, 300); assert.ok(s.progress() > 0 && s.progress() < 1);
  s.gate.wheel(400, true, 330); s.gate.wheel(400, true, 360); s.gate.wheel(400, true, 390);
  assert.equal(s.advances(), 1);
});

test('downward pull at the start returns exactly one scene, at either boundary it follows the gesture', () => {
  let back = 0, next = 0, progress = 0;
  const gate = exports.createScrollGate(value => { progress = value; }, () => { next++; }, () => { back++; });
  gate.start(300, true, true); gate.move(370); assert.equal(progress, -.5);
  gate.move(450); gate.move(600); assert.equal(back, 1); assert.equal(next, 0);
});

test('one continuous downward touch can finish reading back to the top and retreat', () => {
  let back = 0, next = 0, progress = 0;
  const gate = exports.createScrollGate(value => { progress = value; }, () => { next++; }, () => { back++; });
  gate.start(100, false, false); gate.move(200, false, false); gate.move(300, false, true);
  assert.equal(progress, 0); assert.equal(back, 0);
  gate.move(370, false, true); assert.equal(progress, -.5);
  gate.move(450, false, true); assert.equal(back, 1); assert.equal(next, 0);
});

test('reading down to the top does not retreat on wheel momentum', () => {
  let back = 0;
  const gate = exports.createScrollGate(() => {}, () => {}, () => { back++; });
  gate.wheel(-200, false, 0, false);
  for (let time = 20; time < 180; time += 20) gate.wheel(-200, false, time, true);
  assert.equal(back, 0);
  for (let time = 400; time < 550; time += 30) gate.wheel(-200, false, time, true);
  assert.equal(back, 1);
});

test('decoder completion cannot convert an ongoing wheel gesture into navigation', () => {
  const s=setup();s.gate.block();
  for(let at=0;at<=300;at+=30)s.gate.wheel(80,false,at);
  for(let at=330;at<=600;at+=30)s.gate.wheel(80,true,at);
  assert.equal(s.progress(),0);assert.equal(s.advances(),0);
  for(let at=900;at<=1020;at+=30)s.gate.wheel(80,true,at);
  assert.equal(s.advances(),1);
});

test('blocking discards an in-progress touch until a fresh gesture begins', () => {
  const s=setup();s.gate.start(500,true);s.gate.move(450,true);s.gate.block();
  s.gate.move(150,true);assert.equal(s.progress(),0);assert.equal(s.advances(),0);
  s.gate.start(500,true);s.gate.move(340,true);assert.equal(s.advances(),1);
});

test('a wheel burst cannot skip through a remounted previous scene', () => {
  const activity = { current: -Infinity };
  let back = 0;
  const first = exports.createScrollGate(() => {}, () => {}, () => back++, activity);
  for (let at = 0; at < 120; at += 30) first.wheel(-80, false, at, true);
  assert.equal(back, 1);
  const previous = exports.createScrollGate(() => {}, () => {}, () => back++, activity);
  for (let at = 120; at <= 600; at += 30) previous.wheel(-80, false, at, true);
  assert.equal(back, 1);
  for (let at = 900; at < 1020; at += 30) previous.wheel(-80, false, at, true);
  assert.equal(back, 2);
});
