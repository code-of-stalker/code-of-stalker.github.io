#version 300 es
precision highp float;
// Art's approved seated figure: red = opaque cover (chair included),
// green = ink contour, blue = the body alone. The lens blurs it by its
// circle of confusion; Rust decides how each part of the body is lit.
uniform sampler2D u_figure;
uniform vec4 u_mode;  // 0 body, 1 reflection, 2 scattered copy; alpha; blur radius (uv x, y)
uniform vec4 u_light; // contour, presence, weight, soles
uniform vec4 u_more;  // head, breath, time (s), exposure
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
  if (u_mode.x > 1.5) {
    // A copy that has not yet come into the posture: contour only.
    o = vec4(0.6 * ink, 0.25 * ink, 0.0, 0.0) * alpha;
    return;
  }
  if (u_mode.x > 0.5) {
    // The polished floor reflects the person, fading from the soles down.
    float below = max(FLOOR - p.y, 0.0);
    float fade = exp(-below / 40.0) * 0.15;
    o = vec4(0.3 * ink + 0.04 * cover, 0.45 * ink + 0.05 * body, 0.0, 0.0) * fade * alpha;
    return;
  }
  float chair = clamp(cover - body, 0.0, 1.0);
  float head = 1.0 - smoothstep(110.0, 126.0, p.y);
  // The torso as a soft oval inside the body: no box edges in the light.
  vec2 e = (p - vec2(84.0, 222.0)) / vec2(70.0, 112.0);
  float torso = 1.0 - smoothstep(0.55, 1.05, length(e));
  float legs = (1.0 - head) * (1.0 - torso) * smoothstep(262.0, 312.0, p.y) * smoothstep(120.0, 170.0, p.x);
  float sole = smoothstep(488.0, 515.0, p.y) * smoothstep(212.0, 224.0, p.x);
  float texels = max(u_mode.z * TEX.x, u_mode.w * TEX.y);
  // The upper edges catch the light from above.
  float above = texture(u_figure, uv - vec2(0.0, 2.2 / SVG.y)).r;
  float rim = max(cover - above, 0.0) * clamp(1.0 - texels / 6.0, 0.0, 1.0);
  float t = u_more.z;
  float n = 0.6 * noise(p / 26.0 + vec2(0.0, t * 0.12)) + 0.4 * noise(p / 9.0 - vec2(t * 0.08, 0.0));
  // Presence: an even light that fills the whole torso — a form, not a point.
  float presence = u_light.y * torso * body * (0.3 + 0.22 * n + 0.08 * u_more.y);
  // Weight: heavier towards the soles, sinking.
  // Streaks of heaviness drift down the shin, never a flat fill.
  float sink = smoothstep(0.3, 0.95, noise(p / vec2(22.0, 9.0) - vec2(0.0, t * 2.2)));
  float weight = u_light.z * legs * body * (0.015 + 0.09 * pow(smoothstep(300.0, 515.0, p.y), 1.6)) * (0.35 + 0.65 * sink);
  float soles = u_light.w * sole * ink;
  float felt = u_light.w * sole * body * 0.07;
  float drawn = u_more.x * head * body * (0.16 + 0.18 * n);
  float contour = u_light.x * ink;
  float exposure = u_more.w;
  float room = (0.42 * contour * chair + 0.28 * rim) * exposure;
  float person = (contour * (1.0 - chair) + soles) * mix(0.55, 1.0, exposure);
  // Blue holds the body: its lower half the cover, its upper half the light
  // that fills it (presence, weight, the drawn-up head). Light pages show
  // that light as a paler, luminous body; dark rooms as light.
  float glow = clamp((presence + weight + drawn + felt) * mix(0.55, 1.0, exposure), 0.0, 1.0);
  o = vec4(room, person, 0.5 * cover + 0.5 * glow * cover, cover) * alpha;
}
