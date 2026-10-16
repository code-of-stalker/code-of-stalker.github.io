import type { VoiceBands } from './spectrum'

export type VoiceAppearance = {
  styleMode: 'orbit' | 'resonance' | 'plasma'; inputIcon: 'microphone' | 'lips'
  color: string; lightColor: string; glow: number; lineWidth: number; idleSpeed: number
  reactionSize: number; responseSpeed: number; waveStrength: number; waveSpeed: number; fillStrength: number
  lockDistance: number; lockBurst: boolean
  fillRing: boolean; spinRing: boolean; sphereRing: boolean; outerContour: boolean; glassEnabled: boolean
  wavesAfterFill: boolean; wavesAcrossScreen: boolean
  waveColor: string; waveGlow: number; waveFade: number
  meshEnabled: boolean; meshRings: number; meshRadius: number; meshResponse: number
  meshSpeed: number; meshVoiceSpeed: number; meshOpacity: number; meshLineWidth: number; meshColor: string
  glassLinked: boolean; glassBlur: number; glassOpacity: number; glassColor: string
  assemblySmoothness: number; contourLength: number; contourResponse: number; ringsScale: number
  coreEnabled: boolean; coreColor: string; coreResponse: number; coreInertia: number; coreDamping: number
  corePulse: number; corePulseSpeed: number; coreFlow: number; coreTurbulence: number; coreSpread: number
  meshFillEnabled: boolean; meshFillOpacity: number; meshEmission: number
}
export const defaultVoiceAppearance: VoiceAppearance = {
  styleMode: 'resonance', inputIcon: 'lips',
  color: '#E7E100', lightColor: '#E7E100', glow: .75, lineWidth: 1, idleSpeed: .65,
  reactionSize: 2, responseSpeed: .2, waveStrength: .25, waveSpeed: 1, fillStrength: .04, lockDistance: 96, lockBurst: true,
  fillRing: true, spinRing: false, sphereRing: true, outerContour: true, glassEnabled: true,
  wavesAfterFill: true, wavesAcrossScreen: true,
  waveColor: '#E7E100', waveGlow: .1, waveFade: 2.2,
  meshEnabled: true, meshRings: 6, meshRadius: 76, meshResponse: 1,
  meshSpeed: 1.95, meshVoiceSpeed: 3.6, meshOpacity: 1, meshLineWidth: .25, meshColor: '#E7E100',
  glassLinked: false, glassBlur: 2, glassOpacity: .5, glassColor: '#000000',
  assemblySmoothness: .27, contourLength: 40, contourResponse: 7, ringsScale: 1.14,
  coreEnabled: true, coreColor: '#FFF59A', coreResponse: 7, coreInertia: .05, coreDamping: 1.6,
  corePulse: 1, corePulseSpeed: 1.2, coreFlow: 1.8, coreTurbulence: 0, coreSpread: .85,
  meshFillEnabled: true, meshFillOpacity: 1, meshEmission: 3,
}
export const voiceStyleBounds = {
  glow: [0, 2, .05], lineWidth: [.5, 2, .05], idleSpeed: [0, 2, .05], reactionSize: [.3, 2, .05],
  waveStrength: [0, 2, .05], waveSpeed: [.4, 2, .05], fillStrength: [0, 1, .005], lockDistance: [48, 160, 4],
  responseSpeed: [.1, 2, .05],
  waveGlow: [0, 3, .05], waveFade: [.25, 4, .05],
  meshRings: [4, 24, 1], meshRadius: [60, 97, 1], meshResponse: [0, 7, .1],
  meshSpeed: [0, 3, .05], meshVoiceSpeed: [0, 7, .1], meshOpacity: [0, 1, .01], meshLineWidth: [.25, 1.5, .05],
  glassBlur: [0, 80, .5], glassOpacity: [0, 1, .01],
  assemblySmoothness: [.06, .6, .01], contourLength: [8, 64, 1], contourResponse: [.25, 7, .05], ringsScale: [.25, 2.5, .01],
  coreResponse: [0, 7, .1], coreInertia: [.05, 1.5, .01], coreDamping: [.4, 1.6, .05],
  corePulse: [0, 1, .05], corePulseSpeed: [.1, 4, .1], coreFlow: [0, 3, .05], coreTurbulence: [0, 1, .05], coreSpread: [.5, 1.3, .05],
  meshFillOpacity: [0, 1, .01], meshEmission: [0, 3, .05],
} as const
export type VoiceStyleNumber = keyof typeof voiceStyleBounds
// Apply the approved preset once; later edits persist here. Keep v1 untouched.
export const VOICE_PREFERENCES_KEY = 'prince-voice-style-v2'
export const VOICE_DEFAULTS_REVISION = '2026-10-06-approved'
export const defaultVoiceSensitivity: VoiceBands = { low: 7, mid: 7, high: 7 }

