import type { ParallelSettings } from './parallelSettings'
import { parallelClamp, parallelEase, parallelEnvelope, parallelFrame } from './parallelGeometry'
import type { ParallelPoint } from './parallelGeometry'

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
