export type VoiceBands = { low: number; mid: number; high: number }
/** Optional mid-band detail. Hosts supplying only the three bands remain compatible. */
export type VoiceSpectrum = VoiceBands & { contour?: ArrayLike<number> }
export const voiceContourBands = 20
export const silentBands: VoiceBands = { low: 0, mid: 0, high: 0 }
export const voiceBandRanges = { low: [80, 300], mid: [300, 2400], high: [2400, 10000] } as const
export const clampLevel = (value: number) => Math.max(0, Math.min(1, value))

/** Mean spectral power, normalized per band so a wider band isn't louder by itself. */
export function measureVoiceBands(db: Float32Array, sampleRate: number, fftSize: number): VoiceBands {
  const result = { ...silentBands }
  for (const key of Object.keys(voiceBandRanges) as (keyof VoiceBands)[]) {
    const [from, to] = voiceBandRanges[key]
    const start = Math.max(1, Math.ceil(from * fftSize / sampleRate))
    const end = Math.min(db.length, Math.ceil(to * fftSize / sampleRate))
    let power = 0, peak = 0
    for (let i = start; i < end; i++) {
      const amplitude = Number.isFinite(db[i]) ? 10 ** (db[i] / 20) : 0
      power += amplitude * amplitude; peak = Math.max(peak, amplitude)
    }
    const energy = end > start ? .7 * Math.sqrt(power / (end - start)) + .3 * peak : 0
    result[key] = clampLevel(Math.max(0, energy - .0018) * ({ low: 16, mid: 22, high: 35 }[key]))
  }
  return result
}

/** Keep headroom for the contour instead of clipping every loud syllable to one. */
export function measureVoiceSpectrum(db: Float32Array, sampleRate: number, fftSize: number,
  contour = new Float32Array(voiceContourBands)): VoiceSpectrum {
  const [from, to] = voiceBandRanges.mid
  for (let band = 0; band < voiceContourBands; band++) {
    const start = Math.max(1, Math.ceil(from * (to / from) ** (band / voiceContourBands) * fftSize / sampleRate))
    const end = Math.min(db.length, Math.ceil(from * (to / from) ** ((band + 1) / voiceContourBands) * fftSize / sampleRate))
    let power = 0, peak = 0
    for (let i = start; i < end; i++) {
      const amplitude = Number.isFinite(db[i]) ? 10 ** (Math.min(0, db[i]) / 20) : 0
      power += amplitude * amplitude; peak = Math.max(peak, amplitude)
    }
    const energy = end > start ? .7 * Math.sqrt(power / (end - start)) + .3 * peak : 0
    contour[band] = Math.max(0, energy - .0018) * 18
  }
  return { ...measureVoiceBands(db, sampleRate, fftSize), contour }
}

/** Soft compression leaves room for changes above the old hard ceiling. */
export function voiceContourEnergy(level: number, gain: number) {
  const signal = Number.isFinite(level) ? Math.max(0, level) : 0
  return Math.atan(signal * Math.max(0, gain) * 1.6) * 2 / Math.PI
}

export function followContourLevel(previous: number, target: number, dt: number) {
  return previous + (target - previous) * (1 - Math.exp(-Math.min(.1, dt) / (target > previous ? .025 : .09)))
}

export function followLevel(previous: number, target: number, dt: number) {
  return previous + (target - previous) * (1 - Math.exp(-Math.min(.1, dt) / (target > previous ? .045 : .19)))
}

export function formatVoiceTime(seconds: number) {
  const total = Math.max(0, Math.floor(seconds))
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}
