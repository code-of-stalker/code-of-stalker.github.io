import { glassRenderDensity } from '../../../src/features/product/motion/effectQuality';
import type { EffectQuality } from '../../../src/features/product/motion/effectQuality';

let level: EffectQuality = 'balanced';
document.body.dataset.quality = level;
const listeners = new Set<() => void>();
const metrics = new Set<() => object>();
let vectorRunning = false, glassRunning = false, lastActivity: boolean | null = null;
function activity() {
  const running = vectorRunning || glassRunning;
  if (running === lastActivity) return;
  lastActivity = running; postArtMessage({ type: 'watcher-art-activity', running });
}
export const glassQuality = {
  vector(running: boolean) { vectorRunning = running; activity(); },
  glass(running: boolean) { glassRunning = running; activity(); },
  density: () => glassRenderDensity,
  subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; },
  update(value: unknown) {
    if (value !== 'economy' && value !== 'reduced' && value !== 'balanced' && value !== 'high' || value === level) return;
    level = value; document.body.dataset.quality = value; listeners.forEach(fn => fn());
  },
  register(read: () => object) { metrics.add(read); return () => { metrics.delete(read); }; },
  report() { metrics.forEach(read => postArtMessage({ type: 'watcher-art-metrics', metrics: { ...read(), level } })); },
};
export function postArtMessage(value: object) {
  window.parent.postMessage(value, '*'); window.ReactNativeWebView?.postMessage(JSON.stringify(value));
}
