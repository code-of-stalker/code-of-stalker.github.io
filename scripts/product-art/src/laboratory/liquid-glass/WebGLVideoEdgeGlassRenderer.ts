import * as THREE from 'three'
import { contourPixels } from '../../../../../src/features/product/motion/glassShape'
import type { GlassShape } from '../../../../../src/features/product/motion/glassShape'
import { glassBufferLayout } from '../../../../../src/features/product/motion/effectQuality'
import { BackgroundBlurPass } from './BackgroundBlurPass'
import { GlassMotion } from './GlassMotion'
import { dispersionSpreadGLSL, spectralSampleGLSL } from './spectralDispersion'
import { getOpticalTravel, glassLensGLSL, glassRefractionGLSL } from './glassRefraction'
import type { LiquidGlassSettings } from './settings'
import { normalizeLiquidGlassSettings } from './settings'
import type { SourceSize } from './sourceLayout'
import { getGlassPanelShaderRect } from './glassPanel'
import type { GlassPanel } from './glassPanel'
import { MatrixRainRenderer } from '../backgrounds/MatrixRainRenderer'
import { MatrixPulseRenderer } from '../backgrounds/MatrixPulseRenderer'
import { resolveBackgroundPreset } from '../backgrounds/backgroundSettings'
import type { BackgroundInput } from '../backgrounds/backgroundSettings'
import { getPixelRevealOrigin, makePixelRevealState, PanelPulseReveal, pixelRevealGLSL } from './pixelReveal'
import type { PixelRevealState } from './pixelReveal'

type RenderSourceElement = HTMLImageElement | HTMLVideoElement | HTMLCanvasElement

type VideoSourceElement = HTMLVideoElement & {
  cancelVideoFrameCallback?: (handle: number) => void
  requestVideoFrameCallback?: (callback: () => void) => number
}

type RendererOptions = {
  autoResize?: boolean
  canvas: HTMLCanvasElement
  fixedPixelRatio?: number
  pixelBudget?: number
  densityCap?: number
  idleWhenSettled?: boolean
  sourceIsEmpty?: boolean
  externalReveal?: boolean
  transparentCanvas?: boolean
  glassPanel?: GlassPanel
  preserveDrawingBuffer?: boolean
  settings: LiquidGlassSettings
  source: RenderSourceElement
  sourceNaturalSize?: SourceSize
  background?: BackgroundInput
  showGlass?: boolean
  onRevealProgress?: (progress: number) => void
  onPulseReveal?: (state: PixelRevealState) => void
  onActivity?: (running: boolean) => void
}

const vertexShader = `
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`

