import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const compile = path => ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const formatting = {}; vm.runInNewContext(compile('../diary/text-format.ts'), { exports: formatting });
const model = {}; vm.runInNewContext(compile('../state/model.ts'), { exports: model, require: () => formatting });
const signals = {}; vm.runInNewContext(compile('../audio/voice-signal.ts'), { exports: signals, require: () => ({ silentBands: { low: 0, mid: 0, high: 0, contour: [] } }) });
const microphones = {}; vm.runInNewContext(compile('../audio/microphone-input.ts'), { exports: microphones, Error, Set });

// Exercise the actual web capture hook with synthetic streams/encoded chunks.
// No real microphone, browser permissions, or stored user records are accessed.
function captureFixture(mimeType = 'audio/webm', metered = false, limitSeconds) {
  const state = [], effects = [], recorders = [], tracks = [], revoked = [], writes = [];
  const frames = new Map(); let nextFrame = 1, interval;
  let index = 0, now = 1000, updateBlocks = 0, open = async () => makeStream();
  function makeStream() { const track = { stopped: 0, label: 'Browser route', getSettings: () => ({ deviceId: 'default' }), addEventListener() {}, stop() { this.stopped++; } }; tracks.push(track); return { getTracks: () => [track], getAudioTracks: () => [track] }; }
  class Recorder {
    static isTypeSupported() { return true; }
    constructor() { this.state = 'inactive'; this.mimeType = mimeType; recorders.push(this); }
    start() { this.state = 'recording'; }
    stop() { this.state = 'inactive'; this.ondataavailable?.({ data: new Blob(['synthetic opus chunk'], { type: this.mimeType }) }); this.onstop?.(); }
  }
  const exports = {};
  const react = {
    useState(initial) { const slot = index++; state[slot] = typeof initial === 'function' ? initial() : initial; return [state[slot], value => { writes.push(slot); state[slot] = value; }]; },
    useRef: value => ({ current: value }), useCallback: callback => callback, useEffect: callback => effects.push(callback),
  };
  const listeners = new Map();
  vm.runInNewContext(compile('./useObservationRecorder.ts'), { exports,
    require: name => name === 'react' ? react : name.includes('ProductProvider') ? { useProduct: () => ({ settings: {} }) } : name.includes('microphone-input') ? microphones : name.includes('webUpdateSafety') ? { blockWebUpdate() { updateBlocks++; return () => { updateBlocks--; }; } } : name.includes('voice-signal') ? signals : name.includes('/state/model') ? model : name.includes('voice-types') ? { voiceWaveform: () => [] } : { silentBands: { low: 0, mid: 0, high: 0 }, measureVoiceSpectrum: () => ({ low: 0, mid: 0, high: 0 }) },
    window: {}, navigator: { mediaDevices: { getUserMedia: () => open() } }, MediaRecorder: Recorder,
    Blob, URL: { createObjectURL: () => 'blob:synthetic-take', revokeObjectURL: uri => revoked.push(uri) },
    Date: class extends Date { static now() { return now; } },
    document: { visibilityState: 'visible', addEventListener: (name, cb) => listeners.set(name, cb), removeEventListener: name => listeners.delete(name) },
    AudioContext: metered ? class {
      state = 'running'; sampleRate = 48000;
      resume() { return Promise.resolve(); } close() { this.state = 'closed'; return Promise.resolve(); }
      createMediaStreamSource() { return { connect() {} }; }
      createAnalyser() { return { fftSize: 2048, frequencyBinCount: 1024, getFloatFrequencyData: data => data.fill(-24), getFloatTimeDomainData: data => data.fill(.1) }; }
    } : undefined,
    setInterval: callback => { interval = callback; return 1; }, clearInterval() { interval = undefined; }, requestAnimationFrame: callback => { const id = nextFrame++; frames.set(id, callback); return id; }, cancelAnimationFrame: id => frames.delete(id),
  });
  const hook = exports.useObservationRecorder(limitSeconds); const cleanups = effects.map(effect => effect());
  return { hook, state: () => state[2], permission: () => state[5], recorders, tracks, revoked, makeStream,
    setOpen: value => { open = value; }, advance: ms => { now += ms; }, tick: () => interval?.(), writes,
    draw: time => { const pending = [...frames.values()]; frames.clear(); for (const callback of pending) callback(time); },
    updateBlocks: () => updateBlocks, dispose: () => cleanups.forEach(fn => fn?.()) };
}

test('a pending permission, live recording and unsaved review all defer release updates', async () => {
  const s = captureFixture(); let grant;
  s.setOpen(() => new Promise(resolve => { grant = resolve; }));
  const opening = s.hook.start(); assert.equal(s.updateBlocks(), 1);
  grant(s.makeStream()); await opening; assert.equal(s.updateBlocks(), 1);
  s.advance(2100); await s.hook.stop(); assert.equal(s.state().phase, 'ready'); assert.equal(s.updateBlocks(), 1);
  await s.hook.clear(); assert.equal(s.updateBlocks(), 0);
  s.dispose(); assert.equal(s.updateBlocks(), 0);
});

