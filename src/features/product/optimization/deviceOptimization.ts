import type { EffectsSnapshot } from '../motion/EffectsController';
import type { EffectQuality, TargetFps } from '../motion/effectQuality';

export const deviceOptimizationKey = 'watcher.device.optimization.v1';
export const optimizationTiming = { baseline: 3000, warmup: 4000, probe: 6000, verify: 5000, minimum: 30000, maximum: 45000 } as const;
export type OptimizationChoice = { quality: EffectQuality; targetFps: TargetFps; smoothness: boolean };
export type OptimizationMeasurement = OptimizationChoice & { windows: number; covered: number; fps: number; p95: number; stable: boolean };
export type DeviceOptimizationProfile = OptimizationChoice & {
  version: 1; completedAt: number; durationMs: number;
  status: 'completed' | 'cancelled' | 'fallback';
  reason: 'measured' | 'cancelled' | 'unavailable' | 'unstable';
  measurements: OptimizationMeasurement[];
};
type Phase = 'baseline' | 'warmup' | 'probe' | 'refresh' | 'verify' | 'done';
export type OptimizationView = { phase: Phase; elapsed: number; scene: boolean; candidate: OptimizationChoice; result: DeviceOptimizationProfile | null };
type Window = { covered: boolean; fps: number; p95: number };
const tiers: EffectQuality[] = ['high', 'balanced', 'economy'];
const safeChoice: OptimizationChoice = { quality: 'balanced', targetFps: 60, smoothness: false };
const percentile = (values: number[], fraction: number) => [...values].sort((a, b) => a - b)[Math.max(0, Math.ceil(values.length * fraction) - 1)] ?? 0;

export function readDeviceProfile(text: string | null): DeviceOptimizationProfile | null {
  if (!text) return null;
  try {
    const p: DeviceOptimizationProfile = JSON.parse(text);
    if (p.version !== 1 || !['high', 'balanced', 'reduced', 'economy'].includes(p.quality) || ![60, 90, 120].includes(p.targetFps) ||
        typeof p.smoothness !== 'boolean' || !['completed', 'cancelled', 'fallback'].includes(p.status) ||
        !['measured', 'cancelled', 'unavailable', 'unstable'].includes(p.reason) || !Number.isSafeInteger(p.completedAt) || p.completedAt <= 0 ||
        !Number.isFinite(p.durationMs) || p.durationMs < 0 || !Array.isArray(p.measurements) || p.measurements.length > 12) return null;
    return p;
  } catch { return null; }
}

/** Pure timing/selection core. No storage, navigation, rendering or fake FPS. */
export class DeviceOptimizationRun {
  private phase: Phase = 'baseline';
  private elapsed = 0;
  private startedPhaseAt = 0;
  private last: number | null = null;
  private sampledAt = -Infinity;
  private baseline: number[] = [];
  private windows: Window[] = [];
  private tier = 0;
  private refresh: TargetFps = 60;
  private choice: OptimizationChoice = { quality: 'high', targetFps: 60, smoothness: true };
  private measurements: OptimizationMeasurement[] = [];
  private fallback = false;
  private result: DeviceOptimizationProfile | null = null;

