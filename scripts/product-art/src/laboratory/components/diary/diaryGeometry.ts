import type { DiarySettings } from './diarySettings'

export function diaryNumber(value: number) { return Number(value.toFixed(4)) }
export function diaryPlate(settings: DiarySettings) {
  const y = (value: number) => diaryNumber(46 + (value - 46) * settings.tilt)
  const p = (x: number, value: number) => `${x} ${y(value)}`
  const top = `M${p(84, 45)}L${p(151, 24)}L${p(212, 46)}L${p(145, 68)}Z`
  return {
    top,
    body: `M${p(84, 45)}L${p(151, 24)}L${p(212, 46)}L212 ${y(46) + settings.depth}L145 ${y(68) + settings.depth}L84 ${y(45) + settings.depth}Z`,
    edges: `M145 ${y(68)}v${settings.depth}M92 ${y(53)}L135 ${y(68)}M154 ${y(68)}L203 ${y(52)}`,
    label: `M${p(110, 43)}L${p(148, 31)}L${p(184, 44)}L${p(146, 56)}Z`,
    rail: `M${p(95, 52)}L${p(135, 65)}`,
    ticks: `M${p(103, 55)}L${p(106, 56)}M${p(111, 58)}L${p(114, 59)}M${p(119, 61)}L${p(122, 62)}`,
    signal: `matrix(1 ${diaryNumber(.34 * settings.tilt)} 1 ${diaryNumber(-.32 * settings.tilt)} 119 ${y(44)})`,
  }
}

export function diaryLayout(settings: DiarySettings) {
  const height = 44 * settings.tilt + settings.depth + (settings.layers - 1) * settings.layerGap
  // Keep extra layers inside the illustration slot, leaving the title unobstructed.
  const scale = settings.size * Math.min(1, 96 / (height + settings.floatAmount * 2))
  const middle = 46 + (settings.depth + (settings.layers - 1) * settings.layerGap) / 2
  return `translate(148 69) scale(${diaryNumber(scale)}) rotate(${settings.rotation}) translate(-148 ${diaryNumber(-middle)})`
}

export function diarySignal(seconds: number, settings: DiarySettings) {
  return Array.from({ length: settings.signalCount }, (_, index) => {
    const position = index / (settings.signalCount - 1), envelope = .18 + .82 * Math.sin(Math.PI * position) ** 1.4
    const variation = .7 + .16 * Math.sin(seconds * settings.signalSpeed * 1.7 + index * 1.3) + .14 * Math.sin(seconds * settings.signalSpeed * 2.9 - index * .8)
    const height = 1.5 + 9 * envelope * variation * settings.signalAmount
    return { x: diaryNumber(position * 34), height: diaryNumber(height), opacity: diaryNumber(.28 + .72 * envelope * variation) }
  })
}

export function diaryAnimationFrame(seconds: number, settings: DiarySettings, touchAge = Infinity) {
  const tau = Math.PI * 2, time = seconds * settings.tempo
  const progress = touchAge / settings.touchDuration
  const touch = progress >= 0 && progress < 1 ? Math.sin(Math.PI * progress) ** 1.4 * settings.touchStrength : 0
  const phase = (time % settings.scanInterval) / settings.scanInterval
  const scan = settings.scanEnabled && phase > .15 && phase < .8
    ? Math.sin(Math.PI * (phase - .15) / .65) * settings.scanStrength : 0
  const offsets = Array.from({ length: settings.layers }, (_, layer) => {
    const base = layer * settings.layerGap
    const shift = settings.motion === 'cascade'
      ? Math.sin(time * tau / 6 - layer * settings.stagger * 1.5) * settings.floatAmount
      : settings.motion === 'breathe'
        ? Math.sin(time * tau / 8) * settings.floatAmount * layer / Math.max(1, settings.layers - 1)
        : Math.sin(time * tau / 9) * settings.floatAmount
    const lift = settings.touch === 'lift' ? touch * (settings.layers - layer) * 4 : 0
    return diaryNumber(base + shift - lift)
  })
  return {
    offsets, touch,
    halo: settings.halo * (1 + Math.sin(time * tau / 7) * settings.haloPulse * .5) + (settings.touch === 'pulse' ? touch * .16 : touch * .05),
    glow: settings.glow + touch * .65,
    scan, scanY: diaryNumber(46 + (phase * 49 - 23) * settings.tilt),
    traceOffset: diaryNumber(-time * 370 / 15),
    signal: diarySignal(time, settings),
  }
}
