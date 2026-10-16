export type GlassPanel = {
  x: number
  y: number
  width: number
  height: number
}

// Coordinates describe the center and size relative to the source frame, from its top left.
export const defaultGlassPanel: GlassPanel = { x: 0.5, y: 0.5, width: 0.8, height: 0.3 }

function finiteValue(value: number, fallback: number) {
  return Number.isFinite(value) ? value : fallback
}

export function normalizeGlassPanel(panel: GlassPanel): GlassPanel {
  const width = Math.min(1, Math.max(0.06, finiteValue(panel.width, defaultGlassPanel.width)))
  const height = Math.min(1, Math.max(0.06, finiteValue(panel.height, defaultGlassPanel.height)))

  return {
    width,
    height,
    x: Math.min(1 - width / 2, Math.max(width / 2, finiteValue(panel.x, 0.5))),
    y: Math.min(1 - height / 2, Math.max(height / 2, finiteValue(panel.y, 0.5))),
  }
}

export function getGlassPanelShaderRect(panel?: GlassPanel): [number, number, number, number] {
  if (!panel) {
    return [0.5, 0.5, 1, 1]
  }

  const normalized = normalizeGlassPanel(panel)
  return [normalized.x, 1 - normalized.y, normalized.width, normalized.height]
}
