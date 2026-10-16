import { getRainStreams, rainCharacters, rainNoise } from './matrixRainSettings'
import type { MatrixRainSettings } from './matrixRainSettings'

/** Portable canvas source. The glass renderer samples this very canvas, so rain
 * inside and outside the glass stays aligned and is actually refracted/blurred. */
export class MatrixRainRenderer {
  readonly canvas = document.createElement('canvas')
  private readonly context = this.canvas.getContext('2d')!
  private atlas = document.createElement('canvas')
  private atlasKey = ''
  private dirty = true
  private lastTime: number | null = null
  private lastPaint = -1
  private travel = 0
  private clock = 0
  private size = 0
  private disposed = false
  constructor(private settings: MatrixRainSettings) {
    void document.fonts?.ready.then(() => {
      if (!this.disposed) { this.atlasKey = ''; this.dirty = true }
    })
  }

  update(settings: MatrixRainSettings) { this.settings = settings; this.dirty = true }
  restart() { this.travel = 0; this.clock = 0; this.lastTime = null; this.dirty = true }

  draw(time: number, width: number, height: number, pixelRatio: number, reducedMotion: boolean) {
    if (this.disposed) return false
    const dt = this.lastTime === null ? 0 : Math.min(0.1, Math.max(0, time - this.lastTime))
    this.lastTime = time
    const moving = this.settings.playing && !reducedMotion
    if (moving) { this.travel += dt * this.settings.speed; this.clock += dt }
    // Limit procedural texture work to 30fps and 2x density, independently of glass quality.
    const ratio = Math.min(2, pixelRatio, 2048 / Math.max(width, height))
    const w = Math.max(1, Math.round(width * ratio)), h = Math.max(1, Math.round(height * ratio))
    if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; this.dirty = true }
    if (!this.dirty && (!moving || time - this.lastPaint < 1 / 30)) return false
    this.lastPaint = time
    this.dirty = false
    const s = this.settings
    const glyphs = rainCharacters[s.characters]
    const key = `${s.characters}:${s.fontSize}:${s.glow}:${s.color}:${s.headColor}:${ratio}`
    if (key !== this.atlasKey) {
      this.atlasKey = key
      this.size = Math.ceil(s.fontSize * 2.4 * ratio)
      this.atlas.width = this.size * glyphs.length
      this.atlas.height = this.size * 2
      const ctx = this.atlas.getContext('2d')!
      ctx.font = `${s.fontSize * ratio}px "Disket Mono", monospace`
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      for (let row = 0; row < 2; row++) {
        ctx.fillStyle = ctx.shadowColor = row === 0 ? s.color : s.headColor
        ctx.shadowBlur = s.fontSize * ratio * s.glow * 0.6
        for (let i = 0; i < glyphs.length; i++) ctx.fillText(glyphs[i], (i + 0.5) * this.size, (row + 0.5) * this.size)
      }
    }
    const ctx = this.context
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
    ctx.globalAlpha = 1; ctx.fillStyle = s.backgroundColor; ctx.fillRect(0, 0, width, height)
    const tick = Math.floor(this.clock * (1 + s.flicker * 14))
    for (const stream of getRainStreams(width, height, s, this.travel)) {
      if (!stream.active) continue
      const scale = stream.depth * this.size / ratio
      for (let row = stream.tail - 1; row >= 0; row--) {
        const yDown = stream.head - row * stream.cell
        const y = s.direction === 'down' ? yDown : height - yDown
        if (y < -scale || y > height + scale) continue
        const noise = rainNoise(s.seed, stream.index * 997 + row * 17 + (s.flicker > 0 ? tick : 0))
        const character = Math.floor(noise * glyphs.length)
        const fade = (1 - row / stream.tail) ** 1.7
        ctx.globalAlpha = Math.min(1, s.brightness * (row === 0 ? 1 : fade * stream.depth) * (1 - s.flicker * noise * 0.3))
        ctx.drawImage(this.atlas, character * this.size, row === 0 ? this.size : 0, this.size, this.size,
          stream.x - scale / 2, y - scale / 2, scale, scale)
      }
    }
    ctx.globalAlpha = 1
    return true
  }
  dispose() { this.disposed = true; this.canvas.width = this.canvas.height = this.atlas.width = this.atlas.height = 1 }
}
