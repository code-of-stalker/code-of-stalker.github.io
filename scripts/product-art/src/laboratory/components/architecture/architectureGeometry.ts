import type { ArchitectureSettings } from './architectureSettings'

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