const fragmentShader = `
precision highp float;

uniform sampler2D uSourceTexture;
uniform sampler2D uContourTexture;
uniform float uContourEnabled;
uniform float uContourAspect;
uniform float uTransparentSurface;
uniform sampler2D uBlurTexture;
uniform float uBlurEnabled;
uniform float uBackgroundBlur;
uniform float uPixelRatio;
uniform float uGlassVisible;
uniform vec3 uHighlightColor;
uniform vec4 uGlassOptics;
uniform float uOpticalTravel;
uniform float uLightSplay;
uniform vec3 uFillColor;
uniform float uFillOpacity;
uniform vec3 uFacet;
uniform vec4 uCutCorners;
uniform vec4 uCutSizes;
uniform vec4 uTouch;
uniform float uTouchRadius;
uniform float uTouchStrength;
uniform vec3 uRim;
uniform vec2 uDirectedLight;
uniform vec4 uScan;
uniform float uScanStrength;
uniform float uExternalReveal;
uniform vec4 uPulseReveal;
uniform vec2 uPulseStyle;
uniform vec3 uPulseColor;
uniform float uPulseOpacity;
uniform float uDecodeSourceTexture;
uniform vec2 uResolution;
uniform vec4 uGlassPanel;
uniform float uGlassPanelEnabled;
uniform float uSourceAspect;
uniform float uTime;
uniform float uIOR;
uniform float uBorderThickness;
uniform float uCornerRadius;
uniform float uDispersion;
uniform float uEdgeDarkening;
uniform float uHighlightStrength;
uniform float uExposure;
uniform float uBrightness;
uniform float uContrast;
uniform float uSaturation;
uniform float uTemperature;
uniform float uTint;
uniform float uGamma;
uniform float uFieldEnabled;
uniform float uFieldStart;
uniform float uFieldSoftness;
uniform float uFieldFadeMode;
uniform float uFieldCurve;
uniform float uFieldStrength;
uniform vec4 uRegionEdges;
uniform float uRegionWidth;
uniform float uRegionSoftness;
uniform float uShapeType;
uniform float uShapeWarp;
uniform float uFlowEnabled;
uniform float uFlowMode;
uniform float uFlowSpeed;
uniform float uFlowStrength;
uniform float uFlowScale;
uniform float uFlowTurbulence;
uniform float uFlowBoundaryDamping;
uniform float uFlowLayerMix;

varying vec2 vUv;

float sdRoundedBox(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + vec2(r);
  return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r;
}

float sdEllipse(vec2 p, vec2 ab) {
  p = abs(p);
  ab = max(ab, vec2(0.001));
  float k0 = length(p / ab);
  float k1 = length(p / (ab * ab));
  if (k1 < 0.00001) return -min(ab.x, ab.y);
  return k0 * (k0 - 1.0) / max(k1, 0.001);
}

float sdDiamond(vec2 p, float r) {
  p = abs(p);
  return (p.x + p.y - r) * 0.70710678;
}

float sdEquilateralTriangle(vec2 p, float r) {
  const float k = 1.7320508;
  p.x = abs(p.x) - r;
  p.y = p.y + r / k;

  if (p.x + k * p.y > 0.0) {
    p = vec2(p.x - k * p.y, -k * p.x - p.y) / 2.0;
  }

  p.x -= clamp(p.x, -2.0 * r, 0.0);
  return -length(p) * sign(p.y);
}

float sdHexagon(vec2 p, float r) {
  const vec3 k = vec3(-0.8660254, 0.5, 0.5773503);
  p = abs(p);
  p -= 2.0 * min(dot(k.xy, p), 0.0) * k.xy;
  p -= vec2(clamp(p.x, -k.z * r, k.z * r), r);
  return length(p) * sign(p.y);
}

float stableAngularWarp(vec2 p, float seed) {
  float angle = atan(p.y, p.x);
  return
    sin(angle * 3.0 + seed) * 0.52 +
    sin(angle * 5.0 - seed * 1.7) * 0.28 +
    sin(angle * 9.0 + seed * 0.6) * 0.16;
}

float directionalFlowPotential(vec2 p, vec2 direction, float time, float scale) {
  vec2 dir = normalize(direction);
  float primary = sin(dot(p, dir) * scale * 6.2831853 + time);
  float secondary = sin(dot(p, vec2(-dir.y, dir.x)) * scale * 4.712389 - time * 0.73);
  return primary + secondary * 0.28;
}

float flowPotential(vec2 p, float time) {
  float mode = floor(uFlowMode + 0.5);
  float scale = clamp(uFlowScale, 0.25, 8.0);
  float speed = clamp(uFlowSpeed, 0.0, 4.0);
  float turbulence = clamp(uFlowTurbulence, 0.0, 1.0);
  float layerMix = clamp(uFlowLayerMix, 0.0, 1.0);
  float phase = time * speed;

  if (mode < 0.5) {
    return 0.0;
  }

  float base = 0.0;

  if (mode < 1.5) {
    base = directionalFlowPotential(p, vec2(-1.0, 0.0), phase, scale);
  } else if (mode < 2.5) {
    base = directionalFlowPotential(p, vec2(1.0, 0.0), phase, scale);
  } else if (mode < 3.5) {
    base = directionalFlowPotential(p, vec2(0.0, 1.0), phase, scale);
  } else if (mode < 4.5) {
    base = directionalFlowPotential(p, vec2(0.0, -1.0), phase, scale);
  } else if (mode < 6.5) {
    float turn = mode < 5.5 ? 1.0 : -1.0;
    float angle = atan(p.y, p.x);
    float radius = length(p);
    base = sin(angle * 3.0 + radius * scale * 5.0 + phase * turn);
  } else if (mode < 8.5) {
    float sourceSign = mode < 7.5 ? -1.0 : 1.0;
    base = sin(length(p) * scale * 7.0 + phase * sourceSign);
  } else if (mode < 9.5) {
    float a = sin(p.x * scale * 4.1 + phase);
    float b = sin(p.y * scale * 5.3 - phase * 0.82);
    float c = sin((p.x - p.y) * scale * 3.7 + phase * 0.41);
    base = a * 0.46 + b * 0.36 + c * 0.28;
  } else if (mode < 10.5) {
    base = sin((p.x + p.y * 0.36) * scale * 6.0 + phase) +
      sin(p.y * scale * 3.2 - phase * 0.5) * 0.35;
  } else {
    base = sin(p.x * scale * 5.2) * sin(phase) +
      sin(p.y * scale * 3.6 + phase * 0.25) * 0.25;
  }

  float layer = sin(dot(p, vec2(0.73, -0.61)) * scale * 8.4 - phase * 1.37) +
    sin(dot(p, vec2(-0.31, 0.92)) * scale * 6.2 + phase * 0.67) * 0.42;
  float organic = stableAngularWarp(p + vec2(sin(phase * 0.17), cos(phase * 0.13)) * 0.08, 3.7);

  return mix(base, layer, layerMix * 0.72) + organic * turbulence * 0.36;
}

vec2 flowGradient(vec2 p, float time) {
  float mode = floor(uFlowMode + 0.5);

  if (uFlowEnabled < 0.5 || mode < 0.5 || uFlowStrength <= 0.0) {
    return vec2(0.0);
  }

  vec2 eps = vec2(0.0022, 0.0);
  float dX = flowPotential(p + eps.xy, time) - flowPotential(p - eps.xy, time);
  float dY = flowPotential(p + eps.yx, time) - flowPotential(p - eps.yx, time);
  vec2 grad = vec2(dX, dY) / (eps.x * 2.0);

  if (mode > 4.5 && mode < 6.5) {
    float turn = mode < 5.5 ? 1.0 : -1.0;
    grad = vec2(-grad.y, grad.x) * turn;
  } else if (mode > 8.5 && mode < 9.5) {
    grad = vec2(-grad.y, grad.x);
  }

  return grad * 0.055;
}

vec2 applyFlowToNormal(vec2 baseNormal, vec2 p, float opticalMask) {
  float strength = clamp(uFlowStrength, 0.0, 1.5);
  float boundaryDamping = clamp(uFlowBoundaryDamping, 0.0, 1.0);
  float mask = clamp(opticalMask, 0.0, 1.0);
  float dampedMask = mask * mix(1.0, smoothstep(0.0, 1.0, mask), boundaryDamping);
  vec2 flowNormal = baseNormal + flowGradient(p, uTime) * strength * dampedMask;

  return length(flowNormal) > 0.00001 ? normalize(flowNormal) : baseNormal;
}

float shapeDistance(vec2 p, vec2 innerSize, float radius) {
  if (uContourEnabled > 0.5) {
    vec2 uv = vec2(p.x / uContourAspect + 0.5, 0.5 - p.y);
    vec2 encodedContour = texture2D(uContourTexture, uv).rg;
    float distance = dot(encodedContour, vec2(65280.0, 255.0)) / 65535.0 * 2.0 - 1.0;
    return distance + max(0.0, 0.5 - innerSize.y);
  }
  float shapeType = floor(uShapeType + 0.5);
  float warp = clamp(uShapeWarp, 0.0, 1.0);
  float baseRadius = max(0.001, min(innerSize.x, innerSize.y));
  float warpScale = baseRadius * 0.105 * warp;

  if (shapeType > 11.5) {
    float shapeD = sdRoundedBox(p, innerSize, 0.0);
    vec4 cuts = baseRadius * 2.0 * clamp(uCutSizes, 0.0, 0.45);
    vec4 limits = vec4(innerSize.x + innerSize.y) - cuts;
    if (uCutCorners.x > 0.5) shapeD = max(shapeD, (-p.x + p.y - limits.x) * 0.70710678);
    if (uCutCorners.y > 0.5) shapeD = max(shapeD, ( p.x + p.y - limits.y) * 0.70710678);
    if (uCutCorners.z > 0.5) shapeD = max(shapeD, ( p.x - p.y - limits.z) * 0.70710678);
    if (uCutCorners.w > 0.5) shapeD = max(shapeD, (-p.x - p.y - limits.w) * 0.70710678);
    return shapeD;
  }

  if (shapeType > 10.5) {
    return sdRoundedBox(p, vec2(baseRadius), 0.0);
  }

  if (shapeType < 0.5) {
    return sdRoundedBox(p, innerSize, radius);
  }

  if (shapeType < 1.5) {
    return length(p) - baseRadius;
  }

  if (shapeType < 2.5) {
    return sdEllipse(p, innerSize);
  }

  if (shapeType < 3.5) {
    return sdDiamond(p, baseRadius * 1.28);
  }

  if (shapeType < 4.5) {
    return sdEquilateralTriangle(p + vec2(0.0, baseRadius * 0.12), baseRadius * 1.2);
  }

  if (shapeType < 5.5) {
    return sdHexagon(p, baseRadius * 1.02);
  }

  if (shapeType < 6.5) {
    return sdEllipse(p, innerSize * vec2(0.92, 0.96)) +
      stableAngularWarp(p, 0.4) * warpScale;
  }

  if (shapeType < 7.5) {
    float capsule = sdRoundedBox(p, vec2(innerSize.x * 0.88, innerSize.y * 0.56), innerSize.y * 0.46);
    float wave = sin(p.x * 12.0 + sin(p.y * 3.0) * 0.8) * warpScale * 1.05;
    return capsule + wave;
  }

  if (shapeType < 8.5) {
    float chipped = sdRoundedBox(p, innerSize * vec2(0.96, 0.9), max(0.0, radius * 0.45));
    float chip = stableAngularWarp(p, 2.15) * warpScale * 1.25;
    return chipped + floor(chip / max(warpScale * 0.32, 0.001)) * warpScale * 0.32;
  }

  if (shapeType < 9.5) {
    float angle = atan(p.y, p.x);
    float petal = cos(angle * 2.0) * warpScale * 1.45;
    return sdEllipse(p, innerSize * vec2(0.78, 1.02)) - petal;
  }

  return sdEllipse(p, innerSize * vec2(0.9, 0.98)) +
    stableAngularWarp(p, 4.2) * warpScale * 1.35;
}

vec2 coverUv(vec2 uv) {
  float canvasAspect = uResolution.x / max(uResolution.y, 1.0);
  float sourceAspect = max(uSourceAspect, 0.01);
  vec2 scale = vec2(1.0);

  if (canvasAspect > sourceAspect) {
    scale.y = sourceAspect / canvasAspect;
  } else {
    scale.x = canvasAspect / sourceAspect;
  }

  return (uv - 0.5) * scale + 0.5;
}

vec3 sampleSource(vec2 uv) {
  vec4 texel = texture2D(uSourceTexture, clamp(coverUv(uv), vec2(0.001), vec2(0.999)));

  if (uDecodeSourceTexture > 0.5) {
    return sRGBTransferEOTF(texel).rgb;
  }

  return texel.rgb;
}

vec3 sampleGlassSource(vec2 uv, float blurAmount) {
  if (uBlurEnabled > 0.5 && blurAmount > 0.001) {
    vec3 blurred = texture2D(uBlurTexture, clamp(uv, vec2(0.0), vec2(1.0))).rgb;
    if (blurAmount >= 0.999) return blurred;
    return mix(sampleSource(uv), blurred, blurAmount);
  }
  return sampleSource(uv);
}

vec3 sampleDispersedSource(vec2 uv, vec2 refractOffset, float chroma, float blurAmount) {
  vec2 centerUv = uv + refractOffset;
  float bendPixels = length(refractOffset * uResolution / max(uPixelRatio, 0.01));
${dispersionSpreadGLSL}
  if (spreadPixels < 0.01) {
    return sampleGlassSource(centerUv, blurAmount);
  }

  vec2 spreadUv = refractOffset * (spreadPixels / max(bendPixels, 0.00001));
  vec3 color = vec3(0.0);
${spectralSampleGLSL}
  return color;
}

${glassLensGLSL}

vec3 applyColorGrade(vec3 color) {
  color = max(color, vec3(0.0));
  color *= exp2(clamp(uExposure, -2.0, 2.0));
  color += vec3(clamp(uBrightness, -0.25, 0.25));
  color = (color - 0.5) * clamp(uContrast, 0.0, 2.0) + 0.5;

  float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
  color = mix(vec3(luma), color, clamp(uSaturation, 0.0, 2.0));

  float temperature = clamp(uTemperature, -1.0, 1.0);
  float tint = clamp(uTint, -1.0, 1.0);
  color += vec3(temperature * 0.055, tint * 0.045, -temperature * 0.055);

  color = max(color, vec3(0.0));
  color = pow(color, vec3(1.0 / clamp(uGamma, 0.4, 2.4)));

  return clamp(color, 0.0, 1.0);
}

${pixelRevealGLSL}

void writeOutputColor(vec3 color, vec3 baseColor, float panelMask, vec2 panelUv, vec2 edgeNormal, float depthPx, float regionMask) {
  vec3 gold = vec3(1.0, 0.78, 0.035);
  if (uGlassOptics.x > 0.5) {
    float facing = dot(edgeNormal, normalize(uDirectedLight + vec2(0.0001)));
    float highlightSpread = mix(12.0, 1.2, clamp(uLightSplay, 0.0, 1.0));
    float directional = pow(max(facing, 0.0), highlightSpread);
    // Lighting stays at the contour, independently of optical depth. The
    // nearest-edge SDF normal must never shade the entire glass interior.
    float edgeBand = exp(-depthPx / max(uRim.z, 0.25))
      * (1.0 - smoothstep(0.0, max(3.0, uRim.z * 3.0), depthPx));
    float light = directional * edgeBand * 0.83 * uRim.y * regionMask;
    float shade = pow(max(-facing, 0.0), 2.0) * edgeBand * uRim.y * regionMask * 0.12;
    color = color * (1.0 - shade) + uHighlightColor * light;
  } else if (uRim.x > 0.5) {
    float edgeBand = exp(-max(depthPx, 0.0) / max(uRim.z, 0.25));
    vec2 direction = normalize(uDirectedLight + vec2(0.0001));
    float facing = dot(edgeNormal, direction);
    float light = pow(max(facing, 0.0), 2.5) * edgeBand * uRim.y * regionMask;
    float shade = pow(max(-facing, 0.0), 1.5) * edgeBand * uRim.y * regionMask * 0.24;
    color = color * (1.0 - shade) + uHighlightColor * light;
  }

  float reveal = 1.0;
  float scanLight = 0.0;
  if (uScan.x < 1.0) {
    float coordinate = 1.0 - panelUv.y;
    if (uScan.z > 0.5 && uScan.z < 1.5) coordinate = panelUv.y;
    if (uScan.z > 1.5 && uScan.z < 2.5) coordinate = panelUv.x;
    if (uScan.z > 2.5) coordinate = 1.0 - panelUv.x;
    float softness = max(uScan.y, 0.001);
    float front = mix(-softness * 2.0, 1.0 + softness * 2.0, uScan.x);
    reveal = 1.0 - smoothstep(front - softness, front, coordinate);
    float axisPixels = uScan.z > 1.5 ? uResolution.x * uGlassPanel.z : uResolution.y * uGlassPanel.w;
    float lineWidth = 1.25 * uPixelRatio / max(axisPixels, 1.0);
    float scanLine = 1.0 - smoothstep(lineWidth * 0.35, lineWidth * 2.0, abs(coordinate - front));
    float scanEnvelope = smoothstep(0.0, 0.08, uScan.x) * (1.0 - smoothstep(0.92, 1.0, uScan.x));
    scanLight = scanLine * scanEnvelope * uScanStrength * regionMask;
    if (uScan.x <= 0.0) reveal = 0.0;
  }

  // Fill is composited over the optics, in linear space, and only inside the panel.
  // At full opacity it resolves to the exact chosen color, without dimming DOM text.
  vec3 materialColor = mix(applyColorGrade(color), uFillColor, clamp(uFillOpacity, 0.0, 1.0));
  float pulseLight = pixelPulseLight(panelUv, uResolution * uGlassPanel.zw / max(uPixelRatio, 0.01));
  materialColor += uPulseColor * pulseLight * uPulseOpacity;
  if (uExternalReveal > 0.5) reveal = 1.0;
  vec3 outputColor = mix(baseColor, materialColor, panelMask * reveal) + gold * scanLight * panelMask;
  float alpha = uTransparentSurface > 0.5
    ? clamp(max(uFillOpacity, texture2D(uSourceTexture, vUv).a) + scanLight + pulseLight * uPulseOpacity, 0.0, 1.0) * panelMask * reveal
    : 1.0;
  gl_FragColor = linearToOutputTexel(vec4(outputColor, alpha));
}

float smootherstep01(float x) {
  x = clamp(x, 0.0, 1.0);
  return x * x * x * (x * (x * 6.0 - 15.0) + 10.0);
}

float signedOpticalPower(float ior) {
  return ior * 0.18032787;
}

float stripMask(float distanceToEdge, float width, float softness) {
  float innerStart = max(0.0, width - softness);
  return 1.0 - smoothstep(innerStart, width, distanceToEdge);
}

float effectRegionMask(vec2 uv) {
  float selected = max(max(uRegionEdges.x, uRegionEdges.y), max(uRegionEdges.z, uRegionEdges.w));

  if (selected < 0.5) {
    return 0.0;
  }

  float width = clamp(uRegionWidth, 0.0, 1.0);
  float softness = clamp(uRegionSoftness, 0.001, 0.5);
  float top = stripMask(1.0 - uv.y, width, softness) * uRegionEdges.x;
  float right = stripMask(1.0 - uv.x, width, softness) * uRegionEdges.y;
  float bottom = stripMask(uv.y, width, softness) * uRegionEdges.z;
  float left = stripMask(uv.x, width, softness) * uRegionEdges.w;

  return clamp(max(max(top, right), max(bottom, left)), 0.0, 1.0);
}

void main() {
  vec3 baseColor = sampleSource(vUv);
  if (uGlassVisible < 0.5) {
    gl_FragColor = linearToOutputTexel(vec4(baseColor, 1.0));
    return;
  }
  vec2 panelSize = max(uGlassPanel.zw, vec2(0.001));
  vec2 panelUv = (vUv - uGlassPanel.xy) / panelSize + 0.5;
  vec2 panelResolution = uResolution * panelSize;
  float aspect = panelResolution.x / max(panelResolution.y, 1.0);
  vec2 aspectCorrection = vec2(aspect, 1.0);
  vec2 p = (panelUv - 0.5) * aspectCorrection;
  float thickness = clamp(uBorderThickness, 0.001, 0.32);
  float radius = clamp(uCornerRadius, 0.0, 0.34);
  vec2 innerSize = vec2(max(0.001, 0.5 * aspect - thickness * aspect), max(0.001, 0.5 - thickness));
  float d = shapeDistance(p, innerSize, radius);
  float chroma = clamp(uDispersion / 0.08, 0.0, 1.0);
  vec2 lightDirection = normalize(vec2(-0.46, -0.89));
  float regionMask = effectRegionMask(panelUv);
  float panelMask = 1.0;
  vec2 outerSize = vec2(0.5 * aspect, 0.5);
  float panelDistance = shapeDistance(p, outerSize, radius);
  float depthPx = max(0.0, -panelDistance * panelResolution.y / max(uPixelRatio, 0.01));

  if (uGlassPanelEnabled > 0.5 || uShapeType > 10.5) {
    float aa = 1.5 / max(panelResolution.y, 1.0);
    panelMask = 1.0 - smoothstep(-aa, aa, panelDistance);

    if (panelMask <= 0.0) {
      gl_FragColor = linearToOutputTexel(vec4(baseColor, uTransparentSurface > 0.5 ? 0.0 : 1.0));
      return;
    }
  }

  vec2 edgeNormal = vec2(0.0);
  if (uFacet.x > 0.5 || uRim.x > 0.5 || uGlassOptics.x > 0.5) {
    float edgeEpsilon = 0.75 / max(panelResolution.y, 1.0);
    vec2 epsEdge = vec2(edgeEpsilon, 0.0);
    vec2 edgeGrad = vec2(
      shapeDistance(p + epsEdge.xy, outerSize, radius) - shapeDistance(p - epsEdge.xy, outerSize, radius),
      shapeDistance(p + epsEdge.yx, outerSize, radius) - shapeDistance(p - epsEdge.yx, outerSize, radius)
    );
    if (length(edgeGrad) > 0.00001) edgeNormal = normalize(edgeGrad);
  }

  float blurAmount = 1.0;
  vec2 surfaceOffset = vec2(0.0);
  vec2 facetOffset = vec2(0.0);
  if (uFacet.x > 0.5) {
    float width = max(uFacet.y, 0.5);
    blurAmount = smoothstep(width * 0.8, width * 1.65, depthPx);
    float facetCurve = sin(clamp(depthPx / (width * 1.65), 0.0, 1.0) * 3.14159265);
    if (uGlassOptics.x < 0.5) {
      facetOffset = edgeNormal * signedOpticalPower(uIOR) * uFacet.z * width * 1.5 * facetCurve * uPixelRatio / uResolution;
      surfaceOffset += facetOffset;
    }
  }

  if (uTouch.z > 0.0001) {
    vec2 touchPanelUv = (uTouch.xy - uGlassPanel.xy) / panelSize + 0.5;
    vec2 delta = (panelUv - touchPanelUv) * aspectCorrection;
    float touchRadius = max(uTouchRadius * min(aspect, 1.0), 0.001);
    float normalizedDistance = length(delta) / touchRadius;
    float dent = exp(-normalizedDistance * normalizedDistance * 3.0);
    float boundary = smoothstep(0.0, max(3.0, touchRadius * panelResolution.y / uPixelRatio * 0.2), depthPx);
    surfaceOffset += delta * dent * uTouch.z * uTouchStrength * 0.34 * boundary / aspectCorrection * panelSize;
  }

  if (uGlassOptics.x > 0.5) {
${glassRefractionGLSL}
    writeOutputColor(mix(baseColor, opticalColor, regionMask), baseColor, panelMask, panelUv, edgeNormal, depthPx, regionMask);
    return;
  }

  // Blur belongs to the glass body; it must not dissolve with the center field.
  vec3 glassBaseColor = mix(baseColor, sampleGlassSource(vUv + surfaceOffset, blurAmount), regionMask);

  // Legacy presets keep their field and IOR, but chroma stays near the boundary.
  float spectralEdge = 1.0 - smoothstep(0.0, max(4.0, thickness * panelResolution.y / uPixelRatio), depthPx);
  chroma *= spectralEdge;

  if (uFieldEnabled > 0.5) {
    vec2 centerVector = (panelUv - 0.5) * aspectCorrection;
    vec2 normalizedCenter = vec2(
      abs(centerVector.x) / max(0.5 * aspect, 0.001),
      abs(centerVector.y) / 0.5
    );
    float ellipseTravel = length(normalizedCenter);
    float rectTravel = max(normalizedCenter.x, normalizedCenter.y);
    float edgeBlend = smoothstep(0.72, 1.18, ellipseTravel);
    float edgeTravel = mix(ellipseTravel, rectTravel, edgeBlend * 0.16);
    float fieldStart = clamp(uFieldStart, 0.0, 0.9);
    float fieldSoftness = clamp(uFieldSoftness, 0.04, 1.0);
    float fieldCurve = clamp(uFieldCurve, 0.35, 6.0);
    float fadeProgress = clamp((edgeTravel - fieldStart) / max(fieldSoftness, 0.001), 0.0, 1.0);
    float longRamp = smoothstep(max(0.0, fieldStart - fieldSoftness * 0.45), 1.18, edgeTravel);
    float maskFade = pow(smoothstep(0.0, 1.0, fadeProgress) * longRamp, fieldCurve);
    float dissolveFade = pow(smootherstep01(fadeProgress), max(0.6, fieldCurve * 0.82)) * longRamp;
    float masterFade = mix(maskFade, dissolveFade, step(0.5, uFieldFadeMode)) * regionMask;

    vec2 normal = length(centerVector) > 0.00001 ? normalize(centerVector) : vec2(0.0);
    vec2 opticalNormal = applyFlowToNormal(normal, p, masterFade);
    float fieldStrength = clamp(uFieldStrength, 0.0, 2.5);
    float pull = signedOpticalPower(uIOR) * masterFade * fieldStrength * (0.055 + thickness * 0.38);
    vec2 refractOffset = opticalNormal * pull / aspectCorrection * panelSize;
    vec3 opticalColor = sampleDispersedSource(vUv + surfaceOffset - facetOffset, refractOffset + facetOffset, chroma, blurAmount);
    float edgeMask = smoothstep(max(fieldStart + fieldSoftness * 0.65, 0.52), 1.2, edgeTravel) * masterFade;
    float rimLight = pow(max(dot(opticalNormal, -lightDirection), 0.0), 2.8) * edgeMask;
    float lowerLip = smoothstep(0.58, 1.0, panelUv.y) * edgeMask;
    float sweep = smoothstep(0.025, 0.0, abs(panelUv.x - fract(uTime * 0.05 + panelUv.y * 0.26))) * edgeMask;
    float highlight = (rimLight * 0.72 + lowerLip * 0.24 + sweep * 0.12) * uHighlightStrength;
    vec3 highlightColor = uHighlightColor * (rimLight + lowerLip * 0.8);
    float absorption = edgeMask * clamp(uEdgeDarkening, 0.0, 1.0) * (0.28 + masterFade * 0.42);

    opticalColor = mix(opticalColor, opticalColor * (1.0 - absorption), edgeMask);
    opticalColor += highlightColor * highlight;

    writeOutputColor(mix(glassBaseColor, opticalColor, masterFade), baseColor, panelMask, panelUv, edgeNormal, depthPx, regionMask);
    return;
  }

  if (d < -0.001) {
    writeOutputColor(glassBaseColor, baseColor, panelMask, panelUv, edgeNormal, depthPx, regionMask);
    return;
  }

  vec2 eps = vec2(0.0015, 0.0);
  float dX = shapeDistance(p + eps.xy, innerSize, radius) - shapeDistance(p - eps.xy, innerSize, radius);
  float dY = shapeDistance(p + eps.yx, innerSize, radius) - shapeDistance(p - eps.yx, innerSize, radius);
  vec2 grad = vec2(dX, dY);
  vec2 normal = length(grad) > 0.00001 ? normalize(grad) : vec2(0.0);

  float borderMask = smoothstep(-0.001, thickness * 0.15, d) *
    (1.0 - smoothstep(thickness * 0.62, thickness * 1.24, d));
  borderMask *= regionMask;
  float bevel = pow(1.0 - clamp(d / max(thickness, 0.001), 0.0, 1.0), 0.58);
  vec2 opticalNormal = applyFlowToNormal(normal, p, borderMask);
  float pull = signedOpticalPower(uIOR) * borderMask * (0.07 + thickness * 0.62);
  vec2 refractOffset = opticalNormal * pull / aspectCorrection * panelSize;
  vec3 color = mix(baseColor, sampleDispersedSource(vUv + surfaceOffset - facetOffset, refractOffset + facetOffset, chroma, blurAmount), regionMask);
  float rimLight = pow(max(dot(opticalNormal, -lightDirection), 0.0), 2.8) * borderMask;
  float lowerLip = smoothstep(0.56, 1.0, panelUv.y) * borderMask;
  float sweep = smoothstep(0.025, 0.0, abs(panelUv.x - fract(uTime * 0.055 + panelUv.y * 0.28)));
  float highlight = (rimLight * 0.82 + lowerLip * 0.28 + sweep * 0.18) * uHighlightStrength;
  vec3 highlightColor = uHighlightColor * (rimLight + lowerLip * 0.8);

  float absorption = borderMask * bevel * clamp(uEdgeDarkening, 0.0, 1.0);
  color = mix(color, color * (1.0 - absorption), borderMask);
  color += highlightColor * highlight;

  writeOutputColor(color, baseColor, panelMask, panelUv, edgeNormal, depthPx, regionMask);
}
`

