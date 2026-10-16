import { clampLevel, followLevel, followContourLevel, voiceContourEnergy, formatVoiceTime, silentBands } from './spectrum'
import type { VoiceBands, VoiceSpectrum } from './spectrum'
import { lockVisual } from './voiceAppearance'
import type { VoiceAppearance } from './voiceAppearance'
import { sphereRingPaths, voiceArcDashes, voiceArcTarget, voiceRingFill, voiceRadii, voiceContourSegment } from './voiceGeometry'
import { voiceMeshFrame } from './voiceMesh'
import { createVoiceSpring, stepVoiceSpring } from './voicePhysics'
import { voiceLightFrame } from './voiceLight'
import { canEmitVoiceWave, voiceWaveOpacity } from './voiceWaves'
import type { VoiceWaveEvent } from './voiceWaves'

export type VoiceFrame = { bands: VoiceSpectrum; seconds: number; source: 'mic' | 'playback' | 'idle' }
export function mountVoiceMotion(root: HTMLElement, read: () => {
  frame: VoiceFrame; sensitivity: VoiceBands; appearance: VoiceAppearance; lockProgress: number
}, onLevels: (bands: VoiceBands, source: VoiceFrame['source']) => void, onWave?: (wave: VoiceWaveEvent) => void) {
  const low = root.querySelector<SVGGElement>('.vr-low-motion')!, mid = root.querySelector<SVGGElement>('.vr-mid-motion')!
  const high = root.querySelector<SVGGElement>('.vr-high-motion')!, timer = root.querySelector<HTMLElement>('.vr-time-value')!
  const rays = Array.from(root.querySelectorAll<SVGLineElement>('.vr-ray'))
  const contourLevels = new Float64Array(rays.length)
  const arcs = Array.from(root.querySelectorAll<SVGCircleElement>('.vr-fill-arc'))
  const sphereFront = Array.from(root.querySelectorAll<SVGPathElement>('.vr-sphere-front'))
  const sphereBack = root.querySelector<SVGPathElement>('.vr-sphere-back')!
  const meshFront = Array.from(root.querySelectorAll<SVGPathElement>('.vr-mesh-front'))
  const meshBack = Array.from(root.querySelectorAll<SVGPathElement>('.vr-mesh-back'))
  const meshFill = root.querySelector<SVGCircleElement>('.vr-mesh-fill')!, meshEmission = root.querySelector<SVGCircleElement>('.vr-mesh-emission')!
  const coreVolume = root.querySelector<SVGCircleElement>('.vr-core-volume')!
  const caustics = Array.from(root.querySelectorAll<SVGPathElement>('.vr-caustic'))
  const waves = Array.from(root.querySelectorAll<SVGCircleElement>('.vr-wave'))
  const arrow = root.querySelector<SVGGElement>('.vr-lock-arrow')!, lock = root.querySelector<SVGGElement>('.vr-lock-body')!
  const paint = root.querySelector<SVGRectElement>('.vr-lock-fill')!
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
  const pulses = waves.map(() => ({ progress: 1, strength: 0 }))
  const arcSpring = createVoiceSpring(), meshSpring = createVoiceSpring(), lightSpring = createVoiceSpring(), emissionSpring = createVoiceSpring()
  let previous = performance.now(), phase = 0, clock = 0, frameId = 0, lastPulse = -10, pulseIndex = 0, previousEnergy = 0
  let levels = { ...silentBands }, drawnLock = 0
  let spin = 0, orbit = 0, meshAngle = 0
  const draw = (now: number) => {
    frameId = requestAnimationFrame(draw)
    const dt = Math.min(.05, Math.max(0, (now - previous) / 1000)); previous = now
    if (document.hidden) return
    const { frame, sensitivity, appearance: style, lockProgress } = read()
    const responseDt = dt * style.responseSpeed
    clock += responseDt
    if (!reduced.matches) phase += dt * style.idleSpeed
    const motion = reduced.matches ? .12 : style.reactionSize
    // Integrate the audio envelope and its springs on the same clock. Small
    // substeps prevent different frame rates / slowdown settings from changing
    // the fill trajectory through endpoint sampling of a fast-changing band.
    const steps = Math.max(1, Math.ceil(responseDt / .0045)), stepDt = responseDt / steps
    for (let i = 0; i < steps; i++) {
      for (const key of ['low', 'mid', 'high'] as const) levels[key] = followLevel(levels[key], clampLevel(frame.bands[key] * sensitivity[key]), stepDt)
      const drive = clampLevel(levels.mid * .75 + levels.low * .35 + levels.high * .15)
      stepVoiceSpring(arcSpring, voiceArcTarget(levels.low, motion), stepDt, style.assemblySmoothness)
      stepVoiceSpring(meshSpring, style.meshEnabled ? clampLevel(drive * style.meshResponse) : 0, stepDt, style.assemblySmoothness)
      stepVoiceSpring(lightSpring, clampLevel((levels.low * .5 + levels.mid * .75 + levels.high * .15) * style.coreResponse), stepDt, style.coreInertia, style.coreDamping)
    }
    const energy = Math.max(levels.low, levels.mid, levels.high), reacting = frame.source !== 'idle'
    const sphereDrive = clampLevel(levels.mid * .75 + levels.low * .35 + levels.high * .15)
    const fill = voiceRingFill(arcSpring.position, 1), meshAmount = voiceRingFill(meshSpring.position, 1)
    const light = voiceLightFrame(lightSpring.position, clock, style, reduced.matches)
    coreVolume.setAttribute('cx', String(light.x)); coreVolume.setAttribute('cy', String(light.y))
    coreVolume.setAttribute('r', String(light.radius)); coreVolume.setAttribute('opacity', String(light.intensity))
    caustics.forEach((path, index) => {
      const value = light.caustics[index]
      path.setAttribute('d', value.d); path.setAttribute('opacity', String(value.opacity))
      path.setAttribute('stroke-dasharray', value.dash); path.setAttribute('stroke-dashoffset', String(value.offset))
    })
    const complete = style.meshEnabled && style.meshFillEnabled && meshAmount === 1
    const emission = stepVoiceSpring(emissionSpring, complete ? 1 : 0, responseDt, complete ? .2 : .4)
    meshFill.setAttribute('opacity', String(style.meshEnabled && style.meshFillEnabled ? meshAmount * style.meshFillOpacity : 0))
    meshEmission.setAttribute('opacity', String(style.meshEnabled && style.meshFillEnabled ? clampLevel(emission) * style.meshEmission / 3 : 0))
    root.style.setProperty('--vr-mesh-charge', String(meshAmount))
    // Integrate velocity instead of moving the angle directly with volume: no snaps
    // or backwards wobble when a syllable ends. All three rings keep a fixed radius.
    if (!reduced.matches) {
      spin += dt * style.idleSpeed * 9 + responseDt * levels.mid * 175 * motion
      orbit += dt * style.idleSpeed * .24 + responseDt * sphereDrive * 2.6 * motion
      meshAngle += dt * style.meshSpeed * .24 + responseDt * sphereDrive * style.meshVoiceSpeed
    }
    low.setAttribute('transform', `rotate(${phase * 5 - 90} 120 105)`)
    const dashes = voiceArcDashes(fill, 1)
    arcs.forEach(arc => arc.setAttribute('stroke-dasharray', dashes))
    // A tiny measured floor must not leave bright dots behind during silence.
    root.style.setProperty('--vr-arc-visibility', String(clampLevel((fill - .005) / .07)))
    mid.setAttribute('transform', `rotate(${-spin} 120 105)`)
    if (style.sphereRing) {
      const shape = sphereRingPaths(orbit)
      sphereFront.forEach(path => path.setAttribute('d', shape.front))
      sphereBack.setAttribute('d', shape.back)
    }
    if (style.meshEnabled) {
      const mesh = voiceMeshFrame(meshAngle, meshAmount, style.meshRings, style.meshRadius)
      meshFront.forEach((path, index) => { path.setAttribute('d', mesh[index].front); path.setAttribute('opacity', String(mesh[index].opacity)) })
      meshBack.forEach((path, index) => { path.setAttribute('d', mesh[index].back); path.setAttribute('opacity', String(mesh[index].opacity * .28)) })
    }
    high.setAttribute('opacity', '1')
    const contour = frame.bands.contour, contourGain = sensitivity.mid * style.contourResponse * motion
    rays.forEach((ray, i) => {
      const band = contour?.length ? i % contour.length : 0
      const raw = !reacting ? 0 : contour?.length
        ? contour[band] * .8 + (contour[(band + 1) % contour.length] + contour[(band + contour.length - 1) % contour.length]) * .1
        : frame.bands.mid
      // Read unclipped spectral detail directly. Neither the three-band meter's
      // ceiling nor the slower sphere-assembly spring should flatten syllables.
      const target = voiceContourEnergy(raw, contourGain)
      contourLevels[i] = followContourLevel(contourLevels[i], target, responseDt)
      const line = voiceContourSegment(i, contourLevels[i], reduced.matches ? 0 : clock, reacting, style)
      for (const key of ['x1', 'y1', 'x2', 'y2'] as const) ray.setAttribute(key, String(line[key]))
      ray.setAttribute('stroke-width', String(line.strokeWidth)); ray.setAttribute('opacity', String(line.opacity))
    })
    if (!reduced.matches && canEmitVoiceWave(reacting, energy, fill, style.fillRing, style.wavesAfterFill, style.waveStrength)
      && clock - lastPulse > .25 && (energy - previousEnergy > .04 || clock - lastPulse > .68)) {
      if (style.wavesAcrossScreen && onWave) onWave({ strength: energy })
      else pulses[pulseIndex++ % pulses.length] = { progress: 0, strength: energy }
      lastPulse = clock
    }
    waves.forEach((wave, index) => {
      const pulse = pulses[index]
      pulse.progress = Math.min(1, pulse.progress + responseDt * style.waveSpeed / 1.45)
      const progress = pulse.progress
      wave.setAttribute('r', String(voiceRadii.fill + progress * (voiceRadii.glass - voiceRadii.fill)))
      wave.setAttribute('opacity', String(reduced.matches || (style.wavesAcrossScreen && onWave) ? 0 : voiceWaveOpacity(progress, pulse.strength, style.waveStrength, style.waveFade)))
    })
    previousEnergy = energy
    root.style.setProperty('--vr-energy', String(energy))
    root.dataset.source = frame.source
    timer.textContent = formatVoiceTime(frame.seconds)
    // Follow the finger smoothly. At the exact threshold, the fill is complete.
    drawnLock = lockProgress === 1 || reduced.matches ? lockProgress : drawnLock + (lockProgress - drawnLock) * (1 - Math.exp(-dt / .025))
    const gesture = lockVisual(drawnLock)
    arrow.setAttribute('opacity', String(gesture.arrowOpacity))
    arrow.setAttribute('transform', `translate(0 ${8 - gesture.lift})`)
    lock.setAttribute('opacity', String(gesture.lockOpacity))
    lock.setAttribute('transform', `translate(0 ${10 - gesture.lift})`)
    paint.setAttribute('y', String(21 - gesture.fill * 11)); paint.setAttribute('height', String(gesture.fill * 11))
    onLevels(levels, frame.source)
  }
  frameId = requestAnimationFrame(draw)
  return () => { cancelAnimationFrame(frameId); onLevels(silentBands, 'idle') }
}
