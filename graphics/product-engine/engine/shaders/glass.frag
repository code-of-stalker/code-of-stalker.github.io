#version 450
layout(std140,set=0,binding=0) uniform Params {vec4 _data[128];};
layout(set=0,binding=1) uniform texture2D texSource;
layout(set=0,binding=2) uniform texture2D texBlur;
layout(set=0,binding=3) uniform sampler linearSampler;
layout(set=0,binding=4) uniform texture2D texContour;
layout(location=0) out vec4 fragColor;
#define uContourEnabled _data[0].x
#define uContourAspect _data[1].x
#define uTransparentSurface _data[2].x
#define uBlurEnabled _data[3].x
#define uBackgroundBlur _data[4].x
#define uPixelRatio _data[5].x
#define uGlassVisible _data[6].x
#define uHighlightColor _data[7].xyz
#define uGlassOptics _data[8].xyzw
#define uOpticalTravel _data[9].x
#define uLightSplay _data[10].x
#define uFillColor _data[11].xyz
#define uFillOpacity _data[12].x
#define uFacet _data[13].xyz
#define uCutCorners _data[14].xyzw
#define uCutSizes _data[15].xyzw
#define uTouch _data[16].xyzw
#define uTouchRadius _data[17].x
#define uTouchStrength _data[18].x
#define uRim _data[19].xyz
#define uDirectedLight _data[20].xy
#define uScan _data[21].xyzw
#define uScanStrength _data[22].x
#define uExternalReveal _data[23].x
#define uPulseReveal _data[24].xyzw
#define uPulseStyle _data[25].xy
#define uPulseColor _data[26].xyz
#define uPulseOpacity _data[27].x
#define uDecodeSourceTexture _data[28].x
#define uResolution _data[29].xy
#define uGlassPanel _data[30].xyzw
#define uGlassPanelEnabled _data[31].x
#define uSourceAspect _data[32].x
#define uTime _data[33].x
#define uIOR _data[34].x
#define uBorderThickness _data[35].x
#define uCornerRadius _data[36].x
#define uDispersion _data[37].x
#define uEdgeDarkening _data[38].x
#define uHighlightStrength _data[39].x
#define uExposure _data[40].x
#define uBrightness _data[41].x
#define uContrast _data[42].x
#define uSaturation _data[43].x
#define uTemperature _data[44].x
#define uTint _data[45].x
#define uGamma _data[46].x
#define uFieldEnabled _data[47].x
#define uFieldStart _data[48].x
#define uFieldSoftness _data[49].x
#define uFieldFadeMode _data[50].x
#define uFieldCurve _data[51].x
#define uFieldStrength _data[52].x
#define uRegionEdges _data[53].xyzw
#define uRegionWidth _data[54].x
#define uRegionSoftness _data[55].x
#define uShapeType _data[56].x
#define uShapeWarp _data[57].x
#define uFlowEnabled _data[58].x
#define uFlowMode _data[59].x
#define uFlowSpeed _data[60].x
#define uFlowStrength _data[61].x
#define uFlowScale _data[62].x
#define uFlowTurbulence _data[63].x
#define uFlowBoundaryDamping _data[64].x
#define uFlowLayerMix _data[65].x
vec4 readSource(vec2 uv){return textureLod(sampler2D(texSource,linearSampler),vec2(uv.x,1.-uv.y),0.);}
vec4 readBlur(vec2 uv){return textureLod(sampler2D(texBlur,linearSampler),vec2(uv.x,1.-uv.y),0.);}
vec4 readContour(vec2 uv){return textureLod(sampler2D(texContour,linearSampler),uv,0.);}
vec4 LinearTransferOETF( in vec4 value ) {
	return value;
}
vec4 sRGBTransferEOTF( in vec4 value ) {
	return vec4( mix( pow( value.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), value.rgb * 0.0773993808, vec3( lessThanEqual( value.rgb, vec3( 0.04045 ) ) ) ), value.a );
}
vec4 sRGBTransferOETF( in vec4 value ) {
	return vec4( mix( pow( value.rgb, vec3( 0.41666 ) ) * 1.055 - vec3( 0.055 ), value.rgb * 12.92, vec3( lessThanEqual( value.rgb, vec3( 0.0031308 ) ) ) ), value.a );
}
vec4 linearToOutputTexel(vec4 c){return _data[127].x>.5?sRGBTransferOETF(c):c;}









































