export class WebGLVideoEdgeGlassRenderer {
  private backgroundBlurPass?: BackgroundBlurPass
  private glassPanel?: GlassPanel
  private readonly motion = new GlassMotion()
  private lastRenderTime: number | null = null
  private readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
  private readonly canvas: HTMLCanvasElement
  private disposed = false
  private readonly fixedPixelRatio?: number
  private readonly pixelBudget?: number
  private densityCap: number
  private bufferSignature = ''
  private contourSignature = ''
  private lastPresentedTime: number | null = null
  private started = false
  private draws = 0
  private sourceUpdates = 1
  private contourUpdates = 0
  private readonly onActivity?: (running: boolean) => void
  private readonly idleWhenSettled: boolean
  private readonly sourceIsEmpty: boolean
  private renderEnabled = true
  private readonly geometry = new THREE.PlaneGeometry(2, 2)
  private readonly material: THREE.ShaderMaterial
  private readonly mesh: THREE.Mesh
  private readonly renderer: THREE.WebGLRenderer
  private readonly resizeObserver: ResizeObserver
  private readonly scene = new THREE.Scene()
  private settings: LiquidGlassSettings
  private readonly source: RenderSourceElement
  private sourceNaturalSize?: SourceSize
  private videoFrameHandle: number | null = null
  private readonly sourceTexture: THREE.Texture
  private contourTexture?: THREE.DataTexture
  private readonly rain?: MatrixRainRenderer | MatrixPulseRenderer
  private showGlass: boolean
  private readonly onRevealProgress?: (progress: number) => void
  private readonly onPulseReveal?: (state: PixelRevealState) => void
  private readonly pulseReveal = new PanelPulseReveal()

