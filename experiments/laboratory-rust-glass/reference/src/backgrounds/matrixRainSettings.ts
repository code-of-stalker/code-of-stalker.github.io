import { normalizeFillColor } from '../liquid-glass/glassStyleSettings'
import startupBackground from '../../presets/matrix-rain.json'

export const rainBounds = {
  fontSize: [8, 40, 1], spacing: [1, 2.5, 0.05], density: [0.15, 1, 0.01],
  speed: [0.1, 3, 0.05], trailLength: [4, 48, 1], glow: [0, 1, 0.01],
  brightness: [0.1, 1, 0.01], depth: [0, 1, 0.01], flicker: [0, 1, 0.01],
} as const
export type RainNumberKey = keyof typeof rainBounds
export type RainCharacters = 'binary' | 'code' | 'katakana'
export type MatrixRainSettings = Record<RainNumberKey, number> & {
  color: string; headColor: string; backgroundColor: string; characters: RainCharacters;
  seed: number; playing: boolean; direction: 'down' | 'up'
}
export type BackgroundPreset = { version: 1; kind: 'matrix-rain'; settings: MatrixRainSettings }

export const defaultMatrixRainSettings: MatrixRainSettings = {
  ...startupBackground.settings,
  characters: startupBackground.settings.characters as RainCharacters,
  direction: startupBackground.settings.direction as MatrixRainSettings['direction'],
}

export function makeBackgroundPreset(settings: MatrixRainSettings): BackgroundPreset {
  return { version: 1, kind: 'matrix-rain', settings: { ...settings } }
}
export function serializeBackgroundPreset(settings: MatrixRainSettings) {
  return JSON.stringify(makeBackgroundPreset(settings), null, 2)
}
export function parseBackgroundPreset(raw: string): BackgroundPreset {
  const data = JSON.parse(raw)
  if (!data || data.version !== 1 || data.kind !== 'matrix-rain' || !data.settings || typeof data.settings !== 'object') throw new Error('Unsupported background preset')
  const settings = { ...defaultMatrixRainSettings }
  for (const key of Object.keys(rainBounds) as RainNumberKey[]) {
    const value = data.settings[key]
    const [min, max] = rainBounds[key]
    if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) throw new Error(`Invalid ${key}`)
    settings[key] = value
  }
  for (const key of ['color', 'headColor', 'backgroundColor'] as const) {
    const color = normalizeFillColor(data.settings[key])
    if (!color) throw new Error(`Invalid ${key}`)
    settings[key] = color
  }
  if (!['binary', 'code', 'katakana'].includes(data.settings.characters)) throw new Error('Invalid characters')
  if (!['down', 'up'].includes(data.settings.direction)) throw new Error('Invalid direction')
  if (!Number.isInteger(data.settings.seed) || data.settings.seed < 0 || data.settings.seed > 999999) throw new Error('Invalid seed')
  if (typeof data.settings.playing !== 'boolean') throw new Error('Invalid playing')
  return { version: 1, kind: 'matrix-rain', settings: { ...settings, characters: data.settings.characters, direction: data.settings.direction, seed: data.settings.seed, playing: data.settings.playing } }
}

export const rainCharacters: Record<RainCharacters, string> = {
  binary: '01', code: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ:<>/+=',
  katakana: 'アイウエオカキクケコサシスセソタチツテトナニヌネノ0123456789',
}

// Stable integer noise keeps streams reproducible across previews and exports.
export function rainNoise(seed: number, index: number) {
  let value = Math.imul(seed ^ index, 0x45d9f3b)
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b)
  return ((value ^ (value >>> 16)) >>> 0) / 4294967296
}

export function getRainStreams(width: number, height: number, settings: MatrixRainSettings, travel: number) {
  const stride = settings.fontSize * settings.spacing
  const count = Math.min(240, Math.ceil(width / stride))
  const columnWidth = Math.max(stride, width / Math.max(1, count))
  return Array.from({ length: count }, (_, index) => {
    const depth = 1 - settings.depth * rainNoise(settings.seed, index * 7 + 1) * 0.6
    const cell = settings.fontSize * depth * 1.25
    const tail = Math.round(settings.trailLength * (0.6 + rainNoise(settings.seed, index * 7 + 2) * 0.8))
    const cycle = height + cell * tail
    const distance = travel * (34 + rainNoise(settings.seed, index * 7 + 3) * 42) * depth
    const head = ((distance + rainNoise(settings.seed, index * 7 + 4) * cycle) % cycle + cycle) % cycle
    return { x: (index + 0.5) * columnWidth, head, cell, depth, tail, index,
      active: rainNoise(settings.seed, index * 7 + 5) <= settings.density }
  })
}