layout(location=0) in vec2 vUv;

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
    vec2 encodedContour = readContour( uv).rg;
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
  vec4 texel = readSource( clamp(coverUv(uv), vec2(0.001), vec2(0.999)));

  if (uDecodeSourceTexture > 0.5) {
    return sRGBTransferEOTF(texel).rgb;
  }

  return texel.rgb;
}

vec3 sampleGlassSource(vec2 uv, float blurAmount) {
  if (uBlurEnabled > 0.5 && blurAmount > 0.001) {
    vec3 blurred = readBlur( clamp(uv, vec2(0.0), vec2(1.0))).rgb;
    if (blurAmount >= 0.999) return blurred;
    return mix(sampleSource(uv), blurred, blurAmount);
  }
  return sampleSource(uv);
}

vec3 sampleDispersedSource(vec2 uv, vec2 refractOffset, float chroma, float blurAmount) {
  vec2 centerUv = uv + refractOffset;
  float bendPixels = length(refractOffset * uResolution / max(uPixelRatio, 0.01));

  float blurSupport = max(uBackgroundBlur, 0.0) * blurAmount * uBlurEnabled * 0.50 * smoothstep(0.0, 2.0, bendPixels);
  float spreadPixels = min(48.0, bendPixels * 0.85 + blurSupport) * clamp(chroma, 0.0, 1.0);

  if (spreadPixels < 0.01) {
    return sampleGlassSource(centerUv, blurAmount);
  }

  vec2 spreadUv = refractOffset * (spreadPixels / max(bendPixels, 0.00001));
  vec3 color = vec3(0.0);
  color += sampleGlassSource(centerUv + spreadUv * 1.000000000, blurAmount) * vec3(0.003970617, 0.028517168, 0.324538053);
  color += sampleGlassSource(centerUv + spreadUv * 0.580796556, blurAmount) * vec3(0.019853671, 0.120362291, 0.395414136);
  color += sampleGlassSource(centerUv + spreadUv * 0.256303829, blurAmount) * vec3(0.067976236, 0.267871206, 0.218621313);
  color += sampleGlassSource(centerUv + spreadUv * 0.000000000, blurAmount) * vec3(0.159370101, 0.314349772, 0.054851252);
  color += sampleGlassSource(centerUv + spreadUv * -0.205963569, blurAmount) * vec3(0.255852717, 0.194514418, 0.006245027);
  color += sampleGlassSource(centerUv + spreadUv * -0.373955982, blurAmount) * vec3(0.281259157, 0.063466124, 0.000322653);
  color += sampleGlassSource(centerUv + spreadUv * -0.512768173, blurAmount) * vec3(0.211717501, 0.010919021, 0.000007565);
  return color;
}


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


float pixelPulseLight(vec2 panelUv, vec2 panelPixels) {
  float progress = uPulseReveal.z;
  if (progress >= 1.0 || progress <= 0.0) return 0.0;
  float cell = uPulseReveal.w;
  vec2 point = vec2(panelUv.x, 1.0 - panelUv.y) * panelPixels;
  vec2 index = floor(point / cell);
  vec2 center = (index + 0.5) * cell;
  vec2 origin = uPulseReveal.xy;
  float reach = length(max(origin, panelPixels - origin)) + cell * 2.0;
  float radius = mix(-cell * 2.0, reach + cell * 2.0, progress);
  float stagger = mod(index.x * 17.0 + index.y * 31.0, 13.0) / 13.0 * cell * 0.35;
  float age = radius - length(center - origin) - stagger;
  float band = max(3.0, cell * (0.35 + uPulseStyle.x * 1.8));
  float envelope = smoothstep(0.0, 0.08, progress) * (1.0 - smoothstep(0.85, 1.0, progress));
  // Softly shaped square light patches. These modulate light only; the material
  // underneath stays continuous even between adjacent illuminated sectors.
  float edge = max(abs(point.x - center.x), abs(point.y - center.y));
  float coverage = 1.0 - smoothstep(cell * 0.42, cell * 0.5, edge);
  return exp(-0.5 * pow(age / band, 2.0)) * envelope * coverage * uPulseStyle.y;
}


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
    ? clamp(max(uFillOpacity, readSource( vUv).a) + scanLight + pulseLight * uPulseOpacity, 0.0, 1.0) * panelMask * reveal
    : 1.0;
  fragColor = linearToOutputTexel(vec4(outputColor, alpha));
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
    fragColor = linearToOutputTexel(vec4(baseColor, 1.0));
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
      fragColor = linearToOutputTexel(vec4(baseColor, uTransparentSurface > 0.5 ? 0.0 : 1.0));
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