  constructor({
    autoResize = true,
    canvas,
    fixedPixelRatio,
    pixelBudget,
    densityCap = 1,
    idleWhenSettled = false,
    sourceIsEmpty = false,
    externalReveal = false,
    transparentCanvas = false,
    glassPanel,
    preserveDrawingBuffer = false,
    settings,
    source,
    sourceNaturalSize,
    background,
    showGlass = true,
    onRevealProgress,
    onPulseReveal,
    onActivity,
  }: RendererOptions) {
    this.canvas = canvas
    this.fixedPixelRatio = fixedPixelRatio
    this.pixelBudget = pixelBudget
    this.densityCap = densityCap
    this.onActivity = onActivity
    this.idleWhenSettled = idleWhenSettled
    this.sourceIsEmpty = sourceIsEmpty
    if (background) {
      const preset = resolveBackgroundPreset(background)
      this.rain = preset.kind === 'matrix-pulse' ? new MatrixPulseRenderer(preset.settings) : new MatrixRainRenderer(preset.settings)
      source = this.rain.canvas
    }
    this.showGlass = showGlass
    this.onRevealProgress = onRevealProgress
    this.onPulseReveal = onPulseReveal
    this.source = source
    this.sourceNaturalSize = sourceNaturalSize
    settings = normalizeLiquidGlassSettings(settings)
    this.settings = settings
    this.glassPanel = glassPanel
    this.renderer = new THREE.WebGLRenderer({
      alpha: transparentCanvas,
      antialias: true,
      canvas,
      depth: false,
      powerPreference: 'high-performance',
      preserveDrawingBuffer,
      stencil: false,
    })
    this.renderer.setClearColor(0x020202, transparentCanvas ? 0 : 1)
    this.renderer.outputColorSpace = THREE.SRGBColorSpace

    this.sourceTexture = this.createSourceTexture(source)

    this.material = new THREE.ShaderMaterial({
      depthTest: false,
      depthWrite: false,
      transparent: transparentCanvas,
      fragmentShader,
      uniforms: {
        uPixelRatio: { value: 1 },
        uGlassVisible: { value: showGlass ? 1 : 0 },
        uHighlightColor: { value: new THREE.Color() },
        uPulseColor: { value: new THREE.Color() },
        uPulseOpacity: { value: settings.pulseOpacity },
        uGlassOptics: { value: new THREE.Vector4() },
        uOpticalTravel: { value: 0 },
        uLightSplay: { value: settings.figmaSplay },
        uFillColor: { value: new THREE.Color() },
        uFillOpacity: { value: settings.fillOpacity },
        uFacet: { value: new THREE.Vector3() },
        uCutCorners: { value: new THREE.Vector4() },
        uCutSizes: { value: new THREE.Vector4() },
        uTouch: { value: new THREE.Vector4(0.5, 0.5, 0, 0) },
        uTouchRadius: { value: settings.touchRadius },
        uTouchStrength: { value: settings.touchStrength },
        uRim: { value: new THREE.Vector3() },
        uDirectedLight: { value: new THREE.Vector2(-Math.SQRT1_2, Math.SQRT1_2) },
        uScan: { value: new THREE.Vector4(1, settings.scanSoftness, settings.scanDirection, 0) },
        uScanStrength: { value: settings.scanStrength },
        uExternalReveal: { value: externalReveal ? 1 : 0 },
        uPulseReveal: { value: new THREE.Vector4(0, 0, 1, settings.pulseCellSize) },
        uPulseStyle: { value: new THREE.Vector2(settings.pulseSoftness, settings.pulseStrength) },
        uBorderThickness: { value: settings.edgeThickness },
        uCornerRadius: { value: settings.cornerRadius },
        uDispersion: { value: settings.dispersion },
        uEdgeDarkening: { value: settings.edgeDarkening },
        uExposure: { value: settings.exposure },
        uBrightness: { value: settings.brightness },
        uContrast: { value: settings.contrast },
        uSaturation: { value: settings.saturation },
        uTemperature: { value: settings.temperature },
        uTint: { value: settings.tint },
        uGamma: { value: settings.gamma },
        uFieldCurve: { value: settings.fieldCurve },
        uFieldEnabled: { value: settings.fieldEnabled ? 1 : 0 },
        uFieldFadeMode: { value: settings.fieldFadeMode },
        uFieldSoftness: { value: settings.fieldSoftness },
        uFieldStart: { value: settings.fieldStart },
        uFieldStrength: { value: settings.fieldStrength },
        uFlowBoundaryDamping: { value: settings.flowBoundaryDamping },
        uFlowEnabled: { value: settings.flowEnabled ? 1 : 0 },
        uFlowLayerMix: { value: settings.flowLayerMix },
        uFlowMode: { value: settings.flowMode },
        uFlowScale: { value: settings.flowScale },
        uFlowSpeed: { value: settings.flowSpeed },
        uFlowStrength: { value: settings.flowStrength },
        uFlowTurbulence: { value: settings.flowTurbulence },
        uHighlightStrength: { value: settings.highlightStrength },
        uIOR: { value: settings.ior },
        uRegionEdges: {
          value: new THREE.Vector4(
            settings.regionTop ? 1 : 0,
            settings.regionRight ? 1 : 0,
            settings.regionBottom ? 1 : 0,
            settings.regionLeft ? 1 : 0,
          ),
        },
        uRegionSoftness: { value: settings.regionSoftness },
        uRegionWidth: { value: settings.regionWidth },
        uShapeType: { value: settings.shapeType },
        uShapeWarp: { value: settings.shapeWarp },
        uResolution: { value: new THREE.Vector2(1, 1) },
        uGlassPanel: { value: new THREE.Vector4(...getGlassPanelShaderRect(glassPanel)) },
        uGlassPanelEnabled: { value: glassPanel ? 1 : 0 },
        uTime: { value: 0 },
        uDecodeSourceTexture: { value: this.isVideoSource(source) ? 1 : 0 },
        uSourceAspect: { value: 16 / 9 },
        uSourceTexture: { value: this.sourceTexture },
        uContourTexture: { value: null },
        uContourEnabled: { value: 0 },
        uContourAspect: { value: 1 },
        uTransparentSurface: { value: 0 },
        uBlurTexture: { value: this.sourceTexture },
        uBlurEnabled: { value: 0 },
        uBackgroundBlur: { value: settings.backgroundBlur },
      },
      vertexShader,
    })
    this.mesh = new THREE.Mesh(this.geometry, this.material)
    this.scene.add(this.mesh)
    this.resizeObserver = new ResizeObserver(() => this.resize())

    if (autoResize) {
      this.resizeObserver.observe(canvas)
    }

    this.updateSettings(settings)
    this.motion.settle(this.settings, this.glassPanel)
    this.pulseReveal.finish()
  }

