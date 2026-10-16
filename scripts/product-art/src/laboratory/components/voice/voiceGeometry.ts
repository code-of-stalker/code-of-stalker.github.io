import type { VoiceAppearance } from './voiceAppearance'
import { defaultVoiceAppearance } from './voiceAppearance'

export const voiceRadii = { spin: 52, orbit: 69, fill: 84, contour: 99, rayEnd: 113, glass: 114 } as const

/** Every ray has a fixed root; only its tip grows, always away from the rings. */
export function voiceContourSegment(index: number, level: number, clock: number, reacting: boolean,
  style: Pick<VoiceAppearance, 'contourLength' | 'lineWidth'>) {
  const angle = index * Math.PI / 20
  const pattern = .5 + .3 * Math.sin(angle * 3 + clock * .8) + .2 * Math.sin(angle * 7 - clock * 1.1)
  const drive = Math.max(0, Math.min(1, level)) ** 1.4
  const local = drive * (.12 + .88 * pattern ** 1.3)
  const maximum = Math.max(8, Math.min(64, style.contourLength))
  const length = reacting ? 3 + (maximum - 3) * local : 3 + (1 + Math.sin(clock * .9 + index * .5))
  const start = voiceRadii.contour, end = start + length
  return { x1: 120 + Math.cos(angle) * start, y1: 105 + Math.sin(angle) * start,
    x2: 120 + Math.cos(angle) * end, y2: 105 + Math.sin(angle) * end, length,
    strokeWidth: style.lineWidth * (.65 + local * 2.8), opacity: reacting ? .3 + local * .7 : .44 }
}

/** Fixed framing: longer rays overflow instead of shrinking the sphere. */
export function voiceArtworkViewport() {
  return { x: 0, y: 0, width: 240, height: 220, viewBox: '0 0 240 220' }
}

export function voiceRingsTransform(scale: number) {
  return `translate(120 105) scale(${scale}) translate(-120 -105)`
}

/** Audio-to-arc threshold is 30% lower. Apply once, before smoothing. */
export function voiceArcTarget(level: number, reactionSize: number) {
  return voiceRingFill(level / .7, reactionSize)
}

/** Two equal luminous arcs, always exactly opposite each other on pathLength=100. */
export function voiceRingFill(level: number, reactionSize: number) {
  const fill = Math.min(1, Math.max(0, level * Math.max(1, reactionSize)))
  // Complete the last fraction of a pixel instead of approaching closure forever.
  return fill >= .99 ? 1 : fill
}
export function voiceArcDashes(level: number, reactionSize: number) {
  const amount = voiceRingFill(level, reactionSize)
  const length = 50 * amount
  return `${length} ${50 - length}`
}

/** A real rotating 3D circle, projected into the component's 240×220 SVG. */
export function sphereRingPaths(angle: number) {
  const radius = voiceRadii.orbit, segments = 80
  const tilt = .46 + Math.sin(angle * .67) * .18, turn = angle + .55
  const roll = Math.sin(angle * .43) * .45
  const sinT = Math.sin(tilt), cosT = Math.cos(tilt), sinY = Math.sin(turn), cosY = Math.cos(turn)
  const sinR = Math.sin(roll), cosR = Math.cos(roll)
  const project = (t: number) => {
    const x = Math.cos(t) * radius, y = Math.sin(t) * radius
    const y1 = y * cosT, z1 = y * sinT
    const x2 = x * cosY + z1 * sinY, z = -x * sinY + z1 * cosY
    return { x: 120 + x2 * cosR - y1 * sinR, y: 105 + x2 * sinR + y1 * cosR, z }
  }
  const point = ({ x, y }: { x: number; y: number }) => `${x.toFixed(2)} ${y.toFixed(2)}`
  let front = '', back = '', previous = project(0), lastSide: boolean | undefined
  for (let i = 1; i <= segments; i++) {
    const next = project(i * Math.PI * 2 / segments), isFront = (previous.z + next.z) >= 0
    const segment = `${isFront !== lastSide ? `M${point(previous)}` : ''}L${point(next)}`
    if (isFront) front += segment; else back += segment
    lastSide = isFront; previous = next
  }
  return { front, back }
}

/** Maps the circular glass onto the same object-fit:contain geometry as the SVG. */
export function voiceGlassBounds(width: number, height: number, viewport = voiceArtworkViewport(), ringsScale = 1) {
  const scale = Math.max(0, Math.min(width / viewport.width, height / viewport.height))
  const diameter = voiceRadii.glass * 2 * scale * ringsScale
  const centerY = height / 2 + (105 - viewport.y - viewport.height / 2) * scale
  return { width: diameter, height: diameter, left: (width - diameter) / 2, top: centerY - diameter / 2 }
}

export function voiceWaveOrigin(box: { x: number; y: number; width: number; height: number }, style: Pick<VoiceAppearance, 'ringsScale'> = defaultVoiceAppearance) {
  const bounds = voiceGlassBounds(box.width, Math.max(0, box.height - 78), voiceArtworkViewport(), style.ringsScale)
  return { x: box.x + box.width / 2, y: box.y + 12 + bounds.top + bounds.height / 2, radius: bounds.width / 2 }
}