export function normalizeVoicePreferences(raw: unknown): { appearance: VoiceAppearance; sensitivity: VoiceBands } {
  const appearance = { ...defaultVoiceAppearance }, sensitivity = { ...defaultVoiceSensitivity }
  if (!raw || typeof raw !== 'object') return { appearance, sensitivity }
  const value = raw as { appearance?: Partial<VoiceAppearance>; sensitivity?: Partial<VoiceBands> }
  for (const key of Object.keys(voiceStyleBounds) as VoiceStyleNumber[]) {
    const n = value.appearance?.[key], [min, max] = voiceStyleBounds[key]
    if (typeof n === 'number' && Number.isFinite(n)) appearance[key] = Math.max(min, Math.min(max, n))
  }
  appearance.meshRings = Math.round(appearance.meshRings)
  if (['orbit', 'resonance', 'plasma'].includes(value.appearance?.styleMode ?? '')) appearance.styleMode = value.appearance!.styleMode!
  if (value.appearance?.inputIcon === 'lips' || value.appearance?.inputIcon === 'microphone') appearance.inputIcon = value.appearance.inputIcon
  for (const key of ['color', 'lightColor', 'glassColor', 'waveColor', 'meshColor', 'coreColor'] as const) if (/^#[0-9a-f]{6}$/i.test(value.appearance?.[key] ?? '')) appearance[key] = value.appearance![key]!.toUpperCase()
  for (const key of ['lockBurst', 'fillRing', 'spinRing', 'sphereRing', 'outerContour', 'glassEnabled', 'wavesAfterFill', 'wavesAcrossScreen', 'glassLinked', 'meshEnabled', 'coreEnabled', 'meshFillEnabled'] as const) {
    if (typeof value.appearance?.[key] === 'boolean') appearance[key] = value.appearance[key]
  }
  for (const key of ['low', 'mid', 'high'] as const) {
    const n = value.sensitivity?.[key]
    if (typeof n === 'number' && Number.isFinite(n)) sensitivity[key] = Math.max(0, Math.min(7, n))
  }
  return { appearance, sensitivity }
}

export const voiceStylePresets = {
  orbit: { title: 'Орбита', description: 'Свет скользит по пересекающимся орбитам.' },
  resonance: { title: 'Резонанс', description: 'Световые кольца расходятся от центра.' },
  plasma: { title: 'Плазма', description: 'Свет течёт по изгибающимся замкнутым линиям.' },
} satisfies Record<VoiceAppearance['styleMode'], { title: string; description: string }>

export function applyVoiceStyle(value: VoiceAppearance, styleMode: VoiceAppearance['styleMode']): VoiceAppearance {
  return { ...value, styleMode }
}

export function lockGestureProgress(startY: number, currentY: number, scale: number, distance: number) {
  return Math.max(0, Math.min(1, (startY - currentY) / (Math.max(.1, scale) * distance)))
}

export function lockVisual(progress: number) {
  const p = Math.max(0, Math.min(1, progress))
  return { arrowOpacity: 1 - Math.min(1, p / .32), lockOpacity: Math.max(0, Math.min(1, (p - .12) / .22)),
    fill: Math.max(0, (p - .28) / .72), lift: Math.min(1, p / .6) * 10 }
}
