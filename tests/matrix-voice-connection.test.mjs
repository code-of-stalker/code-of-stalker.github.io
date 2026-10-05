import assert from 'node:assert/strict';
import test from 'node:test';
import { registerHooks } from 'node:module';

registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('.') && !/\.(ts|mjs|js)$/.test(specifier)) return nextResolve(specifier + '.ts', context);
  return nextResolve(specifier, context);
} });
const { checkVoiceConnection, VoiceConnectionError, VOICE_CONNECTION_TIMEOUT_MS } = await import('../src/matrix/voice-send-connection.ts');
const { VoiceDraftController } = await import('../src/matrix/voice-draft-controller.ts');
const tick = () => new Promise(resolve => setImmediate(resolve));
function deferred() {
  let resolve, reject;
  const promise = new Promise((ok, fail) => { resolve = ok; reject = fail; });
  return { promise, resolve, reject };
}
const response = (body = { versions: ['r0.6.1', 'v1.18'] }, init = {}) => new Response(
  typeof body === 'string' ? body : JSON.stringify(body), { status: 200, ...init });
const check = request => checkVoiceConnection('https://example.org', new AbortController().signal, request);
const safeFailure = error => error instanceof VoiceConnectionError && /Черновик сохранён/.test(error.message) &&
  !/SECRET|file:\/\/|access_token|preview-/.test(error.message);

test('public connectivity GET forwards native cache prevention and no account or audio data', async () => {
  let seen;
  await checkVoiceConnection(' https://example.org/prefix/ ', new AbortController().signal, async (url, options) => {
    seen = { url, options }; return response();
  });
  assert.equal(seen.url, 'https://example.org/prefix/_matrix/client/versions');
  assert.equal(seen.options.method, 'GET'); assert.equal(seen.options.credentials, 'omit');
  const headers = new Headers(seen.options.headers);
  assert.equal(headers.get('accept'), 'application/json');
  assert.match(headers.get('cache-control'), /no-cache/); assert.match(headers.get('cache-control'), /no-store/);
  assert.equal(headers.get('pragma'), 'no-cache'); assert.equal(seen.options.cache, 'no-store');
  assert.equal(headers.has('authorization'), false); assert.equal(headers.has('cookie'), false);
  assert.equal(seen.options.body, undefined); assert.equal(seen.options.signal.aborted, true);
});

test('current and historical Matrix version replies are accepted without treating them as SDK compatibility', async () => {
  for (const versions of [['v1.1'], ['r0.0.1'], ['v1.18', 'future-feature']]) await check(async () => response({ versions }));
});

test('invalid homeserver addresses never start a request or expose embedded credentials', async () => {
  for (const url of ['http://example.org', 'https://user:SECRET@example.org', 'https://example.org/?access_token=SECRET',
    'https://example.org/#SECRET', 'file:///private/SECRET', 'invalid']) {
    let calls = 0;
    await assert.rejects(checkVoiceConnection(url, new AbortController().signal, async () => { calls++; return response(); }),
      error => error instanceof VoiceConnectionError && !error.message.includes('SECRET'));
    assert.equal(calls, 0);
  }
});

test('native network and body-reading errors become fixed draft-preserving messages', async () => {
  await assert.rejects(check(async () => { throw Error('access_token=SECRET file:///private/preview-key'); }), safeFailure);
  await assert.rejects(check(async () => ({ ok: true, status: 200, headers: new Headers(),
    text: async () => { throw Error('SECRET'); } })), safeFailure);
});

for (const status of [401, 429, 503]) {
  test(`HTTP ${status} does not allow a send`, async () => {
    await assert.rejects(check(async () => response('SECRET', { status })), safeFailure);
  });
}

for (const [name, body] of Object.entries({ html: '<html>SECRET</html>', empty: '{}',
  emptyVersions: { versions: [] }, wrongType: { versions: 'v1.18' }, wrongEntry: { versions: ['v1.18', null] },
  unrelatedService: { versions: ['not-matrix'] }, oversizedList: { versions: Array(101).fill('v1.18') } })) {
  test(`malformed ${name} reply cannot allow a send`, async () => {
    await assert.rejects(check(async () => response(body)), safeFailure);
  });
}

