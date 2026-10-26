#version 300 es
precision highp float;
// The room's air: a horizon haze, a soft key light from the upper right and
// slow volumetric noise. Every motion is periodic in the 48-second loop.
uniform vec4 u_air;  // loop phase (radians), ambient, camera x, camera y
uniform vec4 u_key;  // key light x, y, radius, strength
in vec2 v_uv;
out vec4 o;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * noise(p); p = p * 2.03 + 17.1; a *= 0.5; }
  return v;
}
void main() {
  vec2 px = v_uv;
  float horizon = 512.0;
  vec2 drift = vec2(cos(u_air.x), sin(u_air.x)) * 0.7;
  vec2 parallax = u_air.zw * vec2(0.12, -0.12);
  float smoke = fbm(px / 330.0 + drift + parallax);
  float smoke2 = fbm(px / 140.0 - drift * 1.6 + parallax * 2.0);
  float air = 0.016 + 0.034 * exp(-abs(px.y - horizon) / 110.0);
  // Key light from the upper right falls across the room towards the person.
  vec2 key = u_key.xy;
  vec2 dir = normalize(vec2(-0.62, 0.78));
  vec2 rel = px - key;
  float along = dot(rel, dir);
  float across = abs(rel.x * dir.y - rel.y * dir.x);
  float beam = exp(-pow(across / (150.0 + 0.35 * max(along, 0.0)), 2.0)) * smoothstep(-80.0, 260.0, along) * exp(-max(along, 0.0) / 1500.0);
  float pool = exp(-length((px - vec2(560.0, 1000.0)) / vec2(520.0, 120.0)));
  float light = air * (0.55 + 0.9 * smoke) + u_key.w * (0.05 * beam * (0.6 + 0.8 * smoke2) + 0.05 * pool);
  light *= 1.0 + 0.35 * u_air.y;
  o = vec4(light, light * 0.12, 0.0, 0.0);
}
