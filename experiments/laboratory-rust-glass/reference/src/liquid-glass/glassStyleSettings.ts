import type { LiquidGlassControl } from './settings'

// Figma documents the controls, not the renderer; these are our WebGL equivalents.
// https://help.figma.com/hc/en-us/articles/360041488473-Apply-effects-to-layers
export const glassStyleNumberDefaults = {
  figmaRefraction: 0.55,
  figmaDepth: 28,
  figmaDispersion: 0.12,
  figmaSplay: 0.65,
  fillOpacity: 0,
}
export type GlassStyleNumberKey = keyof typeof glassStyleNumberDefaults

export const glassStyleCopy: Record<GlassStyleNumberKey, Record<'en' | 'ru', { label: string; help: string }>> = {
  figmaRefraction: {
    en: { label: 'Refraction', help: 'Strength of background distortion across the glass. Zero removes lens distortion; blur stays independent.' },
    ru: { label: 'Преломление · Refraction', help: 'Сила искажения изображения под стеклом. При 0% преломление выключено, размытие настраивается отдельно.' },
  },
  figmaDepth: {
    en: { label: 'Distortion depth · Depth', help: 'Optical depth in pixels. Higher values bend and stretch the background more, without widening the rim.' },
    ru: { label: 'Глубина искажения · Depth', help: 'Оптическая глубина в пикселях. Чем больше значение, тем сильнее изгибается и растягивается фон. Ширина блика не меняется.' },
  },
  figmaDispersion: {
    en: { label: 'Dispersion', help: 'Color separation in the distorted background, including frosted areas. Refraction and Depth control the distortion itself.' },
    ru: { label: 'Дисперсия · Dispersion', help: 'Цветовое расщепление искажённого фона, в том числе при размытии. Сам изгиб изображения задают Refraction и Depth.' },
  },
  figmaSplay: {
    en: { label: 'Splay', help: 'Spreads the directional highlight: from a focused reflection to a broad, soft light.' },
    ru: { label: 'Распределение света · Splay', help: 'От узкого направленного отблеска к широкому мягкому свету на грани.' },
  },
  fillOpacity: {
    en: { label: 'Fill opacity', help: '0% is transparent; 100% is a solid color. Text and illustrations keep their own opacity.' },
    ru: { label: 'Непрозрачность заливки', help: '0% — прозрачная плашка, 100% — сплошной цвет. Текст и иллюстрации сохраняют свою непрозрачность.' },
  },
}

const bounds: Record<GlassStyleNumberKey, [number, number, number]> = {
  figmaRefraction: [0, 1, 0.01], figmaDepth: [1, 160, 1],
  figmaDispersion: [0, 1, 0.01], figmaSplay: [0, 1, 0.01], fillOpacity: [0, 1, 0.01],
}

export const glassStyleControls = (Object.keys(bounds) as GlassStyleNumberKey[]).map(key => ({
  key, ...glassStyleCopy[key].en, min: bounds[key][0], max: bounds[key][1], step: bounds[key][2], section: 'material' as const,
})) satisfies LiquidGlassControl[]

export function normalizeFillColor(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const hex = value.trim().replace(/^#/, '')
  if (/^[\da-f]{3}$/i.test(hex)) return `#${[...hex].map(char => char + char).join('').toUpperCase()}`
  return /^[\da-f]{6}$/i.test(hex) ? `#${hex.toUpperCase()}` : null
}
