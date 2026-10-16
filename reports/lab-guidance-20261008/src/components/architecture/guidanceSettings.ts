export const guidanceBounds = {
  approachDuration: [.5, 20, .1], hintDuration: [.5, 15, .1], departureDuration: [.5, 20, .1], finalDuration: [.5, 15, .1],
  guideBrightness: [.5, 3, .05], selfBrightness: [.2, 2, .05], glow: [0, 2, .05], lightSize: [.4, 2, .05], pulseDepth: [0, .35, .01],
  cueStrength: [0, 2, .05], cueWidth: [.4, 3, .05], trailLength: [.05, .95, .05],
  spread: [.6, 1.4, .05], platformSize: [.5, 1.8, .05], platformBrightness: [0, 1, .01], routeBrightness: [0, 1, .01], inactiveOpacity: [0, .6, .01],
  stroke: [.35, 2, .05], guideX: [60, 135, 1], guideY: [22, 70, 1],
} as const
export type GuidanceNumber = keyof typeof guidanceBounds
export type GuidanceSettings = Record<GuidanceNumber, number> & {
  mode: 'hint' | 'pulse' | 'beam'; branch: 'upper' | 'middle' | 'lower' | 'alternate'
  guideColor: string; repeat: boolean; platforms: boolean; trail: boolean; connection: boolean; confirmation: boolean
}

/** Third approved Guidance concept: a hint at a junction, then an independent choice. */
export const defaultGuidanceSettings: GuidanceSettings = {
  mode: 'hint', branch: 'middle', guideColor: '#FFF7BA', repeat: true,
  approachDuration: 3.63, hintDuration: 2.31, departureDuration: 3.3, finalDuration: 1.76,
  guideBrightness: 1.3, selfBrightness: 1, glow: .75, lightSize: 1, pulseDepth: .045,
  cueStrength: 1, cueWidth: 1.2, trailLength: .5, spread: 1, platformSize: 1,
  platformBrightness: .22, routeBrightness: .52, inactiveOpacity: .17, stroke: .8, guideX: 91, guideY: 43,
  platforms: true, trail: true, connection: true, confirmation: true,
}

export function normalizeGuidanceSettings(raw: unknown): GuidanceSettings {
  const result = { ...defaultGuidanceSettings }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return result
  const input = raw as Record<string, unknown>
  for (const key of Object.keys(guidanceBounds) as GuidanceNumber[]) {
    const value = input[key], [min, max] = guidanceBounds[key]
    if (typeof value === 'number' && Number.isFinite(value)) result[key] = Math.max(min, Math.min(max, value))
  }
  if (input.mode === 'hint' || input.mode === 'pulse' || input.mode === 'beam') result.mode = input.mode
  if (input.branch === 'upper' || input.branch === 'middle' || input.branch === 'lower' || input.branch === 'alternate') result.branch = input.branch
  for (const key of ['repeat', 'platforms', 'trail', 'connection', 'confirmation'] as const) {
    if (typeof input[key] === 'boolean') result[key] = input[key]
  }
  if (typeof input.guideColor === 'string' && /^#[\da-f]{6}$/i.test(input.guideColor)) result.guideColor = input.guideColor.toUpperCase()
  return result
}

export const guidanceStages = [
  { key: 'approachDuration', start: 0, end: .33, ru: 'Подход к развилке', en: 'Approach the junction' },
  { key: 'hintDuration', start: .33, end: .54, ru: 'Подсказка и пауза', en: 'Hint and pause' },
  { key: 'departureDuration', start: .54, end: .84, ru: 'Самостоятельный путь', en: 'Independent path' },
  { key: 'finalDuration', start: .84, end: 1, ru: 'Финал', en: 'Finale' },
] as const
export function guidanceDuration(settings: GuidanceSettings) {
  return guidanceStages.reduce((total, stage) => total + settings[stage.key], 0)
}
export function guidancePhase(time: number, settings: GuidanceSettings, repeat = settings.repeat) {
  const duration = guidanceDuration(settings)
  let remaining = repeat ? ((time % duration) + duration) % duration : Math.max(0, Math.min(duration, time))
  for (const stage of guidanceStages) {
    if (remaining <= settings[stage.key]) {
      const phase = stage.start + (stage.end - stage.start) * remaining / settings[stage.key]
      return repeat ? phase : Math.min(.89, phase)
    }
    remaining -= settings[stage.key]
  }
  return repeat ? 0 : .89
}
export function guidanceTimeAtPhase(phase: number, settings: GuidanceSettings) {
  const bounded = Math.max(0, Math.min(1, phase))
  let time = 0
  for (const stage of guidanceStages) {
    if (bounded <= stage.end) return time + (bounded - stage.start) / (stage.end - stage.start) * settings[stage.key]
    time += settings[stage.key]
  }
  return time
}