  private createSourceTexture(source: RenderSourceElement) {
    const texture = this.isVideoSource(source) ? new THREE.VideoTexture(source)
      : source.tagName.toLowerCase() === 'canvas' ? new THREE.CanvasTexture(source as HTMLCanvasElement) : new THREE.Texture(source)

    texture.colorSpace = THREE.SRGBColorSpace
    texture.generateMipmaps = false
    texture.magFilter = THREE.LinearFilter
    texture.minFilter = THREE.LinearFilter
    texture.needsUpdate = true

    return texture
  }

  dispose() {
    this.disposed = true
    this.renderer.setAnimationLoop(null)
    this.resizeObserver.disconnect()
    const source = this.source as VideoSourceElement

    if (this.videoFrameHandle !== null && this.isVideoSource(this.source) && source.cancelVideoFrameCallback) {
      source.cancelVideoFrameCallback(this.videoFrameHandle)
    }

    this.backgroundBlurPass?.dispose()
    this.rain?.dispose()
    this.sourceTexture.dispose()
    this.contourTexture?.dispose()
    this.geometry.dispose()
    this.material.dispose()
    this.renderer.dispose()
  }

  start() {
    this.resize()
    this.replayReveal()
    this.started = true

    if (this.isVideoSource(this.source)) {
      this.startVideoFrameLoop()
    }

    this.canvas.dataset.glassIdle = 'true'
    this.wake()
  }

