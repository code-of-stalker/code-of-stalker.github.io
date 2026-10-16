export const maxGaussianRadius = 36
export const maxBackgroundBlur = 120

// The radius is the support of a Gaussian truncated at three standard deviations.
export function createBackgroundBlurKernel(radius: number) {
  const safeRadius = Number.isFinite(radius) ? Math.max(0, Math.min(radius, maxGaussianRadius)) : 0
  const weights = new Float32Array(maxGaussianRadius + 1)

  if (safeRadius < 0.01) {
    weights[0] = 1
    return { radius: 0, weights }
  }

  const kernelRadius = Math.ceil(safeRadius)
  const sigma = safeRadius / 3
  let total = 1
  weights[0] = 1

  for (let i = 1; i <= kernelRadius; i += 1) {
    weights[i] = Math.exp(-(i * i) / (2 * sigma * sigma))
    total += 2 * weights[i]
  }

  for (let i = 0; i <= kernelRadius; i += 1) {
    weights[i] /= total
  }

  return { radius: kernelRadius, weights }
}

export function getBackgroundBlurLayout(width: number, height: number, pixelRatio: number, radius: number) {
  const pixelRadius = Math.max(0, Math.min(radius, maxBackgroundBlur)) * Math.max(1, Math.min(pixelRatio, 3))
  // Wide blurs use a smaller intermediate texture, keeping the same logical
  // Gaussian support without increasing the number of samples per fragment.
  const scale = Math.min(1, Math.max(0.5, 2 / Math.max(pixelRadius, 0.001)), maxGaussianRadius / Math.max(pixelRadius, 0.001))
  const targetWidth = Math.max(1, Math.ceil(width * scale))
  const targetHeight = Math.max(1, Math.ceil(height * scale))
  const radiusX = pixelRadius * targetWidth / Math.max(width, 1)
  const radiusY = pixelRadius * targetHeight / Math.max(height, 1)

  return {
    width: targetWidth,
    height: targetHeight,
    radiusX,
    radiusY,
    // Rounding odd texture dimensions must not silently truncate the kernel.
    spacingX: Math.max(1, radiusX / maxGaussianRadius),
    spacingY: Math.max(1, radiusY / maxGaussianRadius),
  }
}