test('declared oversize reply is rejected before reading its body', async () => {
  let read = false;
  await assert.rejects(check(async () => ({ ok: true, status: 200, headers: new Headers({ 'content-length': '16385' }),
    text: async () => { read = true; return JSON.stringify({ versions: ['v1.18'] }); } })), safeFailure);
  assert.equal(read, false);
});

test('response-size limit also counts UTF-8 bytes when no length is declared', async () => {
  const body = JSON.stringify({ versions: ['v1.18'], extra: 'я'.repeat(9000) });
  assert.ok(body.length < 16384); assert.ok(Buffer.byteLength(body) > 16384);
  await assert.rejects(check(async () => response(body)), safeFailure);
});

test('pre-cancelled check makes no request', async () => {
  const abort = new AbortController(); abort.abort(); let calls = 0;
  await assert.rejects(checkVoiceConnection('https://example.org', abort.signal, async () => { calls++; return response(); }), /остановлена/);
  assert.equal(calls, 0);
});

test('cancellation finishes even when native fetch ignores it; late success does not revive it', async () => {
  const abort = new AbortController(), pending = deferred(); let nativeSignal;
  const operation = checkVoiceConnection('https://example.org', abort.signal, async (_, options) => {
    nativeSignal = options.signal; return pending.promise;
  });
  const rejected = assert.rejects(operation, /остановлена/);
  abort.abort(); await rejected; assert.equal(nativeSignal.aborted, true);
  pending.resolve(response()); await tick();
});

test('abort while response text is pending cannot succeed', async () => {
  const abort = new AbortController(), pending = deferred(); let reading = false;
  const operation = checkVoiceConnection('https://example.org', abort.signal, async () => ({ ok: true, status: 200,
    headers: new Headers(), text: () => { reading = true; return pending.promise; } }));
  await tick(); assert.equal(reading, true);
  const rejected = assert.rejects(operation, /остановлена/); abort.abort(); await rejected;
  pending.resolve(JSON.stringify({ versions: ['v1.18'] })); await tick();
});

test('timeout bounds a stuck fetch without relying on native cancellation', async context => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  const pending = deferred(); let nativeSignal;
  const operation = check(async (_, options) => { nativeSignal = options.signal; return pending.promise; });
  const rejected = assert.rejects(operation, /не ответил вовремя/);
  context.mock.timers.tick(VOICE_CONNECTION_TIMEOUT_MS - 1); await Promise.resolve();
  assert.equal(nativeSignal.aborted, false);
  context.mock.timers.tick(1); await rejected; assert.equal(nativeSignal.aborted, true);
  pending.reject(Error('late SECRET')); await tick();
});

test('body-reading timeout is covered by the same total deadline', async context => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  const pending = deferred(); let reading = false;
  const operation = check(async () => ({ ok: true, status: 200, headers: new Headers(),
    text: () => { reading = true; return pending.promise; } }));
  await tick(); assert.equal(reading, true);
  const rejected = assert.rejects(operation, /не ответил вовремя/);
  context.mock.timers.tick(VOICE_CONNECTION_TIMEOUT_MS); await rejected;
  pending.resolve(JSON.stringify({ versions: ['v1.18'] })); await tick();
});

test('completed check releases its external cancellation listener and timer', async context => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  const abort = new AbortController();
  const added = context.mock.method(abort.signal, 'addEventListener'), removed = context.mock.method(abort.signal, 'removeEventListener');
  await checkVoiceConnection('https://example.org', abort.signal, async () => response());
  assert.equal(added.mock.callCount(), 1); assert.equal(removed.mock.callCount(), 1);
  assert.equal(added.mock.calls[0].arguments[1], removed.mock.calls[0].arguments[1]);
  context.mock.timers.tick(VOICE_CONNECTION_TIMEOUT_MS); abort.abort(); await tick();
});

const scope = { userId: '@tecno:example.org', serverUrl: 'https://example.org', deviceId: 'TECNO',
  roomId: '!voice:example.org', peerUserId: '@ipad:example.org' };