  renderFrame(timeSeconds: number) {
    // Exports are snapshots of the finished material, never the invisible intro frame.
    this.motion.settle(this.settings, this.glassPanel)
    this.pulseReveal.finish()
    if (this.isVideoSource(this.source)) {
      this.sourceTexture.needsUpdate = true
      this.backgroundBlurPass?.invalidate()
    }

    this.render(timeSeconds * 1000, true)
  }

  resizeTo(size: SourceSize) {
    const width = Math.max(1, Math.round(size.width))
    const height = Math.max(1, Math.round(size.height))

    this.renderer.setPixelRatio(1)
    this.renderer.setSize(width, height, false)
    this.material.uniforms.uResolution.value.set(this.canvas.width, this.canvas.height)
    this.material.uniforms.uPixelRatio.value = 1
    this.material.uniforms.uSourceAspect.value = this.getSourceAspect()
    this.updateOpticalTravel()
  }

  updateSourceNaturalSize(sourceNaturalSize: SourceSize) {
    if (this.sourceNaturalSize?.width === sourceNaturalSize.width && this.sourceNaturalSize?.height === sourceNaturalSize.height) return
    this.sourceNaturalSize = sourceNaturalSize
    this.backgroundBlurPass?.invalidate()
    this.resize()
  }

  /** Resize the same scene. No reveal, clock, pointer, geometry or contour reset. */
  setDensityCap(cap: number) {
    if (this.densityCap === cap) return
    this.densityCap = cap; this.resize()
  }
  refreshFrame() { this.render(this.lastPresentedTime ?? performance.now(), true, false) }
  diagnostics() {
    const source = this.source as HTMLCanvasElement
    return { density: this.renderer.getPixelRatio(), buffer: [this.canvas.width, this.canvas.height], source: [source.width, source.height],
      blur: this.backgroundBlurPass?.size ?? [0, 0], draws: this.draws, blurUpdates: this.backgroundBlurPass?.updates ?? 0,
      sourceUpdates: this.sourceUpdates, contourUpdates: this.contourUpdates, idle: this.canvas.dataset.glassIdle === 'true' }
  }

  /** Product adapter: sample the actual supplied contour rather than a new rectangle. */
  updateContour(shape: GlassShape, transparent = false) {
    const signature = `${shape.width}|${shape.height}|${shape.path}|${transparent}`
    if (signature === this.contourSignature) return
    this.contourSignature = signature
    const { pixels, width, height } = contourPixels(shape)
    const texture = this.contourTexture ?? new THREE.DataTexture(pixels, width, height, THREE.RGBAFormat)
    texture.image = { data: pixels, width, height }
    texture.minFilter = THREE.LinearFilter; texture.magFilter = THREE.LinearFilter
    texture.generateMipmaps = false; texture.needsUpdate = true
    this.contourTexture = texture; this.contourUpdates += 1
    this.material.uniforms.uContourTexture.value = texture
    this.material.uniforms.uContourAspect.value = shape.width / shape.height
    this.material.uniforms.uContourEnabled.value = 1
    this.material.uniforms.uTransparentSurface.value = transparent ? 1 : 0
  }

