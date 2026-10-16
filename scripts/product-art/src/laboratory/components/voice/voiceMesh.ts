export const VOICE_MESH_MAX_RINGS = 24
const meshSamples = Array.from({ length: 65 }, (_, i) => ({ c: Math.cos(i * Math.PI / 32), s: Math.sin(i * Math.PI / 32) }))
const unit = (value: number) => Math.max(0, Math.min(1, value))

/** Fixed-radius meridians and parallels. Volume reveals paths; it never scales the sphere. */
export function voiceMeshFrame(angle: number, level: number, ringCount: number, radius: number) {
  const count = Math.max(4, Math.min(VOICE_MESH_MAX_RINGS, Math.round(ringCount)))
  const r = Math.max(60, Math.min(97, radius)), meridians = 1 + Math.floor(count / 2)
  const yTurn = angle + .4, pitch = .32 + Math.sin(angle * .23) * .18, roll = .16
  const sy = Math.sin(yTurn), cy = Math.cos(yTurn), sp = Math.sin(pitch), cp = Math.cos(pitch)
  const sr = Math.sin(roll), cr = Math.cos(roll)
  const project = (x: number, y: number, z: number) => {
    const x1 = x * cy + z * sy, z1 = -x * sy + z * cy
    const y1 = y * cp - z1 * sp, depth = y * sp + z1 * cp
    return { x: 120 + x1 * cr - y1 * sr, y: 105 + x1 * sr + y1 * cr, z: depth }
  }
  const point = (p: { x: number; y: number }) => `${p.x.toFixed(2)} ${p.y.toFixed(2)}`
  return Array.from({ length: VOICE_MESH_MAX_RINGS }, (_, index) => {
    const reveal = index === 0 ? 1 : index >= count ? 0 : unit(unit(level) * (count - 1) - index + 1)
    const opacity = reveal * reveal * (3 - 2 * reveal)
    if (!opacity) return { front: '', back: '', opacity: 0 }
    // Alternate a new meridian with a parallel to build an even grid progressively.
    const longitude = index === 0 || index % 2 === 1
    const ordinal = index === 0 ? 0 : longitude ? (index + 1) / 2 : index / 2
    const turn = ordinal * Math.PI / meridians
    const height = longitude ? 0 : ((ordinal / (Math.floor((count - 1) / 2) + 1)) * 1.6 - .8) * r
    const circleRadius = Math.sqrt(r * r - height * height)
    const points = meshSamples.map(({ c, s }) => longitude
      ? project(r * c * Math.cos(turn), r * s, r * c * Math.sin(turn))
      : project(circleRadius * c, height, circleRadius * s))
    let front = '', back = '', lastSide: boolean | undefined
    for (let i = 1; i < points.length; i++) {
      const previous = points[i - 1], next = points[i], near = previous.z + next.z >= 0
      const segment = `${near !== lastSide ? `M${point(previous)}` : ''}L${point(next)}`
      if (near) front += segment; else back += segment
      lastSide = near
    }
    return { front, back, opacity }
  })
}
