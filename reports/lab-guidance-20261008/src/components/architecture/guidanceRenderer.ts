import type { GuidanceSettings } from './guidanceSettings'
import { guidanceApproach, guidanceClamp, guidanceEase, guidanceEnvelope, guidanceFrame, guidancePointOnRoute } from './guidanceGeometry'
import type { GuidancePoint } from './guidanceGeometry'

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