  invalidateSource() {
    this.sourceTexture.needsUpdate = true
    this.sourceUpdates += 1
    this.backgroundBlurPass?.invalidate()
    this.wake()
  }

  setActive(active: boolean) {
    if (this.renderEnabled === active) return
    this.renderEnabled = active
    if (active) this.wake()
    else { this.lastRenderTime = null; this.renderer.setAnimationLoop(null); this.canvas.dataset.glassIdle = 'true'; this.onActivity?.(false); this.releasePointer() }
  }

  private wake() {
    if (!this.renderEnabled || this.disposed) return
    if (this.canvas.dataset.glassIdle === 'false') return
    this.lastRenderTime = null
    this.canvas.dataset.glassIdle = 'false'
    this.onActivity?.(true)
    this.renderer.setAnimationLoop(time => {
      if (this.lastRenderTime === null || time - this.lastRenderTime >= 1000 / 30) this.render(time)
    })
  }

  updateGlassPanel(glassPanel?: GlassPanel) {
    this.glassPanel = glassPanel
    this.material.uniforms.uGlassPanel.value.set(...getGlassPanelShaderRect(glassPanel))
    this.material.uniforms.uGlassPanelEnabled.value = glassPanel ? 1 : 0
    this.updateOpticalTravel()
  }

  updateSettings(settings: LiquidGlassSettings) {
    settings = normalizeLiquidGlassSettings(settings)
    const scanJustEnabled = settings.scanEnabled && !this.settings.scanEnabled
    this.settings = settings
    this.material.uniforms.uBackgroundBlur.value = settings.backgroundBlur
    this.material.uniforms.uHighlightColor.value.setStyle(settings.highlightColor, THREE.SRGBColorSpace)
    this.material.uniforms.uPulseColor.value.setStyle(settings.pulseColor, THREE.SRGBColorSpace)
    this.material.uniforms.uPulseOpacity.value = settings.pulseOpacity
    this.material.uniforms.uGlassOptics.value.set(settings.figmaGlassEnabled ? 1 : 0, settings.figmaRefraction,
      settings.figmaDepth, settings.figmaDispersion)
    this.material.uniforms.uLightSplay.value = settings.figmaSplay
    this.material.uniforms.uFillColor.value.setStyle(settings.fillColor, THREE.SRGBColorSpace)
    this.material.uniforms.uFillOpacity.value = settings.fillOpacity
    this.material.uniforms.uFacet.value.set(settings.facetEnabled ? 1 : 0, settings.facetWidth, settings.facetStrength)
    this.material.uniforms.uCutCorners.value.set(settings.cutTopLeft ? 1 : 0, settings.cutTopRight ? 1 : 0,
      settings.cutBottomRight ? 1 : 0, settings.cutBottomLeft ? 1 : 0)
    this.material.uniforms.uCutSizes.value.set(settings.cutSizeTopLeft, settings.cutSizeTopRight,
      settings.cutSizeBottomRight, settings.cutSizeBottomLeft)
    this.material.uniforms.uTouchRadius.value = settings.touchRadius
    this.material.uniforms.uTouchStrength.value = settings.touchStrength
    this.material.uniforms.uRim.value.set(settings.rimEnabled ? 1 : 0, settings.rimStrength, settings.rimWidth)
    this.material.uniforms.uScanStrength.value = settings.scanStrength
    this.material.uniforms.uPulseStyle.value.set(settings.pulseSoftness, settings.pulseStrength)
    if (!settings.pulseRevealEnabled) this.pulseReveal.finish()
    if (scanJustEnabled) this.replayReveal()
    if (!settings.scanEnabled) this.motion.finishReveal()
    this.material.uniforms.uIOR.value = settings.ior
    this.material.uniforms.uBorderThickness.value = settings.edgeThickness
    this.material.uniforms.uCornerRadius.value = settings.cornerRadius
    this.material.uniforms.uDispersion.value = settings.dispersion
    this.material.uniforms.uEdgeDarkening.value = settings.edgeDarkening
    this.material.uniforms.uExposure.value = settings.exposure
    this.material.uniforms.uBrightness.value = settings.brightness
    this.material.uniforms.uContrast.value = settings.contrast
    this.material.uniforms.uSaturation.value = settings.saturation
    this.material.uniforms.uTemperature.value = settings.temperature
    this.material.uniforms.uTint.value = settings.tint
    this.material.uniforms.uGamma.value = settings.gamma
    this.material.uniforms.uFieldCurve.value = settings.fieldCurve
    this.material.uniforms.uFieldEnabled.value = settings.fieldEnabled ? 1 : 0
    this.material.uniforms.uFieldFadeMode.value = settings.fieldFadeMode
    this.material.uniforms.uFieldSoftness.value = settings.fieldSoftness
    this.material.uniforms.uFieldStart.value = settings.fieldStart
    this.material.uniforms.uFieldStrength.value = settings.fieldStrength
    this.material.uniforms.uFlowBoundaryDamping.value = settings.flowBoundaryDamping
    this.material.uniforms.uFlowEnabled.value = settings.flowEnabled ? 1 : 0
    this.material.uniforms.uFlowLayerMix.value = settings.flowLayerMix
    this.material.uniforms.uFlowMode.value = settings.flowMode
    this.material.uniforms.uFlowScale.value = settings.flowScale
    this.material.uniforms.uFlowSpeed.value = settings.flowSpeed
    this.material.uniforms.uFlowStrength.value = settings.flowStrength
    this.material.uniforms.uFlowTurbulence.value = settings.flowTurbulence
    this.material.uniforms.uHighlightStrength.value = settings.highlightStrength
    this.material.uniforms.uRegionEdges.value.set(
      settings.regionTop ? 1 : 0,
      settings.regionRight ? 1 : 0,
      settings.regionBottom ? 1 : 0,
      settings.regionLeft ? 1 : 0,
    )
    this.material.uniforms.uRegionSoftness.value = settings.regionSoftness
    this.material.uniforms.uRegionWidth.value = settings.regionWidth
    this.material.uniforms.uShapeType.value = settings.shapeType
    this.material.uniforms.uShapeWarp.value = settings.shapeWarp
    this.resize()
    this.publishReveal()
  }

