export type DistanceSettings = {
  mode: 'scan' | 'project' | 'pulse'
  cycle: number; distance: number; retreatDuration: number; scanDelay: number; scanDuration: number
  rise: number; figureShift: number; profileWidth: number; profileOpacity: number; planeOpacity: number
  lightSize: number; glow: number; glowRadius: number; projection: number; pulse: number; beamSpread: number
  scanWidth: number; scanStrength: number; scanBlur: number; edgeFade: number
  scanEnabled: boolean; planeEnabled: boolean; raysEnabled: boolean
  voiceEnabled: boolean; voiceDrivesMotion: boolean
  voiceStyle: 'arcs' | 'rings' | 'spectrum'; voiceRhythm: 'phrases' | 'steady' | 'syllables'; voiceDirection: 'forward' | 'light'
  voiceColor: string; voiceRate: number; voiceCount: number; voiceSpeed: number; voiceReach: number; voiceSpread: number
  voiceLineWidth: number; voiceOpacity: number; voiceGlow: number; voiceVariation: number
  voiceLead: number; voiceInfluence: number; voiceScanBoost: number
}

/** Fifth distance concept. The source starts dark, retreats, then scans the whole bust. */
export const defaultDistanceSettings: DistanceSettings = {
  mode: 'scan', cycle: 10, distance: 1.25, retreatDuration: 2.6, scanDelay: .6, scanDuration: 3.5,
  rise: 54, figureShift: 40, profileWidth: .65, profileOpacity: .85, planeOpacity: .15,
  lightSize: 1, glow: 1, glowRadius: 5, projection: 1.3, pulse: 1, beamSpread: 1,
  scanWidth: 12, scanStrength: 1, scanBlur: .65, edgeFade: 8,
  scanEnabled: true, planeEnabled: true, raysEnabled: true,
  voiceEnabled: false, voiceDrivesMotion: true, voiceStyle: 'arcs', voiceRhythm: 'phrases', voiceDirection: 'forward',
  voiceColor: '#FFF7BA', voiceRate: 2.6, voiceCount: 5, voiceSpeed: 46, voiceReach: 64, voiceSpread: 70,
  voiceLineWidth: .8, voiceOpacity: .85, voiceGlow: .65, voiceVariation: .6,
  voiceLead: 1.2, voiceInfluence: .7, voiceScanBoost: .7,
}

export const distanceBounds = {
  cycle: [4, 30, .5], distance: [.3, 1.8, .05], retreatDuration: [.5, 8, .1], scanDelay: [0, 3, .05], scanDuration: [.6, 10, .1],
  rise: [0, 84, 1], figureShift: [0, 100, 1], profileWidth: [.3, 2, .05], profileOpacity: [.1, 1, .01], planeOpacity: [0, .8, .01],
  lightSize: [.3, 2.5, .05], glow: [0, 2, .05], glowRadius: [0, 12, .25], projection: [0, 2, .05], pulse: [0, 1, .05], beamSpread: [.4, 3, .05],
  scanWidth: [2, 40, .5], scanStrength: [0, 8, .05], scanBlur: [0, 4, .1], edgeFade: [0, 24, 1],
  voiceRate: [.5, 5, .1], voiceCount: [1, 10, 1], voiceSpeed: [12, 180, 1], voiceReach: [16, 180, 1], voiceSpread: [15, 150, 1],
  voiceLineWidth: [.25, 3, .05], voiceOpacity: [0, 1, .01], voiceGlow: [0, 3, .05], voiceVariation: [0, 1, .05],
  voiceLead: [.35, 3, .05], voiceInfluence: [0, 1, .05], voiceScanBoost: [0, 3, .05],
} as const
export type DistanceNumber = keyof typeof distanceBounds

type DistanceSequenceSettings = Pick<DistanceSettings, 'retreatDuration' | 'scanDelay' | 'scanDuration'> & Partial<Pick<DistanceSettings, 'voiceEnabled' | 'voiceDrivesMotion' | 'voiceLead'>>

export const distanceVoiceStart = .35
export function distanceRetreatStart(settings: Partial<DistanceSettings>) {
  return settings.voiceEnabled && settings.voiceDrivesMotion ? distanceVoiceStart + (settings.voiceLead ?? defaultDistanceSettings.voiceLead) : .7
}

export function minimumDistanceCycle(settings: DistanceSequenceSettings) {
  // Keep the chosen durations in seconds; reserve time for ignition and a gentle return.
  return Math.ceil((distanceRetreatStart(settings) + settings.retreatDuration + settings.scanDelay + settings.scanDuration + 2) * 2) / 2
}

export function normalizeDistanceSettings(raw: unknown): DistanceSettings {
  const result = { ...defaultDistanceSettings }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return result
  const input = raw as Record<string, unknown>
  for (const key of Object.keys(distanceBounds) as DistanceNumber[]) {
    const value = input[key], [min, max] = distanceBounds[key]
    if (typeof value === 'number' && Number.isFinite(value)) result[key] = Math.min(max, Math.max(min, value))
  }
  for (const key of ['scanEnabled', 'planeEnabled', 'raysEnabled', 'voiceEnabled', 'voiceDrivesMotion'] as const) {
    if (typeof input[key] === 'boolean') result[key] = input[key]
  }
  if (input.mode === 'scan' || input.mode === 'project' || input.mode === 'pulse') result.mode = input.mode
  if (input.voiceStyle === 'arcs' || input.voiceStyle === 'rings' || input.voiceStyle === 'spectrum') result.voiceStyle = input.voiceStyle
  if (input.voiceRhythm === 'phrases' || input.voiceRhythm === 'steady' || input.voiceRhythm === 'syllables') result.voiceRhythm = input.voiceRhythm
  if (input.voiceDirection === 'forward' || input.voiceDirection === 'light') result.voiceDirection = input.voiceDirection
  if (typeof input.voiceColor === 'string' && /^#[\da-f]{6}$/i.test(input.voiceColor)) result.voiceColor = input.voiceColor.toUpperCase()
  result.voiceCount = Math.round(result.voiceCount)
  result.cycle = Math.max(result.cycle, minimumDistanceCycle(result))
  return result
}
