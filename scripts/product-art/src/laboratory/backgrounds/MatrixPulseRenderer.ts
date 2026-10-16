import { rainCharacters, rainNoise } from './matrixRainSettings'
import { getPulseGrid, getPulseLight } from './matrixPulseSettings'
import type { MatrixPulse, MatrixPulseSettings } from './matrixPulseSettings'

/** Interactive source canvas, shared by the clean background and glass optics. */
export class MatrixPulseRenderer {
  readonly canvas = document.createElement('canvas')
  private readonly context = this.canvas.getContext('2d')!
  private readonly atlas = document.createElement('canvas')
  private atlasKey = ''
  private glyphSize = 0
  private dirty = true
  private disposed = false
  private lastTime: number | null = null
  private lastPaint = -1
  private clock = 0
  private reduced = false
  private pulses: MatrixPulse[] = []
  private gridKey = ''
  private grid: ReturnType<typeof getPulseGrid> = { cell: 1, cells: [] }

  constructor(private settings: MatrixPulseSettings) {
    void document.fonts?.ready.then(() => {
      if (!this.disposed) { this.atlasKey = ''; this.dirty = true }
    })
  }
  update(settings: MatrixPulseSettings) { this.settings = settings; this.gridKey = ''; this.dirty = true }
  restart() { this.pulses = []; this.clock = 0; this.lastTime = null; this.dirty = true }
  tap(x: number, y: number) {
    if (this.disposed) return
    this.pulses.push({ x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)), age: 0 })
    this.pulses = this.pulses.slice(-6)
    this.dirty = true
  }

  draw(time: number, width: number, height: number, pixelRatio: number, reducedMotion: boolean) {
    if (this.disposed) return false
    const dt = this.lastTime === null ? 0 : Math.min(0.1, Math.max(0, time - this.lastTime))
    this.lastTime = time
    const s = this.settings
    if (this.reduced !== reducedMotion) { this.reduced = reducedMotion; this.dirty = true }
    const moving = s.playing && !reducedMotion && this.pulses.length > 0
    if (moving) { this.clock += dt; this.pulses.forEach(pulse => { pulse.age += dt }) }
    const ratio = Math.min(2, pixelRatio, 2048 / Math.max(width, height))
    const w = Math.max(1, Math.round(width * ratio)), h = Math.max(1, Math.round(height * ratio))
    if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; this.dirty = true }
    if (!this.dirty && (!moving || time - this.lastPaint < 1 / 30)) return false
    this.lastPaint = time; this.dirty = false
    if (!reducedMotion) {
      const lifetime = Math.hypot(width, height) / s.speed + s.persistence * 7 + s.waveWidth / s.speed
      this.pulses = this.pulses.filter(pulse => pulse.age <= lifetime)
    }
    const glyphs = rainCharacters[s.characters]
    const atlasKey = `${s.characters}:${s.fontSize}:${s.glow}:${s.color}:${s.headColor}:${ratio}`
    if (atlasKey !== this.atlasKey) {
      this.atlasKey = atlasKey
      this.glyphSize = Math.ceil(s.fontSize * 2.4 * ratio)
      this.atlas.width = this.glyphSize * glyphs.length; this.atlas.height = this.glyphSize * 2
      const ctx = this.atlas.getContext('2d')!
      ctx.font = `${s.fontSize * ratio}px "Disket Mono", monospace`
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.shadowBlur = s.fontSize * ratio * s.glow * 0.6
      for (let row = 0; row < 2; row++) {
        ctx.fillStyle = ctx.shadowColor = row === 0 ? s.color : s.headColor
        for (let i = 0; i < glyphs.length; i++) ctx.fillText(glyphs[i], (i + 0.5) * this.glyphSize, (row + 0.5) * this.glyphSize)
      }
    }
    const gridKey = `${width}:${height}:${s.fontSize}:${s.spacing}:${s.seed}:${s.density}`
    if (gridKey !== this.gridKey) { this.gridKey = gridKey; this.grid = getPulseGrid(width, height, s) }
    const ctx = this.context
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
    ctx.globalAlpha = 1; ctx.fillStyle = s.backgroundColor; ctx.fillRect(0, 0, width, height)
    const size = this.glyphSize / ratio
    const tick = Math.floor(this.clock * (1 + s.flicker * 14))
    for (const cell of this.grid.cells) {
      if (!cell.active) continue
      let wake = s.idleBrightness, head = 0
      for (const pulse of this.pulses) {
        if (reducedMotion) { wake = 1; continue }
        const light = getPulseLight(Math.hypot(cell.x - pulse.x * width, cell.y - pulse.y * height), pulse.age, s)
        wake = Math.max(wake, light.wake); head = Math.max(head, light.head)
      }
      const noise = rainNoise(s.seed, cell.index * 997 + (s.flicker > 0 ? tick : 0))
      const alpha = Math.min(1, s.brightness * wake * (1 - s.flicker * noise * 0.2))
      if (alpha < 0.003) continue
      const character = Math.floor(noise * glyphs.length)
      ctx.globalAlpha = alpha
      ctx.drawImage(this.atlas, character * this.glyphSize, head > 0.25 ? this.glyphSize : 0,
        this.glyphSize, this.glyphSize, cell.x - size / 2, cell.y - size / 2, size, size)
    }
    ctx.globalAlpha = 1
    return true
  }
  dispose() { this.disposed = true; this.pulses = []; this.canvas.width = this.canvas.height = this.atlas.width = this.atlas.height = 1 }
}