  private render(time: number, force = false, advance = true) {
    if (this.disposed || (!force && document.visibilityState === 'hidden')) {
      this.lastRenderTime = null
      return
    }

    const ratio = this.renderer.getPixelRatio()
    if (this.rain?.draw(time / 1000, this.canvas.width / ratio, this.canvas.height / ratio, ratio, this.motion.reducedMotion)) {
      this.sourceTexture.needsUpdate = true
      this.material.uniforms.uSourceAspect.value = this.canvas.width / this.canvas.height
      this.backgroundBlurPass?.invalidate()
    }

    if (this.isVideoSource(this.source) && !(this.source as VideoSourceElement).requestVideoFrameCallback) {
      this.sourceTexture.needsUpdate = true
      this.backgroundBlurPass?.invalidate()
    }

    const dt = !advance || this.lastRenderTime === null ? 0 : Math.max(0, (time - this.lastRenderTime) / 1000)
    if (advance) this.lastRenderTime = time
    this.motion.step(dt, this.settings, this.glassPanel)
    this.pulseReveal.step(dt, this.settings.pulseDuration, this.settings.pulseRevealEnabled, this.motion.reducedMotion)
    this.material.uniforms.uTouch.value.set(this.motion.pointerX, 1 - this.motion.pointerY, this.motion.pressure, 0)
    this.material.uniforms.uDirectedLight.value.set(this.motion.lightX, this.motion.lightY)
    this.publishReveal()

    // Blurring an empty transparent texture cannot change the result.
    const blurRadius = this.showGlass && !this.sourceIsEmpty ? this.settings.backgroundBlur : 0
    this.canvas.dataset.glassBlurPass = blurRadius > 0 ? 'true' : 'false'
    this.material.uniforms.uBlurEnabled.value = blurRadius > 0 ? 1 : 0
    if (blurRadius > 0) {
      this.backgroundBlurPass ??= new BackgroundBlurPass(this.renderer, this.sourceTexture, this.isVideoSource(this.source))
      this.backgroundBlurPass.configure(
        this.canvas.width,
        this.canvas.height,
        this.renderer.getPixelRatio(),
        this.material.uniforms.uSourceAspect.value,
        blurRadius,
      )
      this.backgroundBlurPass.render()
      this.material.uniforms.uBlurTexture.value = this.backgroundBlurPass.texture
    }

    this.material.uniforms.uTime.value = time / 1000
    this.renderer.render(this.scene, this.camera)
    this.lastPresentedTime = time; this.draws += 1
    if (this.idleWhenSettled && this.motion.scanProgress >= 1 && this.motion.pressure === 0 && this.pulseReveal.progress >= 1) {
      this.renderer.setAnimationLoop(null)
      this.canvas.dataset.glassIdle = 'true'
      this.onActivity?.(false)
      this.lastRenderTime = null
    }
  }

  private resize() {
    const rect = this.canvas.getBoundingClientRect()
    const css = getComputedStyle(this.canvas)
    const width = Math.max(1, parseFloat(css.width) || this.canvas.clientWidth || rect.width)
    const height = Math.max(1, parseFloat(css.height) || this.canvas.clientHeight || rect.height)
    const layout = glassBufferLayout(width, height, Math.min(this.densityCap, this.fixedPixelRatio ?? this.settings.pixelRatio), this.pixelBudget)
    const pixelRatio = layout.density
    const signature = `${width}|${height}|${pixelRatio}`
    if (signature === this.bufferSignature) return
    this.bufferSignature = signature
    this.canvas.dataset.glassDensity = pixelRatio.toFixed(3)
    // Use the bounded integer layout directly: Three floors CSS size × ratio.
    this.renderer.setPixelRatio(1)
    this.renderer.setSize(layout.width, layout.height, false)
    this.material.uniforms.uResolution.value.set(this.canvas.width, this.canvas.height)
    this.material.uniforms.uPixelRatio.value = pixelRatio
    this.material.uniforms.uSourceAspect.value = this.getSourceAspect()
    this.updateOpticalTravel()
    // Present synchronously after a backing-buffer resize; never expose its clear frame.
    if (this.started) this.refreshFrame()
  }

  private updateOpticalTravel() {
    const panel = this.material.uniforms.uGlassPanel.value as THREE.Vector4
    const resolution = this.material.uniforms.uResolution.value as THREE.Vector2
    const shortSide = Math.min(resolution.x * panel.z, resolution.y * panel.w)
      / Math.max(this.material.uniforms.uPixelRatio.value, .01)
    this.material.uniforms.uOpticalTravel.value = getOpticalTravel(
      this.settings.figmaDepth, this.settings.figmaRefraction, shortSide,
    )
  }

  updatePointer(x: number, y: number, pressed: boolean) {
    this.motion.setPointer(x, y, pressed)
    if (pressed) this.wake()
  }

  updateBackground(settings: BackgroundInput) {
    const preset = resolveBackgroundPreset(settings)
    if (preset.kind === 'matrix-pulse' && this.rain instanceof MatrixPulseRenderer) this.rain.update(preset.settings)
    if (preset.kind === 'matrix-rain' && this.rain instanceof MatrixRainRenderer) this.rain.update(preset.settings)
  }
  restartBackground() { this.rain?.restart() }
  setGlassVisible(visible: boolean) {
    this.showGlass = visible
    this.material.uniforms.uGlassVisible.value = visible ? 1 : 0
    if (visible) this.replayReveal()
  }

  releasePointer() {
    this.motion.releasePointer()
  }

  addScrollImpulse(deltaPixels: number) {
    this.motion.addScroll(deltaPixels)
  }

  replayReveal() {
    this.lastRenderTime = null
    this.pulseReveal.finish()
    this.motion.replayReveal(this.settings.scanEnabled)
    this.publishReveal()
  }

  private publishReveal() {
    this.material.uniforms.uScan.value.set(this.motion.scanProgress, this.settings.scanSoftness, this.settings.scanDirection, 0)
    this.onRevealProgress?.(this.motion.scanProgress)
    const ratio = Math.max(this.renderer.getPixelRatio(), .01)
    const state = makePixelRevealState(this.pulseReveal.x, this.pulseReveal.y, this.pulseReveal.progress,
      this.canvas.width / ratio, this.canvas.height / ratio, this.settings.pulseCellSize, this.settings.pulseSoftness, this.glassPanel)
    const origin = getPixelRevealOrigin(state)
    this.material.uniforms.uPulseReveal.value.set(origin.x, origin.y, state.progress, state.cellSize)
    this.onPulseReveal?.(state)
  }

  triggerPulse(x: number, y: number, animatePanel = true) {
    if (this.rain instanceof MatrixPulseRenderer) this.rain.tap(x, y)
    if (animatePanel && this.showGlass && this.settings.pulseRevealEnabled && this.motion.scanProgress >= 1) {
      this.pulseReveal.trigger(x, y, this.motion.reducedMotion)
      this.publishReveal()
      this.wake()
    }
  }

  previewPixelPulse() { this.triggerPulse(this.glassPanel?.x ?? 0.5, this.glassPanel?.y ?? 0.5) }

  setReducedMotion(reduced: boolean) {
    this.motion.reducedMotion = reduced
    if (reduced) { this.motion.finishReveal(); this.pulseReveal.finish() }
    this.publishReveal()
  }

  private startVideoFrameLoop() {
    if (!this.isVideoSource(this.source)) {
      return
    }

    const source = this.source as VideoSourceElement

    if (!source.requestVideoFrameCallback) {
      return
    }

    const updateTexture = () => {
      this.sourceTexture.needsUpdate = true
      this.backgroundBlurPass?.invalidate()

      if (!this.disposed && source.requestVideoFrameCallback) {
        this.videoFrameHandle = source.requestVideoFrameCallback(updateTexture)
      }
    }

    this.videoFrameHandle = source.requestVideoFrameCallback(updateTexture)
  }

  private getSourceAspect() {
    if (this.rain) return this.canvas.width / Math.max(1, this.canvas.height)
    if (
      this.sourceNaturalSize &&
      this.sourceNaturalSize.width > 0 &&
      this.sourceNaturalSize.height > 0
    ) {
      return this.sourceNaturalSize.width / this.sourceNaturalSize.height
    }

    if (this.isVideoSource(this.source) && this.source.videoWidth > 0 && this.source.videoHeight > 0) {
      return this.source.videoWidth / this.source.videoHeight
    }

    if ('naturalWidth' in this.source && this.source.naturalWidth > 0 && this.source.naturalHeight > 0) {
      return this.source.naturalWidth / this.source.naturalHeight
    }

    return 16 / 9
  }

  private isVideoSource(source: RenderSourceElement): source is HTMLVideoElement {
    return source.tagName.toLowerCase() === 'video'
  }
}
