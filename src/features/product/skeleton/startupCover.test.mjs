import assert from 'node:assert/strict';
import test from 'node:test';
import { nextStartupCover, startupCover } from './startupCover.ts';

// The app's holding states in order: booting, the device setup screen, then home.
const walk = holds => holds.reduce((covers, holding) => [...covers, nextStartupCover(covers.at(-1), holding)], [startupCover(holds[0])]).slice(1);

test('leaving the setup screen before the engine arrives brings a fresh skeleton back', () => {
  // Booting is covered, the setup screen shows its own content, home waits for the engine.
  const covers = walk([true, true, false, true, true, false]);
  assert.deepEqual(covers.map(cover => cover.count), [0, 0, 0, 1, 1, 1]);
});

test('the first skeleton stays put while nothing changes, and an engine that is ready needs no second one', () => {
  const first = startupCover(true);
  assert.equal(nextStartupCover(first, true), first); // Same object: React keeps the same skeleton.
  assert.deepEqual(walk([true, false, false]).map(cover => cover.count), [0, 0, 0]);
});
