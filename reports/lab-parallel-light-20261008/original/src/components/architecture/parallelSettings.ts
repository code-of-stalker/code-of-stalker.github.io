export const parallelBounds = {
  climbDuration: [1, 30, .1], exitDuration: [.3, 10, .1], signalDuration: [.4, 12, .1], finalDuration: [.8, 20, .1],
  radius: [18, 76, 1], height: [62, 106, 1], depth: [0, 20, .5], turns: [1, 3, 1], sway: [0, .45, .01],
  rungs: [5, 26, 1], stroke: [.35, 2, .05], brightness: [.2, 1.8, .05], detail: [0, 1, .05],
  guideBrightness: [.5, 3, .05], selfBrightness: [.2, 2, .05], lightSize: [.4, 2, .05], glow: [0, 2, .05], pulseDepth: [0, .35, .01],
  support: [0, 2, .05], signalCount: [2, 14, 1], signalLength: [.04, .45, .01], ribbonOpacity: [.02, .4, .01],
  landingSpread: [0, 30, 1], exitLift: [0, 16, 1], platformSize: [.4, 1.8, .05],
} as const
export type ParallelNumber = keyof typeof parallelBounds
export type ParallelSettings = Record<ParallelNumber, number> & {
  mode: 'together' | 'dialogue' | 'ribbon'; finale: 'confirm' | 'echo' | 'quiet'
  guideColor: string; repeat: boolean; rungsEnabled: boolean; axisEnabled: boolean; platformsEnabled: boolean; signalsEnabled: boolean
}

/** The approved sixth concept, with level exits and a calm final hold. */
export const defaultParallelSettings: ParallelSettings = {
  mode: 'together', finale: 'confirm', guideColor: '#FFF7BA', repeat: true,
  climbDuration: 5.61, exitDuration: 1.65, signalDuration: 1.87, finalDuration: 1.87,
  radius: 43, height: 103, depth: 8, turns: 1, sway: .16, rungs: 14, stroke: .75, brightness: 1, detail: .45,
  guideBrightness: 1.3, selfBrightness: 1, lightSize: 1, glow: .75, pulseDepth: 0,
  support: .6, signalCount: 6, signalLength: .18, ribbonOpacity: .12, landingSpread: 8, exitLift: 6, platformSize: 1,
  rungsEnabled: true, axisEnabled: true, platformsEnabled: true, signalsEnabled: true,
}
export function normalizeParallelSettings(raw: unknown): ParallelSettings {
  const result = { ...defaultParallelSettings }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return result
  const input = raw as Record<string, unknown>
  for (const key of Object.keys(parallelBounds) as ParallelNumber[]) {
    const value = input[key], [min, max] = parallelBounds[key]
    if (typeof value === 'number' && Number.isFinite(value)) result[key] = Math.max(min, Math.min(max, value))
  }
  for (const key of ['turns', 'rungs', 'signalCount'] as const) result[key] = Math.round(result[key])
  if (input.mode === 'together' || input.mode === 'dialogue' || input.mode === 'ribbon') result.mode = input.mode
  if (input.finale === 'confirm' || input.finale === 'echo' || input.finale === 'quiet') result.finale = input.finale
  for (const key of ['repeat', 'rungsEnabled', 'axisEnabled', 'platformsEnabled', 'signalsEnabled'] as const) {
    if (typeof input[key] === 'boolean') result[key] = input[key]
  }
  if (typeof input.guideColor === 'string' && /^#[\da-f]{6}$/i.test(input.guideColor)) result.guideColor = input.guideColor.toUpperCase()
  return result
}
export const parallelStages = [
  { key: 'climbDuration', start: 0, end: .51, ru: 'Подъём по спирали', en: 'Spiral ascent' },
  { key: 'exitDuration', start: .51, end: .66, ru: 'Выход на один уровень', en: 'Level exit' },
  { key: 'signalDuration', start: .66, end: .83, ru: 'Финальный отклик', en: 'Final response' },
  { key: 'finalDuration', start: .83, end: 1, ru: 'Пауза и затухание', en: 'Hold and fade' },
] as const
export function parallelDuration(settings: ParallelSettings) {
  return parallelStages.reduce((sum, stage) => sum + settings[stage.key], 0)
}
export function parallelPhase(time: number, settings: ParallelSettings, repeat = settings.repeat) {
  const duration = parallelDuration(settings)
  let remaining = repeat ? ((time % duration) + duration) % duration : Math.max(0, Math.min(duration, time))
  for (const stage of parallelStages) {
    if (remaining <= settings[stage.key]) {
      const phase = stage.start + (stage.end - stage.start) * remaining / settings[stage.key]
      return repeat ? phase : Math.min(.94, phase)
    }
    remaining -= settings[stage.key]
  }
  return repeat ? 0 : .94
}
export function parallelTimeAtPhase(phase: number, settings: ParallelSettings) {
  const bounded = Math.max(0, Math.min(1, phase))
  let time = 0
  for (const stage of parallelStages) {
    if (bounded <= stage.end) return time + (bounded - stage.start) / (stage.end - stage.start) * settings[stage.key]
    time += settings[stage.key]
  }
  return time
}
