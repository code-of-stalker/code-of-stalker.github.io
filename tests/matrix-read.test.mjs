import assert from 'node:assert/strict';
import test from 'node:test';
import { registerHooks } from 'node:module';
registerHooks({ resolve(specifier, context, next) {
  return next(specifier.startsWith('.') && !/\.(ts|mjs|js)$/.test(specifier) ? specifier + '.ts' : specifier, context);
} });
const { readMatrixJson, MATRIX_READ_TIMEOUT_MS } = await import('../src/matrix/matrix-read.ts');
const url = 'https://example.org/_matrix/client/v3/rooms/test/messages';
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const response = value => ({ ok: true, status: 200, json: async () => value });

test('authenticated reads request fresh data and release request resources after success', async () => {
  let seen;
  const value = await readMatrixJson(url, 'test-token', new AbortController().signal, async (address, options) => {
    seen = { address, options }; return response({ chunk: [] });
  });
  assert.deepEqual(value, { chunk: [] });
  assert.equal(seen.address, url); assert.equal(seen.options.method, 'GET');
  assert.equal(seen.options.headers.Authorization, 'Bearer test-token');
  assert.match(seen.options.headers['Cache-Control'], /no-cache/);
  assert.equal(seen.options.signal.aborted, true);
});

test('already cancelled reads never contact the server', async () => {
  const controller = new AbortController(); controller.abort();
  await assert.rejects(readMatrixJson(url, 'test-token', controller.signal, async () => { assert.fail('unexpected request'); }), /Aborted/);
});

for (const phase of ['request', 'body']) {
  test(`cancel releases caller even if ${phase} ignores abort; late success cannot continue`, async () => {
    const controller = new AbortController(), held = deferred(), started = deferred();
    let requestSignal, bodyReads = 0, continued = 0;
    const work = readMatrixJson(url, 'test-token', controller.signal, async (_, options) => {
      requestSignal = options.signal;
      if (phase === 'request') { started.resolve(); return held.promise; }
      return { ok: true, status: 200, json() { bodyReads++; started.resolve(); return held.promise; } };
    }).then(() => { continued++; });
    await started.promise;
    controller.abort();
    await assert.rejects(work, /Aborted/);
    assert.equal(requestSignal.aborted, true);
    held.resolve(phase === 'request' ? { ...response({ chunk: [] }), json: async () => { bodyReads++; return {}; } } : { chunk: [] });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(continued, 0); assert.equal(bodyReads, phase === 'body' ? 1 : 0);
  });

  test(`deadline includes stalled ${phase} and observes its late rejection`, async t => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const held = deferred(), started = deferred();
    let signal;
    const work = readMatrixJson(url, 'secret-test-token', new AbortController().signal, async (_, options) => {
      signal = options.signal;
      if (phase === 'request') { started.resolve(); return held.promise; }
      return { ok: true, status: 200, json() { started.resolve(); return held.promise; } };
    });
    await started.promise;
    const rejected = assert.rejects(work, error => /не ответил вовремя/.test(error.message) && !/secret/.test(error.message));
    t.mock.timers.tick(MATRIX_READ_TIMEOUT_MS);
    await rejected;
    assert.equal(signal.aborted, true);
    held.reject(new Error('secret native failure'));
    await new Promise(resolve => setImmediate(resolve));
  });
}

test('network and body errors never expose tokens or arbitrary server text', async () => {
  for (const request of [async () => { throw new Error('secret-token'); }, async () => ({ ok: true, json: async () => { throw new Error('secret-token'); } })]) {
    await assert.rejects(readMatrixJson(url, 'secret-token', new AbortController().signal, request), error => /Проверь интернет/.test(error.message) && !error.message.includes('secret'));
  }
});

test('HTTP failure is reported without parsing or exposing server body', async () => {
  await assert.rejects(readMatrixJson(url, 'test-token', new AbortController().signal, async () => ({ ok: false, status: 429,
    json: async () => { assert.fail('unexpected body read'); } })), /HTTP 429/);
});