  get view(): OptimizationView { return { phase: this.phase, elapsed: this.elapsed, scene: this.phase !== 'baseline' && this.phase !== 'done', candidate: { ...this.choice }, result: this.result }; }
  pause() { this.last = null; this.restartWindow(); }
  restartWindow() { this.windows = []; this.sampledAt = -Infinity; this.startedPhaseAt = this.elapsed; }
  private enter(phase: Phase, choice = this.choice) { this.phase = phase; this.choice = { ...choice }; this.restartWindow(); }
  private finish(status: DeviceOptimizationProfile['status'], reason: DeviceOptimizationProfile['reason'], choice = this.choice) {
    this.result = { ...choice, version: 1, completedAt: Date.now(), durationMs: Math.round(this.elapsed), status, reason, measurements: [...this.measurements] };
    this.phase = 'done'; return this.view;
  }
  cancel() { if (!this.result) this.finish('cancelled', 'cancelled', safeChoice); return this.result!; }
  private sample(snapshot: EffectsSnapshot) {
    const cadence = snapshot.cadence;
    const effects = snapshot.frames.filter(frame => !frame.awaitingGlass && !frame.metrics?.idle).flatMap(frame => frame.metrics?.cadence ?? frame.cadence ?? []);
    const covered = snapshot.frames.length >= 4 && !snapshot.cadencePending && snapshot.level === this.choice.quality && snapshot.targetFps === this.choice.targetFps &&
      !!cadence && Number.isFinite(cadence.fps) && cadence.fps > 0 && Number.isFinite(cadence.p95) && cadence.p95 > 0 &&
      (cadence.samples >= 6 || cadence.fps < 20 && cadence.samples >= 2) && cadence.active && effects.filter(effect => effect.samples >= 6).length >= 3 &&
      effects.every(effect => Number.isFinite(effect.fps) && effect.fps > 0 && Number.isFinite(effect.p95) && effect.p95 > 0);
    return { covered, fps: covered ? Math.min(cadence!.fps, ...effects.map(effect => effect.fps)) : 0,
      p95: covered ? Math.max(cadence!.p95, ...effects.map(effect => effect.p95)) : 0 };
  }
  private summarize() {
    const covered = this.windows.filter(window => window.covered);
    const fps = percentile(covered.map(window => window.fps), .2), p95 = percentile(covered.map(window => window.p95), .8);
    const stable = covered.length >= 3 && covered.length >= this.windows.length * .75 && fps >= this.choice.targetFps * .9 && p95 <= 1000 / this.choice.targetFps * 1.85;
    const summary: OptimizationMeasurement = { ...this.choice, windows: this.windows.length, covered: covered.length, fps, p95, stable };
    this.measurements.push(summary); return summary;
  }
  tick(at: number, snapshot: EffectsSnapshot, sceneReady: boolean): OptimizationView {
    if (this.result) return this.view;
    const dt = this.last === null ? 0 : Math.max(0, at - this.last); this.last = at; this.elapsed += dt;
    if (this.elapsed >= optimizationTiming.maximum) {
      // Incomplete coverage is never reported as successful device measurement.
      return this.finish('fallback', 'unavailable', safeChoice);
    }
    const phaseMs = this.elapsed - this.startedPhaseAt;
    if (this.phase === 'baseline') {
      if (dt >= 3 && dt <= 100) this.baseline.push(dt);
      if (phaseMs >= optimizationTiming.baseline) {
        const fast = percentile(this.baseline, .2);
        this.refresh = this.baseline.length >= 45 ? fast <= 8.8 ? 120 : fast <= 11.9 ? 90 : 60 : 60;
        this.enter('warmup');
      }
    } else if (this.phase === 'warmup') {
      if (phaseMs >= optimizationTiming.warmup && sceneReady) this.enter('probe');
    } else {
      // Ignore shader/texture changes and clock-reset warmup for each candidate.
      if (sceneReady && phaseMs >= 2000 && this.elapsed - this.sampledAt >= 1000) { this.windows.push(this.sample(snapshot)); this.sampledAt = this.elapsed; }
      const duration = this.phase === 'verify' ? optimizationTiming.verify : optimizationTiming.probe;
      if (phaseMs < duration) return this.view;
      const summary = this.summarize();
      if (this.phase === 'probe') {
        if (++this.tier < tiers.length) this.enter('probe', { quality: tiers[this.tier], targetFps: 60, smoothness: true });
        else {
          const best = this.measurements.find(measurement => measurement.stable);
          this.fallback = !this.measurements.some(measurement => measurement.covered >= 3);
          const selected = best ? { quality: best.quality, targetFps: 60 as const, smoothness: true } : this.fallback ? safeChoice : { quality: 'economy' as const, targetFps: 60 as const, smoothness: false };
          this.enter(best && this.refresh > 60 ? 'refresh' : 'verify', { ...selected, targetFps: best ? this.refresh : 60 });
        }
      } else if (this.phase === 'refresh') {
        if (summary.stable) this.enter('verify');
        else if (this.choice.targetFps === 120 && this.elapsed + optimizationTiming.probe + optimizationTiming.verify < optimizationTiming.maximum) this.enter('refresh', { ...this.choice, targetFps: 90 });
        else this.enter('verify', { ...this.choice, targetFps: 60 });
      } else if (this.phase === 'verify' && this.elapsed >= optimizationTiming.minimum) {
        if (!this.choice.smoothness) return this.finish(this.fallback ? 'fallback' : 'completed', this.fallback ? 'unavailable' : 'unstable');
        if (summary.stable) return this.finish('completed', 'measured');
        const canRetry = this.elapsed + optimizationTiming.verify < optimizationTiming.maximum;
        if (canRetry && this.choice.targetFps > 60) this.enter('verify', { ...this.choice, targetFps: 60 });
        else if (canRetry && this.choice.quality !== 'economy') this.enter('verify', { quality: this.choice.quality === 'high' ? 'balanced' : 'economy', targetFps: 60, smoothness: true });
        else return this.finish('completed', 'unstable', { quality: 'economy', targetFps: 60, smoothness: false });
      }
    }
    return this.view;
  }
}
