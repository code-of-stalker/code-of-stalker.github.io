import { QualityPolicy, qualityDensity, glassRenderDensity } from './effectQuality';
import type { Cadence, EffectCadence, EffectQuality, QualityChange, TargetFps } from './effectQuality';

export type GlassMetrics = { level?: EffectQuality; density: number; buffer: number[]; source: number[]; blur: number[]; draws: number; blurUpdates: number; sourceUpdates: number; contourUpdates: number; idle: boolean;
  surface?: 'glass' | 'artwork'; requestedDensity?: number;
  presentation?: 'direct-gpu' | 'atlas-canvas2d'; vectorUploadBytes?: number; filterAllocations?: number;
  densityX?: number; densityY?: number; budgetExceeded?: boolean; transitioning?: boolean; cadence?: EffectCadence; backend?: string; textures?: number; textureBytes?:number; scenes?: number };
type Frame = { label: string; send(value: object): void; active: boolean; running: boolean; metrics?: GlassMetrics; cadence?: EffectCadence; backend?: string; awaitingGlass?: boolean };
export type EffectsSnapshot = { screen: string; level: EffectQuality; reason: string; reference: EffectQuality | null; cost: number; targetFps: TargetFps; smooth: boolean; cadence: Cadence | null; cadencePending: boolean; frames: { label: string; metrics?: GlassMetrics; cadence?: EffectCadence; backend?: string; awaitingGlass?: boolean }[] };
let diagnosticEnabled = false;
const diagnosticListeners = new Set<() => void>();
export const diagnosticsPreference = {
  get: () => diagnosticEnabled,
  subscribe(fn: () => void) { diagnosticListeners.add(fn); return () => { diagnosticListeners.delete(fn); }; },
  set(enabled: boolean) { diagnosticEnabled = enabled; diagnosticListeners.forEach(fn => fn()); },
};

