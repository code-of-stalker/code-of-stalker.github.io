#version 300 es
precision highp float;
// Art's approved seated figure: red = opaque cover (chair included),
// green = ink contour, blue = the body alone. The lens blurs it by its
// circle of confusion. The scan wakes the contour and a quiet light inside
// the body row by row, crown to soles; it never stops anywhere.
uniform sampler2D u_figure;
uniform vec4 u_mode;  // 0 body, 1 reflection; alpha; blur radius (uv x, y)
uniform vec4 u_light; // contour, breath, time (s), exposure
uniform vec4 u_scan;  // scan row (SVG), its alpha, what has been felt, half width (SVG)
in vec2 v_local;
out vec4 o;
const vec2 SVG = vec2(335.0, 530.0);
const vec2 TEX = vec2(1340.0, 2120.0);
const float FLOOR = 518.6;
vec3 lens(vec2 uv) {
  vec2 r = u_mode.zw;
  float texels = max(r.x * TEX.x, r.y * TEX.y);
  if (texels < 0.75) return texture(u_figure, uv).rgb;
  float lod = max(0.0, log2(texels / 5.0));
  vec3 sum = textureLod(u_figure, uv, lod).rgb;
  // A disc of taps on a golden-angle spiral.
  for (int i = 0; i < 18; i++) {
    float f = float(i) + 0.5;
    float a = f * 2.39996323;
    sum += textureLod(u_figure, uv + vec2(cos(a), sin(a)) * sqrt(f / 18.0) * r, lod).rgb;
  }
  return sum / 19.0;
}
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
void main() {
  vec2 uv = v_local;
  vec3 s = lens(uv);
  float cover = s.r, ink = s.g, body = s.b;
  vec2 p = uv * SVG;
  float alpha = u_mode.y;
  if (u_mode.x > 0.5) {
    // The polished floor reflects the person, fading from the soles down.
    float below = max(FLOOR - p.y, 0.0);
    float fade = exp(-below / 40.0) * 0.15;
    o = vec4(0.3 * ink + 0.04 * cover, 0.45 * ink + 0.05 * body, 0.0, 0.0) * fade * alpha;
    return;
  }
  float chair = clamp(cover - body, 0.0, 1.0);
  float texels = max(u_mode.z * TEX.x, u_mode.w * TEX.y);
  // The upper edges catch the light from above.
  float above = texture(u_figure, uv - vec2(0.0, 2.2 / SVG.y)).r;
  float rim = max(cover - above, 0.0) * clamp(1.0 - texels / 6.0, 0.0, 1.0);
  float t = u_light.z;
  // The scan: a band of attention, a soft wake above it, and what it has
  // passed stays a little more present.
  float d = p.y - u_scan.x;
  float band = exp(-d * d / (u_scan.w * u_scan.w)) * u_scan.y;
  float wake = (d < 0.0 ? exp(d / 38.0) : 0.0) * u_scan.y;
  float passed = (1.0 - smoothstep(-6.0, 3.0, d)) * u_scan.z;
  float n = 0.6 * noise(p / 22.0 + vec2(t * 0.1, 0.0)) + 0.4 * noise(p / 8.0 - vec2(0.0, t * 0.15));
  float felt = body * ((0.3 + 0.1 * n) * band + 0.1 * wake + (0.05 + 0.03 * n) * passed);
  float contour = u_light.x * ink * (1.0 + 0.04 * u_light.y);
  float woken = ink * mix(0.25, 1.0, body) * (1.3 * band + 0.35 * passed);
  float exposure = u_light.w;
  float room = (0.42 * contour * chair + 0.28 * rim) * exposure;
  float person = (contour * (1.0 - chair) + woken) * mix(0.55, 1.0, exposure);
  // Blue holds the body: its lower half the cover, its upper half the light
  // that fills it. Light pages show that light as a paler body, dark rooms
  // as light.
  float glow = clamp(felt * mix(0.55, 1.0, exposure), 0.0, 1.0);
  o = vec4(room, person, 0.5 * cover + 0.5 * glow * cover, cover) * alpha;
}
