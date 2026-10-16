import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import ts from 'typescript';

const filename = fileURLToPath(new URL('./gesture.ts', import.meta.url));
const source = ts.transpileModule(readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
}).outputText;
function setup() {
  let now = 0, nextTimer = 1, opens = 0;
  const timers = new Map(), events = [], exports = {};
  vm.runInNewContext(source, { exports, require: createRequire(filename), Math, Date: { now: () => now },
    setTimeout(fn, delay) { const id = nextTimer++; timers.set(id, { at: now + delay, fn }); return id; },
    clearTimeout(id) { timers.delete(id); },
  }, { filename });
  const gesture = exports.createArtGesture(value => events.push(value), () => { opens++; });
  const delay = exports.artHoldDelay('diary');
  return { gesture, delay, timers, events, opens: () => opens,
    advance(ms) { now += ms; for (const [id, timer] of timers) if (timer.at <= now) { timers.delete(id); timer.fn(); } },
  };
}
test('artwork short tap navigates once after release', () => {
  const { gesture, delay, advance, opens, events, timers } = setup();
  gesture.begin(288, 200, delay); advance(100); gesture.end(); gesture.end();
  assert.equal(opens(), 1); assert.equal(events.at(-1).action, 'tap'); assert.equal(timers.size, 0);
});
test('holding artwork responds visually but never navigates', () => {
  const { gesture, delay, advance, opens, events } = setup();
  gesture.begin(288, 200, delay); advance(delay); gesture.end();
  assert.equal(opens(), 0); assert.equal(events[0].action, 'hold'); assert.equal(events.at(-1).action, 'release');
});
test('dragging artwork stays on the screen and clamps parallax', () => {
  const { gesture, delay, opens, events } = setup();
  gesture.begin(288, 200, delay); gesture.move(1000, -1000); gesture.end();
  assert.equal(opens(), 0);
  const move = events.find(event => event.action === 'move');
  assert.equal(move.x, 1); assert.equal(move.y, -1); assert.equal(events.at(-1).action, 'release');
});
test('cancellation releases artwork and cannot fire a late hold', () => {
  const { gesture, delay, advance, opens, events, timers } = setup();
  gesture.begin(288, 200, delay); gesture.cancel();
  const count = events.length; advance(delay * 2);
  assert.equal(events.length, count); assert.equal(events.at(-1).action, 'release'); assert.equal(opens(), 0); assert.equal(timers.size, 0);
});
test('releasing outside the artwork does not navigate', () => {
  const { gesture, delay, advance, opens } = setup();
  gesture.begin(288, 200, delay); advance(10); gesture.end(false); assert.equal(opens(), 0);
});
test('keyboard or screen reader activation cancels a pending hold and navigates', () => {
  const { gesture, delay, advance, opens, events, timers } = setup();
  gesture.begin(288, 200, delay); gesture.activate(); advance(delay * 2);
  assert.equal(opens(), 1); assert.equal(events.at(-1).action, 'tap'); assert.equal(timers.size, 0);
});
