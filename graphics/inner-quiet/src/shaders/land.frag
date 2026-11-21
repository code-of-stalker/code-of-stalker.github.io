// The land: a dark ground drawn in lines of sound, one every ROW metres
// across the view (lines of constant z), like a spectrogram seen from
// inside. The ground hides the lines behind it, so every peak stands out
// against the rows beyond. Lines are brighter on the peaks, warm where the
// warm ring has noticed something, the ridge through his soles the brightest;
// in «оба кольца» a precise grid crosses them. Far off the lines thin out by
// halves, then the land melts into the sky.
in vec3 v_p;
in float v_relief;
in float v_warm;
out vec4 o;

// How much of a pixel a line w px wide covers, d px from it.
float cover(float d, float w) {
  return clamp(0.5 * w + 0.5 - d, 0.0, 1.0);
}
// Lines every 1 of c (fw: c a pixel): denser than every 5 px they drop
// every other one, then every other again.
float lines(float c, float fw, float w) {
  float lod = max(log2(fw * 5.0), 0.0);
  float k = floor(lod);
  float a = exp2(k);
  float l0 = cover(abs(fract(c / a + 0.5) - 0.5) * a / fw, w);
  float l1 = cover(abs(fract(c / (2.0 * a) + 0.5) - 0.5) * 2.0 * a / fw, w);
  return mix(l0, l1, fract(lod));
}

void main() {
  time = u_eye.w;
  float K8 = px800();
  float zr = v_p.z / ROW;
  float xr = v_p.x / GRID;
  float fz = max(fwidth(zr), 1e-5);
  float fx = max(fwidth(xr), 1e-5);
  vec3 toEye = v_p - u_eye.xyz;
  float dist = length(toEye);
  vec3 rd = toEye / dist;

  // The rows, a little thicker near. A steep face turns its rows far apart
  // on screen, so there they come four times as dense: a peak is drawn in
  // light, not left dark.
  float w = K8 * mix(1.25, 0.9, smoothstep(4.0, 30.0, dist));
  float run = max(length(vec2(length(dFdx(v_p.xz)), length(dFdy(v_p.xz)))), 1e-5);
  float rise = length(vec2(dFdx(v_p.y), dFdy(v_p.y)));
  float steep = smoothstep(0.3, 1.0, rise / run) * smoothstep(0.04, 0.2, v_p.y);
  float row = max(lines(zr, fz, w), steep * lines(zr * 4.0, fz * 4.0, 0.85 * w));
  // The ridge through his soles: the row at z = 0, brighter, paler.
  float ridgeRow = u_land.y * cover(abs(v_p.z) / (fz * ROW), 1.6 * K8) * smoothstep(0.18, 0.4, abs(v_p.x));
  float grid = u_land.z * lines(xr, fx, 0.8 * K8);

  float height = clamp(v_relief / 1.2, 0.0, 1.0);
  float light = 0.42 + 0.75 * sqrt(height);
  vec3 ink = mix(COLD, WARM, clamp(v_warm, 0.0, 1.0));
  vec3 col = ink * light * row + COLD * 0.5 * grid + mix(COLD, PALE, 0.5) * 1.3 * ridgeRow;

  // The near rows fade at the frame's bottom edge, the far ones into the air.
  float far = smoothstep(14.0, 52.0, dist) * 0.7 + 0.3 * smoothstep(40.0, 66.0, dist);
  float edge = smoothstep(LAND_Z.y - 10.0, LAND_Z.y - 1.0, v_p.z) + smoothstep(LAND_X * 0.6, LAND_X * 0.95, abs(v_p.x));
  float fog = clamp(max(far, edge), 0.0, 1.0);
  vec3 ground = page() * 0.82;
  vec3 c = ground + col * (1.0 - fog);
  o = vec4(mix(c, skyAt(rd), fog), 1.0);
}
