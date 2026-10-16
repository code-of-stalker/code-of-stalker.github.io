/** Frame cadence and effect commits, never synchronous JavaScript draw time. */
export type EffectQuality = 'economy' | 'reduced' | 'balanced' | 'high';
export type TargetFps = 60 | 90 | 120;
/** Artwork density is independent of the fixed glass calculation resolution. */
export const densityLimits = { min: 1.5, max: 2.5 } as const;
export const glassRenderDensity = 1;
export const qualityDensity: Record<EffectQuality, number> = { economy: 1.5, reduced: 2, balanced: 2, high: 2.5 };
export const qualityNames: Record<EffectQuality, string> = { economy: 'Экономный', reduced: 'Умеренный', balanced: 'Сбалансированный', high: 'Высокий' };
const levels: EffectQuality[] = ['economy', 'reduced', 'balanced', 'high'];
export const glassPixelBudget = 384_000;

const cssSize = (value: number) => Number.isFinite(value) ? Math.max(1, value) : 1;

/** Glass stays at CSS resolution, including its source texture. The budget is soft. */
export function glassBufferLayout(width: number, height: number, _requested = glassRenderDensity, budget = glassPixelBudget) {
  const w = cssSize(width), h = cssSize(height);
  const bufferWidth = Math.ceil(w), bufferHeight = Math.ceil(h);
  return { density: glassRenderDensity, width: bufferWidth, height: bufferHeight, densityX: bufferWidth / w, densityY: bufferHeight / h,
    budgetExceeded: bufferWidth * bufferHeight > budget };
}

/** The controller alone chooses artwork density. A budget is diagnostic, not
 * an unreported downgrade that overrides automatic quality or a reference. */
export function artworkBufferLayout(width: number, height: number, requested: number, budget = glassPixelBudget) {
  const w = Number.isFinite(width) ? Math.max(1, width) : 1, h = Number.isFinite(height) ? Math.max(1, height) : 1;
  const cap = Math.max(1.5, Math.min(2.5, Number.isFinite(requested) ? requested : 2.5));
  const floor = cap >= 2 ? 2 : 1.5;
  const density = cap;
  const pixels = (size: number) => Math.max(Math.ceil(size * floor), Math.min(Math.floor(size * 2.5), Math.round(size * density)));
  const bufferWidth = pixels(w), bufferHeight = pixels(h);
  return { density, width: bufferWidth, height: bufferHeight, densityX: bufferWidth / w, densityY: bufferHeight / h,
    budgetExceeded: bufferWidth * bufferHeight > budget };
}
export type EffectCadence = { p95: number; fps: number; samples: number };
export type Cadence = { p95: number; missedShare: number; refreshMs: number; calibrated: boolean; samples: number; active: boolean; targetMs: number; fps: number; overloaded: boolean };
export type QualityChange = { from: EffectQuality; to: EffectQuality; reason: string; at: number; cost: number };
const percentile = (sorted: number[], p: number) => sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * p) - 1)] ?? 0;

