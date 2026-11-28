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
  return { gesture, delay, timers, events, card: exports, opens: () => opens,
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
// A home card's graphics can take a minute to download on 3G. A tap in that time used to wait for
// the engine's verdict, got none and was dropped: the card never ignores a tap now.
test('a card tap before the engine is ready opens the card', () => {
  const { card } = setup();
  const press = card.cardPressStart(100, 80, false);
  card.cardPressMove(press, 104, 83);
  assert.equal(card.cardPressOpens(press, true, undefined), true);
  assert.equal(card.cardPressOpens(press, false, undefined), false); // Released outside.
  const dragged = card.cardPressStart(100, 80, false);
  card.cardPressMove(dragged, 100, 95); card.cardPressMove(dragged, 100, 81); // Strayed, then came back.
  assert.equal(card.cardPressOpens(dragged, true, undefined), false);
  assert.equal(card.cardPressOpens(undefined, true, undefined), false); // No press began here.
});
test('a press the engine followed keeps its verdict, and a lost verdict falls back to the tap rule', () => {
  const { card } = setup();
  const followed = card.cardPressStart(0, 0, true);
  assert.equal(card.cardPressOpens(followed, true, false), false); // A hold plays the Laboratory instead.
  assert.equal(card.cardPressOpens(followed, true, true), true);
  assert.equal(card.cardPressOpens(followed, true, undefined), true); // The engine crashed mid-press.
  // The engine became ready mid-press: it never saw the start, so its answer is not asked.
  assert.equal(card.cardPressOpens(card.cardPressStart(0, 0, false), true, false), true);
});