function fixture(state = 'draft') {
  const states = [], trace = [], record = { id: 'ab'.repeat(16), createdAt: 1, state,
    draft: { uri: 'file:///cache/preview.m4a', durationMs: 3100, waveform: [0.2, 0.9] } };
  const store = { async restore() { return { ...record }; }, async save() { throw Error('unexpected save'); },
    async markSending(_, id) {
      trace.push('marker'); assert.equal(id, record.id); if (record.state !== 'draft') throw Error('already sending');
      record.state = 'sending'; return { ...record };
    }, async clear() { trace.push('clear'); }, async eraseAll() { trace.push('erase'); } };
  const controller = new VoiceDraftController(store, scope, { changed: value => states.push({ ...value }),
    restored: () => true, discard: () => trace.push('discard') });
  return { controller, states, trace, record, store, get state() { return states.at(-1); } };
}

test('offline gate preserves a retryable draft and never marks, clears or invokes Matrix', async () => {
  const f = fixture(); await f.controller.restore();
  await assert.rejects(f.controller.beforeSend(() => check(async () => { throw Error('offline SECRET'); }))
    .then(() => f.trace.push('SDK')), safeFailure);
  assert.deepEqual(f.trace, []); assert.equal(f.state.saved.state, 'draft'); assert.equal(f.record.state, 'draft');
  assert.equal(f.state.phase, 'error'); assert.equal(f.controller.busy, false);
});

test('only an explicit retry after reconnection marks before SDK and clears after confirmed send', async () => {
  const f = fixture(); await f.controller.restore();
  await assert.rejects(f.controller.beforeSend(() => check(async () => { throw Error('offline'); })));
  await tick(); assert.deepEqual(f.trace, []);
  await f.controller.beforeSend(() => check(async () => { f.trace.push('connection'); return response(); }));
  assert.equal(f.record.state, 'draft'); f.trace.push('prepare-SDK');
  await f.controller.beforeUpload(new AbortController().signal, () => check(async () => { f.trace.push('connection-at-upload'); return response(); }));
  f.trace.push('SDK'); assert.equal(f.state.saved.state, 'sending');
  assert.equal(await f.controller.sent(), true); assert.deepEqual(f.trace, ['connection', 'prepare-SDK', 'connection-at-upload', 'marker', 'SDK', 'clear']);
});

test('double tap and delete are blocked while connectivity is pending', async () => {
  const f = fixture(), pending = deferred(); await f.controller.restore();
  const first = f.controller.beforeSend(() => pending.promise); await tick();
  assert.equal(f.state.phase, 'checking'); assert.equal(f.controller.busy, true);
  await assert.rejects(f.controller.beforeSend(() => { throw Error('second check'); }));
  assert.equal(await f.controller.remove(), false); assert.deepEqual(f.trace, []);
  pending.resolve(); await first; assert.deepEqual(f.trace, []); assert.equal(f.record.state, 'draft');
});

test('aborting connectivity is retryable and never writes a sending marker', async () => {
  const f = fixture(), abort = new AbortController(), pending = deferred(); await f.controller.restore();
  const first = f.controller.beforeSend(() => checkVoiceConnection(scope.serverUrl, abort.signal, () => pending.promise));
  await tick(); const rejected = assert.rejects(first, /остановлена/); abort.abort(); await rejected;
  assert.deepEqual(f.trace, []); assert.equal(f.record.state, 'draft');
  pending.resolve(response()); await tick(); assert.deepEqual(f.trace, []);
  await f.controller.beforeSend(() => check(async () => response())); assert.deepEqual(f.trace, []);
  await f.controller.beforeUpload(new AbortController().signal, () => check(async () => response())); assert.deepEqual(f.trace, ['marker']);
});

test('unmounted screen cannot mark or send after a late successful check', async () => {
  const f = fixture(), pending = deferred(); await f.controller.restore();
  const operation = f.controller.beforeSend(() => pending.promise); await tick(); const count = f.states.length;
  const rejected = assert.rejects(operation, /остановлена/), disposed = f.controller.dispose();
  pending.resolve(); await Promise.all([rejected, disposed]);
  assert.deepEqual(f.trace, []); assert.equal(f.states.length, count); assert.equal(f.record.state, 'draft');
});

