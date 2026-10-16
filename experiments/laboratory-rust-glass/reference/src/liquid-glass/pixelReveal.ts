import { normalizeGlassPanel } from './glassPanel'
import type { GlassPanel } from './glassPanel'

const clamp = (value: number) => Math.max(0, Math.min(1, value))
const smooth = (a: number, b: number, value: number) => { const t = clamp((value - a) / (b - a)); return t * t * (3 - 2 * t) }
export type PixelRevealState = {
  x: number; y: number; progress: number; width: number; height: number;
  panel: GlassPanel; cellSize: number; softness: number
}

export class PanelPulseReveal {
  x = 0.5
  y = 0.5
  progress = 1
  private elapsed = 0
  trigger(x: number, y: number, reducedMotion: boolean) {
    this.x = clamp(x); this.y = clamp(y); this.elapsed = 0
    this.progress = reducedMotion ? 1 : 0
  }
  finish() { this.progress = 1 }
  step(dt: number, duration: number, enabled: boolean, reducedMotion: boolean) {
    if (!enabled || reducedMotion) { this.finish(); return }
    if (this.progress >= 1) return
    this.elapsed += Math.max(0, Number.isFinite(dt) ? dt : 0)
    this.progress = clamp(this.elapsed / Math.max(0.01, duration))
  }
}

export function makePixelRevealState(x: number, y: number, progress: number, width: number, height: number,
  cellSize: number, softness: number, panel?: GlassPanel): PixelRevealState {
  const rect = panel ? normalizeGlassPanel(panel) : { x: 0.5, y: 0.5, width: 1, height: 1 }
  const w = width * rect.width, h = height * rect.height
  // Bound the number of illuminated sectors independently of output density.
  const effectiveCell = Math.max(cellSize, Math.sqrt(w * h / 1100), Math.max(w, h) / 60)
  return { x, y, progress: clamp(progress), width, height, panel: rect, cellSize: effectiveCell, softness }
}

export function getPixelRevealOrigin(state: PixelRevealState) {
  const { panel, width, height } = state
  return { x: (state.x - panel.x + panel.width / 2) * width,
    y: (state.y - panel.y + panel.height / 2) * height }
}

export function getPixelRevealCell(state: PixelRevealState, column: number, row: number) {
  // Contact is a light response on an already visible surface. It must never
  // change the opacity of the glass, frame, text, illustrations or reader UI.
  if (state.progress >= 1 || state.progress <= 0) return { visibility: 1, light: 0 }
  const size = state.cellSize, origin = getPixelRevealOrigin(state)
  const w = state.width * state.panel.width, h = state.height * state.panel.height
  const reach = Math.hypot(Math.max(origin.x, w - origin.x), Math.max(origin.y, h - origin.y)) + size * 2
  const radius = -size * 2 + (reach + size * 4) * state.progress
  const stagger = ((column * 17 + row * 31) % 13) / 13 * size * 0.35
  const distance = Math.hypot((column + 0.5) * size - origin.x, (row + 0.5) * size - origin.y) + stagger
  const band = Math.max(3, size * (0.35 + state.softness * 1.8))
  const age = radius - distance
  const envelope = smooth(0, 0.08, state.progress) * (1 - smooth(0.85, 1, state.progress))
  return { visibility: 1, light: Math.exp(-0.5 * (age / band) ** 2) * envelope }
}

export const pixelRevealGLSL = `
float pixelPulseLight(vec2 panelUv, vec2 panelPixels) {
  float progress = uPulseReveal.z;
  if (progress >= 1.0 || progress <= 0.0) return 0.0;
  float cell = uPulseReveal.w;
  vec2 point = vec2(panelUv.x, 1.0 - panelUv.y) * panelPixels;
  vec2 index = floor(point / cell);
  vec2 center = (index + 0.5) * cell;
  vec2 origin = uPulseReveal.xy;
  float reach = length(max(origin, panelPixels - origin)) + cell * 2.0;
  float radius = mix(-cell * 2.0, reach + cell * 2.0, progress);
  float stagger = mod(index.x * 17.0 + index.y * 31.0, 13.0) / 13.0 * cell * 0.35;
  float age = radius - length(center - origin) - stagger;
  float band = max(3.0, cell * (0.35 + uPulseStyle.x * 1.8));
  float envelope = smoothstep(0.0, 0.08, progress) * (1.0 - smoothstep(0.85, 1.0, progress));
  // Softly shaped square light patches. These modulate light only; the material
  // underneath stays continuous even between adjacent illuminated sectors.
  float edge = max(abs(point.x - center.x), abs(point.y - center.y));
  float coverage = 1.0 - smoothstep(cell * 0.42, cell * 0.5, edge);
  return exp(-0.5 * pow(age / band, 2.0)) * envelope * coverage * uPulseStyle.y;
}
`
