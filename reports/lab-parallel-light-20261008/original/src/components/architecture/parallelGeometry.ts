import type { ParallelSettings } from './parallelSettings'

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
