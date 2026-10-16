export const synchronizationBounds = {
  pathDuration: [1, 30, .1], syncDuration: [.5, 20, .1], riseDuration: [.3, 15, .1], finalDuration: [1, 30, .1],
  amount: [.5, 12, .1], observerHeight: [30, 76, 1], distance: [0, 35, 1], stroke: [.35, 2, .05],
  platformBrightness: [0, 200, 1], initialBrightness: [0, 100, 1], brightness: [0, 200, 1],
  glow: [0, 2, .05], lightSize: [.4, 2, .05], trailDuration: [.1, 6, .1],
  syncGlow: [0, 2, .05], waveWidth: [.4, 5, .1], waveSoftness: [2, 32, 1],
  projectionGlow: [0, 2, .05], projectionPulse: [0, .4, .01], guideOpacity: [0, 1, .01],
} as const
export type SynchronizationNumber = keyof typeof synchronizationBounds
export type SynchronizationSettings = Record<SynchronizationNumber, number> & {
  repeat: boolean; trailEnabled: boolean; waveEnabled: boolean; guidesEnabled: boolean; projectionEnabled: boolean
}

/** Approved continuous wave and centered projector, with a longer final hold. */
export const defaultSynchronizationSettings: SynchronizationSettings = {
  pathDuration: 4.6, syncDuration: 2.6, riseDuration: 1.4, finalDuration: 4.4,
  amount: 2.5, observerHeight: 74, distance: 16, stroke: .75,
  platformBrightness: 75, initialBrightness: 25, brightness: 100,
  glow: .6, lightSize: 1, trailDuration: 1.4, syncGlow: .45, waveWidth: 1.15, waveSoftness: 14,
  projectionGlow: 1.5, projectionPulse: .065, guideOpacity: .38,
  repeat: true, trailEnabled: true, waveEnabled: true, guidesEnabled: true, projectionEnabled: true,
}

export function normalizeSynchronizationSettings(raw: unknown): SynchronizationSettings {
  const result = { ...defaultSynchronizationSettings }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return result
  const input = raw as Record<string, unknown>
  for (const key of Object.keys(synchronizationBounds) as SynchronizationNumber[]) {
    const value = input[key], [min, max] = synchronizationBounds[key]
    if (typeof value === 'number' && Number.isFinite(value)) result[key] = Math.max(min, Math.min(max, value))
  }
  for (const key of ['repeat', 'trailEnabled', 'waveEnabled', 'guidesEnabled', 'projectionEnabled'] as const) {
    if (typeof input[key] === 'boolean') result[key] = input[key]
  }
  return result
}

export const synchronizationStages = [
  { key: 'pathDuration', phaseStart: 0, phaseEnd: .385, ru: 'Первый этап', en: 'First stage' },
  { key: 'syncDuration', phaseStart: .385, phaseEnd: .605, ru: 'Синхронизация', en: 'Synchronization' },
  { key: 'riseDuration', phaseStart: .605, phaseEnd: .72, ru: 'Подъём', en: 'Ascent' },
  { key: 'finalDuration', phaseStart: .72, phaseEnd: 1, ru: 'Финал', en: 'Finale' },
] as const

export function synchronizationDuration(settings: SynchronizationSettings) {
  return synchronizationStages.reduce((total, stage) => total + settings[stage.key], 0)
}

/** Retiming preserves the geometry and event order of the approved choreography. */
export function synchronizationPhase(time: number, settings: SynchronizationSettings, repeat = settings.repeat) {
  const duration = synchronizationDuration(settings)
  let remaining = repeat ? ((time % duration) + duration) % duration : Math.max(0, Math.min(duration, time))
  for (const stage of synchronizationStages) {
    if (remaining <= settings[stage.key]) {
      const phase = stage.phaseStart + (stage.phaseEnd - stage.phaseStart) * remaining / settings[stage.key]
      // A single pass keeps the completed projection on screen rather than ending in darkness.
      return repeat ? phase : Math.min(.94, phase)
    }
    remaining -= settings[stage.key]
  }
  return repeat ? 0 : .94
}

export function synchronizationTimeAtPhase(phase: number, settings: SynchronizationSettings) {
  const bounded = Math.max(0, Math.min(1, phase))
  let time = 0
  for (const stage of synchronizationStages) {
    if (bounded <= stage.phaseEnd) return time + (bounded - stage.phaseStart) / (stage.phaseEnd - stage.phaseStart) * settings[stage.key]
    time += settings[stage.key]
  }
  return time
}
