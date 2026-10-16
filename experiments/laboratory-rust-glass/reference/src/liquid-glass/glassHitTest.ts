import { normalizeGlassPanel } from './glassPanel'
import type { GlassPanel } from './glassPanel'
import type { LiquidGlassSettings } from './settings'
import type { SourceSize } from './sourceLayout'

export function isPointOnGlass(x: number, y: number, frame: SourceSize, settings: LiquidGlassSettings, glassPanel?: GlassPanel) {
  const panel = glassPanel ? normalizeGlassPanel(glassPanel) : { x: 0.5, y: 0.5, width: 1, height: 1 }
  const px = (x - panel.x) * frame.width
  const py = (panel.y - y) * frame.height
  const halfX = panel.width * frame.width / 2
  const halfY = panel.height * frame.height / 2
  const radius = Math.min(halfX, halfY)

  if (Math.abs(px) > halfX || Math.abs(py) > halfY) return false
  if (settings.shapeType === 1) return px * px + py * py <= radius * radius
  if (settings.shapeType === 2) return (px / halfX) ** 2 + (py / halfY) ** 2 <= 1
  if (settings.shapeType === 11) return Math.max(Math.abs(px), Math.abs(py)) <= radius
  if (settings.shapeType === 12) {
    const limit = (cut: number) => halfX + halfY - radius * 2 * cut
    if (settings.cutTopLeft && -px + py > limit(settings.cutSizeTopLeft)) return false
    if (settings.cutTopRight && px + py > limit(settings.cutSizeTopRight)) return false
    if (settings.cutBottomRight && px - py > limit(settings.cutSizeBottomRight)) return false
    if (settings.cutBottomLeft && -px - py > limit(settings.cutSizeBottomLeft)) return false
  }
  if (settings.shapeType === 0) {
    const rounding = Math.min(radius, Math.max(0, settings.cornerRadius * panel.height * frame.height))
    const qx = Math.abs(px) - halfX + rounding
    const qy = Math.abs(py) - halfY + rounding
    return Math.min(Math.max(qx, qy), 0) + Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) <= rounding
  }
  return true
}
