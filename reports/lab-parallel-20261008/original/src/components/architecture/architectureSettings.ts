import { defaultGuidanceSettings, normalizeGuidanceSettings } from './guidanceSettings'
import type { GuidanceSettings } from './guidanceSettings'
import { defaultSynchronizationSettings, normalizeSynchronizationSettings } from './synchronizationSettings'
import type { SynchronizationSettings } from './synchronizationSettings'
import { defaultDistanceSettings, normalizeDistanceSettings } from './distanceSettings'
import type { DistanceSettings } from './distanceSettings'

export type ArchitectureSettings = {
  illustration: 'cell' | 'distance' | 'synchronization' | 'guidance'; guidance: GuidanceSettings; distance: DistanceSettings; synchronization: SynchronizationSettings
  theme: 'dark' | 'light'; motion: 'release' | 'wave' | 'breathe'; trigger: 'loop' | 'tap'
  touch: 'open' | 'pulse'; playing: boolean; frame: boolean; labels: boolean; neighbors: boolean
  scanEnabled: boolean; touchEnabled: boolean; parallaxEnabled: boolean; fadeFigureFrame: boolean
  color: string; lightColor: string; surfaceColor: string
  cycle: number; columns: number; rows: number; cellSize: number; spread: number; frameSpread: number
  startScale: number; figureScale: number; neighborOpacity: number; lineWidth: number
  size: number; offsetX: number; offsetY: number
  lightSize: number; lightOffset: number; glow: number; glowRadius: number; lightPulse: number
  scanWidth: number; scanStrength: number; touchStrength: number; touchDuration: number; holdDelay: number
  parallax: number; inertia: number
}

/** Approved fourth concept: the central figure starts inside a small matrix cell. */
export const defaultArchitectureSettings: ArchitectureSettings = {
  illustration: 'cell', guidance: { ...defaultGuidanceSettings }, distance: { ...defaultDistanceSettings }, synchronization: { ...defaultSynchronizationSettings },
  theme: 'dark', motion: 'release', trigger: 'loop', touch: 'open', playing: true,
  frame: true, labels: true, neighbors: true, scanEnabled: false, touchEnabled: true, parallaxEnabled: false, fadeFigureFrame: false,
  color: '#E7E100', lightColor: '#FFF7BA', surfaceColor: '#0A0C05',
  cycle: 9, columns: 5, rows: 3, cellSize: 1, spread: 4, frameSpread: .65,
  startScale: .2, figureScale: .86, neighborOpacity: .4, lineWidth: 1,
  size: 1, offsetX: 0, offsetY: 0, lightSize: .55, lightOffset: 0,
  glow: .55, glowRadius: 6, lightPulse: 0, scanWidth: 6, scanStrength: .65,
  touchStrength: .65, touchDuration: 2.5, holdDelay: .32, parallax: 6, inertia: .18,
}
export const architectureBounds = {
  cycle: [4, 24, .5], columns: [3, 7, 2], rows: [3, 5, 2], cellSize: [.6, 1.25, .05],
  spread: [0, 18, .5], frameSpread: [0, 1.8, .05], startScale: [.1, .3, .01], figureScale: [.4, 1.2, .01],
  neighborOpacity: [0, 1, .01], lineWidth: [.35, 2.5, .05], size: [.6, 1.35, .01], offsetX: [-32, 32, 1], offsetY: [-24, 24, 1],
  lightSize: [.15, 2, .05], lightOffset: [-16, 24, 1], glow: [0, 1.5, .05], glowRadius: [0, 12, .25], lightPulse: [0, 1, .05],
  scanWidth: [1, 24, .5], scanStrength: [0, 2, .05], touchStrength: [0, 2, .05], touchDuration: [.6, 6, .1],
  holdDelay: [.18, 1, .02], parallax: [0, 18, .5], inertia: [.04, .8, .02],
} as const
export type ArchitectureNumber = keyof typeof architectureBounds
export const ARCHITECTURE_STORAGE_KEY = 'prince-architecture-cover-v1'

export function normalizeArchitectureSettings(raw: unknown): ArchitectureSettings {
  const result = { ...defaultArchitectureSettings, guidance: { ...defaultGuidanceSettings }, distance: { ...defaultDistanceSettings }, synchronization: { ...defaultSynchronizationSettings } }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return result
  const input = raw as Record<string, unknown>
  if (input.illustration === 'cell' || input.illustration === 'distance' || input.illustration === 'synchronization' || input.illustration === 'guidance') result.illustration = input.illustration
  result.distance = normalizeDistanceSettings(input.distance)
  result.synchronization = normalizeSynchronizationSettings(input.synchronization)
  result.guidance = normalizeGuidanceSettings(input.guidance)
  for (const key of Object.keys(architectureBounds) as ArchitectureNumber[]) {
    const value = input[key], [min, max] = architectureBounds[key]
    if (typeof value === 'number' && Number.isFinite(value)) result[key] = Math.min(max, Math.max(min, value))
  }
  result.columns = Math.min(7, Math.max(3, Math.round((result.columns - 3) / 2) * 2 + 3))
  result.rows = Math.min(5, Math.max(3, Math.round((result.rows - 3) / 2) * 2 + 3))
  for (const key of ['playing', 'frame', 'labels', 'neighbors', 'scanEnabled', 'touchEnabled', 'parallaxEnabled', 'fadeFigureFrame'] as const) {
    if (typeof input[key] === 'boolean') result[key] = input[key]
  }
  for (const key of ['color', 'lightColor', 'surfaceColor'] as const) {
    if (typeof input[key] === 'string' && /^#[\da-f]{6}$/i.test(input[key])) result[key] = input[key].toUpperCase()
  }
  if (input.theme === 'light' || input.theme === 'dark') result.theme = input.theme
  if (input.motion === 'release' || input.motion === 'wave' || input.motion === 'breathe') result.motion = input.motion
  if (input.trigger === 'loop' || input.trigger === 'tap') result.trigger = input.trigger
  if (input.touch === 'open' || input.touch === 'pulse') result.touch = input.touch
  return result
}

export function applyArchitectureTheme(value: ArchitectureSettings, theme: ArchitectureSettings['theme']): ArchitectureSettings {
  return { ...value, theme, ...(theme === 'light'
    ? { color: '#C74307', lightColor: '#FFF5C9', surfaceColor: '#F5D997' }
    : { color: '#E7E100', lightColor: '#FFF7BA', surfaceColor: '#0A0C05' }) }
}
export function serializeArchitecturePreset(settings: ArchitectureSettings) {
  return JSON.stringify({ version: 2, kind: 'architecture-cover', settings: normalizeArchitectureSettings(settings) }, null, 2)
}
export function parseArchitecturePreset(raw: string): ArchitectureSettings {
  const preset = JSON.parse(raw)
  const supported = preset?.version === 1 && preset?.kind === 'architecture-cell' || preset?.version === 2 && preset?.kind === 'architecture-cover'
  if (!supported || !preset.settings || typeof preset.settings !== 'object' || Array.isArray(preset.settings)) throw new Error('Invalid architecture preset')
  return normalizeArchitectureSettings(preset.settings)
}
