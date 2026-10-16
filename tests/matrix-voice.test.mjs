import assert from 'node:assert/strict';
import test from 'node:test';
import { registerHooks } from 'node:module';
registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('.') && !/\.(ts|mjs|js)$/.test(specifier)) return nextResolve(specifier + '.ts', context);
  return nextResolve(specifier, context);
} });
const { VoiceCapture } = await import('../src/matrix/voice-capture.ts');
const { isCacheVoiceUri, validateVoiceDraft, validateVoiceBytes, voiceWaveform } = await import('../src/matrix/voice-types.ts');
const uri = 'file:///cache/app/recording.m4a';
const tick = () => new Promise(resolve => setImmediate(resolve));
function deferred() { let resolve; const promise = new Promise(ok => { resolve = ok; }); return { promise, resolve }; }

test('voice file guard rejects external, remote, traversal and oversized or non-M4A input', () => {
  assert.equal(isCacheVoiceUri(uri, 'file:///cache/app/'), true);
  for (const path of ['https://example.org/a.m4a', 'file:///cache/application/a.m4a', 'file:///cache/app/%2e%2e/out.m4a',
    'file:///cache/app/a.m4a?url=secret', 'file://host/cache/app/a.m4a', 'file:///cache/app/a.wav']) {
    assert.equal(isCacheVoiceUri(path, 'file:///cache/app'), false);
  }
  const draft = { uri, durationMs: 2000, waveform: [0, 0.5, 1] };
  validateVoiceDraft(draft);
  for (const patch of [{ durationMs: 100 }, { durationMs: 17000 }, { durationMs: NaN }, { waveform: [1024] }, { waveform: [NaN] }]) {
    assert.throws(() => validateVoiceDraft({ ...draft, ...patch }));
  }
  const bytes = new Uint8Array(50); bytes.set([102, 116, 121, 112], 4); validateVoiceBytes(bytes);
  assert.throws(() => validateVoiceBytes(new Uint8Array(100)));
  assert.throws(() => validateVoiceBytes(new Uint8Array(2 * 1024 * 1024)));
});

test('metering converts to bounded float amplitudes, never Matrix wire integers', () => {
  assert.deepEqual(voiceWaveform([-40, -20, 0, 10, NaN]), [0.01, 0.1, 1, 1]);
  assert.ok(voiceWaveform(Array(500).fill(-30)).length <= 100);
  assert.deepEqual(voiceWaveform([]), []);
});

function fixture(options = {}) {
  const states = [], deleted = [], trace = [];
  let isRecording = false, prepared = false, foreground = true;
  const recorder = { uri,
    async prepareToRecordAsync() { trace.push('prepare'); if (options.prepare) await options.prepare.promise; prepared = true; },
    record({ forDuration }) { assert.equal(forDuration, options.limitSeconds ?? 15); trace.push('record'); isRecording = true; },
    getStatus() { return { isRecording, canRecord: prepared, durationMillis: options.duration ?? 2100, metering: -20 }; },
    async stop() { trace.push('stop'); if (options.stop) await options.stop.promise; isRecording = false; prepared = false; },
  };
  const capture = new VoiceCapture({ recorder,
    async permission() { trace.push('permission'); if (options.permission) return options.permission.promise; return { granted: !options.denied, canAskAgain: false }; },
    async mode(recording) { trace.push(recording ? 'mode-record' : 'mode-play'); },
    foreground: () => foreground, discard: (file) => { if (file) deleted.push(file); }, changed: state => states.push({ ...state }),
  }, options.limitSeconds);
  return { capture, trace, deleted, states, background() { foreground = false; }, get state() { return states.at(-1); } };
}

for (const limitSeconds of [180, 900]) {
  test(`configured native capture preserves a ${limitSeconds}-second recording`, async () => {
    const f = fixture({ limitSeconds, duration: limitSeconds * 1000 });
    try { await f.capture.start(); await f.capture.stop(); assert.equal(f.state.phase, 'ready'); assert.equal(f.state.draft.durationMs, limitSeconds * 1000); }
    finally { await f.capture.dispose(); }
  });
}

test('records only on explicit start, stops to a local draft, never sends anything', async () => {
  const f = fixture();
  try {
    assert.equal(f.trace.length, 0);
    await f.capture.start(); assert.equal(f.state.phase, 'recording');
    await f.capture.stop(); assert.equal(f.state.phase, 'ready');
    assert.equal(f.state.draft.uri, uri); assert.equal(f.state.draft.durationMs, 2100);
    assert.equal(f.trace.filter(x => x === 'record').length, 1);
    assert.ok(f.trace.indexOf('permission') < f.trace.indexOf('prepare'));
    assert.ok(f.trace.indexOf('stop') < f.trace.indexOf('mode-play'));
  } finally { await f.capture.dispose(); }
});

test('denied microphone permission never prepares or starts the recorder', async () => {
  const f = fixture({ denied: true });
  try { await f.capture.start(); assert.equal(f.state.phase, 'error'); assert.ok(!f.trace.includes('prepare')); assert.ok(!f.trace.includes('record')); }
  finally { await f.capture.dispose(); }
});

