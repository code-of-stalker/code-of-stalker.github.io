// Logical pixels: optical depth changes ray travel, not the width of an SDF
// bevel. Soft saturation keeps small panels usable without a half-side cutoff.
export function getOpticalTravel(depth: number, refraction: number, shortSide: number) {
  const limit = Math.max(shortSide, 0.001) * 0.75
  const distance = Math.max(0, depth) * Math.min(1, Math.max(0, refraction)) * 2.2
  return distance === 0 ? 0 : -limit * Math.expm1(-distance / limit)
}

export const glassLensGLSL = `
vec2 glassLensSlope(vec2 p, vec2 halfSize) {
  bool circular = uShapeType > 0.5 && uShapeType < 1.5;
  bool square = uShapeType > 10.5 && uShapeType < 11.5;
  if (circular || square) halfSize = vec2(min(halfSize.x, halfSize.y));
  vec2 q = p / max(halfSize, vec2(0.001));
  // Smooth derivatives of a lens surface. No nearest-edge selection: at a
  // rectangle's medial axes the optical slope remains continuous.
  if (uShapeType > 0.5 && uShapeType < 2.5) {
    return q * (0.6 + 0.85 * dot(q, q));
  }
  return q * (0.6 + 0.85 * q * q);
}
`

// Shared by the renderer and exported integration instructions.
export const glassRefractionGLSL = `
  vec2 opticalSlope = glassLensSlope(p, outerSize);
  float shortSide = min(panelResolution.x, panelResolution.y) / max(uPixelRatio, 1.0);
  float boundary = smoothstep(0.0, max(3.0, shortSide * 0.06), depthPx);
  float flowMask = mix(1.0, boundary, clamp(uFlowBoundaryDamping, 0.0, 1.0));
  opticalSlope += flowGradient(p, uTime) * clamp(uFlowStrength, 0.0, 1.5) * 0.18 * flowMask * regionMask;
  // Keep the 2D slope magnitude: normalizing it would introduce a center seam.
  vec3 normal3D = normalize(vec3(opticalSlope, 1.0));
  vec3 ray = refract(vec3(0.0, 0.0, -1.0), normal3D, 1.0 / 1.5);
  vec2 bendPixels = ray.xy / max(abs(ray.z), 0.15) * uOpticalTravel;
  vec2 bendUv = bendPixels * uPixelRatio / uResolution;
  vec3 opticalColor = sampleDispersedSource(vUv + surfaceOffset, bendUv, uGlassOptics.w, blurAmount);
`
