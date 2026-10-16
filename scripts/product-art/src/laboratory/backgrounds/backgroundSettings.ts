import { makeBackgroundPreset, parseBackgroundPreset } from './matrixRainSettings'
import type { BackgroundPreset as RainPreset, MatrixRainSettings } from './matrixRainSettings'
import { parseMatrixPulseSettings } from './matrixPulseSettings'
import type { MatrixPulseSettings } from './matrixPulseSettings'

export type PulsePreset = { version: 1; kind: 'matrix-pulse'; settings: MatrixPulseSettings }
export type ProceduralBackgroundPreset = RainPreset | PulsePreset
// Raw rain settings remain accepted by existing integrations.
export type BackgroundInput = ProceduralBackgroundPreset | MatrixRainSettings

export function resolveBackgroundPreset(input: BackgroundInput): ProceduralBackgroundPreset {
  return 'kind' in input ? input : makeBackgroundPreset(input)
}
export function copyBackgroundPreset(input: ProceduralBackgroundPreset): ProceduralBackgroundPreset {
  return input.kind === 'matrix-pulse' ? { ...input, settings: { ...input.settings } } : makeBackgroundPreset(input.settings)
}
export function serializeProceduralBackground(input: ProceduralBackgroundPreset) { return JSON.stringify(input, null, 2) }
export function parseProceduralBackground(raw: string): ProceduralBackgroundPreset {
  const data = JSON.parse(raw)
  if (data?.kind === 'matrix-rain') return parseBackgroundPreset(raw)
  if (data?.version !== 1 || data?.kind !== 'matrix-pulse') throw new Error('Unsupported background preset')
  return { version: 1, kind: 'matrix-pulse', settings: parseMatrixPulseSettings(data.settings) }
}
