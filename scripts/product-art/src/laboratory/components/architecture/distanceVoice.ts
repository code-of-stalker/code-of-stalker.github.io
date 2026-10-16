import type { DistanceSettings } from './distanceSettings'
import { distanceVoiceStart } from './distanceSettings'

export const distanceMouth = { x: 185.5, y: 65.2 } as const
export const distanceVoiceCapacity = 10
type DistanceVoiceTiming = { retreatStart: number; retreatEnd: number; scanEnd: number; returnStart: number }
const voiceClamp = (n: number) => Math.max(0, Math.min(1, n))
const voiceSmooth = (a: number, b: number, t: number) => { const q = voiceClamp((t - a) / Math.max(.0001, b - a)); return q * q * (3 - 2 * q) }
const voiceNumber = (n: number) => Number(n.toFixed(3))

/** Deterministic speech-like envelopes: no microphone permission or audio playback is needed. */
export function distanceVoiceLevel(time: number, settings: DistanceSettings) {
  if (!settings.voiceEnabled || time <= distanceVoiceStart) return 0
  const beat = (time - distanceVoiceStart) * settings.voiceRate, index = Math.floor(beat), phase = beat - index
  const syllable = voiceSmooth(0, .2, phase) * (1 - voiceSmooth(.36, .94, phase))
  const accents = [.72, 1, .82, 0, .58, .94, 0, 0]
  const rhythm = settings.voiceRhythm === 'steady' ? .7 + .3 * syllable
    : settings.voiceRhythm === 'syllables' ? syllable : syllable * accents[index % accents.length]
  const variation = 1 - settings.voiceVariation * (.17 + .13 * Math.sin(index * 2.17 + .4))
  return rhythm * variation * voiceSmooth(distanceVoiceStart, distanceVoiceStart + .18, time)
}

// Integrate the speech envelope once per immutable preset. Motion stays monotonic and
// still reaches the exact endpoint before the scan pause, even between spoken phrases.
const distanceVoiceCurves = new WeakMap<DistanceSettings, Float64Array>()
export function distanceVoiceRetreat(time: number, settings: DistanceSettings, timing: DistanceVoiceTiming) {
  const progress = voiceClamp((time - timing.retreatStart) / settings.retreatDuration)
  if (!settings.voiceEnabled || !settings.voiceDrivesMotion || settings.voiceInfluence === 0) return voiceSmooth(0, 1, progress)
  let curve = distanceVoiceCurves.get(settings)
  if (!curve) {
    curve = new Float64Array(97)
    let prior = .18 + distanceVoiceLevel(timing.retreatStart, settings)
    for (let index = 1; index < curve.length; index++) {
      const level = .18 + distanceVoiceLevel(timing.retreatStart + settings.retreatDuration * index / 96, settings)
      curve[index] = curve[index - 1] + (level + prior) / 2; prior = level
    }
    const total = curve[96]
    for (let index = 1; index < curve.length; index++) curve[index] /= total
    distanceVoiceCurves.set(settings, curve)
  }
  const position = progress * 96, index = Math.min(95, Math.floor(position)), fraction = position - index
  const driven = curve[index] + (curve[index + 1] - curve[index]) * fraction
  return voiceSmooth(0, 1, progress + (driven - progress) * settings.voiceInfluence)
}

export function distanceVoiceFrame(time: number, settings: DistanceSettings, timing: DistanceVoiceTiming, shift: number, sourceX: number, sourceY: number) {
  const mouthX = distanceMouth.x + shift, mouthY = distanceMouth.y
  const tail = 1 - voiceSmooth(timing.scanEnd + .1, Math.max(timing.scanEnd + .3, timing.returnStart + .8), time)
  const emission = (at: number) => at <= timing.scanEnd ? distanceVoiceLevel(at, settings) : 0
  const level = emission(time) * tail
  const response = settings.voiceDrivesMotion ? emission(time - .12) * settings.voiceInfluence * tail : 0
  const lifetime = settings.voiceReach / settings.voiceSpeed, interval = lifetime / settings.voiceCount
  const newest = Math.floor((time - distanceVoiceStart) / interval)
  const waves = Array.from({ length: distanceVoiceCapacity }, (_, index) => {
    const born = distanceVoiceStart + (newest - index) * interval, age = time - born
    const progress = age / lifetime, amplitude = emission(born)
    if (!settings.voiceEnabled || index >= settings.voiceCount || born < distanceVoiceStart || age <= 0 || progress >= 1 || amplitude < .005) return { path: '', opacity: 0, width: settings.voiceLineWidth }
    const radius = 1.5 + settings.voiceSpeed * age
    const halfAngle = settings.voiceSpread * Math.PI / 360
    const point = (r: number, angle: number) => `${voiceNumber(Math.cos(angle) * r)} ${voiceNumber(Math.sin(angle) * r)}`
    let path: string
    if (settings.voiceStyle === 'rings') {
      const r = voiceNumber(radius), ry = voiceNumber(radius * .7)
      path = `M${r} 0A${r} ${ry} 0 1 0 ${-r} 0A${r} ${ry} 0 1 0 ${r} 0`
    } else if (settings.voiceStyle === 'spectrum') {
      path = Array.from({ length: 13 }, (_, bin) => {
        const angle = -halfAngle + 2 * halfAngle * bin / 12
        const length = (1.5 + 7 * amplitude * (.3 + .7 * Math.sin(bin * 1.73 + newest - index) ** 2)) * (1 - progress * .55)
        return `M${point(radius, angle)}L${point(radius + length, angle)}`
      }).join('')
    } else path = `M${point(radius, -halfAngle)}A${voiceNumber(radius)} ${voiceNumber(radius)} 0 0 1 ${point(radius, halfAngle)}`
    return { path, opacity: settings.voiceOpacity * amplitude * voiceSmooth(0, .12, progress) * (1 - voiceSmooth(.4, 1, progress)) * tail,
      width: settings.voiceLineWidth * (.65 + .35 * amplitude) * (1 - .25 * progress) }
  })
  return { mouthX, mouthY, level, response, waves,
    angle: settings.voiceDirection === 'light' ? Math.atan2(sourceY - mouthY, sourceX - mouthX) * 180 / Math.PI : 0,
    scanGain: 1 + response * settings.voiceScanBoost,
  }
}
