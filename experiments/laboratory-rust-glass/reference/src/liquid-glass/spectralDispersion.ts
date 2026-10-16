// Seven overlapping spectral responses instead of three separated RGB images.
// This is a compact visual model, not a spectral colorimetry implementation.
// Each channel sums to one: dispersion must never tint a uniform source.
const wavelengths = [0.43, 0.47, 0.51, 0.55, 0.59, 0.63, 0.67]
const centers = [0.62, 0.54, 0.46]
const widths = [0.065, 0.05, 0.045]
const rawWeights = wavelengths.map(wavelength => centers.map((center, channel) =>
  Math.exp(-0.5 * ((wavelength - center) / widths[channel]) ** 2)))
const totals = centers.map((_, channel) => rawWeights.reduce((sum, weight) => sum + weight[channel], 0))
const reference = 1 / 0.55 ** 2
const maximumShift = 1 / 0.43 ** 2 - reference

export const spectralTaps = wavelengths.map((wavelength, i) => ({
  shift: (1 / wavelength ** 2 - reference) / maximumShift,
  weight: rawWeights[i].map((weight, channel) => weight / totals[channel]),
}))

// Compile the small constant kernel into GLSL; there are no per-pixel exp() calls.
export const spectralSampleGLSL = spectralTaps.map(tap =>
  `  color += sampleGlassSource(centerUv + spreadUv * ${tap.shift.toFixed(9)}, blurAmount) * vec3(${tap.weight.map(value => value.toFixed(9)).join(', ')});`
).join('\n')

export const maxDispersionPixels = 48
export const dispersionBendRatio = 0.85
export const dispersionBlurRatio = 0.5

// Blur-aware separation remains anchored to an actual refracted ray; a flat
// surface or zero dispersion must never create chromatic ghost images.
export const dispersionSpreadGLSL = `
  float blurSupport = max(uBackgroundBlur, 0.0) * blurAmount * uBlurEnabled * ${dispersionBlurRatio.toFixed(2)} * smoothstep(0.0, 2.0, bendPixels);
  float spreadPixels = min(${maxDispersionPixels.toFixed(1)}, bendPixels * ${dispersionBendRatio.toFixed(2)} + blurSupport) * clamp(chroma, 0.0, 1.0);
`

// Shared with the shader through the constants above, and used to verify pixel scaling.
export function getDispersionSpread(offsetPixels: number, amount: number, blurRadius = 0) {
  const bend = Math.max(0, offsetPixels)
  const t = Math.min(1, bend / 2)
  const blurSupport = Math.max(0, blurRadius) * dispersionBlurRatio * t * t * (3 - 2 * t)
  return Math.min(maxDispersionPixels, bend * dispersionBendRatio + blurSupport) * Math.min(1, Math.max(0, amount))
}
