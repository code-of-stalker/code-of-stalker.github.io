import assert from 'node:assert/strict';
import test from 'node:test';
import { registerHooks } from 'node:module';

registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('.') && !/\.(ts|mjs|js)$/.test(specifier)) return nextResolve(specifier + '.ts', context);
  return nextResolve(specifier, context);
} });
const { AutomaticVoiceReceiver, ReceiverCleanupError } = await import('../src/matrix/automatic-voice-receiver.ts');
const drain = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
function deferred() {
  let resolve, reject;
  const promise = new Promise((ok, no) => { resolve = ok; reject = no; });
  return { promise, resolve, reject };
}
function clock() {
  const savedSet = globalThis.setTimeout, savedClear = globalThis.clearTimeout;
  let now = 0, id = 0;
  const pending = new Map();
  globalThis.setTimeout = (callback, delay) => { pending.set(++id, { callback, at: now + delay }); return id; };
  globalThis.clearTimeout = (timer) => pending.delete(timer);
  return {
    async advance(ms) {
      now += ms;
      for (const [key, timer] of [...pending]) if (timer.at <= now) { pending.delete(key); timer.callback(); }
      await drain();
    },
    get size() { return pending.size; },
    restore() { globalThis.setTimeout = savedSet; globalThis.clearTimeout = savedClear; },
  };
}

test('starts once when enabled, pauses on background and waits for native cleanup before resuming', async () => {
  const timer = clock(), tasks = [], failures = [];
  const receiver = new AutomaticVoiceReceiver({ starting() {}, failed(error) { failures.push(error); },
    receive(signal) { const task = deferred(); tasks.push({ signal, ...task }); return task.promise; } });
  try {
    assert.equal(timer.size, 0);
    receiver.setEnabled(true); receiver.setEnabled(true);
    await timer.advance(49); assert.equal(tasks.length, 0);
    await timer.advance(1); assert.equal(tasks.length, 1);
    let stopped = false;
    const pause = receiver.pause().then(() => { stopped = true; });
    assert.equal(tasks[0].signal.aborted, true);
    receiver.setEnabled(true);
    await timer.advance(500); assert.equal(tasks.length, 1); assert.equal(stopped, false);
    tasks[0].reject(new Error('normal cancellation')); await pause;
    assert.equal(stopped, true); assert.equal(failures.length, 0);
    await timer.advance(50); assert.equal(tasks.length, 2);
    const lastPause = receiver.pause(); tasks[1].resolve(); await lastPause;
    await timer.advance(100_000); assert.equal(tasks.length, 2);
  } finally { timer.restore(); }
});

test('manual work can start only after cancellation and real cleanup settle', async () => {
  const timer = clock(), cleanup = deferred(), trace = [];
  const receiver = new AutomaticVoiceReceiver({ starting() {}, failed() {}, receive(signal) {
    trace.push('sync-start'); signal.addEventListener('abort', () => trace.push('cancel'));
    return cleanup.promise;
  } });
  try {
    receiver.setEnabled(true); await timer.advance(50);
    const manual = receiver.pause().then(() => trace.push('manual-start'));
    await drain(); assert.deepEqual(trace, ['sync-start', 'cancel']);
    trace.push('sync-stopped'); cleanup.resolve(); await manual;
    assert.deepEqual(trace, ['sync-start', 'cancel', 'sync-stopped', 'manual-start']);
  } finally { timer.restore(); }
});

test('short effect replay cancels deferred startup and cannot open a second native client', async () => {
  const timer = clock(); let calls = 0;
  const options = { starting() {}, failed() {}, async receive() { calls++; throw new Error('offline'); } };
  const first = new AutomaticVoiceReceiver(options), second = new AutomaticVoiceReceiver(options);
  try {
    first.setEnabled(true); await first.pause(); second.setEnabled(true);
    await timer.advance(50); assert.equal(calls, 1);
    await second.pause(); assert.equal(timer.size, 0);
  } finally { timer.restore(); }
});

test('replacing an already running receiver waits for its cleanup before opening another sync', async () => {
  const timer = clock(), firstWork = deferred(), secondWork = deferred(); let starts = 0;
  const first = new AutomaticVoiceReceiver({ starting() {}, failed() {}, receive() { starts++; return firstWork.promise; } });
  try {
    first.setEnabled(true); await timer.advance(50);
    const previousStop = first.pause();
    const second = new AutomaticVoiceReceiver({ starting() {}, failed() {}, async receive(signal) {
      await previousStop;
      if (signal.aborted) return;
      starts++; await secondWork.promise;
    } });
    second.setEnabled(true); await timer.advance(50);
    assert.equal(starts, 1);
    firstWork.resolve(); await previousStop; await drain();
    assert.equal(starts, 2);
    const pause = second.pause(); secondWork.resolve(); await pause;
    assert.equal(timer.size, 0);
  } finally { timer.restore(); }
});

test('network failure backs off, caps retry delay and stops retrying when the screen is closed', async () => {
  const timer = clock(), retries = []; let calls = 0;
  const receiver = new AutomaticVoiceReceiver({ starting() {}, failed(error, ms) { retries.push(ms); },
    async receive() { calls++; throw new Error('offline'); } });
  try {
    receiver.setEnabled(true); await timer.advance(50);
    assert.equal(calls, 1); assert.deepEqual(retries, [15_000]);
    await timer.advance(14_999); assert.equal(calls, 1);
    await timer.advance(1); assert.equal(calls, 2);
    await timer.advance(30_000); await timer.advance(60_000); await timer.advance(60_000);
    assert.deepEqual(retries, [15_000, 30_000, 60_000, 60_000, 60_000]);
    await receiver.pause(); await timer.advance(600_000); assert.equal(calls, 5);
  } finally { timer.restore(); }
});

test('retry button cancels the old receiver and waits before starting a new one', async () => {
  const timer = clock(), tasks = [];
  const receiver = new AutomaticVoiceReceiver({ starting() {}, failed() {}, receive(signal) {
    const task = deferred(); tasks.push({ signal, ...task }); return task.promise;
  } });
  try {
    receiver.setEnabled(true); await timer.advance(50);
    receiver.restart(); await timer.advance(1000);
    assert.equal(tasks[0].signal.aborted, true); assert.equal(tasks.length, 1);
    tasks[0].resolve(); await drain(); await timer.advance(50);
    assert.equal(tasks.length, 2);
    const pause = receiver.pause(); tasks[1].resolve(); await pause;
  } finally { timer.restore(); }
});

test('unconfirmed SDK cleanup blocks manual work and further automatic syncs', async () => {
  const timer = clock(), cleanup = deferred(), failures = []; let calls = 0;
  const receiver = new AutomaticVoiceReceiver({ starting() {}, failed(error, ms) { failures.push([error, ms]); },
    receive() { calls++; return cleanup.promise; } });
  try {
    receiver.setEnabled(true); await timer.advance(50);
    const pause = receiver.pause();
    const rejected = assert.rejects(pause, ReceiverCleanupError);
    cleanup.reject(new ReceiverCleanupError()); await rejected;
    assert.equal(failures[0][1], 0);
    receiver.setEnabled(true); receiver.restart(); await timer.advance(600_000);
    assert.equal(calls, 1);
    await assert.rejects(receiver.pause(), ReceiverCleanupError);
  } finally { timer.restore(); }
});
