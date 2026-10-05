import assert from 'node:assert/strict';
import test from 'node:test';
import { observeOperation } from '../src/matrix/operation-wait.ts';

function deferred() {
  let resolve, reject;
  const promise = new Promise((ok, no) => { resolve = ok; reject = no; });
  return { promise, resolve, reject };
}

test('cancel releases the screen immediately while the native cleanup lock stays held', async () => {
  const task = deferred();
  const abort = new AbortController();
  const observed = observeOperation(task.promise, abort.signal);
  let screen = 'waiting';
  let released = false;
  void observed.settled.then(() => { released = true; });
  const screenResult = observed.result.then(() => { screen = 'success'; }, () => { screen = 'cancelled'; });
  abort.abort();
  await screenResult;
  assert.equal(screen, 'cancelled');
  assert.equal(observed.isPending(), true);
  assert.equal(released, false);
  task.resolve('late native success');
  await observed.settled;
  assert.equal(observed.isPending(), false);
  assert.equal(released, true);
  assert.equal(screen, 'cancelled');
});

test('late native failure settles cleanup without overwriting the cancelled result or becoming unhandled', async () => {
  const task = deferred();
  const abort = new AbortController();
  const observed = observeOperation(task.promise, abort.signal);
  abort.abort();
  await assert.rejects(observed.result, /^Error: Aborted$/);
  task.reject(new Error('late native failure'));
  await observed.settled;
  assert.equal(observed.isPending(), false);
  await assert.rejects(observed.result, /^Error: Aborted$/);
});

test('a pre-aborted wait still tracks an already started native operation', async () => {
  const abort = new AbortController();
  abort.abort();
  const task = deferred();
  const observed = observeOperation(task.promise, abort.signal);
  await assert.rejects(observed.result, /Aborted/);
  assert.equal(observed.isPending(), true);
  task.resolve(); await observed.settled;
  assert.equal(observed.isPending(), false);
});

test('cancel wins over a native success queued in the same JS turn', async () => {
  const task = deferred();
  const abort = new AbortController();
  const observed = observeOperation(task.promise, abort.signal);
  task.resolve('success');
  abort.abort();
  await assert.rejects(observed.result, /Aborted/);
  await observed.settled;
});

test('normal success and failure are preserved and release ownership after completion', async () => {
  const abort = new AbortController();
  const success = observeOperation(Promise.resolve('done'), abort.signal);
  assert.equal(await success.result, 'done');
  assert.equal(success.isPending(), false);
  const failure = new Error('native error');
  const failed = observeOperation(Promise.reject(failure), abort.signal);
  await assert.rejects(failed.result, (error) => error === failure);
  assert.equal(failed.isPending(), false);
  abort.abort();
  assert.equal(await success.result, 'done');
});
