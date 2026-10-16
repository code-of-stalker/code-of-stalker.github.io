import type { GuidanceSettings } from './guidanceSettings'

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
