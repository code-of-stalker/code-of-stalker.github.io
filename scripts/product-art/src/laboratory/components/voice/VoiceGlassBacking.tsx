import { useEffect, useRef } from 'react'
import type { CSSProperties } from 'react'
import { voiceGlassBounds, voiceArtworkViewport } from './voiceGeometry'
import type { VoiceAppearance } from './voiceAppearance'

/** The linked material values; geometry stays circular regardless of the glass editor's shape. */
export type VoiceGlassMaterial = {
  backgroundBlur: number; fillColor: string; fillOpacity: number
  highlightColor: string; highlightStrength: number
}

export function resolveVoiceGlassMaterial(appearance: VoiceAppearance, linked?: VoiceGlassMaterial): VoiceGlassMaterial {
  if (appearance.glassLinked && linked) return linked
  return { backgroundBlur: appearance.glassBlur, fillOpacity: appearance.glassOpacity, fillColor: appearance.glassColor,
    highlightColor: appearance.lightColor, highlightStrength: .025 * appearance.glow }
}

export function VoiceGlassBacking({ material, viewport = voiceArtworkViewport(), scale = 1 }: { material: VoiceGlassMaterial; viewport?: ReturnType<typeof voiceArtworkViewport>; scale?: number }) {
  const glass = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const element = glass.current, plane = element?.parentElement
    if (!element || !plane) return
    const place = (width: number, height: number) => {
      const bounds = voiceGlassBounds(width, height, viewport, scale)
      for (const key of ['width', 'height', 'left', 'top'] as const) element.style[key] = `${bounds[key]}px`
    }
    place(plane.clientWidth, plane.clientHeight)
    const observer = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect; place(width, height)
    })
    observer.observe(plane)
    return () => observer.disconnect()
  }, [viewport.x, viewport.y, viewport.width, viewport.height, scale])
  return <span ref={glass} className="vr-glass" aria-hidden="true" style={{
    '--vr-glass-blur': `${Math.max(0, material.backgroundBlur)}px`,
    '--vr-glass-fill': material.fillColor,
    '--vr-glass-opacity': `${Math.max(0, Math.min(1, material.fillOpacity)) * 100}%`,
    '--vr-glass-light': material.highlightColor,
    '--vr-glass-shine': `${Math.min(.25, Math.max(0, material.highlightStrength)) * 100}%`,
  } as CSSProperties}/>
}
