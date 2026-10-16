import { normalizeFillColor } from '../liquid-glass/glassStyleSettings'
import { rainNoise } from './matrixRainSettings'
import type { RainCharacters } from './matrixRainSettings'

export const pulseBounds = {
  fontSize: [8, 32, 1], spacing: [1, 2.2, 0.05], density: [0.15, 1, 0.01],
  speed: [60, 600, 10], waveWidth: [12, 180, 2], persistence: [0.2, 6, 0.1],
  glow: [0, 1, 0.01], brightness: [0.1, 1, 0.01], idleBrightness: [0, 0.25, 0.01],
  flicker: [0, 1, 0.01],
} as const
export type PulseNumberKey = keyof typeof pulseBounds
export type MatrixPulseSettings = Record<PulseNumberKey, number> & {
  color: string; headColor: string; backgroundColor: string;
  characters: RainCharacters; seed: number; playing: boolean
}
export const defaultMatrixPulseSettings: MatrixPulseSettings = {
  fontSize: 10, spacing: 1.35, density: 0.9, speed: 220, waveWidth: 54,
  persistence: 2.2, glow: 0.8, brightness: 0.8, idleBrightness: 0.025,
  flicker: 0.2, color: '#E7E100', headColor: '#FFF7BF', backgroundColor: '#000000',
  characters: 'katakana', seed: 73, playing: true,
}
export function parseMatrixPulseSettings(data: unknown): MatrixPulseSettings {
  if (!data || typeof data !== 'object') throw new Error('Invalid pulse settings')
  const raw = data as Record<string, unknown>
  const result = { ...defaultMatrixPulseSettings }
  for (const key of Object.keys(pulseBounds) as PulseNumberKey[]) {
    const value = raw[key], [min, max] = pulseBounds[key]
    if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) throw new Error(`Invalid ${key}`)
    result[key] = value
  }
  for (const key of ['color', 'headColor', 'backgroundColor'] as const) {
    const color = normalizeFillColor(raw[key])
    if (!color) throw new Error(`Invalid ${key}`)
    result[key] = color
  }
  if (!['binary', 'code', 'katakana'].includes(String(raw.characters))) throw new Error('Invalid characters')
  if (typeof raw.seed !== 'number' || !Number.isInteger(raw.seed) || raw.seed < 0 || raw.seed > 999999) throw new Error('Invalid seed')
  if (typeof raw.playing !== 'boolean') throw new Error('Invalid playing')
  return { ...result, characters: raw.characters as RainCharacters, seed: raw.seed, playing: raw.playing }
}

export type MatrixPulse = { x: number; y: number; age: number }
const smooth = (value: number) => { const t = Math.max(0, Math.min(1, value)); return t * t * (3 - 2 * t) }

/** A softened leading wave followed by a lasting glyph wake. Coordinates and
 * speed use logical pixels, so the field has the same rhythm at any DPR. */
export function getPulseLight(distance: number, age: number, settings: MatrixPulseSettings) {
  const front = age * settings.speed
  const lag = front - distance
  const width = settings.waveWidth
  const arrival = smooth((lag + width * 0.4) / (width * 0.8))
  const wake = arrival * Math.exp(-Math.max(0, lag) / (settings.speed * settings.persistence))
  const head = Math.exp(-0.5 * (lag / (width * 0.28)) ** 2) * arrival
  return { wake, head }
}

export function getPulseGrid(width: number, height: number, settings: MatrixPulseSettings) {
  // Bound the glyph count on large frames; uniform spacing prevents a honeycomb texture.
  const cell = Math.max(settings.fontSize * settings.spacing, Math.sqrt(width * height / 3200))
  const cols = Math.ceil(width / cell), rows = Math.ceil(height / cell)
  const cells = Array.from({ length: cols * rows }, (_, index) => ({
    x: (index % cols + 0.5) * cell, y: (Math.floor(index / cols) + 0.5) * cell,
    index, active: rainNoise(settings.seed, index * 7 + 5) <= settings.density,
  }))
  return { cell, cells }
}
