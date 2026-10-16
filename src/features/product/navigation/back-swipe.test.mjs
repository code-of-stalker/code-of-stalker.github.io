import assert from 'node:assert/strict';
import test from 'node:test';
import { BackSwipe } from './back-swipe.ts';

test('rightward swipe goes back once and ignores short taps', () => {
  const gesture = new BackSwipe();
  gesture.begin(40, 100, 0); gesture.move(95, 108);
  assert.equal(gesture.finish(150, 111, 400), true);
  assert.equal(gesture.finish(150, 111, 420), false);
  gesture.begin(40, 100, 0);
  assert.equal(gesture.finish(70, 100, 150), false);
});
test('vertical scrolling and leftward intent cannot turn into back', () => {
  const gesture = new BackSwipe();
  gesture.begin(40, 100, 0); gesture.move(50, 130);
  assert.equal(gesture.finish(180, 140, 500), false);
  gesture.begin(100, 100, 0); gesture.move(70, 100);
  assert.equal(gesture.finish(240, 100, 500), false);
});
test('cancelled and diagonal gestures stay on the screen; deliberate slow swipes work', () => {
  const gesture = new BackSwipe();
  gesture.begin(40, 100, 0); gesture.cancel();
  assert.equal(gesture.finish(200, 100, 300), false);
  gesture.begin(40, 100, 0);
  assert.equal(gesture.finish(160, 180, 400), false);
  gesture.begin(40, 100, 0);
  assert.equal(gesture.finish(160, 100, 1400), true);
});

test('a drag exposes progress, can reverse, and adapts its threshold to a tablet', () => {
  const gesture = new BackSwipe();gesture.begin(8, 180, 0, 768);
  assert.equal(gesture.move(72,182).claimed,true);
  assert.ok(gesture.move(110,182).progress<1);
  assert.equal(gesture.move(150,182).progress,1);
  assert.ok(gesture.move(45,182).progress<.5);
  assert.equal(gesture.finish(45,182,700),false);
});