test('cancel during permission prompt prevents a late grant from starting the mic', async () => {
  const permission = deferred(), f = fixture({ permission });
  try {
    const start = f.capture.start(); const cancel = f.capture.cancel();
    permission.resolve({ granted: true, canAskAgain: true });
    await Promise.all([start, cancel]);
    assert.ok(!f.trace.includes('record')); assert.ok(!f.trace.includes('prepare')); assert.equal(f.state.draft, null);
  } finally { await f.capture.dispose(); }
});

test('cancel during native prepare keeps new recording locked until cleanup, then discards the file', async () => {
  const prepare = deferred(), f = fixture({ prepare });
  try {
    const start = f.capture.start(); await tick(); assert.ok(f.trace.includes('prepare'));
    const cancel = f.capture.cancel(); const retry = f.capture.start();
    prepare.resolve(); await Promise.all([start, cancel, retry]);
    assert.equal(f.trace.filter(x => x === 'prepare').length, 1); assert.ok(!f.trace.includes('record'));
    assert.ok(f.deleted.includes(uri)); assert.equal(f.state.phase, 'idle');
  } finally { await f.capture.dispose(); }
});

test('leaving foreground while permission is pending cannot start a recording', async () => {
  const permission = deferred(), f = fixture({ permission });
  try {
    const start = f.capture.start(); f.background(); permission.resolve({ granted: true, canAskAgain: true });
    await start; assert.ok(!f.trace.includes('record')); assert.equal(f.state.draft, null);
  } finally { await f.capture.dispose(); }
});

test('cancel during stop never publishes a sendable draft', async () => {
  const stop = deferred(), f = fixture({ stop });
  try {
    await f.capture.start(); const stopping = f.capture.stop(); const cancel = f.capture.cancel();
    stop.resolve(); await Promise.all([stopping, cancel]);
    assert.ok(f.states.every(s => !s.draft)); assert.ok(f.deleted.includes(uri));
  } finally { await f.capture.dispose(); }
});

test('native duration completion finalizes one draft and releases recording mode', async () => {
  const f = fixture({ duration: 15000 });
  try {
    await f.capture.start(); f.capture.nativeFinished(false, uri); await tick();
    assert.equal(f.state.phase, 'ready'); assert.equal(f.state.draft.durationMs, 15000);
    assert.equal(f.trace.filter(x => x === 'stop').length, 1);
  } finally { await f.capture.dispose(); }
});

test('native recording error does not produce a draft', async () => {
  const f = fixture();
  try {
    await f.capture.start(); f.capture.nativeFinished(true, null); await tick();
    assert.equal(f.state.phase, 'error'); assert.equal(f.state.draft, null); assert.ok(f.deleted.includes(uri));
  } finally { await f.capture.dispose(); }
});

test('too-short recording is discarded and cannot be sent', async () => {
  const f = fixture({ duration: 200 });
  try { await f.capture.start(); await f.capture.stop(); assert.equal(f.state.phase, 'error'); assert.equal(f.state.draft, null); }
  finally { await f.capture.dispose(); }
});

test('unmount during preparation prevents late recording or UI updates', async () => {
  const prepare = deferred(), f = fixture({ prepare });
  const start = f.capture.start(); await tick(); const count = f.states.length;
  const dispose = f.capture.dispose(); prepare.resolve(); await Promise.all([start, dispose]);
  assert.ok(!f.trace.includes('record')); assert.equal(f.states.length, count); assert.ok(f.deleted.includes(uri));
});

test('restored draft is immediately previewable without starting microphone and is copied',async()=>{
  const f=fixture(),draft={uri,durationMs:3200,waveform:[0.3,0.9]};
  assert.equal(f.capture.restoreDraft(draft),true);draft.waveform[0]=0;
  assert.equal(f.state.phase,'ready');assert.equal(f.state.durationMs,3200);assert.deepEqual(f.state.draft.waveform,[0.3,0.9]);
  assert.deepEqual(f.trace,[]);assert.equal(f.capture.restoreDraft(draft),false);
  await f.capture.dispose();assert.ok(f.deleted.includes(uri));
});

test('pending or disposed capture refuses restoration and invalid draft never becomes ready',async()=>{
  const permission=deferred(),f=fixture({permission});const recording=f.capture.start();
  assert.equal(f.capture.restoreDraft({uri,durationMs:3200,waveform:[]}),false);
  permission.resolve({granted:false,canAskAgain:false});await recording;await f.capture.dispose();
  assert.equal(f.capture.restoreDraft({uri,durationMs:3200,waveform:[]}),false);
  const fresh=fixture();assert.throws(()=>fresh.capture.restoreDraft({uri,durationMs:100,waveform:[]}));assert.equal(fresh.states.length,0);
  await fresh.capture.dispose();
});

test('successful storage swaps the ready preview and discards the original recorder file',async()=>{
  const f=fixture();await f.capture.start();await f.capture.stop();
  const protectedPreview={uri:'file:///cache/app/matrix-voice-drafts/preview-abc.m4a',durationMs:2100,waveform:[0.4]};
  assert.equal(f.capture.replaceReadyDraft(protectedPreview),true);assert.equal(f.state.draft.uri,protectedPreview.uri);
  assert.ok(f.deleted.includes(uri));assert.equal(f.trace.filter(x=>x==='record').length,1);
  await f.capture.dispose();assert.ok(f.deleted.includes(protectedPreview.uri));
});
