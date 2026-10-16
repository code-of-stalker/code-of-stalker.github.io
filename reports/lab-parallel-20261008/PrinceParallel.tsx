/**
 * Prince Laboratory · Guidance · Parallel path · 288 × 200.
 * Save as PrinceArchitecture.tsx. Import { PrinceArchitecture }.
 * Includes the current preset, SVG animation, touch response and styles.
 * Provide Tektur and Disket Mono fonts. active=false pauses the animation.
 * onClick opens your section after a short tap. Holds and drags animate without opening.
 */
import { useEffect, useId, useImperativeHandle, useRef, useState } from 'react'
import type { CSSProperties, Ref, MouseEvent, PointerEvent } from 'react'

export const architecturePreset: ArchitectureSettings = {
  "illustration": "guidance",
  "guidanceVariant": "parallel",
  "parallel": {
    "mode": "ribbon",
    "finale": "confirm",
    "guideColor": "#FFF7BA",
    "repeat": true,
    "climbDuration": 5.61,
    "exitDuration": 1.65,
    "signalDuration": 1.87,
    "finalDuration": 4.8,
    "radius": 55,
    "height": 103,
    "depth": 8,
    "turns": 1,
    "sway": 0.16,
    "rungs": 14,
    "stroke": 0.75,
    "brightness": 1,
    "detail": 0.45,
    "guideBrightness": 1.65,
    "selfBrightness": 1,
    "lightSize": 1,
    "glow": 0.75,
    "pulseDepth": 0,
    "support": 0.6,
    "signalCount": 6,
    "signalLength": 0.18,
    "ribbonOpacity": 0.12,
    "landingSpread": 8,
    "exitLift": 6,
    "platformSize": 1,
    "rungsEnabled": true,
    "axisEnabled": true,
    "platformsEnabled": true,
    "signalsEnabled": true
  },
  "guidance": {
    "mode": "hint",
    "branch": "middle",
    "guideColor": "#FFF7BA",
    "repeat": true,
    "approachDuration": 3.63,
    "hintDuration": 2.31,
    "departureDuration": 3.3,
    "finalDuration": 1.76,
    "guideBrightness": 1.9,
    "selfBrightness": 1,
    "glow": 0.75,
    "lightSize": 1,
    "pulseDepth": 0.045,
    "cueStrength": 1,
    "cueWidth": 1.2,
    "trailLength": 0.5,
    "spread": 1,
    "platformSize": 1,
    "platformBrightness": 0.22,
    "routeBrightness": 0.52,
    "inactiveOpacity": 0.17,
    "stroke": 0.8,
    "guideX": 91,
    "guideY": 43,
    "platforms": true,
    "trail": true,
    "connection": true,
    "confirmation": true
  },
  "distance": {
    "mode": "scan",
    "cycle": 10,
    "distance": 1.25,
    "retreatDuration": 2.6,
    "scanDelay": 0.6,
    "scanDuration": 3.5,
    "rise": 54,
    "figureShift": 40,
    "profileWidth": 0.65,
    "profileOpacity": 0.85,
    "planeOpacity": 0.15,
    "lightSize": 1,
    "glow": 1,
    "glowRadius": 5,
    "projection": 1.3,
    "pulse": 1,
    "beamSpread": 1,
    "scanWidth": 12,
    "scanStrength": 1,
    "scanBlur": 0.65,
    "edgeFade": 8,
    "scanEnabled": true,
    "planeEnabled": true,
    "raysEnabled": true,
    "voiceEnabled": false,
    "voiceDrivesMotion": true,
    "voiceStyle": "arcs",
    "voiceRhythm": "phrases",
    "voiceDirection": "forward",
    "voiceColor": "#FFF7BA",
    "voiceRate": 2.6,
    "voiceCount": 5,
    "voiceSpeed": 46,
    "voiceReach": 64,
    "voiceSpread": 70,
    "voiceLineWidth": 0.8,
    "voiceOpacity": 0.85,
    "voiceGlow": 0.65,
    "voiceVariation": 0.6,
    "voiceLead": 1.2,
    "voiceInfluence": 0.7,
    "voiceScanBoost": 0.7
  },
  "synchronization": {
    "pathDuration": 4.6,
    "syncDuration": 2.6,
    "riseDuration": 1.4,
    "finalDuration": 4.4,
    "amount": 2.5,
    "observerHeight": 74,
    "distance": 16,
    "stroke": 0.75,
    "platformBrightness": 75,
    "initialBrightness": 25,
    "brightness": 100,
    "glow": 0.6,
    "lightSize": 1,
    "trailDuration": 1.4,
    "syncGlow": 0.45,
    "waveWidth": 1.15,
    "waveSoftness": 14,
    "projectionGlow": 1.5,
    "projectionPulse": 0.065,
    "guideOpacity": 0.38,
    "repeat": true,
    "trailEnabled": true,
    "waveEnabled": true,
    "guidesEnabled": true,
    "projectionEnabled": true
  },
  "theme": "dark",
  "motion": "release",
  "trigger": "loop",
  "touch": "open",
  "playing": false,
  "frame": true,
  "labels": true,
  "neighbors": true,
  "scanEnabled": false,
  "touchEnabled": true,
  "parallaxEnabled": false,
  "fadeFigureFrame": false,
  "color": "#E7E100",
  "lightColor": "#FFF7BA",
  "surfaceColor": "#0A0C05",
  "cycle": 9,
  "columns": 5,
  "rows": 3,
  "cellSize": 1,
  "spread": 4,
  "frameSpread": 0.65,
  "startScale": 0.2,
  "figureScale": 0.86,
  "neighborOpacity": 0.4,
  "lineWidth": 1,
  "size": 1,
  "offsetX": 0,
  "offsetY": 0,
  "lightSize": 0.55,
  "lightOffset": 0,
  "glow": 0.55,
  "glowRadius": 6,
  "lightPulse": 0,
  "scanWidth": 6,
  "scanStrength": 0.65,
  "touchStrength": 0.65,
  "touchDuration": 2.5,
  "holdDelay": 0.32,
  "parallax": 6,
  "inertia": 0.18
}
const architectureStyles = ".architecture-cover { position:relative; display:block; width:100%; height:100%; padding:0; border:0; border-radius:0; overflow:hidden; background:var(--architecture-bg,#000); color:var(--architecture-color,#e7e100); text-align:left; cursor:pointer; -webkit-tap-highlight-color:transparent; touch-action:pinch-zoom; user-select:none; -webkit-user-select:none; container-type:inline-size; }\n.architecture-cover[data-presentation='artwork'] { background:transparent; }\n.architecture-cover:focus-visible { outline:1px solid currentColor; outline-offset:-4px; }\n.architecture-frame { position:absolute; inset:0; width:100%; height:100%; pointer-events:none; }\n.architecture-artwork { position:absolute; top:7%; left:0; width:100%; height:78%; overflow:hidden; }\n.architecture-cover[data-illustration='distance'] .architecture-artwork { top:0; height:100%; }\n.architecture-serial { position:absolute; top:12px; left:12px; color:var(--architecture-color); opacity:.55; font:400 8px/1.4 'Disket Mono',monospace; letter-spacing:2px; pointer-events:none; }\n.architecture-footer { position:absolute; left:12px; right:24px; bottom:12px; z-index:1; display:flex; flex-direction:column; gap:7px; pointer-events:none; }\n.architecture-footer strong { font:500 clamp(17px,7.29cqw,21px)/1.15 'Tektur',sans-serif; text-transform:uppercase; text-shadow:0 0 3px var(--architecture-bg),0 1px 5px var(--architecture-bg); }\n.architecture-footer small { opacity:.65; font:400 9px/1.5 'Disket Mono',monospace; }\n.architecture-arrow { position:absolute; right:16px; bottom:16px; width:16px; height:16px; pointer-events:none; }\n.synchronization-control .synchronization-time { display:flex; flex:none; align-items:center; gap:6px; }\n.synchronization-time input { box-sizing:border-box; width:68px; min-height:32px; padding:5px 7px; border:1px solid currentColor; background:transparent; color:inherit; font:inherit; text-align:right; }\n.synchronization-control > span > label { min-width:0; }\n"

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

export type ParallelPoint = [number, number]
export type ParallelRamp = [ParallelPoint, ParallelPoint, ParallelPoint, ParallelPoint]
export const parallelClamp = (v: number, min = 0, max = 1) => Math.min(max, Math.max(min, v))
export function parallelEase(a: number, b: number, t: number) { const p = parallelClamp((t - a) / (b - a)); return p * p * (3 - 2 * p) }
export function parallelEnvelope(t: number, a = .06, b = .2, c = .955, d = 1) { return parallelEase(a, b, t) * (1 - parallelEase(c, d, t)) }
export function parallelBezier([a, b, c, d]: ParallelRamp, p: number): ParallelPoint {
  return [0, 1].map(k => (1 - p) ** 3 * a[k] + 3 * (1 - p) ** 2 * p * b[k] + 3 * (1 - p) * p * p * c[k] + p ** 3 * d[k]) as ParallelPoint
}
export function parallelFrame(t: number, s: ParallelSettings) {
  const travel = parallelEase(.12, .66, t), p = parallelClamp(travel / .86), out = parallelClamp((travel - .86) / .14)
  const yaw = s.sway * Math.sin(p * Math.PI) * (1 - parallelEase(.75, 1, p))
  const at = (z: number, side: number): [number, number, number] => {
    const a = -Math.PI / 2 + z * Math.PI * 2 * s.turns + side * Math.PI + yaw
    return [144 + Math.sin(a) * s.radius, 133 - z * s.height + Math.cos(a) * s.depth * (1 - parallelEase(.78, 1, z)), Math.cos(a)]
  }
  const endY = 133 - s.height - s.exitLift
  const ends: ParallelPoint[] = [[144 - s.radius - s.landingSpread, endY], [144 + s.radius + s.landingSpread, endY]]
  const ramps = ends.map((end, i): ParallelRamp => {
    const start = at(1, i).slice(0, 2) as ParallelPoint
    // Match the upward tangent at the rail, then reach zero velocity at the landing.
    return [start, [start[0], start[1] - s.height * .14 / .86 / 3], end, end]
  })
  const positions = ramps.map((ramp, i) => travel <= .86 ? at(p, i).slice(0, 2) as ParallelPoint : parallelBezier(ramp, out))
  return { power: parallelEnvelope(t), travel, p, out, at, ends, ramps, positions, settled: parallelEase(.62, .7, t),
    stage: t < .51 ? 'climb' : t < .66 ? 'exit' : t < .83 ? 'confirmation' : t < .955 ? 'hold' : 'fade' }
}

function parallelAttr(node: Element, name: string, value: number | string) { node.setAttribute(name, typeof value === 'number' ? value.toFixed(4) : value) }
const parallelPointString = (p: number[]) => `${p[0].toFixed(3)} ${p[1].toFixed(3)}`
const parallelPath = (points: number[][]) => 'M' + points.map(parallelPointString).join('L')
function parallelDiamond(x: number, y: number, rx: number, ry: number) { return parallelPath([[x - rx, y], [x, y - ry], [x + rx, y], [x, y + ry]]) + 'Z' }
function parallelSelect(root: ParentNode, selector: string): SVGElement {
  const element = root.querySelector<SVGElement>(selector)
  if (!element) throw new Error('Missing parallel path layer: ' + selector)
  return element
}

/** Native SVG double helix. Keep both sources independent through the level finish. */
export function createParallelPath(svg: SVGSVGElement, id: string, palette: { ink: string; warm: string; guide: string }, initial: ParallelSettings) {
  const count = initial.turns * 40, attr = parallelAttr
  const select = (selector: string) => parallelSelect(svg, selector)
  const all = (selector: string) => [...svg.querySelectorAll<SVGElement>(selector)]
  const energy = (name: string, color: string) => `<radialGradient id="${id}-${name}"><stop stop-color="${color}" stop-opacity=".92"/><stop offset=".16" stop-color="${palette.ink}" stop-opacity=".5"/><stop offset=".5" stop-color="${palette.ink}" stop-opacity=".12"/><stop offset="1" stop-color="${palette.ink}" stop-opacity="0"/></radialGradient>`
  const sourceMarkup = (role: string, color: string) => `<g class="parallel-${role}" data-role="${role}" opacity="0"><circle class="parallel-aura" r="14" fill="url(#${id}-${role}-energy)" stroke="none"/><circle class="parallel-bloom" r="3.7" fill="${color}" stroke="none" filter="url(#${id}-glow)"/><circle class="parallel-core" r="1.45" fill="${color}" stroke="none"/><path d="M-4 0H4M0-2.5V2.5" stroke="${color}" stroke-width=".45" opacity=".3"/></g>`
  svg.innerHTML = `<defs>${energy('guide-energy', palette.guide)}${energy('self-energy', palette.warm)}<filter id="${id}-glow" x="-180%" y="-180%" width="460%" height="460%"><feGaussianBlur stdDeviation="2.2"/></filter></defs>
    <g class="parallel-ribbon" fill="${palette.ink}" stroke="none">${Array.from({ length: count }, () => '<path class="parallel-surface"/>').join('')}</g>
    <g class="parallel-axis"><path d="M144 40V144" stroke-dasharray="1 7"/><ellipse cx="144" cy="137" rx="62" ry="13"/><path d="M74 137h-8m156 0h-8"/></g>
    <g class="parallel-rails">${Array.from({ length: count * 2 }, () => '<path class="parallel-edge"/>').join('')}</g>
    <g class="parallel-rungs">${Array.from({ length: initial.rungs }, () => '<path class="parallel-rung"/>').join('')}</g>
    <g class="parallel-exits"><path class="parallel-exit"/><path class="parallel-exit"/></g>
    <path class="parallel-horizon" opacity="0"/><path class="parallel-link" stroke="${palette.guide}"/><path class="parallel-link-glow" stroke="${palette.guide}" stroke-width="2.2" opacity="0" filter="url(#${id}-glow)"/>
    <path class="parallel-confirm" stroke="${palette.guide}" opacity="0"/><path class="parallel-confirm-bloom" stroke="${palette.guide}" stroke-width="2.5" opacity="0" filter="url(#${id}-glow)"/>
    <path class="parallel-return" stroke="${palette.warm}" opacity="0"/><path class="parallel-return-bloom" stroke="${palette.warm}" stroke-width="2.5" opacity="0" filter="url(#${id}-glow)"/>
    <ellipse class="parallel-received" opacity="0"/><ellipse class="parallel-received-return" opacity="0"/>
    <g class="parallel-landings"><path class="parallel-landing"/><path class="parallel-landing"/></g>
    ${sourceMarkup('guide', palette.guide)}${sourceMarkup('self', palette.warm)}`
  const rails = all('.parallel-edge'), rungs = all('.parallel-rung'), surfaces = all('.parallel-surface')
  const axis = select('.parallel-axis'), ribbon = select('.parallel-ribbon'), landings = all('.parallel-landing'), exits = all('.parallel-exit')
  const link = select('.parallel-link'), linkGlow = select('.parallel-link-glow'), horizon = select('.parallel-horizon')
  const confirm = select('.parallel-confirm'), confirmBloom = select('.parallel-confirm-bloom'), echo = select('.parallel-return'), echoBloom = select('.parallel-return-bloom')
  const received = select('.parallel-received'), receivedReturn = select('.parallel-received-return')
  const sources = [select('.parallel-guide'), select('.parallel-self')].map(root => ({ root, aura: parallelSelect(root, '.parallel-aura'), bloom: parallelSelect(root, '.parallel-bloom'), core: parallelSelect(root, '.parallel-core') }))
  const between = (a: ParallelPoint, b: ParallelPoint, p: number): ParallelPoint => [a[0] + (b[0] - a[0]) * p, a[1] + (b[1] - a[1]) * p]
  function dash(a: ParallelPoint, b: ParallelPoint, progress: number, length: number) { return parallelPath([between(a, b, parallelClamp(progress - length)), between(a, b, progress)]) }
  function light(index: number, point: ParallelPoint, power: number, s: ParallelSettings, breathing: number) {
    const source = sources[index], gain = index === 0 ? s.guideBrightness : s.selfBrightness
    attr(source.root, 'transform', `translate(${parallelPointString(point)})`); attr(source.root, 'opacity', parallelClamp(power * Math.min(1, gain)))
    attr(source.aura, 'r', (8 + 11 * s.glow) * breathing * s.lightSize * (1 + (gain - 1) * .18)); attr(source.aura, 'opacity', parallelClamp(s.glow * gain))
    attr(source.bloom, 'r', 3.2 * breathing * s.lightSize * Math.sqrt(gain)); attr(source.bloom, 'opacity', parallelClamp(s.glow * .65 * gain))
    attr(source.core, 'r', 1.45 * s.lightSize * Math.sqrt(gain))
  }
  return (phase: number, s: ParallelSettings) => {
    const t = parallelClamp(phase), f = parallelFrame(t, s), { power, p, at, settled, ends, positions, ramps } = f
    attr(svg, 'stroke-width', s.stroke); svg.dataset.parallelStage = f.stage; svg.dataset.parallelMode = s.mode
    attr(axis, 'opacity', s.axisEnabled ? (.1 + .13 * s.detail) * s.brightness : 0)
    attr(ribbon, 'opacity', s.mode === 'ribbon' ? 1 : 0)
    if (s.mode === 'ribbon') surfaces.forEach((node, i) => {
      const z = i / count, next = (i + 1) / count, near = Math.exp(-(((p - z) / .18) ** 2)) * (1 - settled)
      attr(node, 'd', parallelPath([at(z, 0), at(next, 0), at(next, 1), at(z, 1)]) + 'Z')
      attr(node, 'opacity', (s.ribbonOpacity * (.25 + near * .75)) * power)
    })
    rails.forEach((node, i) => {
      const side = i < count ? 0 : 1, n = i % count, z = n / count, a = at(z, side), b = at((n + 1) / count, side)
      const head = Math.exp(-(((p - z) / .16) ** 2)) * (1 - settled)
      attr(node, 'd', parallelPath([a, b])); attr(node, 'opacity', parallelClamp((.16 + power * .4 * (1 - settled * .4) + head * .32 * power) * (.5 + .5 * (a[2] + 1) / 2) * s.brightness))
      attr(node, 'stroke-width', (.6 + .4 * (a[2] + 1) / 2) * s.stroke)
    })
    rungs.forEach((node, i) => {
      const z = i / (rungs.length - 1), a = at(z, 0), b = at(z, 1), near = Math.exp(-(((z - p) / .085) ** 2)) * (1 - settled)
      attr(node, 'd', parallelPath([a, b])); attr(node, 'opacity', s.rungsEnabled ? parallelClamp((.1 + .15 * s.detail + near * .4) * power * (1 - settled * .3) * s.brightness) : 0)
    })
    exits.forEach((node, i) => {
      const r = ramps[i]; attr(node, 'd', `M${parallelPointString(r[0])}C${parallelPointString(r[1])} ${parallelPointString(r[2])} ${parallelPointString(r[3])}`)
      attr(node, 'opacity', parallelClamp(parallelEase(.43, .58, t) * power * .63 * s.brightness))
    })
    const [a, b] = positions, step = Math.floor(p * s.signalCount), q = (p * s.signalCount) % 1
    const reverse = s.mode === 'dialogue' && step % 2 === 1
    const movingDash = reverse ? dash(b, a, q, s.signalLength) : dash(a, b, q, s.signalLength)
    const movingPower = s.signalsEnabled ? power * Math.sin(q * Math.PI) * s.support * (1 - parallelEase(.48, .57, t)) : 0
    attr(link, 'd', movingDash); attr(linkGlow, 'd', movingDash)
    attr(link, 'stroke', reverse ? palette.warm : palette.guide); attr(linkGlow, 'stroke', reverse ? palette.warm : palette.guide)
    attr(link, 'opacity', parallelClamp(movingPower * .85)); attr(linkGlow, 'opacity', parallelClamp(movingPower * .28))
    attr(horizon, 'd', parallelPath(ends)); attr(horizon, 'opacity', parallelClamp(settled * power * .3 * s.support))
    const confirmation = parallelEase(.69, .78, t), confirmationPower = s.finale === 'quiet' ? 0 : parallelEnvelope(t, .685, .72, .785, .83) * s.support
    const finalDash = dash(ends[0], ends[1], confirmation, s.signalLength)
    attr(confirm, 'd', finalDash); attr(confirmBloom, 'd', finalDash); attr(confirm, 'opacity', parallelClamp(confirmationPower * .9)); attr(confirmBloom, 'opacity', parallelClamp(confirmationPower * .32))
    const returning = parallelEase(.79, .865, t), returnPower = s.finale === 'echo' ? parallelEnvelope(t, .785, .8, .868, .89) * s.support : 0
    const returnDash = dash(ends[1], ends[0], returning, s.signalLength)
    attr(echo, 'd', returnDash); attr(echoBloom, 'd', returnDash); attr(echo, 'opacity', parallelClamp(returnPower * .8)); attr(echoBloom, 'opacity', parallelClamp(returnPower * .3))
    for (const [node, endpoint, receipt, enabled] of [
      [received, ends[1], parallelEase(.765, .87, t), s.finale !== 'quiet'],
      [receivedReturn, ends[0], parallelEase(.85, .925, t), s.finale === 'echo'],
    ] as const) {
      attr(node, 'cx', endpoint[0]); attr(node, 'cy', endpoint[1] + 6)
      attr(node, 'rx', 5 + receipt * 13); attr(node, 'ry', 2 + receipt * 5)
      attr(node, 'opacity', enabled ? parallelClamp(Math.sin(receipt * Math.PI) * (1 - receipt) * s.support * .5) : 0)
    }
    const breathing = 1 + Math.sin(t * Math.PI * 8) * s.pulseDepth
    positions.forEach((point, i) => light(i, point, power, s, breathing))
    landings.forEach((node, i) => {
      attr(node, 'd', parallelDiamond(ends[i][0], ends[i][1] + 6, 12 * s.platformSize, 5 * s.platformSize))
      attr(node, 'opacity', s.platformsEnabled ? parallelClamp(parallelEase(.51, .69, t) * power * .58 * s.brightness) : 0)
    })
  }
}