test('reopened screen after offline failure restores the same retryable recording', async () => {
  const f = fixture(); await f.controller.restore();
  await assert.rejects(f.controller.beforeSend(() => check(async () => { throw Error('offline'); })));
  await f.controller.dispose(); const states = [];
  const reopened = new VoiceDraftController(f.store, scope, { changed: s => states.push(s), restored: () => true, discard() {} });
  await reopened.restore(); assert.equal(states.at(-1).saved.id, f.record.id);
  assert.equal(states.at(-1).saved.state, 'draft'); await reopened.beforeSend(() => check(async () => response()));
  assert.deepEqual(f.trace, []);
  await reopened.beforeUpload(new AbortController().signal, () => check(async () => response()));
  assert.deepEqual(f.trace, ['marker']);
});

test('an old uncertain send never even probes connectivity or invokes Matrix again', async () => {
  const f = fixture('sending'); await f.controller.restore();
  await assert.rejects(f.controller.beforeSend(async () => { f.trace.push('connection'); }).then(() => f.trace.push('SDK')));
  assert.deepEqual(f.trace, []); assert.equal(f.record.state, 'sending');
});

test('failure after the sending marker cannot turn the recording into a retryable draft', async () => {
  const f = fixture(); await f.controller.restore();
  await f.controller.beforeSend(() => check(async () => response()));
  await assert.rejects(f.controller.beforeUpload(new AbortController().signal, () => check(async () => response())).then(() => {
    f.trace.push('SDK'); throw Error('SDK connection lost');
  }));
  await assert.rejects(f.controller.beforeSend(() => check(async () => response())));
  assert.equal(f.record.state, 'sending'); assert.equal(f.state.saved.state, 'sending'); assert.deepEqual(f.trace, ['marker', 'SDK']);
});

test('sending-marker failure after a successful connection gate still prevents an SDK call', async () => {
  const f = fixture(); f.store.markSending = async () => { throw Error('SecureStore write failed'); }; await f.controller.restore();
  await f.controller.beforeSend(() => check(async () => response()));
  await assert.rejects(f.controller.beforeUpload(new AbortController().signal, () => check(async () => response())).then(() => f.trace.push('SDK')));
  assert.deepEqual(f.trace, []); assert.equal(f.record.state, 'draft');
});

test('Reload after successful connection but during SDK preparation leaves the same draft retryable', async () => {
  const f = fixture(); await f.controller.restore(); await f.controller.beforeSend(() => check(async () => response()));
  assert.deepEqual(f.trace, []); assert.equal(f.record.state, 'draft'); await f.controller.dispose();
  await assert.rejects(f.controller.beforeUpload(new AbortController().signal, () => check(async () => response())));
  assert.deepEqual(f.trace, []); assert.equal(f.record.state, 'draft');
});

test('late upload-boundary connection after Reload cannot write a marker', async () => {
  const f = fixture(), pending = deferred(); await f.controller.restore(); await f.controller.beforeSend();
  const operation = f.controller.beforeUpload(new AbortController().signal, () => pending.promise); await tick();
  const rejected = assert.rejects(operation, /остановлена/), disposed = f.controller.dispose();
  pending.resolve(); await Promise.all([rejected, disposed]);
  assert.deepEqual(f.trace, []); assert.equal(f.record.state, 'draft');
});

test('network lost during SDK preparation fails the fresh boundary check without marking the draft', async () => {
  const f = fixture(); await f.controller.restore(); await f.controller.beforeSend(() => check(async () => response()));
  await assert.rejects(f.controller.beforeUpload(new AbortController().signal, () => check(async () => { throw Error('offline'); })), safeFailure);
  assert.deepEqual(f.trace, []); assert.equal(f.record.state, 'draft'); assert.equal(f.state.saved.state, 'draft');
});

test('already cancelled SDK operation cannot perform its boundary check or mark', async () => {
  const f = fixture(), abort = new AbortController(); await f.controller.restore(); await f.controller.beforeSend(); abort.abort();
  await assert.rejects(f.controller.beforeUpload(abort.signal, async () => { f.trace.push('connection'); }), /остановлена/);
  assert.deepEqual(f.trace, []); assert.equal(f.record.state, 'draft');
});
