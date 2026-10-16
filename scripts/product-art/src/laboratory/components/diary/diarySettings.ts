export type DiarySettings = {
  theme: 'dark' | 'light'; motion: 'levitate' | 'cascade' | 'breathe'; signal: 'voice' | 'cells' | 'code'
  touch: 'save' | 'lift' | 'pulse'; playing: boolean; frame: boolean; labels: boolean; guides: boolean
  scanEnabled: boolean; traceEnabled: boolean; parallaxEnabled: boolean; touchEnabled: boolean
  color: string; lightColor: string; surfaceColor: string
  layers: number; layerGap: number; depth: number; tilt: number; size: number; rotation: number
  lineWidth: number; layerOpacity: number; surfaceOpacity: number
  tempo: number; floatAmount: number; stagger: number; signalCount: number; signalAmount: number; signalSpeed: number
  scanInterval: number; scanWidth: number; scanStrength: number; traceLength: number
  glow: number; glowRadius: number; halo: number; haloPulse: number
  touchStrength: number; touchDuration: number; holdDelay: number; parallax: number; inertia: number
}

// Geometry and palette follow the approved third concept: Archive of moments.
export const defaultDiarySettings: DiarySettings = {
  theme: 'dark', motion: 'levitate', signal: 'voice', touch: 'save', playing: true,
  frame: true, labels: true, guides: true, scanEnabled: false, traceEnabled: true, parallaxEnabled: true, touchEnabled: true,
  color: '#E7E100', lightColor: '#FFF7BA', surfaceColor: '#0A0C05',
  layers: 3, layerGap: 19, depth: 8, tilt: 1, size: 1, rotation: 0,
  lineWidth: 1, layerOpacity: .5, surfaceOpacity: 1,
  tempo: .8, floatAmount: 3, stagger: .45, signalCount: 7, signalAmount: 1, signalSpeed: .8,
  scanInterval: 6, scanWidth: 9, scanStrength: .6, traceLength: 20,
  glow: .45, glowRadius: 2.6, halo: .13, haloPulse: .3,
  touchStrength: .65, touchDuration: 1.1, holdDelay: .32, parallax: 6, inertia: .18,
}
export const diaryBounds = {
  layers: [1, 7, 1], layerGap: [0, 36, 1], depth: [1, 20, 1], tilt: [.45, 1.7, .01], size: [.6, 1.35, .01], rotation: [-18, 18, 1],
  lineWidth: [.35, 2.5, .05], layerOpacity: [.05, 1, .01], surfaceOpacity: [0, 1, .01],
  tempo: [.1, 2, .05], floatAmount: [0, 18, .5], stagger: [0, 1, .05],
  signalCount: [3, 21, 1], signalAmount: [0, 2, .05], signalSpeed: [0, 3, .05],
  scanInterval: [2, 14, .5], scanWidth: [1, 24, .5], scanStrength: [0, 2, .05], traceLength: [4, 100, 1],
  glow: [0, 1.5, .05], glowRadius: [0, 6, .2], halo: [0, .6, .01], haloPulse: [0, 1, .05],
  touchStrength: [0, 2, .05], touchDuration: [.3, 3, .1], holdDelay: [.18, 1, .02], parallax: [0, 18, .5], inertia: [.04, .8, .02],
} as const
export type DiaryNumber = keyof typeof diaryBounds
export const DIARY_STORAGE_KEY = 'prince-diary-cover-v1'

export function normalizeDiarySettings(raw: unknown): DiarySettings {
  const result = { ...defaultDiarySettings }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return result
  const input = raw as Record<string, unknown>
  for (const key of Object.keys(diaryBounds) as DiaryNumber[]) {
    const value = input[key], [min, max] = diaryBounds[key]
    if (typeof value === 'number' && Number.isFinite(value)) result[key] = Math.min(max, Math.max(min, value))
  }
  result.layers = Math.round(result.layers); result.signalCount = Math.round(result.signalCount)
  for (const key of ['playing', 'frame', 'labels', 'guides', 'scanEnabled', 'traceEnabled', 'parallaxEnabled', 'touchEnabled'] as const) {
    if (typeof input[key] === 'boolean') result[key] = input[key]
  }
  for (const key of ['color', 'lightColor', 'surfaceColor'] as const) {
    if (typeof input[key] === 'string' && /^#[\da-f]{6}$/i.test(input[key])) result[key] = input[key].toUpperCase()
  }
  if (input.theme === 'light' || input.theme === 'dark') result.theme = input.theme
  if (input.motion === 'levitate' || input.motion === 'cascade' || input.motion === 'breathe') result.motion = input.motion
  if (input.signal === 'voice' || input.signal === 'cells' || input.signal === 'code') result.signal = input.signal
  if (input.touch === 'save' || input.touch === 'lift' || input.touch === 'pulse') result.touch = input.touch
  return result
}

export function applyDiaryTheme(value: DiarySettings, theme: DiarySettings['theme']): DiarySettings {
  return { ...value, theme, ...(theme === 'light'
    ? { color: '#C74307', lightColor: '#FFF5C9', surfaceColor: '#F5D997' }
    : { color: '#E7E100', lightColor: '#FFF7BA', surfaceColor: '#0A0C05' }) }
}
export function serializeDiaryPreset(settings: DiarySettings) {
  return JSON.stringify({ version: 1, kind: 'diary-archive', settings: normalizeDiarySettings(settings) }, null, 2)
}
export function parseDiaryPreset(raw: string): DiarySettings {
  const preset = JSON.parse(raw)
  if (preset?.version !== 1 || preset?.kind !== 'diary-archive' || !preset.settings || typeof preset.settings !== 'object' || Array.isArray(preset.settings)) throw new Error('Invalid diary preset')
  return normalizeDiarySettings(preset.settings)
}