test('30 live microphone samples bypass React state, and cancellation clears the signal', async () => {
  const s = captureFixture('audio/webm', true), samples = [];
  const unsubscribe = s.hook.audioSource.subscribe(() => samples.push(s.hook.audioSource.read()));
  await s.hook.start(); const writes = s.writes.length;
  for (let i = 1; i <= 30; i++) s.draw(i * 40);
  assert.equal(samples.length, 30); assert.equal(s.writes.length, writes);
  await s.hook.cancel(); assert.equal(samples.at(-1).low, 0); assert.equal(s.tracks[0].stopped, 1);
  unsubscribe(); s.dispose();
});

test('granted web stream produces a nonempty draft and stops every track', async () => {
  const s = captureFixture(); await s.hook.start(); assert.equal(s.state().phase, 'recording');
  assert.equal(s.recorders[0].state, 'recording'); s.advance(2100); await s.hook.stop();
  assert.equal(s.state().phase, 'ready'); assert.equal(s.state().draft.durationMs, 2100);
  assert.equal(s.state().draft.mimeType, 'audio/webm'); assert.equal(s.tracks[0].stopped, 1);
  await s.hook.clear(); assert.equal(s.revoked.length, 1); s.dispose();
});

test('diary can capture a fifteen-minute report without changing the architecture limit', async () => {
  const diary = captureFixture('audio/webm', false, model.DIARY_LIMIT_SECONDS);
  await diary.hook.start(); diary.advance(900000); await diary.hook.stop();
  assert.equal(diary.state().phase, 'ready'); assert.equal(diary.state().draft.durationMs, 900000);
  assert.throws(() => model.validateObservationDraft(diary.state().draft));
  assert.doesNotThrow(() => model.validateObservationDraft(diary.state().draft, model.DIARY_LIMIT_SECONDS));
  diary.dispose();
});

for (const [name, configured, seconds] of [['assignment', undefined, 180], ['diary', model.DIARY_LIMIT_SECONDS, 900]]) {
  test(`${name} keeps recording until its limit, then stops and releases the microphone`, async () => {
    const s = captureFixture('audio/webm', false, configured);
    try {
      assert.equal(s.hook.limitSeconds, seconds);
      await s.hook.start(); s.advance((seconds - 1) * 1000); s.tick();
      assert.equal(s.state().phase, 'recording');
      s.advance(1000); s.tick();
      assert.equal(s.state().phase, 'ready'); assert.equal(s.state().draft.durationMs, seconds * 1000);
      assert.equal(s.tracks[0].stopped, 1);
    } finally { s.dispose(); }
  });
}

test('Safari recorder codec metadata produces a valid savable draft instead of a corruption error', async () => {
  const s = captureFixture('audio/mp4;codecs=mp4a.40.2');
  try {
    await s.hook.start(); s.advance(2100); await s.hook.stop();
    assert.equal(s.state().phase, 'ready');
    assert.equal(s.state().draft.mimeType, 'audio/mp4;codecs=mp4a.40.2');
    assert.doesNotThrow(() => model.validateObservationDraft(s.state().draft));
    assert.equal(s.tracks[0].stopped, 1);
  } finally { s.dispose(); }
});
test('late permission after release cannot record; the following hold can', async () => {
  const s = captureFixture(); let allow;
  s.setOpen(() => new Promise(resolve => { allow = resolve; })); const started = s.hook.start();
  assert.equal(s.state().phase, 'preparing'); await s.hook.stop(); allow(s.makeStream()); await started;
  assert.equal(s.recorders.length, 0); assert.equal(s.tracks[0].stopped, 1); assert.equal(s.state().phase, 'idle');
  s.setOpen(async () => s.makeStream()); await s.hook.start(); assert.equal(s.state().phase, 'recording');
  await s.hook.cancel(); assert.equal(s.state().draft, null); s.dispose();
});
test('permission preflight releases its stream and only the next gesture records', async () => {
  const s = captureFixture(); assert.equal(await s.hook.requestPermission(), true);
  assert.equal(s.permission(), true); assert.equal(s.recorders.length, 0); assert.equal(s.tracks[0].stopped, 1);
  await s.hook.start(); assert.equal(s.recorders.length, 1); await s.hook.cancel(); s.dispose();
});
test('denial reports a readable microphone error', async () => {
  const s = captureFixture(); s.setOpen(async () => { const error = new Error('denied'); error.name = 'NotAllowedError'; throw error; });
  await s.hook.start(); assert.equal(s.state().phase, 'error'); assert.match(s.state().error, /Разреши.*микрофону/);
  assert.equal(s.recorders.length, 0); s.dispose();
});
