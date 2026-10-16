export type VoiceWaveEvent = { strength: number }
export type VoiceWaveOrigin = { x: number; y: number; radius: number }
export type TravelingVoiceWave = VoiceWaveOrigin & { endRadius: number; progress: number; duration: number; strength: number }

export function canEmitVoiceWave(reacting: boolean, energy: number, fill: number, fillRing: boolean, afterFill: boolean, strength: number) {
  return reacting && energy > .12 && strength > 0 && (!afterFill || (fillRing && fill === 1))
}

export function createTravelingVoiceWave(origin: VoiceWaveOrigin, width: number, height: number, strength: number): TravelingVoiceWave {
  const endRadius = Math.max(...[[0, 0], [width, 0], [0, height], [width, height]].map(([x, y]) => Math.hypot(origin.x - x, origin.y - y))) + 16
  return { ...origin, endRadius, progress: 0, duration: Math.max(1.45, (endRadius - origin.radius) / 150), strength }
}

/** Fade is independent of propagation: higher values extinguish the trail sooner. */
export function voiceWaveOpacity(progress: number, strength: number, intensity: number, fade = 1) {
  const p = Math.max(0, Math.min(1, progress)), fadeIn = Math.sin(Math.min(1, p / .06) * Math.PI / 2)
  return Math.min(1, fadeIn * (1 - p) ** (2 * fade) * strength * intensity * .65)
}

export function travelingVoiceWaveFrame(wave: TravelingVoiceWave, dt: number, speed: number, strength: number, fade = 1) {
  wave.progress = Math.min(1, wave.progress + Math.max(0, dt) * speed / wave.duration)
  const p = wave.progress
  return { radius: wave.radius + (wave.endRadius - wave.radius) * p,
    opacity: voiceWaveOpacity(p, wave.strength, strength, fade) }
}
