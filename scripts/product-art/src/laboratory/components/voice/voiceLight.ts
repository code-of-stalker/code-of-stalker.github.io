import type { VoiceAppearance } from './voiceAppearance'
import { clampLevel } from './spectrum'

/** Moving caustics and pressure fronts: luminosity is always powered by the voice envelope. */
export function voiceLightFrame(pressure: number, clock: number, style: VoiceAppearance, reduced = false) {
  const energy = pressure < .001 || !style.coreEnabled ? 0 : clampLevel(pressure)
  const phase = reduced ? 0 : clock * style.coreFlow
  const beat = reduced ? 1 : 1 - style.corePulse * .5 + Math.sin(clock * style.corePulseSpeed * Math.PI * 2) * style.corePulse * .5
  const intensity = clampLevel(energy * style.fillStrength * 4) * Math.max(.05, beat)
  const radius = (45 + energy * 28) * style.coreSpread
  const caustics = Array.from({ length: 3 }, (_, index) => {
    if (!intensity) return { d: '', opacity: 0, dash: '100 0', offset: 0 }
    const travel = (phase * .26 + index / 3) % 1
    const base = style.styleMode === 'resonance' ? 18 + travel * 66 : 37 + index * 15
    const ratio = style.styleMode === 'orbit' ? .34 + index * .17 : 1
    const angle = style.styleMode === 'orbit' ? phase * .6 + index * .9 : phase * .22
    const cos = Math.cos(angle), sin = Math.sin(angle)
    const points = Array.from({ length: 73 }, (_, i) => {
      const t = i * Math.PI / 36
      const distortion = (Math.sin(t * 3 + phase * 1.4 + index) * .65 + Math.sin(t * 5 - phase * .8) * .35)
        * style.coreTurbulence * energy * (style.styleMode === 'plasma' ? 17 : 4)
      const r = Math.min(82, Math.max(10, (base + distortion) * style.coreSpread))
      const x = Math.cos(t) * r, y = Math.sin(t) * r * ratio
      return `${i ? 'L' : 'M'}${(120 + x * cos - y * sin).toFixed(2)} ${(105 + x * sin + y * cos).toFixed(2)}`
    }).join('') + 'Z'
    const fade = style.styleMode === 'resonance' ? Math.sin(travel * Math.PI) * (1 - travel * .65) : .5 + index * .15
    return { d: points, opacity: intensity * fade, dash: style.styleMode === 'orbit' ? '32 14 7 47' : '100 0', offset: -phase * (9 + index * 3) }
  })
  return { intensity, radius, x: 120 + Math.sin(phase * .8) * energy * 12, y: 105 + Math.cos(phase * .63) * energy * 9, caustics }
}
