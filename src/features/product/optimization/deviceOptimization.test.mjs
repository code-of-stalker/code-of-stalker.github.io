import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const module = { exports: {} };
new Function('exports', ts.transpileModule(fs.readFileSync(new URL('./deviceOptimization.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText)(module.exports);
const { DeviceOptimizationRun, readDeviceProfile } = module.exports;
function snapshot(view, options) {
  const requested = view.candidate.targetFps, cap = (options.cap ?? (() => 120))(view), fps = Math.min(requested, cap);
  const uiFps = options.uiFps ?? options.hz ?? 60, effect = { fps, p95: 1000 / fps, samples: 60 };
  return { level: view.candidate.quality, targetFps: requested, smooth: true, cadencePending: false,
    cadence: { fps: Math.min(uiFps, fps), p95: Math.max(1000 / uiFps, effect.p95), samples: uiFps < 20 ? 2 : 60, active: true },
    frames: Array.from({ length: options.effects ?? 4 }, () => ({ cadence: effect })) };
}
function simulate(options = {}) {
  const run = new DeviceOptimizationRun(); let at = 0, paused = false;
  for (let i = 0; i < 20000; i++) {
    const result = run.tick(at, snapshot(run.view, options), options.ready !== false);
    if (result.result) return result.result;
    at += 1000 / (options.hz ?? 60);
    if (options.pause && !paused && run.view.elapsed >= 10000) { paused = true; run.pause(); at += 120000; }
  }
  throw new Error('Run did not finish');
}
test('stable 60 Hz device chooses high quality in 30–45 foreground seconds', () => {
  const profile = simulate(); assert.equal(profile.quality, 'high'); assert.equal(profile.targetFps, 60); assert.equal(profile.smoothness, true);
  assert.equal(profile.reason, 'measured'); assert.ok(profile.durationMs >= 30000 && profile.durationMs <= 45000);
});
test('quality selection uses committed effect cadence, rather than fast UI alone', () => {
  const profile = simulate({ cap: view => view.candidate.quality === 'high' ? 40 : 60 });
  assert.equal(profile.quality, 'balanced'); assert.equal(profile.smoothness, true);
  assert.equal(profile.measurements[0].stable, false); assert.equal(profile.measurements[1].stable, true);
});
test('only economy can sustain 60 FPS', () => {
  const profile = simulate({ cap: view => view.candidate.quality === 'economy' ? 60 : 30 });
  assert.equal(profile.quality, 'economy'); assert.equal(profile.smoothness, true);
});
test('persistent overload selects economy with smoothness disabled, including very slow UI', () => {
  for (const uiFps of [30, 2]) {
    const profile = simulate({ uiFps, cap: () => 20 });
    assert.equal(profile.quality, 'economy'); assert.equal(profile.smoothness, false); assert.equal(profile.reason, 'unstable');
  }
});
test('fast 120 Hz display and effects can select 120 FPS', () => {
  const profile = simulate({ hz: 120 }); assert.equal(profile.targetFps, 120); assert.equal(profile.reason, 'measured');
  assert.ok(profile.durationMs >= 30000 && profile.durationMs <= 45000);
});
test('120 Hz UI with effects capped at 60 cannot falsely qualify for 90 or 120 FPS', () => {
  const profile = simulate({ hz: 120, cap: () => 60 });
  assert.equal(profile.targetFps, 60); assert.equal(profile.smoothness, true);
  assert.ok(profile.measurements.filter(m => m.targetFps > 60).every(m => !m.stable));
});
test('failed 120 FPS is retested at 90 FPS before selecting it', () => {
  const profile = simulate({ hz: 120, cap: () => 100 });
  assert.equal(profile.targetFps, 90); assert.equal(profile.reason, 'measured');
  assert.ok(profile.measurements.some(m => m.targetFps === 90 && m.stable));
});
test('verification catches deterioration after the initial high-quality probe', () => {
  const profile = simulate({ cap: view => view.phase === 'verify' && view.candidate.quality === 'high' ? 40 : 60 });
  assert.equal(profile.quality, 'balanced'); assert.equal(profile.reason, 'measured');
});
test('unavailable renderer and insufficient effect coverage produce conservative fallback', () => {
  for (const options of [{ ready: false }, { effects: 0 }, { effects: 2 }, { effects: 3 }, { uiFps: NaN }]) {
    const profile = simulate(options); assert.equal(profile.status, 'fallback'); assert.equal(profile.quality, 'balanced'); assert.equal(profile.smoothness, false);
    assert.equal(profile.reason, 'unavailable'); assert.ok(profile.durationMs <= 45100);
  }
});
test('background time is excluded and the interrupted measurement window is repeated', () => {
  const profile = simulate({ pause: true }); assert.equal(profile.reason, 'measured');
  assert.ok(profile.durationMs >= 30000 && profile.durationMs <= 45000);
});
test('cancel always selects balanced quality, 60 FPS and disabled smoothness, exactly once', () => {
  const run = new DeviceOptimizationRun(); for (let at = 0; at <= 12000; at += 16) run.tick(at, snapshot(run.view, {}), true);
  const cancelled = run.cancel(); assert.equal(cancelled.quality, 'balanced'); assert.equal(cancelled.targetFps, 60); assert.equal(cancelled.smoothness, false);
  assert.equal(cancelled.status, 'cancelled'); assert.equal(run.cancel(), cancelled);
  assert.equal(run.tick(999999, snapshot(run.view, {}), true).result, cancelled);
});
test('persisted profiles reject invalid settings/version/corrupt JSON', () => {
  const profile = simulate(); assert.deepEqual(readDeviceProfile(JSON.stringify(profile)), profile);
  for (const value of [null, '{', JSON.stringify({ ...profile, version: 2 }), JSON.stringify({ ...profile, quality: 'ultra' }), JSON.stringify({ ...profile, targetFps: 240 })]) assert.equal(readDeviceProfile(value), null);
});