export class QualityPolicy {
  level: EffectQuality = 'high';
  preferred: EffectQuality = 'high';
  cost = 0;
  targetFps: TargetFps = 60;
  smooth = true;
  reason = 'Старт: стекло ×1,00; иллюстрации ×2,50; цель 60 FPS';
  refreshMs = 1000 / 60;
  calibrated = false;
  metrics: Cadence | null = null;
  private samples: { at: number; dt: number }[] = [];
  private last: number | null = null;
  private evaluatedAt = 0;
  private badSince: number | null = null;
  private stableSince: number | null = null;
  private raisedAt = -Infinity;
  private activity: boolean | null = null;
  forced: EffectQuality | null = null;
  resetWindow() { this.samples = []; this.last = null; this.badSince = null; this.stableSince = null; this.metrics = null; this.activity = null; this.evaluatedAt = 0; }
  resetScreen() {
    this.level = this.forced ?? this.preferred; this.cost = this.level === 'economy' ? 3 : this.level === 'reduced' ? 1 : 0;
    this.reason = this.forced ? 'Фиксированная плотность иллюстраций для проверки; стекло ×1,00' : `Качество устройства: ${qualityNames[this.preferred]}; стекло ×1,00; иллюстрации ×${qualityDensity[this.level].toFixed(2)}`;
    this.raisedAt = -Infinity; this.resetWindow();
  }
  setPreferred(level: EffectQuality) { this.preferred = level; this.resetScreen(); }
  setTarget(target: TargetFps, smooth = true) { this.targetFps = target; this.smooth = smooth; this.resetWindow(); }
  setReference(level: EffectQuality | null) {
    this.forced = level; this.level = level ?? this.preferred; this.cost = this.level === 'economy' ? 3 : this.level === 'reduced' ? 1 : 0;
    this.reason = level ? 'Фиксированная плотность для проверки' : 'Автоматическое качество: новое окно'; this.resetWindow();
  }
  observe(at: number, active: boolean, effects: EffectCadence[] = []): QualityChange | null {
    if (this.activity !== active) { this.resetWindow(); this.activity = active; }
    if (this.last !== null) { const dt = at - this.last; if (dt > 0) this.samples.push({ at, dt }); }
    this.last = at;
    if (at - this.evaluatedAt < 500 || this.samples.length === 0) return null;
    this.samples = this.samples.filter(sample => at - sample.at < 1100);
    if (!this.samples.length) return null;
    this.evaluatedAt = at;
    const sorted = this.samples.map(sample => sample.dt).sort((a, b) => a - b);
    const low = percentile(sorted, .2), median = percentile(sorted, .5), uiP95 = percentile(sorted, .95);
    // A slower cadence is learned only without load. Dropped 60 Hz frames must
    // never redefine the display as 30 Hz.
    const fastCluster = sorted.filter(dt => dt >= low * .9 && dt <= low * 1.1);
    if (fastCluster.length >= 12 && low >= 3 && low <= 42 && low < this.refreshMs * .95) {
      this.refreshMs = percentile(fastCluster, .5); this.calibrated = true;
    } else if (sorted.length >= 12 && median >= 3 && median <= 42 && uiP95 / low < 1.2 && (median <= this.refreshMs * 1.05 || !active)) {
      this.refreshMs = median; this.calibrated = true;
    }
    const targetMs = Math.max(this.refreshMs, 1000 / (this.smooth ? this.targetFps : 60));
    let slots = 0, missed = 0;
    for (const sample of this.samples) { const count = Math.max(1, Math.round(sample.dt / this.refreshMs)); slots += count; missed += count - 1; }
    // Actual effect commits, not the scheduler counter: 30 FPS rain cannot
    // qualify as smooth even when the UI receives 90 requestAnimationFrames.
    const measured = effects.filter(effect => effect.samples >= 6);
    const p95 = Math.max(uiP95, ...measured.map(effect => effect.p95));
    const uiFps = sorted.length * 1000 / sorted.reduce((sum, dt) => sum + dt, 0);
    const fps = Math.min(uiFps, ...measured.map(effect => effect.fps));
    const share = Math.max(missed / Math.max(1, slots), 1 - Math.min(1, fps * targetMs / 1000));
    // 90 FPS on a 120 Hz panel legitimately alternates one/two display slots.
    const quantizedInterval = Math.ceil(targetMs / this.refreshMs - 1e-6) * this.refreshMs;
    const poor = share > .12 && (p95 > Math.max(targetMs * 1.65, quantizedInterval * 1.35)
      || measured.length > 0 && fps < (1000 / targetMs) * .85);
    const good = share <= .04 && p95 <= Math.max(targetMs * 1.35, quantizedInterval * 1.05);
    this.metrics = { p95, missedShare: share, refreshMs: this.refreshMs, calibrated: this.calibrated, targetMs, fps, samples: sorted.length, active, overloaded: poor };
    const coveredMs = at - this.samples[0].at + this.samples[0].dt;
    if (!active || !this.smooth || this.forced || coveredMs < 850) { this.badSince = null; this.stableSince = null; return null; }
    this.badSince = poor ? this.badSince ?? at : null;
    this.stableSince = good ? this.stableSince ?? at : null;
    const index = levels.indexOf(this.level);
    const lower = this.badSince !== null && at - this.badSince >= 2000 && (this.level !== 'economy' || this.cost < 3);
    const preferredCost = this.preferred === 'economy' ? 3 : this.preferred === 'reduced' ? 1 : 0;
    const higher = this.stableSince !== null && at - this.stableSince >= 18000 && at - this.raisedAt >= 20000 && (index < levels.indexOf(this.preferred) || this.cost > preferredCost);
    if (!lower && !higher) {
      if (poor && this.level === 'economy' && this.cost === 3) this.reason = 'Цель FPS не достигнута; стекло ×1,00, иллюстрации ×1,50; сохраняем основные контуры';
      return null;
    }
    const from = this.level, previousCost = this.cost;
    if (lower) {
      if (this.level === 'high') this.level = 'balanced';
      else if (this.cost < 3) { this.cost++; if (this.level !== 'economy') this.level = 'reduced'; }
      else this.level = 'economy';
    } else {
      // Restore sharp artwork before restoring expensive secondary effects.
      if (this.level === 'economy') this.level = 'reduced';
      else if (this.cost > 0) { this.cost--; if (this.cost === 0) this.level = 'balanced'; }
      else this.level = levels[Math.min(index + 1, levels.length - 1)];
      this.raisedAt = at;
    }
    this.reason = lower ? (this.cost !== previousCost
      ? 'Устойчивая перегрузка ≥2 с: упрощаем второстепенные эффекты, сохраняя плотность иллюстраций'
      : this.level === 'economy' ? 'Перегрузка сохраняется после трёх ступеней упрощения: иллюстрации ×1,50; стекло ×1,00'
      : 'Устойчивая перегрузка ≥2 с: иллюстрации ×2,00; стекло ×1,00')
      : 'Запас производительности с активными эффектами ≥18 с; стекло остаётся ×1,00';
    const change = { from, to: this.level, reason: this.reason, at, cost: this.cost };
    this.resetWindow(); return change;
  }
}