export function ParallelCover({ settings = defaultArchitectureSettings, active = true, language = 'ru', presentation = 'cover', replayKey = 0, touchKey = 0, controller, onClick, interactive = true }: ArchitectureCoverProps) {
  const ru = language === 'ru', id = `parallel-${useId().replace(/\W/g, '')}`
  const svg = useRef<SVGSVGElement>(null), scene = useRef<SVGSVGElement>(null), parallax = useRef<SVGGElement>(null)
  const [interaction, setInteraction] = useState(0)
  const clock = useRef({ time: 0, replayKey, touchKey, interaction: 0, started: false, trigger: settings.trigger, settings: normalizeParallelSettings(settings.parallel) })
  const aim = useRef({ x: 0, y: 0, targetX: 0, targetY: 0 }), wakeGesture = useRef<() => void>(() => {})
  const hold = () => { if (settings.touchEnabled || settings.trigger === 'tap') setInteraction(value => value + 1) }
  const release = () => {}
  const move = (x: number, y: number) => { aim.current.targetX = x; aim.current.targetY = y; wakeGesture.current() }
  const gesture = useCoverGesture({ holdDelay: settings.holdDelay, disabled: !interactive || !active,
    onHold: hold, onRelease: release, onMove: move, onTap: () => { onClick?.() } })

  useImperativeHandle(controller, () => ({ hold, release, move, svg: () => {
    if (!svg.current) return ''
    const copy = svg.current.cloneNode(true) as SVGSVGElement
    copy.setAttribute('xmlns', 'http://www.w3.org/2000/svg'); copy.setAttribute('width', '288'); copy.setAttribute('height', '160')
    copy.removeAttribute('class'); copy.removeAttribute('aria-hidden'); copy.setAttribute('role', 'img')
    const title = document.createElementNS('http://www.w3.org/2000/svg', 'title')
    title.textContent = ru ? 'Водительство · Параллельный путь' : 'Guidance · Parallel path'; copy.prepend(title)
    for (const node of [copy, ...copy.querySelectorAll('*')]) for (const attr of Array.from(node.attributes)) if (attr.name.startsWith('data-')) node.removeAttribute(attr.name)
    return `<?xml version="1.0" encoding="UTF-8"?>\n${new XMLSerializer().serializeToString(copy)}`
  } }), [settings, ru])

  useEffect(() => {
    const node = scene.current, root = svg.current, offset = parallax.current
    if (!node || !root || !offset) return
    const s = normalizeParallelSettings(settings.parallel), state = clock.current
    const repeat = settings.trigger === 'loop' && s.repeat
    // Preserve the current stage when changing its duration or the visual controls.
    const oldPhase = parallelPhase(state.time, state.settings, settings.trigger === 'loop' && state.settings.repeat)
    const completedCycles = repeat ? Math.floor(state.time / parallelDuration(state.settings)) : 0
    state.time = completedCycles * parallelDuration(s) + parallelTimeAtPhase(oldPhase, s); state.settings = s
    if (state.trigger !== settings.trigger) { state.time = 0; state.started = false; state.trigger = settings.trigger }
    if (state.replayKey !== replayKey || state.touchKey !== touchKey || state.interaction !== interaction) {
      state.time = 0; state.started = true; state.replayKey = replayKey; state.touchKey = touchKey; state.interaction = interaction
    }
    const render = createParallelPath(node, id, { ink: settings.color, warm: settings.lightColor, guide: s.guideColor }, s)
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    let frame = 0, last = 0, visible = true
    const canPlay = () => active && visible && !document.hidden && !media.matches
    const advancing = () => settings.playing && (settings.trigger === 'loop' || state.started) && (repeat || state.time < parallelDuration(s))
    function draw(dt: number) {
      if (canPlay() && advancing()) state.time += dt
      const phase = media.matches ? .94 : parallelPhase(state.time, s, repeat)
      render(phase, s)
      root!.dataset.parallelPhase = String(phase)
      root!.dataset.parallelTime = String(state.time)
      const point = aim.current, factor = media.matches ? 1 : 1 - Math.exp(-dt / settings.inertia)
      const x = settings.parallaxEnabled && !media.matches ? point.targetX * settings.parallax : 0
      const y = settings.parallaxEnabled && !media.matches ? point.targetY * settings.parallax * .55 : 0
      point.x += (x - point.x) * factor; point.y += (y - point.y) * factor
      if (!settings.parallaxEnabled) { point.x = 0; point.y = 0 }
      offset!.setAttribute('transform', `translate(${point.x.toFixed(3)} ${point.y.toFixed(3)})`)
      return Math.abs(x - point.x) + Math.abs(y - point.y) > .01
    }
    function tick(now: number) {
      frame = 0
      if (!canPlay()) return
      const dt = last ? Math.min(.05, (now - last) / 1000) : 0
      last = now
      const moving = draw(dt)
      if (advancing() || moving) frame = requestAnimationFrame(tick)
    }
    function wake() {
      cancelAnimationFrame(frame); frame = 0; last = 0; draw(0)
      if (canPlay()) frame = requestAnimationFrame(tick)
    }
    const observer = new IntersectionObserver(entries => { visible = entries[0]?.isIntersecting ?? false; wake() })
    observer.observe(root)
    wakeGesture.current = wake
    document.addEventListener('visibilitychange', wake); media.addEventListener('change', wake)
    wake()
    return () => {
      cancelAnimationFrame(frame); observer.disconnect(); wakeGesture.current = () => {}
      document.removeEventListener('visibilitychange', wake); media.removeEventListener('change', wake)
    }
  }, [settings, active, replayKey, touchKey, interaction, id])

  return <button type="button" className="architecture-cover" data-illustration="guidance" data-guidance-variant="parallel" data-theme={settings.theme} data-presentation={presentation} tabIndex={interactive ? undefined : -1}
    aria-label={ru ? 'Архитектура наблюдения · Параллельный путь' : 'Observation architecture · Parallel path'}
    style={{ '--architecture-color': settings.color, '--architecture-bg': settings.theme === 'dark' ? '#000000' : '#FAE6AD' } as CSSProperties} {...gesture}>
    {presentation === 'cover' && settings.frame && <svg className="architecture-frame" viewBox="0 0 288 200" preserveAspectRatio="none" aria-hidden="true"><path d="M.5 .5H270L287.5 18V181L269 199.5H.5Z" fill="none" stroke={settings.color} strokeOpacity=".38"/></svg>}
    <svg className="architecture-artwork" ref={svg} viewBox="0 0 288 160" fill="none" color={settings.color} stroke={settings.color} strokeWidth={settings.parallel.stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <g ref={parallax}><g transform={architectureArtworkTransform(settings)}><svg ref={scene} width="288" height="160" viewBox="0 0 288 160" overflow="visible"/></g></g>
    </svg>
    {presentation === 'cover' && settings.labels && <>
      <span className="architecture-serial">01 /</span>
      <span className="architecture-footer"><strong>{ru ? <>Архитектура<br/>Наблюдения</> : <>Observation<br/>Architecture</>}</strong><small>{ru ? 'ВОДИТЕЛЬСТВО · ПАРАЛЛЕЛЬНЫЙ ПУТЬ' : 'GUIDANCE · PARALLEL PATH'}</small></span>
      <svg className="architecture-arrow" viewBox="0 0 24 24" fill="none" stroke={settings.color} strokeWidth="1" aria-hidden="true"><path d="M5 19L19 5M7 5h12v12"/></svg>
    </>}
  </button>
}

export type DistanceSettings = {
  mode: 'scan' | 'project' | 'pulse'
  cycle: number; distance: number; retreatDuration: number; scanDelay: number; scanDuration: number
  rise: number; figureShift: number; profileWidth: number; profileOpacity: number; planeOpacity: number
  lightSize: number; glow: number; glowRadius: number; projection: number; pulse: number; beamSpread: number
  scanWidth: number; scanStrength: number; scanBlur: number; edgeFade: number
  scanEnabled: boolean; planeEnabled: boolean; raysEnabled: boolean
  voiceEnabled: boolean; voiceDrivesMotion: boolean
  voiceStyle: 'arcs' | 'rings' | 'spectrum'; voiceRhythm: 'phrases' | 'steady' | 'syllables'; voiceDirection: 'forward' | 'light'
  voiceColor: string; voiceRate: number; voiceCount: number; voiceSpeed: number; voiceReach: number; voiceSpread: number
  voiceLineWidth: number; voiceOpacity: number; voiceGlow: number; voiceVariation: number
  voiceLead: number; voiceInfluence: number; voiceScanBoost: number
}

/** Fifth distance concept. The source starts dark, retreats, then scans the whole bust. */
export const defaultDistanceSettings: DistanceSettings = {
  mode: 'scan', cycle: 10, distance: 1.25, retreatDuration: 2.6, scanDelay: .6, scanDuration: 3.5,
  rise: 54, figureShift: 40, profileWidth: .65, profileOpacity: .85, planeOpacity: .15,
  lightSize: 1, glow: 1, glowRadius: 5, projection: 1.3, pulse: 1, beamSpread: 1,
  scanWidth: 12, scanStrength: 1, scanBlur: .65, edgeFade: 8,
  scanEnabled: true, planeEnabled: true, raysEnabled: true,
  voiceEnabled: false, voiceDrivesMotion: true, voiceStyle: 'arcs', voiceRhythm: 'phrases', voiceDirection: 'forward',
  voiceColor: '#FFF7BA', voiceRate: 2.6, voiceCount: 5, voiceSpeed: 46, voiceReach: 64, voiceSpread: 70,
  voiceLineWidth: .8, voiceOpacity: .85, voiceGlow: .65, voiceVariation: .6,
  voiceLead: 1.2, voiceInfluence: .7, voiceScanBoost: .7,
}

export const distanceBounds = {
  cycle: [4, 30, .5], distance: [.3, 1.8, .05], retreatDuration: [.5, 8, .1], scanDelay: [0, 3, .05], scanDuration: [.6, 10, .1],
  rise: [0, 84, 1], figureShift: [0, 100, 1], profileWidth: [.3, 2, .05], profileOpacity: [.1, 1, .01], planeOpacity: [0, .8, .01],
  lightSize: [.3, 2.5, .05], glow: [0, 2, .05], glowRadius: [0, 12, .25], projection: [0, 2, .05], pulse: [0, 1, .05], beamSpread: [.4, 3, .05],
  scanWidth: [2, 40, .5], scanStrength: [0, 8, .05], scanBlur: [0, 4, .1], edgeFade: [0, 24, 1],
  voiceRate: [.5, 5, .1], voiceCount: [1, 10, 1], voiceSpeed: [12, 180, 1], voiceReach: [16, 180, 1], voiceSpread: [15, 150, 1],
  voiceLineWidth: [.25, 3, .05], voiceOpacity: [0, 1, .01], voiceGlow: [0, 3, .05], voiceVariation: [0, 1, .05],
  voiceLead: [.35, 3, .05], voiceInfluence: [0, 1, .05], voiceScanBoost: [0, 3, .05],
} as const
export type DistanceNumber = keyof typeof distanceBounds

type DistanceSequenceSettings = Pick<DistanceSettings, 'retreatDuration' | 'scanDelay' | 'scanDuration'> & Partial<Pick<DistanceSettings, 'voiceEnabled' | 'voiceDrivesMotion' | 'voiceLead'>>

export const distanceVoiceStart = .35
export function distanceRetreatStart(settings: Partial<DistanceSettings>) {
  return settings.voiceEnabled && settings.voiceDrivesMotion ? distanceVoiceStart + (settings.voiceLead ?? defaultDistanceSettings.voiceLead) : .7
}

export function minimumDistanceCycle(settings: DistanceSequenceSettings) {
  // Keep the chosen durations in seconds; reserve time for ignition and a gentle return.
  return Math.ceil((distanceRetreatStart(settings) + settings.retreatDuration + settings.scanDelay + settings.scanDuration + 2) * 2) / 2
}

export function normalizeDistanceSettings(raw: unknown): DistanceSettings {
  const result = { ...defaultDistanceSettings }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return result
  const input = raw as Record<string, unknown>
  for (const key of Object.keys(distanceBounds) as DistanceNumber[]) {
    const value = input[key], [min, max] = distanceBounds[key]
    if (typeof value === 'number' && Number.isFinite(value)) result[key] = Math.min(max, Math.max(min, value))
  }
  for (const key of ['scanEnabled', 'planeEnabled', 'raysEnabled', 'voiceEnabled', 'voiceDrivesMotion'] as const) {
    if (typeof input[key] === 'boolean') result[key] = input[key]
  }
  if (input.mode === 'scan' || input.mode === 'project' || input.mode === 'pulse') result.mode = input.mode
  if (input.voiceStyle === 'arcs' || input.voiceStyle === 'rings' || input.voiceStyle === 'spectrum') result.voiceStyle = input.voiceStyle
  if (input.voiceRhythm === 'phrases' || input.voiceRhythm === 'steady' || input.voiceRhythm === 'syllables') result.voiceRhythm = input.voiceRhythm
  if (input.voiceDirection === 'forward' || input.voiceDirection === 'light') result.voiceDirection = input.voiceDirection
  if (typeof input.voiceColor === 'string' && /^#[\da-f]{6}$/i.test(input.voiceColor)) result.voiceColor = input.voiceColor.toUpperCase()
  result.voiceCount = Math.round(result.voiceCount)
  result.cycle = Math.max(result.cycle, minimumDistanceCycle(result))
  return result
}

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

export type GuidancePoint = [number, number]
export const guidanceClamp = (v: number, min = 0, max = 1) => Math.min(max, Math.max(min, v))
export function guidanceEase(a: number, b: number, value: number) {
  const p = guidanceClamp((value - a) / (b - a))
  return p * p * (3 - 2 * p)
}
export function guidanceEnvelope(t: number, a = .06, b = .2, c = .9, d = 1) {
  return guidanceEase(a, b, t) * (1 - guidanceEase(c, d, t))
}
export const guidanceApproach: GuidancePoint[] = [[47, 119], [86, 99], [124, 99], [151, 86]]
export function guidanceBranches(spread: number): GuidancePoint[][] {
  return [
    [[151, 86], [174, 59], [211, 43]],
    [[151, 86], [190, 86], [238, 65]],
    [[151, 86], [180, 109], [218, 127]],
  ].map(route => route.map(([x, y]) => [x, 86 + (y - 86) * spread] as GuidancePoint))
}
/** Arc-length interpolation keeps the light exactly on the polyline, at both bends. */
export function guidancePointOnRoute(route: GuidancePoint[], progress: number): GuidancePoint {
  const lengths = route.slice(1).map((p, i) => Math.hypot(p[0] - route[i][0], p[1] - route[i][1]))
  let distance = guidanceClamp(progress) * lengths.reduce((sum, length) => sum + length, 0)
  for (let i = 0; i < lengths.length; i++) {
    if (distance <= lengths[i] || i === lengths.length - 1) {
      const p = lengths[i] ? distance / lengths[i] : 0
      return [route[i][0] + (route[i + 1][0] - route[i][0]) * p, route[i][1] + (route[i + 1][1] - route[i][1]) * p]
    }
    distance -= lengths[i]
  }
  return route[0]
}
export function guidanceBranchIndex(settings: GuidanceSettings, cycle = 0) {
  return settings.branch === 'alternate' ? [1, 0, 2][((Math.floor(cycle) % 3) + 3) % 3] : settings.branch === 'upper' ? 0 : settings.branch === 'lower' ? 2 : 1
}
export function guidanceFrame(t: number, settings: GuidanceSettings, cycle = 0) {
  const branch = guidanceBranchIndex(settings, cycle), routes = guidanceBranches(settings.spread)
  const approach = guidanceEase(.1, .33, t), departure = guidanceEase(.54, .84, t)
  return {
    branch, approach, departure, routes,
    power: guidanceEnvelope(t), guidePower: guidanceEnvelope(t, .29, .39, .85, .99),
    cue: guidanceEnvelope(t, .34, .45, .6, .74),
    position: t < .54 ? guidancePointOnRoute(guidanceApproach, approach) : guidancePointOnRoute(routes[branch], departure),
    stage: t < .33 ? 'approach' : t < .54 ? 'hint' : t < .84 ? 'departure' : 'final',
  }
}

function guidanceAttr(el: Element, name: string, value: number | string) {
  el.setAttribute(name, typeof value === 'number' ? value.toFixed(4) : value)
}
function guidanceSelect(root: ParentNode, selector: string): SVGElement {
  const node = root.querySelector<SVGElement>(selector)
  if (!node) throw new Error('Missing guidance layer: ' + selector)
  return node
}
const guidancePath = (points: GuidancePoint[]) => 'M' + points.map(p => p.map(v => v.toFixed(3)).join(' ')).join('L')
function guidanceTrace(node: Element, from: number, to: number, opacity: number) {
  guidanceAttr(node, 'pathLength', 1)
  guidanceAttr(node, 'stroke-dasharray', `${Math.max(0, to - from)} 2`)
  guidanceAttr(node, 'stroke-dashoffset', -from)
  guidanceAttr(node, 'opacity', to > from ? guidanceClamp(opacity) : 0)
}

/** Small native SVG scene: no canvas, WebGL, assets or React updates in the animation loop. */
export function createGuidanceJunction(svg: SVGSVGElement, id: string, palette: { ink: string; warm: string; guide: string }) {
  const attr = guidanceAttr, select = (selector: string) => guidanceSelect(svg, selector)
  const energy = (name: string, color: string) => `<radialGradient id="${id}-${name}"><stop stop-color="${color}" stop-opacity=".92"/><stop offset=".16" stop-color="${palette.ink}" stop-opacity=".5"/><stop offset=".5" stop-color="${palette.ink}" stop-opacity=".12"/><stop offset="1" stop-color="${palette.ink}" stop-opacity="0"/></radialGradient>`
  const light = (role: string, color: string) => `<g class="guidance-${role}" data-role="${role}" opacity="0"><circle class="guidance-aura" r="14" fill="url(#${id}-${role}-energy)" stroke="none"/><circle class="guidance-bloom" r="3.7" fill="${color}" stroke="none" filter="url(#${id}-glow)"/><circle class="guidance-core" r="1.45" fill="${color}" stroke="none"/><path d="M-4 0H4M0-2.5V2.5" stroke="${color}" stroke-width=".45" opacity=".3"/></g>`
  svg.innerHTML = `<defs>${energy('guide-energy', palette.guide)}${energy('self-energy', palette.warm)}
    <linearGradient id="${id}-beam" gradientUnits="userSpaceOnUse"><stop stop-color="${palette.guide}" stop-opacity=".02"/><stop offset=".2" stop-color="${palette.ink}" stop-opacity=".26"/><stop offset="1" stop-color="${palette.ink}" stop-opacity="0"/></linearGradient>
    <filter id="${id}-glow" x="-180%" y="-180%" width="460%" height="460%"><feGaussianBlur stdDeviation="2.2"/></filter>
    <filter id="${id}-soft" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="1.2"/></filter></defs>
    <g class="guidance-floor">${Array.from({ length: 10 }, () => '<path class="guidance-platform" d="M-12 0L0-5.4 12 0 0 5.4Z"/>').join('')}<path d="M29 132L68 113m113-80l30-13M235 133l15 6" stroke-width=".5" opacity=".6"/></g>
    <path class="guidance-start" d="${guidancePath(guidanceApproach)}"/>
    ${[0, 1, 2].map(i => `<path class="guidance-branch branch-${i}"/><path class="guidance-cue cue-${i}" stroke="${palette.guide}" stroke-dasharray="2 4" opacity="0"/><path class="guidance-trail trail-${i}" stroke="${palette.warm}" opacity="0"/>`).join('')}
    <path class="guidance-approach-trail" d="${guidancePath(guidanceApproach)}" stroke="${palette.warm}" opacity="0"/>
    <path class="guidance-beam" fill="url(#${id}-beam)" stroke="none" filter="url(#${id}-soft)" opacity="0"/>
    <path class="guidance-hint" stroke="${palette.guide}" stroke-width=".55" stroke-dasharray="2 4" opacity="0"/>
    <circle class="guidance-signal" r="1.4" fill="${palette.guide}" stroke="none" opacity="0"/>
    <circle class="guidance-pulse" cx="151" cy="86" r="8" opacity="0"/>
    <ellipse class="guidance-arrival" rx="12" ry="5.4" opacity="0"/>
    ${light('guide', palette.guide)}${light('self', palette.warm)}`
  const floor = select('.guidance-floor'), platforms = [...svg.querySelectorAll('.guidance-platform')]
  const start = select('.guidance-start'), startTrail = select('.guidance-approach-trail')
  const branches = [0, 1, 2].map(i => select(`.branch-${i}`)), cues = [0, 1, 2].map(i => select(`.cue-${i}`)), trails = [0, 1, 2].map(i => select(`.trail-${i}`))
  const hint = select('.guidance-hint'), guide = select('.guidance-guide'), self = select('.guidance-self')
  const beam = select('.guidance-beam'), beamGradient = select(`#${id}-beam`), signal = select('.guidance-signal')
  const pulse = select('.guidance-pulse'), arrival = select('.guidance-arrival')
  const sources = [guide, self].map(root => ({ root, aura: guidanceSelect(root, '.guidance-aura'), bloom: guidanceSelect(root, '.guidance-bloom'), core: guidanceSelect(root, '.guidance-core') }))
  function setLight(index: number, point: GuidancePoint, power: number, settings: GuidanceSettings, breathing: number) {
    const source = sources[index], gain = index === 0 ? settings.guideBrightness : settings.selfBrightness
    attr(source.root, 'transform', `translate(${point[0].toFixed(3)} ${point[1].toFixed(3)})`)
    attr(source.root, 'opacity', guidanceClamp(power * Math.min(1, gain)))
    attr(source.aura, 'r', (8 + 11 * settings.glow) * breathing * settings.lightSize * (1 + (gain - 1) * .18))
    attr(source.aura, 'opacity', guidanceClamp(settings.glow * gain))
    attr(source.bloom, 'r', 3.2 * breathing * settings.lightSize * Math.sqrt(gain))
    attr(source.bloom, 'opacity', guidanceClamp(settings.glow * .65 * gain))
    attr(source.core, 'r', 1.45 * settings.lightSize * Math.sqrt(gain))
  }
  return (phase: number, settings: GuidanceSettings, cycle = 0) => {
    const t = guidanceClamp(phase), f = guidanceFrame(t, settings, cycle)
    const { branch: choice, power, cue, approach, departure, routes } = f
    svg.dataset.guidanceStage = f.stage; svg.dataset.guidanceBranch = String(choice); svg.dataset.guidanceMode = settings.mode
    attr(svg, 'stroke-width', settings.stroke)
    attr(floor, 'opacity', settings.platforms ? settings.platformBrightness : 0)
    const centers = [...guidanceApproach, ...routes.flatMap(route => route.slice(1))]
    platforms.forEach((node, i) => attr(node, 'transform', `translate(${centers[i].join(' ')}) scale(${settings.platformSize})`))
    attr(start, 'opacity', settings.routeBrightness * (.38 + power * .62))
    guidanceTrace(startTrail, Math.max(0, approach - settings.trailLength), approach, settings.trail ? power * (1 - guidanceEase(.54, .69, t)) * .85 : 0)
    routes.forEach((route, i) => {
      const d = guidancePath(route)
      attr(branches[i], 'd', d); attr(cues[i], 'd', d); attr(trails[i], 'd', d)
      attr(branches[i], 'opacity', i === choice ? Math.min(1, settings.inactiveOpacity + guidanceEase(.42, .62, t) * power * settings.routeBrightness * .87) : settings.inactiveOpacity)
      guidanceTrace(trails[i], Math.max(0, departure - settings.trailLength), departure, settings.trail && i === choice ? power : 0)
      attr(cues[i], 'stroke-width', settings.cueWidth)
      if (settings.mode === 'pulse') {
        const p = guidanceEase(.42, .56, t)
        guidanceTrace(cues[i], Math.max(0, p - .13), p, i === choice ? guidanceEnvelope(t, .41, .43, .55, .58) * settings.cueStrength : 0)
      } else {
        cues[i].removeAttribute('pathLength')
        attr(cues[i], 'stroke-dasharray', settings.mode === 'hint' ? '2 4' : 'none')
        attr(cues[i], 'stroke-dashoffset', -t * 30)
        attr(cues[i], 'opacity', i === choice ? guidanceClamp(cue * settings.cueStrength * (settings.mode === 'hint' ? .75 : .5)) : 0)
      }
    })
    const source: GuidancePoint = [settings.guideX, settings.guideY]
    const target = settings.mode === 'pulse' ? guidanceApproach.at(-1)! : guidancePointOnRoute(routes[choice], Math.min(1, .2 + guidanceEase(.37, .55, t) * .8))
    const control: GuidancePoint = [(source[0] + target[0]) / 2, Math.min(source[1], target[1]) - 11]
    attr(hint, 'd', `M${source.join(' ')}Q${control.join(' ')} ${target.join(' ')}`)
    attr(hint, 'opacity', settings.connection ? guidanceClamp(cue * .34 * settings.cueStrength) : 0)
    attr(hint, 'stroke-width', settings.stroke * .69)
    attr(beam, 'd', guidancePath([source, [target[0] - 6 * settings.cueWidth, target[1] - 4 * settings.cueWidth], [target[0] + 6 * settings.cueWidth, target[1] + 4 * settings.cueWidth]]) + 'Z')
    attr(beam, 'opacity', settings.mode === 'beam' ? guidanceClamp(cue * settings.cueStrength) : 0)
    for (const [name, value] of [['x1', source[0]], ['y1', source[1]], ['x2', target[0]], ['y2', target[1]]] as const) attr(beamGradient, name, value)
    const p = guidanceEase(.34, .42, t), u = 1 - p
    attr(signal, 'cx', u * u * source[0] + 2 * u * p * control[0] + p * p * target[0])
    attr(signal, 'cy', u * u * source[1] + 2 * u * p * control[1] + p * p * target[1])
    attr(signal, 'opacity', settings.mode === 'pulse' && settings.connection ? guidanceEnvelope(t, .34, .355, .41, .425) * Math.min(1, settings.cueStrength) : 0)
    setLight(0, source, f.guidePower, settings, 1 + settings.pulseDepth * Math.sin(t * 18))
    setLight(1, f.position, power, settings, 1)
    const q = guidanceEase(.36, .57, t)
    attr(pulse, 'r', 6 + q * 15)
    attr(pulse, 'opacity', settings.confirmation ? Math.sin(q * Math.PI) * .5 * Math.min(1.5, settings.cueStrength) : 0)
    const end = routes[choice].at(-1)!, landed = guidanceEase(.84, .94, t)
    attr(arrival, 'cx', end[0]); attr(arrival, 'cy', end[1]); attr(arrival, 'rx', 12 + 12 * landed); attr(arrival, 'ry', 5.4 + 5.4 * landed)
    attr(arrival, 'opacity', settings.confirmation ? Math.sin(landed * Math.PI) * .4 * Math.min(1.5, settings.cueStrength) : 0)
  }
}

export function GuidanceCover({ settings = defaultArchitectureSettings, active = true, language = 'ru', presentation = 'cover', replayKey = 0, touchKey = 0, controller, onClick, interactive = true }: ArchitectureCoverProps) {
  const ru = language === 'ru', id = `guidance-${useId().replace(/\W/g, '')}`
  const svg = useRef<SVGSVGElement>(null), scene = useRef<SVGSVGElement>(null), parallax = useRef<SVGGElement>(null)
  const [interaction, setInteraction] = useState(0)
  const clock = useRef({ time: 0, replayKey, touchKey, interaction: 0, started: false, trigger: settings.trigger, settings: normalizeGuidanceSettings(settings.guidance) })
  const aim = useRef({ x: 0, y: 0, targetX: 0, targetY: 0 }), wakeGesture = useRef<() => void>(() => {})
  const hold = () => { if (settings.touchEnabled || settings.trigger === 'tap') setInteraction(value => value + 1) }
  const release = () => {}
  const move = (x: number, y: number) => { aim.current.targetX = x; aim.current.targetY = y; wakeGesture.current() }
  const gesture = useCoverGesture({ holdDelay: settings.holdDelay, disabled: !interactive || !active,
    onHold: hold, onRelease: release, onMove: move, onTap: () => { onClick?.() } })

  useImperativeHandle(controller, () => ({ hold, release, move, svg: () => {
    if (!svg.current) return ''
    const copy = svg.current.cloneNode(true) as SVGSVGElement
    copy.setAttribute('xmlns', 'http://www.w3.org/2000/svg'); copy.setAttribute('width', '288'); copy.setAttribute('height', '160')
    copy.removeAttribute('class'); copy.removeAttribute('aria-hidden'); copy.setAttribute('role', 'img')
    const title = document.createElementNS('http://www.w3.org/2000/svg', 'title')
    title.textContent = ru ? 'Водительство · Подсказка в узле' : 'Guidance · Hint at the junction'; copy.prepend(title)
    for (const node of [copy, ...copy.querySelectorAll('*')]) for (const attr of Array.from(node.attributes)) if (attr.name.startsWith('data-')) node.removeAttribute(attr.name)
    return `<?xml version="1.0" encoding="UTF-8"?>\n${new XMLSerializer().serializeToString(copy)}`
  } }), [settings, ru])

  useEffect(() => {
    const node = scene.current, root = svg.current, offset = parallax.current
    if (!node || !root || !offset) return
    const s = normalizeGuidanceSettings(settings.guidance), state = clock.current
    const repeat = settings.trigger === 'loop' && s.repeat
    // Preserve the current stage when changing its duration or the visual controls.
    const oldPhase = guidancePhase(state.time, state.settings, settings.trigger === 'loop' && state.settings.repeat)
    const completedCycles = repeat ? Math.floor(state.time / guidanceDuration(state.settings)) : 0
    state.time = completedCycles * guidanceDuration(s) + guidanceTimeAtPhase(oldPhase, s); state.settings = s
    if (state.trigger !== settings.trigger) { state.time = 0; state.started = false; state.trigger = settings.trigger }
    if (state.replayKey !== replayKey || state.touchKey !== touchKey || state.interaction !== interaction) {
      state.time = 0; state.started = true; state.replayKey = replayKey; state.touchKey = touchKey; state.interaction = interaction
    }
    const render = createGuidanceJunction(node, id, { ink: settings.color, warm: settings.lightColor, guide: s.guideColor })
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    let frame = 0, last = 0, visible = true
    const canPlay = () => active && visible && !document.hidden && !media.matches
    const advancing = () => settings.playing && (settings.trigger === 'loop' || state.started) && (repeat || state.time < guidanceDuration(s))
    function draw(dt: number) {
      if (canPlay() && advancing()) state.time += dt
      const phase = media.matches ? .89 : guidancePhase(state.time, s, repeat)
      render(phase, s, repeat ? Math.floor(state.time / guidanceDuration(s)) : 0)
      root!.dataset.guidancePhase = String(phase)
      root!.dataset.guidanceTime = String(state.time)
      const point = aim.current, factor = media.matches ? 1 : 1 - Math.exp(-dt / settings.inertia)
      const x = settings.parallaxEnabled && !media.matches ? point.targetX * settings.parallax : 0
      const y = settings.parallaxEnabled && !media.matches ? point.targetY * settings.parallax * .55 : 0
      point.x += (x - point.x) * factor; point.y += (y - point.y) * factor
      if (!settings.parallaxEnabled) { point.x = 0; point.y = 0 }
      offset!.setAttribute('transform', `translate(${point.x.toFixed(3)} ${point.y.toFixed(3)})`)
      return Math.abs(x - point.x) + Math.abs(y - point.y) > .01
    }
    function tick(now: number) {
      frame = 0
      if (!canPlay()) return
      const dt = last ? Math.min(.05, (now - last) / 1000) : 0
      last = now
      const moving = draw(dt)
      if (advancing() || moving) frame = requestAnimationFrame(tick)
    }
    function wake() {
      cancelAnimationFrame(frame); frame = 0; last = 0; draw(0)
      if (canPlay()) frame = requestAnimationFrame(tick)
    }
    const observer = new IntersectionObserver(entries => { visible = entries[0]?.isIntersecting ?? false; wake() })
    observer.observe(root)
    wakeGesture.current = wake
    document.addEventListener('visibilitychange', wake); media.addEventListener('change', wake)
    wake()
    return () => {
      cancelAnimationFrame(frame); observer.disconnect(); wakeGesture.current = () => {}
      document.removeEventListener('visibilitychange', wake); media.removeEventListener('change', wake)
    }
  }, [settings, active, replayKey, touchKey, interaction, id])

  return <button type="button" className="architecture-cover" data-illustration="guidance" data-theme={settings.theme} data-presentation={presentation} tabIndex={interactive ? undefined : -1}
    aria-label={ru ? 'Архитектура наблюдения · Подсказка в узле' : 'Observation architecture · Hint at the junction'}
    style={{ '--architecture-color': settings.color, '--architecture-bg': settings.theme === 'dark' ? '#000000' : '#FAE6AD' } as CSSProperties} {...gesture}>
    {presentation === 'cover' && settings.frame && <svg className="architecture-frame" viewBox="0 0 288 200" preserveAspectRatio="none" aria-hidden="true"><path d="M.5 .5H270L287.5 18V181L269 199.5H.5Z" fill="none" stroke={settings.color} strokeOpacity=".38"/></svg>}
    <svg className="architecture-artwork" ref={svg} viewBox="0 0 288 160" fill="none" color={settings.color} stroke={settings.color} strokeWidth={settings.guidance.stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <g ref={parallax}><g transform={architectureArtworkTransform(settings)}><svg ref={scene} width="288" height="160" viewBox="0 0 288 160" overflow="visible"/></g></g>
    </svg>
    {presentation === 'cover' && settings.labels && <>
      <span className="architecture-serial">01 /</span>
      <span className="architecture-footer"><strong>{ru ? <>Архитектура<br/>Наблюдения</> : <>Observation<br/>Architecture</>}</strong><small>{ru ? 'ВОДИТЕЛЬСТВО · ПОДСКАЗКА В УЗЛЕ' : 'GUIDANCE · HINT AT THE JUNCTION'}</small></span>
      <svg className="architecture-arrow" viewBox="0 0 24 24" fill="none" stroke={settings.color} strokeWidth="1" aria-hidden="true"><path d="M5 19L19 5M7 5h12v12"/></svg>
    </>}
  </button>
}

export type ArchitectureSettings = {
  illustration: 'cell' | 'distance' | 'synchronization' | 'guidance'; guidance: GuidanceSettings; guidanceVariant: 'junction' | 'parallel'; parallel: ParallelSettings; distance: DistanceSettings; synchronization: SynchronizationSettings
  theme: 'dark' | 'light'; motion: 'release' | 'wave' | 'breathe'; trigger: 'loop' | 'tap'
  touch: 'open' | 'pulse'; playing: boolean; frame: boolean; labels: boolean; neighbors: boolean
  scanEnabled: boolean; touchEnabled: boolean; parallaxEnabled: boolean; fadeFigureFrame: boolean
  color: string; lightColor: string; surfaceColor: string
  cycle: number; columns: number; rows: number; cellSize: number; spread: number; frameSpread: number
  startScale: number; figureScale: number; neighborOpacity: number; lineWidth: number
  size: number; offsetX: number; offsetY: number
  lightSize: number; lightOffset: number; glow: number; glowRadius: number; lightPulse: number
  scanWidth: number; scanStrength: number; touchStrength: number; touchDuration: number; holdDelay: number
  parallax: number; inertia: number
}

/** Approved fourth concept: the central figure starts inside a small matrix cell. */
export const defaultArchitectureSettings: ArchitectureSettings = {
  illustration: 'cell', guidanceVariant: 'junction', parallel: { ...defaultParallelSettings }, guidance: { ...defaultGuidanceSettings }, distance: { ...defaultDistanceSettings }, synchronization: { ...defaultSynchronizationSettings },
  theme: 'dark', motion: 'release', trigger: 'loop', touch: 'open', playing: true,
  frame: true, labels: true, neighbors: true, scanEnabled: false, touchEnabled: true, parallaxEnabled: false, fadeFigureFrame: false,
  color: '#E7E100', lightColor: '#FFF7BA', surfaceColor: '#0A0C05',
  cycle: 9, columns: 5, rows: 3, cellSize: 1, spread: 4, frameSpread: .65,
  startScale: .2, figureScale: .86, neighborOpacity: .4, lineWidth: 1,
  size: 1, offsetX: 0, offsetY: 0, lightSize: .55, lightOffset: 0,
  glow: .55, glowRadius: 6, lightPulse: 0, scanWidth: 6, scanStrength: .65,
  touchStrength: .65, touchDuration: 2.5, holdDelay: .32, parallax: 6, inertia: .18,
}
export const architectureBounds = {
  cycle: [4, 24, .5], columns: [3, 7, 2], rows: [3, 5, 2], cellSize: [.6, 1.25, .05],
  spread: [0, 18, .5], frameSpread: [0, 1.8, .05], startScale: [.1, .3, .01], figureScale: [.4, 1.2, .01],
  neighborOpacity: [0, 1, .01], lineWidth: [.35, 2.5, .05], size: [.6, 1.35, .01], offsetX: [-32, 32, 1], offsetY: [-24, 24, 1],
  lightSize: [.15, 2, .05], lightOffset: [-16, 24, 1], glow: [0, 1.5, .05], glowRadius: [0, 12, .25], lightPulse: [0, 1, .05],
  scanWidth: [1, 24, .5], scanStrength: [0, 2, .05], touchStrength: [0, 2, .05], touchDuration: [.6, 6, .1],
  holdDelay: [.18, 1, .02], parallax: [0, 18, .5], inertia: [.04, .8, .02],
} as const
export type ArchitectureNumber = keyof typeof architectureBounds
export const ARCHITECTURE_STORAGE_KEY = 'prince-architecture-cover-v1'

export function normalizeArchitectureSettings(raw: unknown): ArchitectureSettings {
  const result = { ...defaultArchitectureSettings, parallel: { ...defaultParallelSettings }, guidance: { ...defaultGuidanceSettings }, distance: { ...defaultDistanceSettings }, synchronization: { ...defaultSynchronizationSettings } }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return result
  const input = raw as Record<string, unknown>
  if (input.illustration === 'cell' || input.illustration === 'distance' || input.illustration === 'synchronization' || input.illustration === 'guidance') result.illustration = input.illustration
  result.distance = normalizeDistanceSettings(input.distance)
  result.synchronization = normalizeSynchronizationSettings(input.synchronization)
  result.guidance = normalizeGuidanceSettings(input.guidance)
  result.parallel = normalizeParallelSettings(input.parallel)
  if (input.guidanceVariant === 'junction' || input.guidanceVariant === 'parallel') result.guidanceVariant = input.guidanceVariant
  for (const key of Object.keys(architectureBounds) as ArchitectureNumber[]) {
    const value = input[key], [min, max] = architectureBounds[key]
    if (typeof value === 'number' && Number.isFinite(value)) result[key] = Math.min(max, Math.max(min, value))
  }
  result.columns = Math.min(7, Math.max(3, Math.round((result.columns - 3) / 2) * 2 + 3))
  result.rows = Math.min(5, Math.max(3, Math.round((result.rows - 3) / 2) * 2 + 3))
  for (const key of ['playing', 'frame', 'labels', 'neighbors', 'scanEnabled', 'touchEnabled', 'parallaxEnabled', 'fadeFigureFrame'] as const) {
    if (typeof input[key] === 'boolean') result[key] = input[key]
  }
  for (const key of ['color', 'lightColor', 'surfaceColor'] as const) {
    if (typeof input[key] === 'string' && /^#[\da-f]{6}$/i.test(input[key])) result[key] = input[key].toUpperCase()
  }
  if (input.theme === 'light' || input.theme === 'dark') result.theme = input.theme
  if (input.motion === 'release' || input.motion === 'wave' || input.motion === 'breathe') result.motion = input.motion
  if (input.trigger === 'loop' || input.trigger === 'tap') result.trigger = input.trigger
  if (input.touch === 'open' || input.touch === 'pulse') result.touch = input.touch
  return result
}

export function applyArchitectureTheme(value: ArchitectureSettings, theme: ArchitectureSettings['theme']): ArchitectureSettings {
  return { ...value, theme, ...(theme === 'light'
    ? { color: '#C74307', lightColor: '#FFF5C9', surfaceColor: '#F5D997' }
    : { color: '#E7E100', lightColor: '#FFF7BA', surfaceColor: '#0A0C05' }) }
}
export function serializeArchitecturePreset(settings: ArchitectureSettings) {
  return JSON.stringify({ version: 2, kind: 'architecture-cover', settings: normalizeArchitectureSettings(settings) }, null, 2)
}
export function parseArchitecturePreset(raw: string): ArchitectureSettings {
  const preset = JSON.parse(raw)
  const supported = preset?.version === 1 && preset?.kind === 'architecture-cell' || preset?.version === 2 && preset?.kind === 'architecture-cover'
  if (!supported || !preset.settings || typeof preset.settings !== 'object' || Array.isArray(preset.settings)) throw new Error('Invalid architecture preset')
  return normalizeArchitectureSettings(preset.settings)
}

export const architectureBody = 'M-11 14C-11-4 11-4 11 14C11 23 8 29 5 32V40C14 43 28 46 30 56L33 92H-33L-30 56C-28 46-14 43-5 40V32C-8 29-11 23-11 14Z'
export const architectureDetail = 'M-5 40L0 45 5 40M-23 62L-22 88M23 62L22 88'
export const architectureCorners = 'M121 51H136M152 51H167V63M167 89V103H152M136 103H121V89M121 63V51'
const clamp = (n: number) => Math.max(0, Math.min(1, n))
const mix = (a: number, b: number, n: number) => a + (b - a) * n
function smooth(a: number, b: number, t: number) { const n = clamp((t - a) / (b - a)); return n * n * (3 - 2 * n) }
export const architectureNumber = (n: number) => Number(n.toFixed(4))

export function architectureGrid(settings: ArchitectureSettings) {
  const cx = (settings.columns - 1) / 2, cy = (settings.rows - 1) / 2
  const gapX = Math.min(45, 236 / (settings.columns - 1)), gapY = Math.min(37, 106 / (settings.rows - 1))
  const cells = []
  for (let row = 0; row < settings.rows; row++) for (let column = 0; column < settings.columns; column++) {
    if (column === cx && row === cy) continue
    const dx = column - cx, dy = row - cy
    cells.push({ id: `${column}-${row}`, dx, dy, x: 144 + dx * gapX, y: 76 + dy * gapY, distance: Math.hypot(dx, dy) })
  }
  return cells
}

export function architectureAnimationFrame(seconds: number, settings: ArchitectureSettings, touchAge = Infinity) {
  const phase = settings.trigger === 'tap' ? (Number.isFinite(touchAge) ? clamp(touchAge / settings.touchDuration) : 0)
    : ((seconds % settings.cycle) + settings.cycle) % settings.cycle / settings.cycle
  const base = smooth(.16, .44, phase) * (1 - smooth(.76, .98, phase))
  const touchProgress = clamp(touchAge / settings.touchDuration)
  const touch = settings.touchEnabled && Number.isFinite(touchAge) && touchProgress < 1 ? Math.sin(Math.PI * touchProgress) ** 1.4 * settings.touchStrength : 0
  const motion = settings.motion === 'breathe' ? (.5 - .5 * Math.cos(phase * Math.PI * 2)) : base
  const q = clamp(motion + (settings.trigger === 'loop' && settings.touch === 'open' ? touch * .5 : 0))
  const personY = mix(66, 36, q), personScale = mix(settings.startScale, settings.figureScale, q)
  const cells = architectureGrid(settings).map(cell => {
    const arrival = cell.distance * .065, wave = settings.motion === 'wave'
      ? smooth(.16 + arrival, .35 + arrival, phase) * (1 - smooth(.63 + arrival, .85 + arrival, phase)) : 0
    const move = settings.motion === 'wave' ? wave : q
    return { ...cell, x: cell.x + cell.dx * move * settings.spread, y: cell.y + cell.dy * move * settings.spread,
      opacity: Math.min(1, settings.neighborOpacity * (1 - .28 * q) + wave * .35), wave }
  })
  const scanProgress = clamp((phase - .34) / .34)
  const frameVisibility = settings.fadeFigureFrame ? 1 - q : 1
  return {
    phase, q, cells, personY, personScale,
    frameScale: mix(.53 * settings.cellSize, 1, q) + q * settings.frameSpread, frameOpacity: (.7 - .4 * q) * frameVisibility,
    // The light follows the same throat landmark through every scale and mode.
    lightY: personY + (45 + settings.lightOffset) * personScale,
    lightOpacity: (.1 + .9 * q) * (1 - settings.lightPulse * .5 + settings.lightPulse * .5 * Math.cos(seconds * Math.PI * 2 / 2.8)) + touch * .2,
    scanY: -5 + scanProgress * 102, scanOpacity: settings.scanEnabled && scanProgress > 0 && scanProgress < 1 ? Math.sin(scanProgress * Math.PI) * settings.scanStrength : 0,
    rippleRadius: 8 + touchProgress * 108,
    rippleOpacity: settings.touch === 'pulse' ? Math.max(0, (1 - touchProgress) * touch * .5) : 0,
  }
}

export function architectureArtworkTransform(settings: ArchitectureSettings) {
  return `translate(${144 + settings.offsetX} ${78 + settings.offsetY}) scale(${settings.size}) translate(-144 -78)`
}

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

export const distanceCanvas = { width: 288, height: 200, artworkY: 14 } as const

// Keep the approved head, eye and torso. Only the formerly raised forearm is lowered.
export const distanceProfile = {
  "outline": "M87.88 12.00C89.38 11.72 92.23 11.95 92.97 12.00C93.70 12.05 94.69 12.24 95.39 12.48C96.09 12.73 97.87 13.44 98.53 13.94C99.19 14.43 100.09 15.30 100.23 16.11C100.36 16.93 99.47 18.96 99.50 19.74C99.53 20.53 100.34 21.39 100.47 22.16C100.59 22.94 100.54 25.25 100.47 25.79C100.39 26.34 99.66 26.94 99.74 27.49C99.82 28.04 101.07 30.46 101.19 30.88C101.32 31.29 101.45 31.98 101.19 32.33C100.94 32.68 99.54 33.12 99.26 33.54C98.98 33.96 99.37 34.76 99.26 35.23C99.15 35.71 98.61 36.20 98.53 36.68C98.45 37.16 98.60 39.23 98.53 39.59C98.47 39.94 98.14 40.41 97.81 40.56C97.47 40.70 95.96 41.07 95.14 41.04C94.33 41.01 91.82 40.31 91.51 40.31C91.21 40.31 90.87 40.74 90.79 41.04C90.71 41.34 89.08 45.08 89.82 46.61C90.56 48.13 94.08 50.11 95.63 50.96C97.17 51.82 100.50 52.56 101.19 52.90C101.89 53.23 102.65 53.99 103.13 54.59C103.61 55.20 104.44 56.56 104.82 57.50C105.20 58.43 105.68 60.00 105.79 61.13C105.90 62.25 105.89 65.78 105.79 67.18C105.70 68.57 104.95 70.38 105.07 71.77C104.90 81.30 101.90 91.80 103.13 101.78C103.40 102.69 105.02 105.78 105.55 107.59C106.08 109.40 108.09 118.07 108.45 119.93C108.82 121.80 109.09 124.33 109.18 126.22C109.27 128.12 109.44 132.50 109.18 135.18C108.92 137.85 108.07 143.02 107.24 146.31C106.41 149.60 103.85 155.89 103.37 158.17C102.89 160.44 103.41 164.24 103.13 165.91C102.85 167.59 101.42 169.55 101.19 171.24C100.97 172.92 101.01 181.60 100.47 186.00C99.93 190.40 97.13 204.72 96.84 206.81C96.55 208.90 96.57 213.28 96.60 213.83C96.63 214.38 96.94 215.12 97.32 215.52C97.71 215.92 103.29 220.91 104.10 221.57C104.91 222.24 106.03 223.11 107.00 223.51C107.97 223.90 109.95 224.03 110.63 224.23C111.32 224.43 112.40 224.83 112.81 225.20C113.22 225.58 113.54 226.47 113.54 226.90C113.54 227.32 113.16 227.87 112.81 228.11C112.46 228.34 111.32 228.78 110.63 228.83C109.95 228.88 105.03 229.07 102.65 228.83C100.26 228.59 96.25 227.34 93.93 227.14C91.62 226.93 86.72 227.39 86.19 227.38C85.66 227.37 84.94 227.15 84.50 226.90C84.05 226.64 83.42 226.18 83.29 225.69C83.15 225.19 83.04 223.45 83.29 222.54C83.53 221.63 85.65 217.14 86.19 214.80C86.73 212.45 86.88 209.22 86.92 206.81C86.95 204.40 86.87 199.27 86.43 196.16C86.00 193.06 84.24 188.02 84.01 186.00C83.78 183.97 84.03 181.21 84.50 179.22C84.97 177.24 88.19 168.33 88.37 167.61C88.54 166.89 87.90 165.93 87.88 165.19C87.87 164.45 88.34 156.29 88.13 152.84C87.92 149.40 89.87 141.75 86.43 141.47C82.99 141.19 83.12 149.49 82.08 152.36C81.03 155.23 79.35 160.95 78.93 162.04C78.51 163.13 77.14 165.21 76.99 165.43C76.85 165.64 76.39 165.68 76.27 165.91C76.15 166.14 74.24 170.75 73.85 171.48C73.46 172.21 72.34 172.85 72.15 173.66C71.97 174.46 70.11 187.46 69.73 189.14C69.36 190.83 68.31 192.91 67.56 194.47C66.81 196.02 64.23 200.44 63.20 202.70C62.17 204.95 60.69 209.23 60.30 210.44C59.90 211.65 59.44 213.32 59.33 214.55C59.22 215.79 59.68 217.93 59.57 218.67C59.46 219.41 58.44 220.10 58.36 220.85C58.28 221.59 58.82 224.40 58.84 225.20C58.87 226.00 58.78 227.38 58.60 227.86C58.42 228.34 57.84 228.82 57.39 229.07C56.95 229.33 56.01 229.13 55.70 229.56C55.39 229.99 55.78 231.16 55.46 231.74C55.13 232.31 53.97 233.16 53.52 233.43C53.07 233.70 52.35 233.90 51.83 233.91C51.30 233.93 44.95 233.79 44.08 233.67C43.21 233.55 41.85 232.96 41.42 232.46C40.99 231.96 41.12 230.70 41.18 230.28C41.24 229.86 41.60 229.37 41.90 229.07C42.20 228.77 44.62 227.03 45.53 225.93C46.45 224.83 47.66 222.24 47.95 221.81C48.24 221.39 49.02 221.10 49.16 220.60C49.31 220.11 49.10 218.02 49.41 216.97C49.71 215.93 51.08 214.37 51.34 213.10C51.60 211.83 52.35 204.98 52.55 201.49C52.75 197.99 52.76 186.17 53.04 183.82C53.31 181.47 54.40 178.43 55.46 176.32C56.51 174.20 59.73 170.60 61.02 167.85C62.31 165.09 63.68 160.84 64.17 157.68C64.66 154.53 64.86 144.03 65.38 139.78C65.89 135.52 67.70 128.92 68.04 125.74C68.38 122.56 67.85 117.04 68.04 115.09C68.23 113.15 69.10 110.65 69.73 108.80C70.37 106.95 72.28 103.26 72.64 101.78C72.99 100.30 72.74 98.02 72.64 96.70C72.54 95.38 72.09 93.04 71.91 92.34C71.73 91.65 71.32 90.77 70.94 90.17C70.56 89.56 67.26 85.03 66.59 83.87C65.92 82.72 64.96 79.89 64.89 79.76C64.83 79.63 64.47 79.63 64.41 79.76C64.35 79.89 63.71 82.53 63.20 83.63C62.69 84.74 60.37 88.31 60.05 89.20C59.73 90.09 59.96 91.41 60.05 92.34C60.15 93.28 61.05 96.56 61.02 98.39C61.00 100.23 59.93 107.37 59.81 109.77C59.69 112.16 59.52 115.96 60.05 117.75C60.59 119.55 63.01 121.09 63.68 122.84C64.36 124.58 64.82 129.76 64.89 130.34C64.97 130.91 64.93 132.07 64.89 132.27C64.85 132.48 64.61 132.73 64.41 132.76C64.21 132.79 63.51 132.72 63.20 132.52C62.89 132.31 62.38 131.75 62.23 131.31C62.08 130.86 61.83 128.41 61.75 128.16C61.67 127.91 61.08 127.42 61.02 127.68C60.96 127.93 60.50 130.92 60.78 132.27C61.06 133.63 62.86 136.83 62.96 137.11C63.05 137.40 62.91 137.85 62.72 138.08C62.52 138.31 62.07 138.60 61.75 138.57C61.42 138.53 60.58 138.06 60.30 137.84C60.01 137.62 59.89 137.05 59.57 136.87C59.25 136.70 58.16 136.67 57.63 136.39C57.10 136.11 55.29 134.71 54.97 134.45C54.65 134.20 54.22 133.83 54.00 133.48C53.79 133.13 53.28 131.98 53.04 131.31C52.79 130.64 52.39 129.64 52.31 128.89C52.23 128.13 52.26 124.78 52.31 124.05C52.36 123.31 52.79 122.37 52.79 121.63C52.79 120.89 52.67 117.53 52.31 115.82C51.95 114.11 49.24 104.76 48.92 103.48C48.61 102.19 48.30 100.44 48.20 99.12C48.10 97.80 48.02 95.38 48.20 93.80C48.37 92.21 49.40 88.40 49.65 86.05C49.89 83.70 49.60 80.01 49.89 77.58C50.18 75.15 51.25 70.86 51.58 69.60C51.91 68.33 52.83 66.77 53.04 65.48C53.25 64.19 52.92 60.95 53.28 59.19C53.64 57.43 54.80 54.79 55.46 53.62C56.12 52.46 57.60 50.90 58.36 50.24C59.12 49.57 60.37 48.87 61.26 48.54C62.16 48.22 63.94 48.18 64.41 48.06C64.88 47.93 65.44 47.58 65.86 47.33C66.28 47.08 74.05 42.72 75.30 41.52C76.55 40.33 77.12 37.33 77.48 36.20C77.83 35.07 78.39 33.50 78.20 32.33C78.02 31.16 76.06 26.59 75.78 25.31C75.51 24.03 75.71 21.64 75.78 20.95C75.86 20.27 76.15 19.36 76.51 18.78C76.87 18.19 78.29 16.48 78.93 15.87C79.57 15.26 80.54 14.53 81.35 14.18C82.16 13.83 86.39 12.28 87.88 12.00ZM97.08 17.32C97.03 16.87 98.17 18.05 98.53 17.81C98.89 17.57 98.68 16.77 98.53 16.36C98.38 15.95 97.96 15.39 97.56 15.15C97.17 14.90 95.51 14.18 94.66 13.94C93.81 13.69 92.64 13.43 91.76 13.45C90.87 13.47 86.79 13.75 85.22 14.18C83.66 14.61 81.11 16.11 80.38 16.60C79.66 17.09 78.84 18.18 78.45 18.78C78.05 19.37 77.59 20.25 77.48 20.95C77.37 21.66 77.22 23.86 77.48 25.07C77.74 26.27 79.13 28.78 79.41 29.91C79.70 31.04 79.87 32.64 79.66 33.78C79.44 34.92 77.62 40.37 77.24 41.28C76.85 42.19 75.51 43.75 75.30 43.94C75.09 44.14 74.59 43.81 74.33 43.94C74.08 44.08 72.87 45.22 72.15 45.64C71.44 46.05 67.32 47.49 66.83 48.30C66.34 49.11 70.37 49.64 69.49 49.99C68.61 50.35 64.39 49.58 63.20 49.75C62.01 49.93 60.52 50.71 59.57 51.45C58.62 52.18 57.54 53.53 56.91 54.59C56.27 55.65 55.50 57.72 55.21 58.71C54.93 59.69 54.75 61.07 54.73 62.09C54.71 63.12 54.98 68.71 54.97 68.87C54.97 69.03 54.56 68.77 54.49 68.63C54.42 68.48 54.57 68.02 54.49 67.90C54.41 67.78 54.06 67.77 54.00 67.90C53.95 68.04 52.89 71.09 52.55 72.50C52.21 73.91 51.76 76.21 51.58 77.82C51.40 79.44 51.10 85.42 51.10 85.57C51.10 85.71 51.49 85.68 51.58 85.57C51.67 85.45 51.95 84.47 52.07 84.36C52.18 84.24 52.35 84.68 52.31 84.84C52.27 85.00 50.83 88.95 50.62 90.17C50.40 91.38 50.65 94.05 50.62 94.28C50.58 94.51 49.91 94.29 49.89 94.52C49.87 94.75 49.83 98.44 50.13 100.09C50.44 101.73 54.16 116.45 54.49 119.21C54.82 121.96 53.50 127.52 53.52 128.40C53.54 129.28 54.39 130.78 54.73 131.06C55.07 131.35 54.91 129.74 54.97 129.61C55.04 129.48 55.40 129.48 55.46 129.61C55.52 129.74 57.05 134.26 57.15 134.45C57.25 134.65 57.88 134.67 57.88 134.45C57.88 134.23 57.26 132.95 57.15 132.27C57.04 131.59 57.11 130.01 57.15 129.85C57.19 129.70 57.57 129.95 57.63 130.10C57.69 130.25 58.71 133.96 59.09 134.69C59.46 135.42 60.89 136.54 61.02 136.63C61.16 136.72 61.32 136.30 61.26 136.15C61.20 136.00 60.27 134.86 60.05 134.21C59.84 133.56 59.57 132.02 59.57 131.06C59.57 130.11 59.99 127.51 60.05 127.19C60.12 126.87 60.30 126.39 60.54 126.22C60.78 126.06 61.24 126.11 61.51 126.22C61.77 126.34 62.12 126.66 62.23 126.95C62.34 127.24 62.82 130.69 63.44 131.31C64.06 131.92 63.83 129.26 63.68 128.40C63.54 127.54 62.72 124.02 61.99 122.59C61.26 121.17 58.99 120.03 58.60 118.48C58.21 116.93 58.31 109.47 58.36 108.07C58.41 106.68 58.99 104.87 59.09 103.48C59.19 102.08 59.10 98.11 59.09 97.91C59.07 97.71 58.75 97.28 58.60 97.43C58.46 97.57 58.69 98.26 58.60 98.39C58.51 98.53 58.16 98.31 58.12 98.15C58.08 97.99 57.92 95.42 57.63 94.28C57.35 93.14 55.90 89.39 55.70 88.47C55.50 87.55 55.12 84.58 55.70 85.33C56.27 86.07 57.84 90.71 58.12 91.62C58.40 92.53 58.56 94.61 58.60 94.76C58.65 94.92 59.08 95.17 59.09 95.01C59.10 94.84 58.91 91.14 58.84 90.89C58.78 90.64 58.34 91.52 58.12 91.38C57.90 91.23 58.00 90.67 58.12 90.41C58.23 90.14 60.61 85.72 61.51 83.63C62.41 81.54 63.49 78.52 64.17 76.37C64.85 74.22 66.04 69.39 66.10 69.11C66.17 68.83 66.23 68.32 66.10 68.14C65.97 67.97 65.50 68.22 65.38 68.14C65.26 68.06 65.28 67.77 65.38 67.66C65.48 67.55 67.21 66.14 67.80 65.48C68.39 64.82 69.11 63.86 69.49 63.06C69.88 62.26 70.27 59.51 70.94 58.95C71.61 58.39 71.11 61.00 70.94 61.85C70.77 62.71 69.70 64.56 69.73 65.00C69.77 65.44 70.86 64.45 71.19 64.76C71.51 65.06 72.55 67.41 73.36 68.39C74.18 69.36 76.53 71.49 77.24 72.02C77.94 72.54 79.04 73.05 79.90 73.23C80.76 73.40 85.32 73.69 85.46 73.71C85.61 73.73 85.61 74.18 85.46 74.19C85.32 74.21 80.42 74.54 79.41 74.44C78.41 74.33 77.09 73.81 76.27 73.23C75.44 72.64 73.68 71.03 72.88 69.84C72.08 68.64 71.93 65.75 70.94 65.24C69.96 64.73 68.24 66.16 67.80 67.18C67.36 68.19 65.56 75.73 65.62 77.58C65.68 79.43 67.35 81.55 68.28 83.15C69.21 84.75 72.60 89.21 73.36 90.89C74.13 92.58 74.41 95.43 74.57 96.94C74.74 98.46 74.94 100.54 74.57 102.02C74.21 103.50 72.32 106.96 71.67 108.80C71.02 110.64 70.26 113.30 69.98 115.09C69.69 116.89 69.73 120.98 69.73 121.14C69.74 121.30 70.19 121.22 70.22 121.38C70.25 121.54 70.32 122.92 70.22 123.56C70.11 124.21 67.72 135.37 67.07 140.50C66.43 145.63 65.67 159.70 65.62 160.10C65.57 160.51 64.80 160.69 64.65 161.07C64.51 161.46 64.07 163.98 63.68 165.19C63.30 166.40 61.96 169.86 61.75 170.27C61.53 170.68 60.81 170.86 60.54 171.24C60.26 171.61 58.56 174.22 57.88 175.59C57.19 176.96 55.96 179.63 55.46 181.40C54.95 183.17 54.60 185.62 54.49 187.45C54.37 189.28 54.59 193.89 54.49 196.65C54.39 199.40 53.98 205.97 53.76 208.02C53.54 210.07 52.84 213.83 52.55 214.80C52.26 215.76 50.97 217.43 50.86 217.70C50.74 217.97 50.63 218.49 50.86 218.67C51.09 218.84 51.69 218.39 51.83 218.43C51.97 218.46 51.90 218.79 51.83 218.91C51.75 219.03 47.30 226.15 46.74 226.90C46.18 227.64 44.43 228.71 44.32 228.83C44.22 228.95 44.40 229.30 44.57 229.32C44.73 229.33 47.39 229.05 47.71 229.07C48.04 229.09 48.99 229.46 48.68 229.56C48.37 229.65 46.06 229.64 45.29 229.80C44.53 229.96 43.05 230.63 42.87 230.77C42.69 230.91 42.93 231.36 43.11 231.49C43.30 231.63 44.11 231.91 44.57 231.98C45.02 232.04 47.93 232.23 48.20 232.22C48.46 232.21 48.76 231.74 48.92 231.74C49.08 231.74 49.00 232.19 49.16 232.22C49.32 232.25 51.28 232.31 51.83 232.22C52.37 232.13 53.22 231.70 53.52 231.49C53.82 231.29 54.14 230.87 54.25 230.53C54.35 230.18 54.40 228.28 54.73 227.38C55.06 226.48 56.41 224.82 56.67 223.99C56.92 223.16 56.49 221.82 56.67 221.09C56.84 220.36 57.75 219.65 57.88 218.91C58.00 218.17 57.74 215.09 57.88 213.83C58.01 212.57 58.44 210.92 58.84 209.71C59.24 208.51 60.90 203.90 61.99 201.49C63.08 199.08 66.06 193.65 66.59 192.53C67.12 191.41 67.78 189.87 68.04 188.66C68.30 187.45 70.70 174.74 70.70 173.66C70.70 172.58 68.28 175.91 68.04 176.08C67.80 176.24 66.98 176.35 67.07 176.08C67.16 175.80 68.33 173.97 69.01 173.17C69.68 172.37 71.63 170.96 72.40 169.78C73.17 168.61 74.03 165.56 74.09 165.43C74.15 165.30 74.47 165.52 74.57 165.43C74.68 165.33 75.84 164.13 76.27 163.49C76.70 162.85 77.21 161.84 77.48 161.07C77.75 160.31 79.37 154.58 80.38 151.88C81.40 149.17 84.80 141.76 86.19 137.84C87.58 133.92 89.86 125.38 90.06 124.53C90.26 123.68 90.21 122.48 90.06 121.63C89.91 120.77 88.88 117.92 88.85 117.51C88.82 117.10 89.64 118.11 89.82 118.48C90.00 118.85 91.17 122.16 91.27 122.35C91.38 122.54 91.80 122.45 92.00 122.35C92.19 122.25 94.76 120.90 95.63 120.17C96.50 119.44 97.60 117.55 98.05 117.27C98.50 116.99 97.81 118.50 97.56 118.96C97.32 119.43 96.38 120.81 95.87 121.38C95.36 121.96 94.59 122.67 93.93 123.08C93.28 123.49 91.64 123.49 91.27 124.29C90.91 125.09 90.30 130.23 89.82 132.03C89.34 133.83 87.62 135.98 87.64 137.84C87.66 139.70 89.89 151.85 90.06 153.81C90.23 155.77 89.61 158.38 89.58 160.35C89.55 162.31 89.83 170.28 89.82 170.51C89.81 170.74 89.25 170.23 89.09 170.27C88.94 170.31 88.90 170.60 88.85 170.75C88.81 170.91 86.25 179.46 85.95 181.40C85.65 183.34 85.85 186.00 86.19 187.93C86.53 189.87 88.07 192.94 88.37 195.19C88.66 197.45 88.67 203.92 88.61 206.33C88.55 208.73 88.38 211.96 87.88 214.31C87.38 216.67 85.40 221.67 85.22 222.30C85.04 222.93 84.84 224.03 84.98 224.48C85.12 224.92 85.73 225.40 86.19 225.44C86.65 225.49 95.05 225.50 96.84 225.69C98.62 225.87 100.87 226.89 102.65 227.14C104.42 227.39 108.11 227.42 108.94 227.38C109.76 227.34 111.35 226.84 111.60 226.65C111.85 226.47 111.17 226.03 110.87 225.93C110.58 225.83 107.93 225.40 107.24 225.20C106.56 225.00 105.63 224.67 105.07 224.23C104.50 223.80 96.38 218.76 94.90 215.76C93.42 212.77 94.97 207.95 95.39 204.63C95.80 201.32 98.70 185.54 99.02 183.09C99.33 180.65 99.26 175.03 99.26 174.87C99.25 174.70 98.83 175.26 98.77 175.11C98.72 174.95 98.63 173.90 98.77 173.41C98.91 172.93 100.81 168.56 101.19 166.64C101.58 164.71 101.44 160.27 101.44 160.10C101.43 159.94 100.91 160.02 100.95 159.86C101.00 159.71 104.18 150.87 104.82 148.73C105.47 146.59 106.12 143.63 106.52 141.47C106.91 139.31 107.43 136.41 107.49 134.21C107.54 132.01 107.23 123.98 107.00 121.63C106.78 119.27 106.11 116.18 105.55 113.88C104.99 111.59 102.93 104.82 102.89 104.69C102.84 104.55 102.46 104.55 102.40 104.69C102.35 104.82 101.79 107.54 101.68 107.83C101.57 108.12 100.95 108.87 100.95 108.56C100.95 108.25 101.94 102.96 101.68 100.57C101.42 98.18 99.27 92.53 99.02 90.65C98.76 88.77 99.50 86.25 99.50 84.36C99.50 82.46 99.19 75.83 99.02 75.16C98.84 74.50 96.96 74.51 96.84 74.44C96.71 74.37 96.70 73.99 96.84 73.95C96.98 73.92 99.06 74.25 99.74 73.71C100.43 73.17 101.18 71.43 101.44 70.32C101.70 69.22 101.78 66.93 101.68 65.48C101.57 64.03 100.71 60.57 100.71 60.16C100.71 59.75 101.51 60.75 101.68 61.13C101.84 61.50 102.92 64.43 103.13 65.72C103.34 67.01 103.18 69.48 103.13 70.08C103.08 70.68 102.86 71.46 102.65 72.02C102.43 72.57 101.58 74.22 101.44 74.44C101.29 74.65 100.72 74.66 100.71 74.92C100.70 75.18 101.23 80.48 101.19 82.66C101.40 87.80 100.50 91.00 101.68 96.00C102.10 91.30 103.85 79.15 103.61 72.26C103.53 70.39 104.39 64.07 104.34 62.58C104.29 61.08 103.62 58.82 103.13 57.74C102.64 56.65 101.58 55.28 100.71 54.59C99.84 53.91 98.42 53.30 97.32 53.14C96.23 52.98 93.44 53.27 92.48 53.38C91.52 53.50 89.75 54.19 89.34 54.11C88.92 54.02 89.66 53.04 90.06 52.90C90.46 52.76 94.90 53.64 94.90 52.17C94.90 50.70 90.18 48.62 90.06 48.54C89.94 48.46 89.63 48.41 89.58 48.54C89.53 48.68 89.53 50.86 89.09 51.20C88.66 51.55 88.45 50.06 88.37 49.51C88.29 48.96 88.71 46.82 88.37 46.36C88.03 45.91 86.77 48.12 86.92 47.57C87.06 47.03 90.24 39.98 90.30 39.10C90.37 38.23 88.19 38.28 87.64 37.89C87.10 37.51 85.53 36.07 86.19 36.20C86.85 36.33 91.29 38.50 92.48 38.86C93.67 39.22 96.39 39.35 96.60 39.35C96.80 39.35 97.04 39.06 97.08 38.86C97.12 38.66 96.96 37.66 97.08 37.17C97.20 36.67 97.93 35.24 98.05 34.75C98.16 34.25 97.77 33.48 98.05 33.05C98.33 32.63 99.92 32.53 99.98 31.84C100.05 31.16 98.67 29.03 98.53 27.73C98.39 26.43 99.23 24.16 99.02 22.65C98.80 21.13 97.13 17.78 97.08 17.32ZM71.91 50.24C72.22 50.27 83.53 52.08 84.01 52.17C84.49 52.27 85.10 52.57 85.46 52.90C85.83 53.22 86.93 54.18 86.43 54.35C85.94 54.52 84.78 53.55 84.01 53.38C83.25 53.21 76.44 52.12 75.54 51.93C74.64 51.74 72.92 51.09 72.64 50.96C72.36 50.83 71.61 50.20 71.91 50.24ZM93.21 84.84C93.24 84.64 93.68 85.12 93.69 85.33C93.70 85.53 93.64 94.18 93.69 94.76C93.74 95.35 94.56 95.88 94.66 96.46C94.76 97.04 95.21 99.23 94.42 99.12C93.62 99.01 93.22 96.91 92.97 96.22C92.71 95.52 92.47 94.54 92.48 93.80C92.50 93.06 93.18 85.05 93.21 84.84ZM94.90 164.46C95.28 165.14 95.00 168.22 95.14 169.06C95.28 169.90 95.98 170.88 96.11 171.72C96.25 172.56 96.14 174.95 96.11 175.11C96.09 175.27 95.67 175.02 95.63 174.87C95.58 174.71 95.75 173.83 95.63 173.41C95.50 173.00 94.12 170.00 93.93 169.30C93.75 168.60 93.79 167.59 93.93 166.88C94.08 166.17 94.52 163.78 94.90 164.46ZM82.56 41.04C82.55 40.88 83.00 41.13 83.04 41.28C83.09 41.44 83.43 44.36 83.77 45.64C84.11 46.92 85.88 51.46 85.95 52.17C86.02 52.89 84.61 51.10 84.25 50.48C83.89 49.86 83.45 48.48 83.29 47.57C83.12 46.67 82.57 41.20 82.56 41.04ZM90.30 209.96C91.13 209.25 90.58 212.63 90.55 213.59C90.51 214.54 90.06 216.47 90.06 216.73C90.06 216.99 90.49 217.20 90.55 217.46C90.60 217.71 90.91 218.69 90.55 218.91C90.18 219.13 89.59 218.48 89.34 218.18C89.08 217.89 88.91 217.36 88.85 216.97C88.79 216.59 88.73 215.61 88.85 215.04C88.97 214.47 89.48 210.67 90.30 209.96ZM78.45 104.44C78.58 104.50 80.94 105.88 81.59 106.38C82.25 106.88 83.05 107.65 83.53 108.32C84.01 108.98 85.86 112.22 85.95 112.43C86.04 112.64 85.32 112.29 85.22 112.19C85.12 112.09 85.32 111.81 85.22 111.70C85.12 111.60 78.55 105.03 78.45 104.93C78.35 104.82 78.31 104.38 78.45 104.44ZM66.35 165.67C66.56 165.46 66.64 166.34 66.59 166.64C66.53 166.93 66.03 169.13 65.62 169.54C65.21 169.95 65.51 168.18 65.62 167.61C65.73 167.04 66.13 165.88 66.35 165.67ZM56.91 226.90C57.00 226.71 57.20 226.08 57.15 225.93C57.10 225.77 56.74 226.02 56.67 226.17C56.59 226.32 56.36 227.19 56.42 227.38C56.49 227.57 56.82 227.08 56.91 226.90Z",
  "eye": "M94.6 26.12Q96.15 25.48 98.06 25.88L97.37 27.33Q95.96 26.94 94.6 26.12ZM95.2 24.88Q96.9 24.09 98.13 24.88Q96.9 24.55 95.2 24.88Z",
  "arm": "M105.3 72.8C107.2 79.3 109.7 87.5 111.2 96.3C112.5 106.8 112.7 117.5 115.1 125.8C115.8 128.4 118.6 130.8 119.1 133.5C119.4 135.1 118.7 135.8 117.9 134.8L115.8 131.4C115.3 134.6 117.3 139.7 117.4 142.9C117.5 144.5 116.4 145.1 115.6 143.1L113.2 136.2M115.5 143.2C115.8 145.8 114.5 146.5 113.6 143.7L111.3 136.3M113.6 143.5C113.8 145.8 112.5 145.9 111.7 143.4L109.9 136.8C109.4 134.1 109.8 130.3 110 127.3C109.2 117.9 106.4 107.4 104.8 101.3"
}

const distanceClamp = (n: number) => Math.max(0, Math.min(1, n))
export function distanceProfileThickness(width: number) {
  // A vector mask trims both edges continuously, including at subpixel widths.
  // feMorphology rounds small radii in the raster filter and can leave the outline unchanged.
  return { trim: Math.max(0, 1 - width) * 1.6, expand: Math.max(0, width - 1) * 1.6 }
}

export function distanceScanLighting(strength: number, softness: number) {
  // Strength above 1 adds luminous spill and a hot core instead of a clamped opacity.
  return {
    auraRadius: 1.1 + softness * .8 + strength * .65, auraGain: 1.8 + strength * .85,
    auraSpread: .2 + strength * .35, auraSmoothing: .25 + strength * .1,
    coreRadius: .2 + softness * .35, coreGain: 1.5 + strength * 1.25,
    whiteOpacity: Math.min(.95, strength * .35),
  }
}
const distanceSmooth = (a: number, b: number, value: number) => {
  const n = distanceClamp((value - a) / Math.max(.001, b - a))
  return n * n * (3 - 2 * n)
}

// Cross-sections locate the laser's contact point without changing the drawing.
const distanceProfileSections = [
  [16.3, 167, 168], [16.5, 161.75, 173], [17, 160, 175.75], [20, 151, 183.25], [23, 145.25, 186.5], [26, 142.25, 187.25],
  [32, 138, 185.75], [38, 137, 187.75], [44, 137.25, 187.75], [50, 139.5, 187],
  [56, 141.75, 189.5], [62, 142, 185], [68, 140.25, 183.75], [74, 138.25, 183.5],
  [77, 136.25, 167.5], [80, 132, 166.5], [83, 127, 165.75], [86, 122, 165.5],
  [89, 116.75, 167], [92, 106, 170.75], [95, 101.5, 175.5], [98, 98.5, 182],
  [101, 96, 190.5], [104, 94.5, 193.25], [110, 92, 196.75], [116, 90.75, 198.5],
  [122, 90.75, 198.75], [128, 90.25, 198.75], [134, 87.75, 197.75],
  [140, 86.25, 197.25], [146, 85, 200], [152, 84, 201.75],
  [155, 84, 202.75], [161, 84, 204.25], [167, 83.75, 206], [173, 83, 207.5],
  [179, 81.75, 208.75], [185, 80.75, 210], [191, 80.5, 211], [197, 81, 211.5],
  [203, 82, 212.25], [209, 83.5, 212.75], [215, 85.25, 213.25], [221, 87, 213.75],
  [227, 88.5, 214.5], [233, 89.75, 215.25], [239, 90, 216.25], [245, 89.25, 217.5],
  [251, 89, 219.25], [257, 89.25, 222.75], [263, 91.5, 226.25], [269, 96.5, 226.5],
  [275, 106.25, 221.75], [281, 115.75, 223], [287, 115.25, 223.25],
  [293, 115, 201.25], [299, 114.5, 199.5], [305, 114.25, 197.25],
  [311, 113.75, 195.25], [317, 113.25, 193.5], [323, 111.75, 193.25],
] as const

function distanceScanSection(y: number) {
  const first = distanceProfileSections[0], last = distanceProfileSections[distanceProfileSections.length - 1]
  if (y <= first[0]) return { left: first[1], right: first[2] }
  for (let index = 1; index < distanceProfileSections.length; index++) {
    const a = distanceProfileSections[index - 1], b = distanceProfileSections[index]
    if (y <= b[0]) {
      const mix = (y - a[0]) / (b[0] - a[0])
      return { left: a[1] + (b[1] - a[1]) * mix, right: a[2] + (b[2] - a[2]) * mix }
    }
  }
  return { left: last[1], right: last[2] }
}

/** Every stage keeps its requested duration; extend the loop instead of speeding up scanning. */
export function distanceTimeline(settings: DistanceSettings) {
  const cycle = Math.max(settings.cycle, minimumDistanceCycle(settings))
  const retreatStart = distanceRetreatStart(settings), retreatEnd = retreatStart + settings.retreatDuration
  const scanStart = retreatEnd + settings.scanDelay, scanEnd = scanStart + settings.scanDuration
  const returnStart = cycle - 1.55, returnEnd = cycle - .15
  return { cycle, retreatStart, retreatEnd, scanStart, scanEnd, returnStart, returnEnd }
}

export function distanceAnimationFrame(seconds: number, settings: ArchitectureSettings, touchAge = Infinity) {
  const d = settings.distance.voiceEnabled === undefined ? { ...defaultDistanceSettings, ...settings.distance } : settings.distance
  const timeline = distanceTimeline(d)
  const time = settings.trigger === 'tap'
    ? (Number.isFinite(touchAge) ? Math.max(0, Math.min(timeline.cycle, touchAge)) : 0)
    : (seconds >= 0 ? seconds % timeline.cycle : ((seconds % timeline.cycle) + timeline.cycle) % timeline.cycle)
  const phase = time / timeline.cycle
  const outward = distanceVoiceRetreat(time, d, timeline)
  const returning = distanceSmooth(timeline.returnStart, timeline.returnEnd, time)
  const separation = outward * (1 - returning)
  const power = distanceSmooth(.1, .9, time) * (1 - distanceSmooth(timeline.returnStart + .3, timeline.returnEnd, time))
  const flicker = 1 - d.pulse * (.14 + .08 * Math.sin(phase * 37) + .05 * Math.sin(phase * 61 + .7))
  const wave = d.mode === 'pulse' ? .6 + .4 * (.5 + .5 * Math.sin(phase * Math.PI * 8)) : 1
  const scanProgress = distanceClamp((time - timeline.scanStart) / d.scanDuration)
  const scanGate = time > timeline.scanStart && time < timeline.scanEnd
    ? distanceSmooth(0, .04, scanProgress) * (1 - distanceSmooth(.985, 1, scanProgress)) : 0
  const scanOpacity = d.scanEnabled && d.mode !== 'project' ? scanGate * Math.min(1, d.scanStrength) : 0
  const shift = separation * (d.figureShift ?? defaultDistanceSettings.figureShift), sourceX = 157 - separation * 60 * d.distance, sourceY = 88 - separation * d.rise
  const voice = distanceVoiceFrame(time, d, timeline, shift, sourceX, sourceY)
  const light = power * flicker * wave * (d.voiceEnabled && d.voiceDrivesMotion ? .8 + .5 * voice.response : 1)
  // Scan all the way beyond the actual card edge, including when the artwork is resized or moved.
  const visibleBottom = 78 + (distanceCanvas.height - distanceCanvas.artworkY - 78 - settings.offsetY) / settings.size
  const visibleRight = 144 + (distanceCanvas.width - 144 - settings.offsetX) / settings.size
  const scanFrom = 16 - d.scanWidth / 2 - 2
  // Reserve space for the brightest halo without changing the scan speed when brightness changes.
  const scanTo = visibleBottom + d.scanWidth / 2 + 32
  const scanY = scanFrom + scanProgress * (scanTo - scanFrom)
  const scanTop = scanY - d.scanWidth / 2, scanBottom = scanY + d.scanWidth / 2
  const section = distanceScanSection(scanY)
  const targetX = section.left + shift + .6, targetY = scanY
  const scanHit = scanY >= distanceProfileSections[0][0]
  // In empty space a ray continues out of view; it cannot stop at an imaginary head-sized box.
  const rayEndX = scanHit ? targetX : Math.max(visibleRight + 48, targetX + 48)
  const rayEndY = scanHit ? targetY : sourceY + (scanY - sourceY) * (rayEndX - sourceX) / Math.max(1, targetX - sourceX)
  const scanRay = `M${sourceX} ${sourceY}L${rayEndX} ${rayEndY}`
  const scanFront = scanHit ? `M${targetX} ${scanY}H${section.right + shift}` : ''
  const scanMask = `M${-144 + shift} ${scanTop}H${432 + shift}V${scanBottom}H${-144 + shift}Z`
  // Faint projection rays have fixed destinations on the image, independent of scan timing.
  const rays = [26, 58, 92, 126].map(y => {
    const rayY = Math.max(17, Math.min(148, 77 + (y - 77) * d.beamSpread))
    const contact = distanceScanSection(rayY)
    return `M${sourceX} ${sourceY}L${contact.right + shift} ${rayY}`
  })
  return {
    time, phase, separation, light, sourceX, sourceY, shift, scanProgress, scanOpacity, voice,
    scanY, scanFrom, scanTo, scanTop, scanBottom, targetX, targetY, scanHit, rayEndX, rayEndY, visibleBottom,
    projection: d.raysEnabled ? light * d.projection * distanceSmooth(0, .3, separation) : 0,
    profileOpacity: d.profileOpacity,
    planeOpacity: d.planeEnabled ? d.planeOpacity * (1 - .28 * separation) : 0,
    scanMask, scanRay, scanFront, rays,
    haloScale: d.lightSize * (1 + d.pulse * .1 * Math.sin(phase * 23) + voice.response * .1),
  }
}

export type CoverGestureOptions = {
  holdDelay: number; disabled?: boolean
  canStart?: (target: EventTarget | null) => boolean
  onHold: () => void; onRelease: () => void; onMove: (x: number, y: number) => void; onTap?: () => void
}
export type CoverGestureSession = {
  pointerId: number; x: number; y: number; lastX: number; lastY: number; started: number
  width: number; height: number; held: boolean; moved: boolean; target: HTMLElement
}
export function coverGestureIsTap(held: boolean, moved: boolean, elapsed: number, holdDelay: number, inside: boolean) {
  return !held && !moved && inside && elapsed < holdDelay * 1000
}
export function coverGestureMovement(dx: number, dy: number, width: number, height: number) {
  return { dragged: Math.hypot(dx, dy) > 10, x: Math.max(-1, Math.min(1, dx / Math.max(1, width * .3))), y: Math.max(-1, Math.min(1, dy / Math.max(1, height * .3))) }
}

/** A release opens the section only if the pointer never became a hold or a drag. */
export function useCoverGesture(options: CoverGestureOptions) {
  const latest = useRef(options); latest.current = options
  const session = useRef<CoverGestureSession | null>(null), timer = useRef(0), suppressClick = useRef(false)
  function clearTimer() { window.clearTimeout(timer.current); timer.current = 0 }
  function end() {
    const current = session.current
    if (!current) return
    session.current = null; clearTimer(); suppressClick.current = true
    latest.current.onRelease(); latest.current.onMove(0, 0)
    if (current.target.hasPointerCapture(current.pointerId)) current.target.releasePointerCapture(current.pointerId)
  }
  function hold(current: CoverGestureSession) {
    if (session.current !== current || current.held) return
    clearTimer(); current.held = true; latest.current.onHold()
  }
  useEffect(() => { if (options.disabled) end() }, [options.disabled])
  useEffect(() => {
    const cancel = () => { if (document.hidden) end() }
    document.addEventListener('visibilitychange', cancel)
    return () => { document.removeEventListener('visibilitychange', cancel); end() }
  }, [])
  return {
    onPointerDown(event: PointerEvent<HTMLElement>) {
      if (latest.current.disabled || event.button !== 0 || latest.current.canStart?.(event.target) === false) return
      if (!event.isPrimary) { end(); return }
      event.stopPropagation(); end(); suppressClick.current = false
      const target = event.currentTarget, bounds = target.getBoundingClientRect()
      const current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, lastX: event.clientX, lastY: event.clientY,
        started: performance.now(), width: bounds.width, height: bounds.height, held: false, moved: false, target }
      session.current = current; target.setPointerCapture(event.pointerId)
      timer.current = window.setTimeout(() => hold(current), latest.current.holdDelay * 1000)
    },
    onPointerMove(event: PointerEvent<HTMLElement>) {
      const current = session.current
      if (!current || current.pointerId !== event.pointerId) return
      event.stopPropagation(); current.lastX = event.clientX; current.lastY = event.clientY
      const movement = coverGestureMovement(event.clientX - current.x, event.clientY - current.y, current.width, current.height)
      current.moved ||= movement.dragged
      if (current.moved) hold(current)
      if (current.held) latest.current.onMove(movement.x, movement.y)
    },
    onPointerUp(event: PointerEvent<HTMLElement>) {
      const current = session.current
      if (!current || current.pointerId !== event.pointerId) return
      event.stopPropagation()
      const bounds = current.target.getBoundingClientRect()
      const inside = event.clientX >= bounds.left && event.clientX <= bounds.right && event.clientY >= bounds.top && event.clientY <= bounds.bottom
      const moved = current.moved || coverGestureMovement(event.clientX - current.x, event.clientY - current.y, current.width, current.height).dragged
      const tap = coverGestureIsTap(current.held, moved, performance.now() - current.started, latest.current.holdDelay, inside)
      end()
      if (tap && !latest.current.disabled) latest.current.onTap?.()
    },
    onPointerCancel(event: PointerEvent<HTMLElement>) { if (session.current?.pointerId === event.pointerId) { event.stopPropagation(); end() } },
    onLostPointerCapture(event: PointerEvent<HTMLElement>) { if (event.target === event.currentTarget && session.current?.pointerId === event.pointerId) end() },
    onContextMenu(event: MouseEvent<HTMLElement>) { if (session.current) event.preventDefault() },
    onClick(event: MouseEvent<HTMLElement>) {
      if (latest.current.canStart?.(event.target) === false) return
      event.stopPropagation()
      if (latest.current.disabled || (event.detail !== 0 && suppressClick.current)) { event.preventDefault(); return }
      latest.current.onTap?.()
    },
  }
}

export function DistanceCover({ settings = defaultArchitectureSettings, active = true, language = 'ru', presentation = 'cover', replayKey = 0, touchKey = 0, controller, onClick, interactive = true }: ArchitectureCoverProps) {
  const ru = language === 'ru', d = normalizeDistanceSettings(settings.distance), id = `distance-${useId().replace(/\W/g, '')}`
  const svg = useRef<SVGSVGElement>(null), [interaction, setInteraction] = useState(0)
  const state = useRef({ time: 0, age: Infinity, replayKey, touchKey, interaction: 0, holding: false })
  const aim = useRef({ x: 0, y: 0, targetX: 0, targetY: 0 }), wakeGesture = useRef<() => void>(() => {})
  const initial = distanceAnimationFrame(0, settings)
  const hold = () => {
    state.current.holding = true
    if (settings.touchEnabled || settings.trigger === 'tap') setInteraction(value => value + 1)
  }
  const release = () => { state.current.holding = false }
  const move = (x: number, y: number) => { aim.current.targetX = x; aim.current.targetY = y; wakeGesture.current() }
  const gesture = useCoverGesture({ holdDelay: settings.holdDelay, disabled: !interactive || !active,
    onHold: hold, onRelease: release, onMove: move, onTap: () => { if (settings.trigger === 'tap') setInteraction(value => value + 1); onClick?.() } })
  useImperativeHandle(controller, () => ({ hold, release, move, svg: () => {
    if (!svg.current) return ''
    const copy = svg.current.cloneNode(true) as SVGSVGElement
    copy.setAttribute('xmlns', 'http://www.w3.org/2000/svg'); copy.setAttribute('width', '288'); copy.setAttribute('height', '200')
    copy.removeAttribute('class'); copy.removeAttribute('aria-hidden'); copy.setAttribute('role', 'img')
    const title = document.createElementNS('http://www.w3.org/2000/svg', 'title')
    title.textContent = ru ? 'Между собой и образом · Выставь дистанцию' : 'Between self and image · Set a distance'
    copy.prepend(title)
    for (const node of [copy, ...copy.querySelectorAll('*')]) for (const attr of Array.from(node.attributes)) if (attr.name.startsWith('data-')) node.removeAttribute(attr.name)
    return `<?xml version="1.0" encoding="UTF-8"?>\n${new XMLSerializer().serializeToString(copy)}`
  } }), [settings, ru])

  useEffect(() => {
    const element = svg.current
    if (!element) return
    const node = element
    const clock = state.current
    const timeline = distanceTimeline(d)
    const heldAge = timeline.scanEnd + .25
    const interactionDuration = settings.trigger === 'tap' ? timeline.cycle : settings.touchDuration
    if (clock.replayKey !== replayKey) { clock.time = 0; clock.age = Infinity; clock.replayKey = replayKey }
    if (clock.touchKey !== touchKey || clock.interaction !== interaction) {
      clock.age = 0; clock.touchKey = touchKey; clock.interaction = interaction
      if (settings.trigger === 'loop') clock.time = 0
    }
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const select = <T extends SVGElement>(selector: string) => node.querySelector<T>(selector)!
    const person = select<SVGGElement>('[data-distance-person]'), base = select<SVGGElement>('[data-distance-base]')
    const plane = select<SVGGElement>('[data-distance-plane]'), light = select<SVGGElement>('[data-distance-source]')
    const halo = select<SVGGElement>('[data-distance-halo]'), flare = select<SVGGElement>('[data-distance-flare]')
    const beam = select<SVGGElement>('[data-distance-beam]'), beamGlow = select<SVGPathElement>('[data-distance-beam-glow]')
    const projection = select<SVGGElement>('[data-distance-projection]')
    const scanRay = select<SVGPathElement>('[data-distance-scan-ray]'), scanFront = select<SVGPathElement>('[data-distance-scan-front]')
    const gradient = select<SVGLinearGradientElement>('[data-distance-gradient]')
    const scanGradient = select<SVGLinearGradientElement>('[data-distance-scan-gradient]')
    const rays = Array.from(node.querySelectorAll<SVGPathElement>('[data-distance-ray]'))
    const band = select<SVGPathElement>('[data-distance-band]'), scan = select<SVGGElement>('[data-distance-scan]')
    const scanFilters = Array.from(node.querySelectorAll<SVGFilterElement>('[data-distance-scan-filter]'))
    const voice = select<SVGGElement>('[data-distance-voice]'), mouth = select<SVGCircleElement>('[data-distance-mouth]')
    const voiceWaves = Array.from(node.querySelectorAll<SVGPathElement>('[data-distance-voice-wave]'))
    const auraGain = select<SVGFEFuncAElement>('[data-distance-aura-gain]'), coreGain = select<SVGFEFuncAElement>('[data-distance-core-gain]')
    const scanWhite = select<SVGGElement>('[data-distance-scan-white]'), scanLight = distanceScanLighting(d.scanStrength, d.scanBlur)
    const parallax = select<SVGGElement>('[data-distance-parallax]')
    let frame = 0, last = 0
    function draw(dt: number) {
      if (active && !media.matches) {
        if (settings.playing) clock.time += dt
        clock.age += dt
        if (clock.holding && Number.isFinite(clock.age)) clock.age = Math.min(clock.age, heldAge)
      }
      const motion = distanceAnimationFrame(clock.time, settings, clock.age)
      node.dataset.distancePhase = String(architectureNumber(motion.phase))
      node.dataset.distanceTime = String(architectureNumber(motion.time))
      node.dataset.scanProgress = String(architectureNumber(motion.scanProgress))
      node.dataset.scanY = String(architectureNumber(motion.scanY))
      node.dataset.scanFrom = String(architectureNumber(motion.scanFrom)); node.dataset.scanTo = String(architectureNumber(motion.scanTo))
      node.dataset.scanHit = String(motion.scanHit)
      node.dataset.voiceLevel = String(architectureNumber(motion.voice.level))
      node.dataset.voiceResponse = String(architectureNumber(motion.voice.response))
      person.setAttribute('transform', `translate(${architectureNumber(motion.shift)} 0)`)
      base.setAttribute('opacity', String(motion.profileOpacity)); plane.setAttribute('opacity', String(motion.planeOpacity))
      light.setAttribute('transform', `translate(${architectureNumber(motion.sourceX)} ${architectureNumber(motion.sourceY)})`)
      light.setAttribute('opacity', String(motion.light))
      halo.setAttribute('transform', `scale(${architectureNumber(motion.haloScale)})`)
      flare.setAttribute('transform', `scale(${d.lightSize}) rotate(${architectureNumber(motion.phase * 18 - 9)})`)
      projection.setAttribute('opacity', String(motion.projection))
      beam.setAttribute('opacity', String(motion.scanOpacity))
      beamGlow.setAttribute('d', motion.scanRay)
      scanRay.setAttribute('d', motion.scanRay); scanFront.setAttribute('d', motion.scanFront)
      gradient.setAttribute('x1', String(motion.sourceX)); gradient.setAttribute('y1', String(motion.sourceY))
      gradient.setAttribute('x2', String(motion.rayEndX)); gradient.setAttribute('y2', String(motion.rayEndY))
      rays.forEach((ray, index) => ray.setAttribute('d', motion.rays[index]))
      band.setAttribute('d', motion.scanMask); band.setAttribute('transform', `translate(${-motion.shift} 0)`)
      scanGradient.setAttribute('y1', String(motion.scanTop)); scanGradient.setAttribute('y2', String(motion.scanBottom))
      scanFilters.forEach(filter => { filter.setAttribute('y', String(motion.scanTop - 64)); filter.setAttribute('height', String(d.scanWidth + 128)) })
      scan.setAttribute('opacity', String(motion.scanOpacity))
      auraGain.setAttribute('slope', String(scanLight.auraGain * motion.voice.scanGain))
      coreGain.setAttribute('slope', String(scanLight.coreGain * motion.voice.scanGain))
      scanWhite.setAttribute('opacity', String(Math.min(.95, scanLight.whiteOpacity * motion.voice.scanGain)))
      voice.setAttribute('transform', `translate(${architectureNumber(motion.voice.mouthX)} ${motion.voice.mouthY}) rotate(${architectureNumber(motion.voice.angle)})`)
      voiceWaves.forEach((path, index) => {
        const wave = motion.voice.waves[index % distanceVoiceCapacity]
        path.setAttribute('d', wave.path); path.setAttribute('opacity', String(wave.opacity)); path.setAttribute('stroke-width', String(wave.width))
      })
      mouth.setAttribute('r', String(.45 + motion.voice.level * .35))
      mouth.setAttribute('opacity', String(motion.voice.level * d.voiceOpacity * .7))
      const point = aim.current, factor = media.matches ? 1 : 1 - Math.exp(-Math.min(dt, .05) / settings.inertia)
      point.x += ((settings.parallaxEnabled && !media.matches ? point.targetX * settings.parallax : 0) - point.x) * factor
      point.y += ((settings.parallaxEnabled && !media.matches ? point.targetY * settings.parallax * .55 : 0) - point.y) * factor
      parallax.setAttribute('transform', `translate(${architectureNumber(point.x)} ${architectureNumber(point.y)})`)
    }
    function tick(now: number) {
      frame = 0
      if (!active || document.hidden || media.matches) return
      const dt = last ? Math.min(.05, (now - last) / 1000) : 0
      last = now; draw(dt)
      const point = aim.current, moving = settings.parallaxEnabled && (Math.abs(point.targetX * settings.parallax - point.x) > .01 || Math.abs(point.targetY * settings.parallax * .55 - point.y) > .01)
      if ((settings.playing && settings.trigger === 'loop') || clock.age < interactionDuration || moving) frame = requestAnimationFrame(tick)
    }
    function wake() {
      cancelAnimationFrame(frame); frame = 0; last = 0; draw(0)
      if (active && !document.hidden && !media.matches) frame = requestAnimationFrame(tick)
    }
    function pointerWake() { if (!frame && active && !document.hidden && !media.matches) { last = 0; frame = requestAnimationFrame(tick) } }
    wakeGesture.current = pointerWake
    document.addEventListener('visibilitychange', wake); media.addEventListener('change', wake)
    wake()
    return () => { cancelAnimationFrame(frame); wakeGesture.current = () => {}; document.removeEventListener('visibilitychange', wake); media.removeEventListener('change', wake) }
  }, [settings, active, replayKey, touchKey, interaction])

  const thickness = distanceProfileThickness(d.profileWidth), scanLight = distanceScanLighting(d.scanStrength, d.scanBlur)
  const profile = <g transform="translate(-18 -8) scale(2.05)" fill="currentColor" stroke="none" fillRule="evenodd">
    <path data-distance-outline="" d={distanceProfile.outline} mask={thickness.trim > 0 ? `url(#${id}-profile-line)` : undefined} stroke={thickness.expand > 0 ? 'currentColor' : 'none'} strokeWidth={thickness.expand}/>
    <path data-distance-eye="" d={distanceProfile.eye}/>
    <path data-distance-arm="" d={distanceProfile.arm} fill="none" stroke="currentColor" strokeWidth={d.profileWidth * 1.4}/>
  </g>
  const scanProfile = <g mask={`url(#${id}-scan-window)`}>{profile}</g>
  return <button type="button" className="architecture-cover" data-illustration="distance" data-theme={settings.theme} data-presentation={presentation} tabIndex={interactive ? undefined : -1}
    aria-label={ru ? 'Архитектура наблюдения · Выставь дистанцию' : 'Observation architecture · Set a distance'}
    style={{ '--architecture-color': settings.color, '--architecture-bg': settings.theme === 'dark' ? '#000000' : '#FAE6AD' } as CSSProperties} {...gesture}>
    {presentation === 'cover' && settings.frame && <svg className="architecture-frame" viewBox="0 0 288 200" preserveAspectRatio="none" aria-hidden="true"><path d="M.5 .5H270L287.5 18V181L269 199.5H.5Z" fill="none" stroke={settings.color} strokeOpacity=".38"/></svg>}
    <svg ref={svg} className="architecture-artwork" viewBox="0 0 288 200" fill="none" color={settings.color} stroke={settings.color} strokeWidth={d.profileWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <defs>
        <mask id={`${id}-profile-line`} maskUnits="userSpaceOnUse" x="30" y="0" width="120" height="250"><path data-distance-line-weight="" d={distanceProfile.outline} fill="white" fillRule="evenodd" stroke="black" strokeWidth={thickness.trim}/></mask>
        <clipPath id={`${id}-card-clip`} clipPathUnits="userSpaceOnUse"><rect data-distance-card-mask="" x="0" y="0" width="288" height="200"/></clipPath>
        <filter id={`${id}-glow`} x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation={d.glowRadius}/></filter>
        <filter id={`${id}-beam-blur`} filterUnits="userSpaceOnUse" x="-144" y="-192" width="768" height="768"><feGaussianBlur stdDeviation=".9"/></filter>
        <filter id={`${id}-bloom`} x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation=".65"/></filter>
        <filter id={`${id}-scan-aura`} data-distance-scan-filter="" filterUnits="userSpaceOnUse" x="-144" y={initial.scanTop - 64} width="576" height={d.scanWidth + 128} colorInterpolationFilters="sRGB"><feMorphology operator="dilate" radius={scanLight.auraSpread}/><feGaussianBlur stdDeviation={scanLight.auraRadius}/><feComponentTransfer><feFuncA data-distance-aura-gain="" type="linear" slope={scanLight.auraGain}/></feComponentTransfer><feGaussianBlur stdDeviation={scanLight.auraSmoothing}/></filter>
        <filter id={`${id}-scan-core`} data-distance-scan-filter="" filterUnits="userSpaceOnUse" x="-144" y={initial.scanTop - 64} width="576" height={d.scanWidth + 128} colorInterpolationFilters="sRGB"><feGaussianBlur stdDeviation={scanLight.coreRadius}/><feComponentTransfer><feFuncA data-distance-core-gain="" type="linear" slope={scanLight.coreGain}/></feComponentTransfer></filter>
        <filter id={`${id}-voice-glow`} filterUnits="userSpaceOnUse" x="-200" y="-200" width="400" height="400"><feGaussianBlur stdDeviation={.6 + d.voiceGlow * .4}/></filter>
        <radialGradient id={`${id}-source`}><stop stopColor={settings.lightColor} stopOpacity=".9"/><stop offset=".13" stopColor={settings.lightColor} stopOpacity=".75"/><stop offset=".4" stopColor={settings.lightColor} stopOpacity=".19"/><stop offset="1" stopColor={settings.lightColor} stopOpacity="0"/></radialGradient>
        <linearGradient id={`${id}-beam`} data-distance-gradient="" gradientUnits="userSpaceOnUse" x1="157" y1="88" x2="185" y2="76"><stop stopColor={settings.lightColor} stopOpacity=".65"/><stop offset=".45" stopColor={settings.lightColor} stopOpacity=".32"/><stop offset="1" stopColor={settings.lightColor} stopOpacity=".85"/></linearGradient>
        <linearGradient id={`${id}-scan-softness`} data-distance-scan-gradient="" gradientUnits="userSpaceOnUse" x1="0" y1={initial.scanTop} x2="0" y2={initial.scanBottom}><stop stopColor="black"/><stop offset=".25" stopColor="white"/><stop offset=".75" stopColor="white"/><stop offset="1" stopColor="black"/></linearGradient>
        <linearGradient id={`${id}-edge`} data-distance-card-edge="" gradientUnits="userSpaceOnUse" x1="0" y1={200 - Math.max(.001, d.edgeFade)} x2="0" y2="200"><stop stopColor="white"/><stop offset="1" stopColor={d.edgeFade > 0 ? 'black' : 'white'}/></linearGradient>
        <mask id={`${id}-soft-edge`} maskUnits="userSpaceOnUse" x="0" y="0" width="288" height="200"><rect x="0" y="0" width="288" height="200" fill={`url(#${id}-edge)`} stroke="none"/></mask>
        <mask id={`${id}-scan-window`} maskUnits="userSpaceOnUse" x="-144" y="-128" width="576" height="768"><path data-distance-band="" d={initial.scanMask} fill={`url(#${id}-scan-softness)`} stroke="none"/></mask>
      </defs>
      <g clipPath={`url(#${id}-card-clip)`}><g mask={`url(#${id}-soft-edge)`}><g transform={`translate(0 ${distanceCanvas.artworkY})`}><g data-distance-parallax=""><g transform={architectureArtworkTransform(settings)}>
        <g data-distance-plane="" opacity={initial.planeOpacity} strokeWidth=".55"><path d="M126 15H210L228 33V130H115V26M126 15L136 23M210 15V26M115 130L126 120"/></g>
        <g data-distance-projection="" opacity="0" stroke={settings.lightColor} strokeWidth=".35"><g opacity=".17">{[0, 1, 2, 3].map(index => <path key={index} data-distance-ray=""/>)}</g></g>
        <g data-distance-beam="" opacity="0" stroke={settings.lightColor}>
          <path data-distance-beam-glow="" stroke={`url(#${id}-beam)`} strokeWidth={1.6 + Math.min(4, d.scanWidth * .14)} filter={`url(#${id}-beam-blur)`}/>
          <path data-distance-scan-ray="" stroke={`url(#${id}-beam)`} strokeWidth=".65"/>
          <path data-distance-scan-front="" strokeWidth=".4" opacity=".18"/>
        </g>
        <g data-distance-person="">
          <g data-distance-base="" opacity={initial.profileOpacity}>{profile}</g>
          <g data-distance-scan="" opacity="0" color={settings.lightColor}>
            <g filter={`url(#${id}-scan-aura)`} opacity=".85">{scanProfile}</g>
            <g filter={`url(#${id}-scan-core)`}>{scanProfile}</g>
            {scanProfile}<g data-distance-scan-white="" color="#FFFFFF" opacity={scanLight.whiteOpacity}>{scanProfile}</g>
          </g>
        </g>
        <g data-distance-voice="" opacity={d.voiceEnabled ? 1 : 0} stroke={d.voiceColor} fill="none">
          <g filter={`url(#${id}-voice-glow)`} opacity={d.voiceGlow * .7}>{Array.from({ length: distanceVoiceCapacity }, (_, index) => <path key={index} data-distance-voice-wave=""/>)}</g>
          <g>{Array.from({ length: distanceVoiceCapacity }, (_, index) => <path key={index} data-distance-voice-wave=""/>)}</g>
          <circle data-distance-mouth="" r=".45" opacity="0" fill={d.voiceColor} stroke="none"/>
        </g>
        <g data-distance-source="" transform="translate(157 88)" opacity="0" stroke="none" fill={settings.lightColor}>
          <g data-distance-halo=""><circle r="29" fill={`url(#${id}-source)`} filter={`url(#${id}-glow)`} opacity={d.glow}/><circle r="18" fill={`url(#${id}-source)`}/></g>
          <g data-distance-flare="" filter={`url(#${id}-bloom)`}><ellipse rx="12" ry=".6" opacity=".42"/><ellipse rx=".7" ry="6" opacity=".23"/><circle r="3.4" opacity=".85"/></g>
          <circle r={1.35 * d.lightSize}/>
        </g>
      </g></g></g></g></g>
    </svg>
    {presentation === 'cover' && settings.labels && <>
      <span className="architecture-serial">01 /</span>
      <span className="architecture-footer"><strong>{ru ? <>Архитектура<br/>Наблюдения</> : <>Observation<br/>Architecture</>}</strong><small>{ru ? 'ВЫСТАВЬ ДИСТАНЦИЮ' : 'SET A DISTANCE'}</small></span>
      <svg className="architecture-arrow" viewBox="0 0 24 24" fill="none" stroke={settings.color} strokeWidth="1" aria-hidden="true"><path d="M5 19L19 5M7 5h12v12"/></svg>
    </>}
  </button>
}

type SynchronizationPoint = [number, number]
type SynchronizationPalette = { ink: string; warm: string }
function synchronizationSelect(root: ParentNode, selector: string): SVGElement {
  const element = root.querySelector<SVGElement>(selector)
  if (!element) throw new Error('Missing synchronization layer: ' + selector)
  return element
}

/** SVG layers ported from the approved Live Matrix concept. No React updates per frame. */
function createLiveMatrix(svg: SVGSVGElement, id: string, palette: SynchronizationPalette) {
  const clamp=(v: number,a=0,b=1)=>Math.min(b,Math.max(a,v));
  const ease=(a: number,b: number,t: number)=>{const q=clamp((t-a)/(b-a));return q*q*(3-2*q);};
  const attr=(el: Element,key: string,value: string | number)=>el.setAttribute(key,typeof value==='number'?value.toFixed(3):value);
  const poly=(points: readonly (readonly number[])[])=>`M${points.map(([x,y])=>`${x.toFixed(3)} ${y.toFixed(3)}`).join('L')}`;
  const order=[[4,0],[3,0],[3,1],[3,2],[2,2],[1,2],[1,3],[1,4],[0,4]];
  const centers: { r: number; c: number; x: number; y: number; step: number }[]=[],routeIndices=order.map(([r,c])=>r*5+c);
  for(let r=0;r<5;r++)for(let c=0;c<5;c++)centers.push({r,c,x:144+(c-r)*23,y:35+(c+r)*10,step:order.findIndex(p=>p[0]===r&&p[1]===c)});
  const outerY=21*10/23,innerY=15*10/23;
  const tiles=centers.map(({r,c,x,y},i)=>`<g class="matrix-tile" data-index="${i}" data-row="${r}" data-col="${c}" opacity="0"><path class="matrix-top" d="M${x-21} ${y}L${x} ${y-outerY}L${x+21} ${y}L${x} ${y+outerY}Z" fill="currentColor" fill-opacity=".035"/><path d="M${x-21} ${y}v4l21 ${outerY} 21 ${-outerY}v-4M${x} ${y+outerY}v4" opacity=".22"/><path class="matrix-inset" d="M${x-15} ${y}l15 ${-innerY} 15 ${innerY}-15 ${innerY}Z" stroke-width=".45" opacity=".2"/></g>`);
  const backgroundTiles=tiles.filter((_,i)=>centers[i].step<0).join(''),platformTiles=tiles.filter((_,i)=>centers[i].step>=0).join('');
  svg.innerHTML=`<defs><radialGradient id="${id}-energy"><stop stop-color="${palette.warm}" stop-opacity=".8"/><stop offset=".16" stop-color="${palette.ink}" stop-opacity=".32"/><stop offset="1" stop-color="${palette.ink}" stop-opacity="0"/></radialGradient><filter id="${id}-bloom" x="-150%" y="-150%" width="400%" height="400%"><feGaussianBlur stdDeviation="3"/></filter></defs><g class="matrix-system"><g class="matrix-foundation" opacity="0"><path d="M39 102L144 147 251 101M34 70h9m-4-4v8M251 67h9m-4-4v8" opacity=".22"/></g>${backgroundTiles}</g><g class="matrix-platforms">${platformTiles}<path class="matrix-route" stroke="${palette.warm}" opacity="0"/></g><g class="matrix-source" data-energy="" opacity="0"><circle r="15" fill="url(#${id}-energy)" stroke="none"/><circle r="4" fill="${palette.warm}" stroke="none" opacity=".45" filter="url(#${id}-bloom)"/><circle r="1.45" fill="${palette.warm}" stroke="none"/><path d="M-5 0H5M0-2.5V2.5" stroke="${palette.warm}" opacity=".25" stroke-width=".55"/></g>`;
  const tilesEl=centers.map((_,i)=>synchronizationSelect(svg,`[data-index="${i}"]`)),tops=tilesEl.map(el=>synchronizationSelect(el,'.matrix-top')),insets=tilesEl.map(el=>synchronizationSelect(el,'.matrix-inset'));
  const foundation=synchronizationSelect(svg,'.matrix-foundation'),system=synchronizationSelect(svg,'.matrix-system'),platforms=synchronizationSelect(svg,'.matrix-platforms'),route=synchronizationSelect(svg,'.matrix-route'),source=synchronizationSelect(svg,'.matrix-source');
  const applyBrightness=(el: SVGElement,value: number)=>{el.style.opacity=String(Math.min(1,value/100));el.style.filter=value>100?`brightness(${value/100})`:'none';};
  let lastBrightness: number | undefined, lastPlatformBrightness: number | undefined, lastStroke: number | undefined, lastAmount: number | undefined; let points: number[][] = [];
  return (t: number,settings: SynchronizationSettings)=>{
    const amount=clamp(settings.amount,.5,12),brightness=clamp(settings.brightness??100,0,200),platformBrightness=clamp(settings.platformBrightness??100,0,200);
    if(brightness!==lastBrightness){applyBrightness(system,brightness);lastBrightness=brightness;}
    if(platformBrightness!==lastPlatformBrightness){applyBrightness(platforms,platformBrightness);lastPlatformBrightness=platformBrightness;}
    if(settings.stroke!==lastStroke){svg.style.strokeWidth=String(settings.stroke);lastStroke=settings.stroke;}
    const elevation=3.5*amount;
    // A fixed isometric path: moving platforms never steer the light.
    if(amount!==lastAmount){points=routeIndices.map(i=>[centers[i].x,centers[i].y-elevation]);lastAmount=amount;}
    const fade=1-ease(.91,.995,t),ignition=ease(.06,.14,t),progress=clamp((t-.16)/.54);
    const travelled=progress*(order.length-1);
    centers.forEach((cell,i)=>{
      const isPlatform=cell.step>=0;
      // Settle before the light crosses the platform edge (0.45 cell from its center).
      const rise=!isPlatform?0:cell.step===0?ease(.005,.055,t):ease(cell.step-1.10,cell.step-.50,travelled);
      const visible=!isPlatform?ease(.70+(cell.r+4-cell.c)*.008,.765+(cell.r+4-cell.c)*.008,t):cell.step===0?ease(.085,.155,t):ease(cell.step-.65,cell.step-.15,travelled);
      const height=rise*elevation;
      attr(tilesEl[i],'transform',`translate(0 ${(-height).toFixed(3)})`);
      attr(tilesEl[i],'opacity',visible*fade*(isPlatform?.94:.62));
      attr(tops[i],'fill-opacity',isPlatform?.14:.035);
      attr(insets[i],'opacity',isPlatform?.61:.14);
    });
    const segment=Math.min(order.length-2,Math.floor(travelled)),fraction=travelled-segment;
    const from=points[segment],to=points[segment+1];
    const position=[from[0]+(to[0]-from[0])*fraction,from[1]+(to[1]-from[1])*fraction];
    // Both the visible trail and light use this exact, unchanging centerline.
    attr(route,'d',poly([...points.slice(0,segment+1),position]));
    attr(route,'opacity',ignition*fade*.65);
    attr(foundation,'opacity',ease(.76,.84,t)*fade);
    attr(source,'transform',`translate(${position[0].toFixed(3)} ${position[1].toFixed(3)})`);
    attr(source,'opacity',ignition*fade);
    svg.dataset.phase=t.toFixed(4);
  };
}

export function createSynchronizedMatrix(svg: SVGSVGElement, id: string, palette: SynchronizationPalette) {
  const drawWalk=createLiveMatrix(svg,id,palette),ns='http://www.w3.org/2000/svg';
  const clamp=(v: number,a=0,b=1)=>Math.min(b,Math.max(a,v)),mix=(a: number,b: number,p: number)=>a+(b-a)*p;
  const ease=(a: number,b: number,t: number)=>{const p=clamp((t-a)/(b-a));return p*p*(3-2*p);};
  const attr=(el: Element,key: string,value: string | number)=>el.setAttribute(key,typeof value==='number'?value.toFixed(3):value);
  const poly=(points: readonly (readonly number[])[])=>`M${points.map(([x,y])=>`${x.toFixed(3)} ${y.toFixed(3)}`).join('L')}`;
  const brightness=(el: SVGElement,value: number)=>{el.style.opacity=String(Math.min(1,value/100));el.style.filter=value>100?`brightness(${value/100})`:'none';};
  const system=synchronizationSelect(svg,'.matrix-system'),platforms=synchronizationSelect(svg,'.matrix-platforms'),source=synchronizationSelect(svg,'.matrix-source'),route=synchronizationSelect(svg,'.matrix-route'),foundation=synchronizationSelect(svg,'.matrix-foundation');
  const tiles=[...svg.querySelectorAll<SVGElement>('.matrix-tile')],camera=document.createElementNS(ns,'g'),remaining=document.createElementNS(ns,'g');
  camera.setAttribute('class','matrix-camera');remaining.setAttribute('class','matrix-unsynchronized');
  svg.insertBefore(camera,system);camera.append(remaining);remaining.append(system,platforms);
  const project=(x: number,y: number): SynchronizationPoint=>[144+(x-y)*23,25+(x+y)*10];
  const corners=[project(0,0),project(5,0),project(5,5),project(0,5)];
  const order=[[4,0],[3,0],[3,1],[3,2],[2,2],[1,2],[1,3],[1,4],[0,4]];
  const timing={arrival:.32,revealEnd:.365,lowerStart:.385,lowerEnd:.465,syncStart:.465,syncEnd:.585,liftStart:.605,liftEnd:.70,projectStart:.72,projectEnd:.77,fadeStart:.94,fadeEnd:.999};
  const routeStart=.16*timing.arrival/.70,routeDuration=timing.arrival-routeStart;
  const planeRatio=10/23,waveOrigin=[236,75],waveReach=Math.max(...corners.map(([x,y])=>Math.hypot(x-waveOrigin[0],(y-waveOrigin[1])/planeRatio)))+18;
  const defs=synchronizationSelect(svg,'defs');
  defs.insertAdjacentHTML('beforeend',`<linearGradient id="${id}-trail" class="matrix-trail-gradient" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="1" y2="0"><stop stop-color="${palette.warm}" stop-opacity="0"/><stop offset=".25" stop-color="${palette.warm}" stop-opacity=".04"/><stop offset=".6" stop-color="${palette.warm}" stop-opacity=".22"/><stop offset=".85" stop-color="${palette.warm}" stop-opacity=".55"/><stop offset="1" stop-color="${palette.warm}"/></linearGradient><linearGradient id="${id}-projection" class="matrix-projection-gradient" gradientUnits="userSpaceOnUse" x1="144" y1="25" x2="144" y2="129"><stop stop-color="${palette.warm}" stop-opacity=".34"/><stop offset=".14" stop-color="${palette.ink}" stop-opacity=".21"/><stop offset=".64" stop-color="${palette.ink}" stop-opacity=".065"/><stop offset="1" stop-color="${palette.ink}" stop-opacity="0"/></linearGradient><radialGradient id="${id}-projection-pool"><stop stop-color="${palette.warm}" stop-opacity=".75"/><stop offset=".35" stop-color="${palette.ink}" stop-opacity=".4"/><stop offset="1" stop-color="${palette.ink}" stop-opacity="0"/></radialGradient><radialGradient id="${id}-projected-lines" gradientUnits="userSpaceOnUse" cx="144" cy="75" r="112" gradientTransform="translate(0 40.5) scale(1 .46)"><stop stop-color="${palette.warm}"/><stop offset=".5" stop-color="${palette.warm}" stop-opacity=".6"/><stop offset="1" stop-color="${palette.ink}" stop-opacity="0"/></radialGradient><filter id="${id}-projection-soft" x="-25%" y="-40%" width="150%" height="180%"><feGaussianBlur stdDeviation="1.8"/></filter><clipPath id="${id}-projection-floor"><path d="${poly(corners)}Z"/></clipPath>`);
  const trailGradient=synchronizationSelect(defs,'.matrix-trail-gradient'),projectionGradient=synchronizationSelect(defs,'.matrix-projection-gradient');
  const waveTransform=`translate(0 ${75*(1-planeRatio)}) scale(1 ${planeRatio})`;
  defs.insertAdjacentHTML('beforeend',`<radialGradient id="${id}-sync-reveal-gradient" class="matrix-sync-reveal-gradient" gradientUnits="userSpaceOnUse" cx="236" cy="75" r=".001" gradientTransform="${waveTransform}"><stop stop-color="white"/><stop class="matrix-sync-reveal-feather" offset="0" stop-color="white"/><stop offset="1" stop-color="white" stop-opacity="0"/></radialGradient><radialGradient id="${id}-sync-remaining-gradient" class="matrix-sync-remaining-gradient" gradientUnits="userSpaceOnUse" cx="236" cy="75" r=".001" gradientTransform="${waveTransform}"><stop stop-color="white" stop-opacity="0"/><stop class="matrix-sync-remaining-feather" offset="0" stop-color="white" stop-opacity="0"/><stop offset="1" stop-color="white"/></radialGradient><mask id="${id}-sync-reveal" maskUnits="userSpaceOnUse" x="0" y="0" width="288" height="160" style="mask-type:alpha"><rect width="288" height="160" fill="url(#${id}-sync-reveal-gradient)"/></mask><mask id="${id}-sync-remaining" maskUnits="userSpaceOnUse" x="0" y="0" width="288" height="160" style="mask-type:alpha"><rect width="288" height="160" fill="url(#${id}-sync-remaining-gradient)"/></mask>`);
  const revealGradient=synchronizationSelect(defs,'.matrix-sync-reveal-gradient'),remainingGradient=synchronizationSelect(defs,'.matrix-sync-remaining-gradient');
  const revealFeather=synchronizationSelect(defs,'.matrix-sync-reveal-feather'),remainingFeather=synchronizationSelect(defs,'.matrix-sync-remaining-feather');
  route.setAttribute('stroke',`url(#${id}-trail)`);
  const projection=document.createElementNS(ns,'g');projection.setAttribute('class','matrix-projection');projection.setAttribute('opacity','0');
  projection.innerHTML=`<path class="matrix-projection-volume" fill="url(#${id}-projection)" stroke="none" filter="url(#${id}-projection-soft)"/><path class="matrix-projection-core" fill="url(#${id}-projection)" stroke="none" opacity=".65" filter="url(#${id}-projection-soft)"/>`;
  svg.insertBefore(projection,camera);
  const volume=synchronizationSelect(projection,'.matrix-projection-volume'),core=synchronizationSelect(projection,'.matrix-projection-core');
  const guides=document.createElementNS(ns,'g');guides.setAttribute('class','matrix-projection-guides');guides.setAttribute('opacity','0');
  guides.innerHTML=corners.map(()=>`<path fill="none" stroke="${palette.warm}" stroke-width=".65" stroke-dasharray="2.2 4" stroke-linecap="round"/>`).join('');
  svg.insertBefore(guides,source);
  const lines=[];
  for(let i=0;i<=5;i++){lines.push([project(i,0),project(i,5)]);lines.push([project(0,i),project(5,i)]);}
  const mesh=lines.map(points=>`<path d="${poly(points)}"/>`).join('');
  const unified=document.createElementNS(ns,'g');unified.setAttribute('class','matrix-unified');
  unified.setAttribute('mask',`url(#${id}-sync-reveal)`);
  unified.innerHTML=`<g class="matrix-unified-level"><path d="${poly(corners)}Z" fill="currentColor" fill-opacity=".025" stroke="none"/><g class="matrix-projection-pool" opacity="0" clip-path="url(#${id}-projection-floor)"><ellipse cx="144" cy="75" rx="114" ry="49" fill="url(#${id}-projection-pool)" stroke="none"/></g><g class="matrix-unified-lines">${mesh}</g><g class="matrix-projected-lines" opacity="0" stroke="url(#${id}-projected-lines)" stroke-width="1.1">${mesh}</g><path d="M29 75v4l115 50 115-50v-4M144 125v4" opacity=".28"/></g>`;
  camera.append(unified);
  const pulse=document.createElementNS(ns,'g');pulse.setAttribute('class','matrix-sync-pulse');
  pulse.innerHTML=`<g clip-path="url(#${id}-projection-floor)"><ellipse class="matrix-sync-wave matrix-sync-wave-bloom" cx="236" cy="75" rx="0" ry="0" fill="none" stroke="${palette.warm}" stroke-width="4" opacity=".48" filter="url(#${id}-bloom)"/><ellipse class="matrix-sync-wave matrix-sync-wave-edge" cx="236" cy="75" rx="0" ry="0" fill="none" stroke="${palette.warm}" stroke-width="1.15"/></g>`;
  camera.append(pulse);
  const waveEllipses=[...pulse.querySelectorAll<SVGElement>('.matrix-sync-wave')];
  const pool=synchronizationSelect(unified,'.matrix-projection-pool'),projectedLines=synchronizationSelect(unified,'.matrix-projected-lines');
  const sourceCircles=[...source.querySelectorAll<SVGElement>('circle')];
  const trailTiles=order.map(([r,c],step)=>{const tile=synchronizationSelect(svg,`[data-index="${r*5+c}"]`);return{top:synchronizationSelect(tile,'.matrix-top'),inset:synchronizationSelect(tile,'.matrix-inset'),birth:routeStart+step/8*routeDuration};});
  return(t: number,settings: SynchronizationSettings)=>{
    const arriving=t>=timing.arrival,baseTime=arriving?.85:t*.70/timing.arrival;
    drawWalk(baseTime,settings);
    const fade=1-ease(timing.fadeStart,timing.fadeEnd,t),appearance=ease(timing.arrival,timing.revealEnd,t),lower=ease(timing.lowerStart,timing.lowerEnd,t);
    const sync=clamp((t-timing.syncStart)/(timing.syncEnd-timing.syncStart)),join=ease(timing.lowerEnd-.025,timing.syncStart+.01,t);
    const rise=ease(timing.liftStart,timing.liftEnd,t),zoom=rise,scale=1-clamp(settings.distance,0,35)/100*zoom;
    const elevation=3.5*clamp(settings.amount,.5,12),height=elevation*(1-lower),finalBrightness=clamp(settings.brightness??100,0,200);
    const platformBrightness=clamp(settings.platformBrightness??75,0,200),syncGlow=clamp(settings.syncGlow,0,2);
    const elapsed=synchronizationTimeAtPhase(t,settings),trailDuration=settings.trailDuration;
    const routeStartTime=synchronizationTimeAtPhase(routeStart,settings),routeDurationTime=synchronizationTimeAtPhase(timing.arrival,settings)-routeStartTime;
    // The gradient moves beyond the endpoint after arrival, so old light decays in place.
    const trailHead=52+184*(elapsed-routeStartTime)/routeDurationTime,trailSpan=184/routeDurationTime*trailDuration;
    attr(trailGradient,'x1',trailHead-trailSpan);attr(trailGradient,'x2',trailHead);
    trailTiles.forEach(({top,inset,birth},step)=>{
      const igniting=ease(step===0?.04:birth-.022,birth,t),age=Math.max(0,elapsed-synchronizationTimeAtPhase(birth,settings));
      const heat=igniting*(1-ease(0,trailDuration,age));
      attr(top,'fill-opacity',.035+.105*heat);attr(inset,'opacity',.14+.47*heat);
    });
    brightness(system,settings.initialBrightness);
    brightness(platforms,platformBrightness);
    brightness(unified.firstElementChild as SVGElement,finalBrightness);
    attr(camera,'transform',`translate(144 ${(75+12*zoom).toFixed(3)}) scale(${scale.toFixed(5)}) translate(-144 -75)`);
    // One continuous wave reveals the assembled surface; its inverse removes the old tiles.
    const radius=Math.max(.001,waveReach*sync),feather=clamp((radius-settings.waveSoftness)/radius,0,.9999);
    attr(revealGradient,'r',radius);attr(remainingGradient,'r',radius);
    attr(revealFeather,'offset',feather);attr(remainingFeather,'offset',feather);
    remaining.setAttribute('mask',t>=timing.syncStart?`url(#${id}-sync-remaining)`:'none');
    attr(unified,'opacity',(t>=timing.syncStart?1:0)*fade);
    const wavePower=ease(timing.syncStart,timing.syncStart+.008,t)*(1-ease(timing.syncEnd-.012,timing.syncEnd+.012,t))*clamp(syncGlow*1.5,0,2);
    attr(pulse,'opacity',wavePower*fade*(settings.waveEnabled?1:0));
    waveEllipses.forEach(el=>{attr(el,'rx',radius-0.001);attr(el,'ry',(radius-0.001)*planeRatio);});
    if(arriving){
      for(const tile of tiles){
        const isPlatform=tile.parentNode===platforms,row=Number(tile.dataset.row),col=Number(tile.dataset.col),x=144+(col-row)*23,y=35+(col+row)*10;
        const cellHeight=isPlatform?height:0,growth=mix(1,23/21,join);
        attr(tile,'transform',`translate(0 ${(-cellHeight).toFixed(3)}) translate(${x} ${y}) scale(${growth.toFixed(5)}) translate(${-x} ${-y})`);
        attr(tile,'opacity',(isPlatform?.94:appearance)*fade);
      }
      attr(foundation,'opacity',appearance*.5*(1-join)*fade);
      const points=order.map(([r,c])=>[144+(c-r)*23,35+(c+r)*10-height]);
      attr(route,'d',poly(points));attr(route,'opacity',.65*(1-join)*fade);
      const lift=clamp(settings.observerHeight??62,30,76)*rise;
      const x=144+(236-144)*scale*(1-rise),y=75-height*scale+12*zoom-lift;
      attr(source,'transform',`translate(${x.toFixed(3)} ${y.toFixed(3)}) scale(${(1+.16*rise).toFixed(4)})`);
      attr(source,'opacity',fade);
    }
    // The filled light volume starts only after the source has reached the center and stopped.
    const projectionPhase=ease(timing.projectStart,timing.projectEnd,t),breath=1+settings.projectionPulse*Math.sin((elapsed-synchronizationTimeAtPhase(timing.projectStart,settings))*Math.PI*2/2.8);
    const projectionPower=projectionPhase*settings.projectionGlow*breath*(settings.projectionEnabled?1:0);
    const lightPosition=(source as SVGGElement).transform.baseVal.consolidate()!.matrix;
    const screen=([x,y]: SynchronizationPoint): SynchronizationPoint=>[144+(x-144)*scale,75+(y-75)*scale+12*zoom];
    const screenCorners=corners.map(screen),[,right,front,left]=screenCorners,centerY=75+12*zoom;
    const apex=[lightPosition.e,lightPosition.f];
    attr(projectionGradient,'x1',apex[0]);attr(projectionGradient,'y1',apex[1]);
    attr(projectionGradient,'x2',144);attr(projectionGradient,'y2',front[1]);
    attr(volume,'d',`${poly([apex,left,front,right])}Z`);
    attr(core,'d',`${poly([apex,[144-25*scale,centerY],[144,centerY+20*scale],[144+25*scale,centerY]])}Z`);
    const guidePower=ease(.04,.4,rise)*(settings.projectionEnabled?1-ease(timing.projectStart,timing.projectEnd-.005,t):1);
    attr(guides,'opacity',guidePower*settings.guideOpacity*fade*(settings.guidesEnabled?1:0));
    [...guides.children].forEach((el,i)=>{attr(el,'d',poly([apex,screenCorners[i]]));attr(el,'stroke-dashoffset',-(elapsed-synchronizationTimeAtPhase(timing.liftStart,settings))*3);});
    attr(projection,'opacity',projectionPower*fade);
    attr(pool,'opacity',projectionPower*.24);attr(projectedLines,'opacity',projectionPower*.62);
    const confirmation=ease(timing.syncStart,timing.syncStart+.01,t)*(1-ease(timing.syncStart+.025,timing.syncStart+.055,t))*syncGlow;
    const auraRadius=Math.min(15+11*projectionPhase*breath+8*confirmation,Math.max(6,(apex[1]-2)/(1+.16*rise)));
    attr(sourceCircles[0],'r',auraRadius); attr(sourceCircles[0],'opacity',Math.min(1,settings.glow));
    attr(sourceCircles[1],'r',(4+2.2*projectionPhase*breath+1.5*confirmation)*settings.lightSize); attr(sourceCircles[1],'opacity',Math.min(1,settings.glow*.75));
    attr(sourceCircles[2],'r',(1.45+.4*projectionPhase*breath)*settings.lightSize);
    route.style.display=settings.trailEnabled?'':'none';
    waveEllipses.forEach((el,i)=>attr(el,'stroke-width',settings.waveWidth*(i===0?3.5:1)));
    svg.dataset.elapsed=elapsed.toFixed(4);
    svg.dataset.phase=t.toFixed(4);
    svg.dataset.stage=t<timing.arrival?'route':t<timing.lowerStart?'matrix-25':t<timing.syncStart?'descending':t<timing.liftStart?'synchronizing':t<timing.liftEnd?'distance':t<timing.projectStart?'guides':t<timing.fadeStart?'projection':'fade';
    svg.dataset.synchronization=sync.toFixed(4);
    svg.dataset.distance=rise.toFixed(4);
    svg.dataset.projection=projectionPhase.toFixed(4);
  };
}

export function SynchronizationCover({ settings = defaultArchitectureSettings, active = true, language = 'ru', presentation = 'cover', replayKey = 0, touchKey = 0, controller, onClick, interactive = true }: ArchitectureCoverProps) {
  const ru = language === 'ru', id = `synchronization-${useId().replace(/\W/g, '')}`
  const svg = useRef<SVGSVGElement>(null), scene = useRef<SVGSVGElement>(null), parallax = useRef<SVGGElement>(null)
  const [interaction, setInteraction] = useState(0)
  const clock = useRef({ time: 0, replayKey, touchKey, interaction: 0, started: false, settings: normalizeSynchronizationSettings(settings.synchronization) })
  const aim = useRef({ x: 0, y: 0, targetX: 0, targetY: 0 }), wakeGesture = useRef<() => void>(() => {})
  const hold = () => { if (settings.touchEnabled || settings.trigger === 'tap') setInteraction(value => value + 1) }
  const release = () => {}
  const move = (x: number, y: number) => { aim.current.targetX = x; aim.current.targetY = y; wakeGesture.current() }
  const gesture = useCoverGesture({ holdDelay: settings.holdDelay, disabled: !interactive || !active,
    onHold: hold, onRelease: release, onMove: move, onTap: () => { onClick?.() } })

  useImperativeHandle(controller, () => ({ hold, release, move, svg: () => {
    if (!svg.current) return ''
    const copy = svg.current.cloneNode(true) as SVGSVGElement
    copy.setAttribute('xmlns', 'http://www.w3.org/2000/svg'); copy.setAttribute('width', '288'); copy.setAttribute('height', '160')
    copy.removeAttribute('class'); copy.removeAttribute('aria-hidden'); copy.setAttribute('role', 'img')
    const title = document.createElementNS('http://www.w3.org/2000/svg', 'title')
    title.textContent = ru ? 'Интенсив · Полная синхронизация' : 'Intensive · Full synchronization'; copy.prepend(title)
    for (const node of [copy, ...copy.querySelectorAll('*')]) for (const attr of Array.from(node.attributes)) if (attr.name.startsWith('data-')) node.removeAttribute(attr.name)
    return `<?xml version="1.0" encoding="UTF-8"?>\n${new XMLSerializer().serializeToString(copy)}`
  } }), [settings, ru])

  useEffect(() => {
    const node = scene.current, root = svg.current, offset = parallax.current
    if (!node || !root || !offset) return
    const s = normalizeSynchronizationSettings(settings.synchronization), state = clock.current
    const repeat = settings.trigger === 'loop' && s.repeat
    // Preserve the current stage when changing its duration or the visual controls.
    const oldPhase = synchronizationPhase(state.time, state.settings, settings.trigger === 'loop' && state.settings.repeat)
    state.time = synchronizationTimeAtPhase(oldPhase, s); state.settings = s
    if (state.replayKey !== replayKey || state.touchKey !== touchKey || state.interaction !== interaction) {
      state.time = 0; state.started = true; state.replayKey = replayKey; state.touchKey = touchKey; state.interaction = interaction
    }
    const render = createSynchronizedMatrix(node, id, { ink: settings.color, warm: settings.lightColor })
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    let frame = 0, last = 0, visible = true
    const canPlay = () => active && visible && !document.hidden && !media.matches
    const advancing = () => settings.playing && (settings.trigger === 'loop' || state.started) && (repeat || state.time < synchronizationDuration(s))
    function draw(dt: number) {
      if (canPlay() && advancing()) state.time += dt
      const phase = media.matches ? .9 : synchronizationPhase(state.time, s, repeat)
      render(phase, s)
      root!.dataset.synchronizationPhase = String(phase)
      root!.dataset.synchronizationTime = String(state.time)
      const point = aim.current, factor = media.matches ? 1 : 1 - Math.exp(-dt / settings.inertia)
      const x = settings.parallaxEnabled && !media.matches ? point.targetX * settings.parallax : 0
      const y = settings.parallaxEnabled && !media.matches ? point.targetY * settings.parallax * .55 : 0
      point.x += (x - point.x) * factor; point.y += (y - point.y) * factor
      if (!settings.parallaxEnabled) { point.x = 0; point.y = 0 }
      offset!.setAttribute('transform', `translate(${point.x.toFixed(3)} ${point.y.toFixed(3)})`)
      return Math.abs(x - point.x) + Math.abs(y - point.y) > .01
    }
    function tick(now: number) {
      frame = 0
      if (!canPlay()) return
      const dt = last ? Math.min(.05, (now - last) / 1000) : 0
      last = now
      const moving = draw(dt)
      if (advancing() || moving) frame = requestAnimationFrame(tick)
    }
    function wake() {
      cancelAnimationFrame(frame); frame = 0; last = 0; draw(0)
      if (canPlay()) frame = requestAnimationFrame(tick)
    }
    const observer = new IntersectionObserver(entries => { visible = entries[0]?.isIntersecting ?? false; wake() })
    observer.observe(root)
    wakeGesture.current = wake
    document.addEventListener('visibilitychange', wake); media.addEventListener('change', wake)
    wake()
    return () => {
      cancelAnimationFrame(frame); observer.disconnect(); wakeGesture.current = () => {}
      document.removeEventListener('visibilitychange', wake); media.removeEventListener('change', wake)
    }
  }, [settings, active, replayKey, touchKey, interaction, id])

  return <button type="button" className="architecture-cover" data-illustration="synchronization" data-theme={settings.theme} data-presentation={presentation} tabIndex={interactive ? undefined : -1}
    aria-label={ru ? 'Архитектура наблюдения · Полная синхронизация' : 'Observation architecture · Full synchronization'}
    style={{ '--architecture-color': settings.color, '--architecture-bg': settings.theme === 'dark' ? '#000000' : '#FAE6AD' } as CSSProperties} {...gesture}>
    {presentation === 'cover' && settings.frame && <svg className="architecture-frame" viewBox="0 0 288 200" preserveAspectRatio="none" aria-hidden="true"><path d="M.5 .5H270L287.5 18V181L269 199.5H.5Z" fill="none" stroke={settings.color} strokeOpacity=".38"/></svg>}
    <svg className="architecture-artwork" ref={svg} viewBox="0 0 288 160" fill="none" color={settings.color} stroke={settings.color} strokeWidth={settings.synchronization.stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <g ref={parallax}><g transform={architectureArtworkTransform(settings)}><svg ref={scene} width="288" height="160" viewBox="0 0 288 160" overflow="visible"/></g></g>
    </svg>
    {presentation === 'cover' && settings.labels && <>
      <span className="architecture-serial">01 /</span>
      <span className="architecture-footer"><strong>{ru ? <>Архитектура<br/>Наблюдения</> : <>Observation<br/>Architecture</>}</strong><small>{ru ? 'ИНТЕНСИВ · СИНХРОНИЗАЦИЯ' : 'INTENSIVE · SYNCHRONIZATION'}</small></span>
      <svg className="architecture-arrow" viewBox="0 0 24 24" fill="none" stroke={settings.color} strokeWidth="1" aria-hidden="true"><path d="M5 19L19 5M7 5h12v12"/></svg>
    </>}
  </button>
}

export type ArchitectureCoverHandle = { svg: () => string; hold: () => void; release: () => void; move: (x: number, y: number) => void }
export type ArchitectureCoverProps = {
  settings?: ArchitectureSettings; active?: boolean; language?: 'ru' | 'en'; presentation?: 'cover' | 'artwork'
  replayKey?: number; touchKey?: number; controller?: Ref<ArchitectureCoverHandle>; onClick?: () => void; interactive?: boolean
}

/** One SVG animation loop. The React tree is updated only when settings change. */
export function ArchitectureCover(props: ArchitectureCoverProps) {
  if (props.settings?.illustration === 'guidance') return props.settings.guidanceVariant === 'parallel' ? <ParallelCover {...props}/> : <GuidanceCover {...props}/>
  if (props.settings?.illustration === 'synchronization') return <SynchronizationCover {...props}/>
  return props.settings?.illustration === 'distance' ? <DistanceCover {...props}/> : <CellArchitectureCover {...props}/>
}

function CellArchitectureCover({ settings = defaultArchitectureSettings, active = true, language = 'ru', presentation = 'cover', replayKey = 0, touchKey = 0, controller, onClick, interactive = true }: ArchitectureCoverProps) {
  const id = `architecture-${useId().replace(/\W/g, '')}`, svg = useRef<SVGSVGElement>(null), ru = language === 'ru'
  const clock = useRef({ time: 0, touchAge: Infinity, replayKey, touchKey, interaction: 0, holding: false })
  const aim = useRef({ x: 0, y: 0, targetX: 0, targetY: 0 })
  const wakeGesture = useRef<() => void>(() => {})
  const [interaction, setInteraction] = useState(0)
  const initial = architectureAnimationFrame(0, settings)
  const hold = () => { clock.current.holding = true; if (settings.touchEnabled || settings.trigger === 'tap') setInteraction(value => value + 1) }
  const release = () => { clock.current.holding = false }
  const move = (x: number, y: number) => { aim.current.targetX = x; aim.current.targetY = y; wakeGesture.current() }
  const gesture = useCoverGesture({ holdDelay: settings.holdDelay, disabled: !interactive || !active,
    onHold: hold, onRelease: release, onMove: move, onTap: () => { if (settings.touchEnabled || settings.trigger === 'tap') setInteraction(value => value + 1); onClick?.() } })
  useImperativeHandle(controller, () => ({ hold, release, move, svg: () => {
    if (!svg.current) return ''
    const copy = svg.current.cloneNode(true) as SVGSVGElement
    copy.setAttribute('xmlns', 'http://www.w3.org/2000/svg'); copy.setAttribute('width', '288'); copy.setAttribute('height', '156')
    copy.removeAttribute('class'); copy.removeAttribute('aria-hidden'); copy.setAttribute('role', 'img')
    const title = document.createElementNS('http://www.w3.org/2000/svg', 'title')
    title.textContent = ru ? 'Вне ячейки · Ощути себя' : 'Beyond the cell · Feel yourself'; copy.prepend(title)
    const elements = [copy, ...copy.querySelectorAll('*')]
    elements.forEach(node => Array.from(node.attributes).forEach(attr => { if (attr.name.startsWith('data-')) node.removeAttribute(attr.name) }))
    return `<?xml version="1.0" encoding="UTF-8"?>\n${new XMLSerializer().serializeToString(copy)}`
  } }), [ru, settings])

  useEffect(() => {
    const element = svg.current
    if (!element) return
    const node = element
    const state = clock.current
    if (state.replayKey !== replayKey) { state.time = 0; state.touchAge = Infinity; state.replayKey = replayKey }
    if (state.touchKey !== touchKey || state.interaction !== interaction) { state.touchAge = 0; state.touchKey = touchKey; state.interaction = interaction }
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const cells = Array.from(node.querySelectorAll<SVGGElement>('[data-architecture-cell]'))
    const person = node.querySelector<SVGGElement>('[data-architecture-person]')!
    const corners = node.querySelector<SVGPathElement>('[data-architecture-corners]')!
    const light = node.querySelector<SVGGElement>('[data-architecture-light]')!
    const scan = node.querySelector<SVGRectElement>('[data-architecture-scan]')!
    const ripple = node.querySelector<SVGCircleElement>('[data-architecture-ripple]')!
    const parallax = node.querySelector<SVGGElement>('[data-architecture-parallax]')!
    let frame = 0, last = 0
    function draw(dt: number) {
      if (active && !media.matches) {
        if (settings.playing) state.time += dt
        state.touchAge += dt
        if (state.holding && Number.isFinite(state.touchAge)) state.touchAge = Math.min(state.touchAge, settings.touchDuration / 2)
      }
      const motion = architectureAnimationFrame(media.matches ? settings.cycle * .55 : state.time, settings, media.matches ? Infinity : state.touchAge)
      node.dataset.architecturePhase = architectureNumber(motion.phase).toString()
      cells.forEach((cell, index) => {
        const value = motion.cells[index]
        cell.setAttribute('transform', `translate(${architectureNumber(value.x)} ${architectureNumber(value.y)}) scale(${settings.cellSize})`)
        cell.setAttribute('opacity', String(value.opacity))
      })
      person.setAttribute('transform', `translate(144 ${architectureNumber(motion.personY)}) scale(${architectureNumber(motion.personScale)})`)
      corners.setAttribute('transform', `translate(144 77) scale(${architectureNumber(motion.frameScale)}) translate(-144 -77)`)
      corners.setAttribute('opacity', String(motion.frameOpacity))
      light.setAttribute('transform', `translate(144 ${architectureNumber(motion.lightY)}) scale(${settings.lightSize})`)
      light.setAttribute('opacity', String(Math.min(1, motion.lightOpacity)))
      scan.setAttribute('y', String(motion.scanY)); scan.setAttribute('opacity', String(motion.scanOpacity))
      ripple.setAttribute('r', String(motion.rippleRadius)); ripple.setAttribute('cy', String(motion.lightY)); ripple.setAttribute('opacity', String(motion.rippleOpacity))
      const point = aim.current, smoothing = media.matches ? 1 : 1 - Math.exp(-Math.min(dt, .05) / settings.inertia)
      point.x += ((settings.parallaxEnabled && !media.matches ? point.targetX * settings.parallax : 0) - point.x) * smoothing
      point.y += ((settings.parallaxEnabled && !media.matches ? point.targetY * settings.parallax * .55 : 0) - point.y) * smoothing
      parallax.setAttribute('transform', `translate(${architectureNumber(point.x)} ${architectureNumber(point.y)})`)
    }
    function tick(now: number) {
      frame = 0
      if (!active || document.hidden || media.matches) return
      const dt = last ? Math.min(.05, (now - last) / 1000) : 0
      last = now; draw(dt)
      const point = aim.current, moving = settings.parallaxEnabled && (Math.abs(point.targetX * settings.parallax - point.x) > .01 || Math.abs(point.targetY * settings.parallax * .55 - point.y) > .01)
      if ((settings.playing && settings.trigger === 'loop') || state.touchAge < settings.touchDuration || moving) frame = requestAnimationFrame(tick)
    }
    function wake() {
      cancelAnimationFrame(frame); frame = 0; last = 0; draw(0)
      if (active && !document.hidden && !media.matches) frame = requestAnimationFrame(tick)
    }
    function pointerWake() { if (!frame && active && !document.hidden && !media.matches) { last = 0; frame = requestAnimationFrame(tick) } }
    wakeGesture.current = pointerWake
    document.addEventListener('visibilitychange', wake); media.addEventListener('change', wake)
    wake()
    return () => {
      cancelAnimationFrame(frame); wakeGesture.current = () => {}
      document.removeEventListener('visibilitychange', wake); media.removeEventListener('change', wake)
    }
  }, [settings, active, replayKey, touchKey, interaction])

  return <button type="button" className="architecture-cover" data-theme={settings.theme} data-presentation={presentation} data-motion={settings.motion} tabIndex={interactive ? undefined : -1}
    aria-label={ru ? 'Архитектура наблюдения · Ощути себя' : 'Observation architecture · Feel yourself'}
    style={{ '--architecture-color': settings.color, '--architecture-bg': settings.theme === 'dark' ? '#000000' : '#FAE6AD' } as CSSProperties}
    {...gesture}>
    {presentation === 'cover' && settings.frame && <svg className="architecture-frame" viewBox="0 0 288 200" preserveAspectRatio="none" aria-hidden="true"><path d="M.5 .5H270L287.5 18V181L269 199.5H.5Z" fill="none" stroke={settings.color} strokeOpacity=".38"/></svg>}
    <svg className="architecture-artwork" ref={svg} viewBox="0 0 288 156" fill="none" stroke={settings.color} strokeWidth={settings.lineWidth} strokeLinejoin="round" strokeLinecap="round" aria-hidden="true">
      <defs>
        <filter id={`${id}-glow`} x="-200%" y="-200%" width="500%" height="500%"><feGaussianBlur stdDeviation={settings.glowRadius}/></filter>
        <clipPath id={`${id}-body`}><path d={architectureBody}/></clipPath>
        <linearGradient id={`${id}-scan`} x1="0" y1="0" x2="0" y2="1"><stop stopColor={settings.lightColor} stopOpacity="0"/><stop offset=".5" stopColor={settings.lightColor}/><stop offset="1" stopColor={settings.lightColor} stopOpacity="0"/></linearGradient>
      </defs>
      <g data-architecture-parallax=""><g transform={architectureArtworkTransform(settings)}>
        {settings.neighbors && <g>{architectureGrid(settings).map(cell => <g key={cell.id} data-architecture-cell={cell.id} transform={`translate(${cell.x} ${cell.y}) scale(${settings.cellSize})`} opacity={settings.neighborOpacity}>
          <path d="M-17-14H13L17-10V14H-17Z" strokeWidth={settings.lineWidth * .7}/>
          <g transform="translate(0 -10) scale(.2)" opacity=".7"><path d={architectureBody} fill={settings.surfaceColor}/><path d={architectureDetail} strokeWidth={settings.lineWidth * .7} opacity=".5"/></g>
        </g>)}</g>}
        <path data-architecture-corners="" d={architectureCorners} opacity=".7" transform={`translate(144 77) scale(${initial.frameScale}) translate(-144 -77)`}/>
        <g data-architecture-person="" transform={`translate(144 ${initial.personY}) scale(${initial.personScale})`}>
          <path d={architectureBody} fill={settings.surfaceColor}/><path d={architectureDetail} opacity=".5" strokeWidth={settings.lineWidth * .7}/>
          <g clipPath={`url(#${id}-body)`}><rect data-architecture-scan="" x="-35" y="-5" width="70" height={settings.scanWidth} stroke="none" fill={`url(#${id}-scan)`} opacity="0"/></g>
        </g>
        <g data-architecture-light="" transform={`translate(144 ${initial.lightY}) scale(${settings.lightSize})`} opacity={initial.lightOpacity}>
          <circle r="12" fill={settings.lightColor} stroke="none" filter={`url(#${id}-glow)`} opacity={settings.glow}/>
          <circle r="3" fill={settings.lightColor} stroke="none"/><circle r="7" stroke={settings.lightColor} opacity=".65"/>
        </g>
        <circle data-architecture-ripple="" cx="144" cy={initial.lightY} r="8" opacity="0" stroke={settings.lightColor}/>
      </g></g>
    </svg>
    {presentation === 'cover' && settings.labels && <>
      <span className="architecture-serial">01 /</span>
      <span className="architecture-footer"><strong>{ru ? <>Архитектура<br/>Наблюдения</> : <>Observation<br/>Architecture</>}</strong><small>{ru ? 'БАЗОВЫЙ · ШАГ 1' : 'BASIC · STEP 1'}</small></span>
      <svg className="architecture-arrow" viewBox="0 0 24 24" fill="none" stroke={settings.color} strokeWidth="1" aria-hidden="true"><path d="M5 19L19 5M7 5h12v12"/></svg>
    </>}
  </button>
}

export function PrinceArchitecture(props: ArchitectureCoverProps) {
  return <><style>{architectureStyles}</style><div style={{ width: 288, height: 200, maxWidth: '100%' }}>
    <ArchitectureCover {...props} language={props.language ?? 'ru'} settings={props.settings ?? architecturePreset}/>
  </div></>
}