/** One instance above the product navigator. Inactive routes cannot contribute work. */
export class EffectsController {
  readonly policy = new QualityPolicy();
  optimizing = false;
  private frames = new Map<object, Frame>();
  private listeners = new Set<() => void>();
  private frameJobs = new Set<(at: number) => void>();
  private nextFrame = 0;
  private screen = '';
  private publishedAt = 0;
  private retainCadence = false;
  private trace: { at: number; screen: string; cadence: Cadence | null; level: EffectQuality; change?: QualityChange }[] = [];
  private snapshot: EffectsSnapshot = { screen: '', level: this.policy.level, reason: this.policy.reason, reference: null, cost: 0, targetFps: this.policy.targetFps, smooth: true, cadence: null, cadencePending: false, frames: [] };
  getSnapshot = () => this.snapshot;
  subscribe = (fn: () => void) => { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; };
  private qualityMessage() { return { type: 'watcher-quality', level: this.policy.level, density: qualityDensity[this.policy.level], glassDensity: glassRenderDensity, cost: this.policy.cost, targetFps: this.policy.smooth ? this.policy.targetFps : 60 }; }
  frameJob(job: (at: number) => void) { this.frameJobs.add(job); return () => { this.frameJobs.delete(job); }; }
  target(target: TargetFps, smooth = true) { if (this.optimizing) return; this.retainCadence = false; this.nextFrame = 0; this.policy.setTarget(target, smooth); this.broadcast(); this.publish(); }
  preferred(level: EffectQuality) { if (this.optimizing) return; this.retainCadence = false; this.policy.setPreferred(level); this.broadcast(); this.publish(); }
  probe(level: EffectQuality, target: TargetFps) {
    this.optimizing = true; this.retainCadence = false; this.nextFrame = 0;
    this.policy.setTarget(target, true); this.policy.setReference(level);
    this.resetWindow(); this.broadcast(); this.publish();
  }
  finishOptimization(level: EffectQuality, target: TargetFps, smooth: boolean) {
    this.optimizing = false; this.policy.setReference(null); this.policy.setPreferred(level);
    this.target(target, smooth);
  }
  register(id: object, label: string, send: Frame['send']) {
    this.frames.set(id, { label, send, active: false, running: false }); send(this.qualityMessage());
    return () => { this.frames.delete(id); };
  }
  sync(id: object) { this.frames.get(id)?.send(this.qualityMessage()); }
  activity(id: object, active: boolean, running: boolean) {
    const frame = this.frames.get(id); if (frame) { frame.active = active; frame.running = running; }
  }
  report(id: object, data: GlassMetrics) {
    const frame = this.frames.get(id);
    if (!frame || !Number.isFinite(data?.density) || !Array.isArray(data.buffer) || !Array.isArray(data.source)) return;
    if (data.level && data.level !== this.policy.level) return;
    frame.metrics = data; frame.awaitingGlass = !!data.transitioning;
  }
  reportCadence(id: object, backend: string, cadence?: EffectCadence) {
    const frame = this.frames.get(id); if (frame) { frame.backend = backend; frame.cadence = cadence; }
  }
  screenChanged(screen: string) {
    if (screen === this.screen) return;
    this.retainCadence = false; this.screen = screen; this.policy.resetScreen(); this.broadcast(); this.publish();
  }
  resetWindow = () => { this.retainCadence = false; this.nextFrame = 0; this.policy.resetWindow(); this.frames.forEach(frame => { frame.cadence = undefined; if(frame.metrics) frame.metrics.cadence = undefined; frame.send({ type: 'watcher-clock-reset' }); }); };
  reference(level: EffectQuality | null) { this.retainCadence = !!this.snapshot.cadence; this.policy.setReference(level); this.broadcast(); this.publish(); }
  recreateGraphics() { this.frames.forEach(frame => frame.send({ type: 'watcher-graphics-recover' })); }
  private broadcast() {
    const message = this.qualityMessage();
    this.frames.forEach(frame => {
      if (frame.metrics) frame.awaitingGlass = true;
      frame.send(message);
      if (frame.active && (diagnosticsPreference.get() || this.optimizing)) frame.send({ type: 'watcher-quality-report' });
    });
  }
  sample(at: number) {
    const period = 1000 / (this.policy.smooth ? this.policy.targetFps : 60);
    if (at + .25 >= this.nextFrame) {
      if (!this.nextFrame || at - this.nextFrame > period * 2) this.nextFrame = at;
      this.nextFrame += period;
      this.frameJobs.forEach(job => job(at));
    }
    const active = [...this.frames.values()].some(frame => frame.active && frame.running);
    const effects = [...this.frames.values()].filter(frame => frame.active && frame.running && !frame.awaitingGlass).flatMap(frame => frame.metrics?.cadence ?? frame.cadence ?? []);
    const change = this.policy.observe(at, active, effects);
    if (change) { this.retainCadence = !!this.snapshot.cadence; this.broadcast(); }
    if (at - this.publishedAt < 1000 && !change) return;
    this.publishedAt = at;
    if (diagnosticsPreference.get() || this.optimizing) {
      this.trace.push({ at: Math.round(at), screen: this.screen, cadence: this.policy.metrics, level: this.policy.level, ...(change ? { change } : {}) });
      if (this.trace.length > 600) this.trace.shift();
      this.frames.forEach(frame => { if (frame.active) frame.send({ type: 'watcher-quality-report' }); });
    }
    this.publish();
  }
  private publish() {
    if (this.policy.metrics && this.policy.metrics.samples >= 6 && ![...this.frames.values()].some(frame => frame.active && frame.awaitingGlass)) this.retainCadence = false;
    this.snapshot = { screen: this.screen, level: this.policy.level, reason: this.policy.reason, reference: this.policy.forced, cost: this.policy.cost, targetFps: this.policy.targetFps, smooth: this.policy.smooth,
      cadence: this.retainCadence ? this.snapshot.cadence : this.policy.metrics, cadencePending: this.retainCadence,
      frames: [...this.frames.values()].filter(frame => frame.active).map(frame => ({ label: frame.label, metrics: frame.metrics, backend: frame.backend, cadence: frame.cadence, awaitingGlass: frame.awaitingGlass })) };
    this.listeners.forEach(fn => fn());
  }
  export() { return { measured: 'UI requestAnimationFrame and committed effect-frame cadence; no GPU execution timings', ...this.snapshot, trace: this.trace }; }
}
