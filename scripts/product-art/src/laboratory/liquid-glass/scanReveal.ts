import { normalizeGlassPanel } from './glassPanel'
import type { GlassPanel } from './glassPanel'
import type { LiquidGlassSettings } from './settings'

export type ScanSettings = Pick<LiquidGlassSettings, 'scanEnabled' | 'scanDirection' | 'scanSoftness' | 'scanStrength'>
const clamp = (value: number) => Math.max(0, Math.min(1, value))
const smoothstep = (a: number, b: number, value: number) => {
  const x = clamp((value - a) / (b - a))
  return x * x * (3 - 2 * x)
}

/** The same front and smoothstep as uScan in the glass shader. Coordinates here
 * start at the scan's leading side, so all four directions share one profile. */
export function getScanProfile(progress: number, softness: number) {
  const s = Math.max(softness, 0.001)
  const p = clamp(progress)
  return { progress: p, softness: s, front: -2 * s + (1 + 4 * s) * p }
}

export function getScanOpacity(coordinate: number, progress: number, softness: number) {
  if (progress <= 0) return 0
  if (progress >= 1) return 1
  const profile = getScanProfile(progress, softness)
  // The entire soft transition trails the light; nothing is visible ahead of it.
  return 1 - smoothstep(profile.front - profile.softness, profile.front, coordinate)
}

/** Mask the entire DOM overlay in source-frame coordinates. The mask's scan
 * distances follow the panel, including when it has moved or changed size. */
export function getLayoutScanStyle(progress: number, settings: ScanSettings, panel?: GlassPanel) {
  const p = settings.scanEnabled ? clamp(progress) : 1
  if (p >= 1) return { mask: 'none', light: 'none', revealing: false }
  if (p <= 0) return { mask: 'linear-gradient(transparent, transparent)', light: 'none', revealing: true }
  const rect = panel ? normalizeGlassPanel(panel) : { x: 0.5, y: 0.5, width: 1, height: 1 }
  const direction = Math.round(settings.scanDirection)
  const horizontal = direction >= 2
  const reversed = direction === 1 || direction === 3
  const extent = horizontal ? rect.width : rect.height
  const center = horizontal ? rect.x : rect.y
  const origin = reversed ? 1 - center - extent / 2 : center - extent / 2
  const axis = ['to bottom', 'to top', 'to right', 'to left'][direction] ?? 'to bottom'
  const profile = getScanProfile(p, settings.scanSoftness)
  // Nine stops approximate smoothstep; alpha error stays below 1.1%.
  const stops = Array.from({ length: 9 }, (_, i) => {
    const coordinate = profile.front - profile.softness + profile.softness * i / 8
    const alpha = getScanOpacity(coordinate, p, profile.softness)
    return `rgba(0,0,0,${alpha.toFixed(6)}) ${((origin + coordinate * extent) * 100).toFixed(5)}%`
  })
  const envelope = smoothstep(0, 0.08, p) * (1 - smoothstep(0.92, 1, p))
  const lightAlpha = clamp(envelope * settings.scanStrength)
  const front = `${(profile.front * 100).toFixed(5)}%`
  return {
    mask: `linear-gradient(${axis}, ${stops.join(', ')})`,
    // This gradient is rendered inside the layout's own clipped panel bounds.
    light: lightAlpha === 0 ? 'none' : `linear-gradient(${axis}, transparent calc(${front} - 2.5px), rgba(255,229,53,${lightAlpha.toFixed(5)}) ${front}, transparent calc(${front} + 2.5px))`,
    revealing: true,
  }
}
