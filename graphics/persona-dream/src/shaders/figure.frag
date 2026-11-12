#version 300 es
precision highp float;
// The standing person (Art's approved figure above the waist, its standing
// legs below): red = opaque cover, green = ink contour, blue = the body.
// The lens blurs it by its circle of confusion. Inside the body an even,
// quiet light: the living one, Presence; a form, not a point. The other
// people deep in the room (three cells of u_others: red cover, green ink)
// are only faint contours.
uniform sampler2D u_figure;
uniform sampler2D u_others;
uniform float u_who;  // which cell of u_others
uniform vec4 u_mode;  // 0 body, 1 reflection, 2 another person; alpha; blur radius (uv x, y)
uniform vec4 u_light; // contour, breath, time (s), exposure
uniform float u_presence;
in vec2 v_local;
out vec4 o;
const vec2 SVG = vec2(200.0, 672.0);
const vec2 TEX = vec2(800.0, 2688.0);
const vec2 OTHERS_TEX = vec2(840.0, 760.0);
const float FLOOR = 660.0;
// Loops start from a uniform-derived zero so the compiler cannot unroll them.
#define ZERO min(int(u_light.z), 0)
// The lens on `tex` (`size` texels) at `uv`, blur radius `r` (uv).
vec3 lens(sampler2D tex, vec2 size, vec2 uv, vec2 r) {
  float texels = max(r.x * size.x, r.y * size.y);
  if (texels < 0.75) return texture(tex, uv).rgb;
  float lod = max(0.0, log2(texels / 5.0));
  vec3 sum = textureLod(tex, uv, lod).rgb;
  // A disc of taps on a golden-angle spiral.
  for (int i = ZERO; i < 18; i++) {
    float f = float(i) + 0.5;
    float a = f * 2.39996323;
    sum += textureLod(tex, uv + vec2(cos(a), sin(a)) * sqrt(f / 18.0) * r, lod).rgb;
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
  float alpha = u_mode.y;
  if (u_mode.x > 1.5) {
    // Someone else, far off: their contour only.
    vec3 q = lens(u_others, OTHERS_TEX, vec2((u_who + uv.x) / 3.0, uv.y), u_mode.zw * vec2(1.0 / 3.0, 1.0));
    o = vec4(0.3 * q.g + 0.03 * q.r, 0.06 * q.g, 0.0, 0.0) * alpha;
    return;
  }
  vec3 s = lens(u_figure, TEX, uv, u_mode.zw);
  float cover = s.r, ink = s.g, body = s.b;
  vec2 p = uv * SVG;
  if (u_mode.x > 0.5) {
    // The polished floor reflects the person, fading from the soles down.
    float below = max(FLOOR - p.y, 0.0);
    float fade = exp(-below / 40.0) * 0.15;
    o = vec4(0.3 * ink + 0.04 * cover, 0.45 * ink + 0.05 * body, 0.0, 0.0) * fade * alpha;
    return;
  }
  float texels = max(u_mode.z * TEX.x, u_mode.w * TEX.y);
  // The upper edges catch the light from above.
  float above = texture(u_figure, uv - vec2(0.0, 2.2 / SVG.y)).r;
  float rim = max(cover - above, 0.0) * clamp(1.0 - texels / 6.0, 0.0, 1.0);
  float t = u_light.z;
  float n = 0.6 * noise(p / 26.0 + vec2(0.0, t * 0.12)) + 0.4 * noise(p / 9.0 - vec2(t * 0.08, 0.0));
  // Presence: the same quiet light through the whole body, breathing.
  float living = u_presence * body * (0.1 + 0.08 * n + 0.03 * u_light.y);
  float contour = u_light.x * ink * (1.0 + 0.04 * u_light.y);
  float exposure = u_light.w;
  float room = 0.28 * rim * exposure;
  float person = contour * mix(0.55, 1.0, exposure);
  // Blue holds the body: its lower half the cover, its upper half the light
  // that fills it.
  float glow = clamp(living * mix(0.55, 1.0, exposure), 0.0, 1.0);
  o = vec4(room, person, 0.5 * cover + 0.5 * glow * cover, cover) * alpha;
}
