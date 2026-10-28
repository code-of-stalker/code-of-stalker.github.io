#version 300 es
precision highp float;
// The theme: dark themes add light and the air of the room (the cone of the
// top light, the haze of the depth) to a dark room, light themes lay ink on
// the page itself. Bloom, grain and the soft edges into the page.
uniform sampler2D u_scene;
uniform sampler2D u_bloom;
uniform sampler2D u_wide;
uniform vec3 u_paper;
uniform vec3 u_room;
uniform vec3 u_person;
uniform vec3 u_body;
uniform vec3 u_lamp;    // the color of light on light pages
uniform vec3 u_backdrop;
uniform vec4 u_cone_a;  // apex x, y, apex half width, unused (authored px)
uniform vec4 u_cone_b;  // floor x, y, floor half width, floor half height
uniform vec4 u_air;     // horizon y, exposure, loop phase (radians), camera x
uniform vec4 u_post;    // light theme, vignette, grain seed, soft edges
uniform vec4 u_edges;   // left, right, top, bottom
uniform vec4 u_frame;   // the shown part of the authored frame: x, y, width, height (px)
in vec2 v_local;
out vec4 o;
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
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
// The room's haze (x) and the beam of the top light (y).
vec2 air(vec2 px) {
  vec2 drift = vec2(cos(u_air.z), sin(u_air.z)) * 0.6;
  float smoke = fbm(px / 300.0 + drift + vec2(u_air.w * 0.4, 0.0));
  float haze = 0.018 + 0.04 * exp(-abs(px.y - u_air.x) / 150.0);
  float l = haze * (0.5 + smoke), beam_light = 0.0;
  float span = u_cone_b.y - u_cone_a.y;
  if (span > 1.0) {
    float s = (px.y - u_cone_a.y) / span;
    float axis = mix(u_cone_a.x, u_cone_b.x, s);
    float half_width = max(mix(u_cone_a.z, u_cone_b.z, clamp(s, 0.0, 1.2)), 1.0);
    float x = (px.x - axis) / half_width;
    // Ends on the floor: inside the far rim of the pool, never below it.
    float ground = 1.0 - smoothstep(0.0, 1.0, (px.y - u_cone_b.y) / max(u_cone_b.w, 1.0) - sqrt(max(1.0 - x * x, 0.0)));
    float beam = exp(-x * x * 1.7) * smoothstep(-0.02, 0.25, s) * ground;
    float rays = 0.65 + 0.7 * noise(vec2(x * 3.2 + drift.x, s * 0.7 - u_air.z * 0.4));
    beam_light = 0.16 * beam * rays * (0.55 + 0.9 * smoke);
  }
  return vec2(l, beam_light) * u_air.y;
}
void main() {
  vec2 uv = v_local;
  vec2 px = u_frame.xy + vec2(uv.x, 1.0 - uv.y) * u_frame.zw;
  vec4 s = texture(u_scene, uv);
  vec2 b = texture(u_bloom, uv).rg * 0.28 + texture(u_wide, uv).rg * 0.22;
  vec3 c;
  float fill = clamp(s.b * 2.0, 0.0, 1.0);
  float glow = clamp(s.b * 2.0 - 1.0, 0.0, 1.0);
  if (u_post.x < 0.5) {
    vec2 room_air = air(px) * (1.0 - clamp(s.a, 0.0, 1.0));
    float a = room_air.x + room_air.y;
    vec3 base = mix(u_paper, u_body, fill);
    vec3 light = u_room * (s.r * 1.2 + b.r + a) + u_person * (s.g * 1.2 + glow * 1.2 + b.g);
    c = base + (1.0 - base) * (1.0 - exp(-light * 1.35));
    float v = length((uv - 0.5) * vec2(1.25, 1.0));
    c *= 1.0 - u_post.y * smoothstep(0.32, 0.95, v);
  } else {
    // On a light page the scene's paper is the page itself: no haze, no
    // beam of the top light, nothing lighter than the page anywhere.
    // Bodies and columns are drawn by their ink alone (they already hide
    // what lies behind them), so nothing paints a paler shape on the page.
    c = u_backdrop;
    // Light is never white here: like the effects of Art's light paintings it
    // inks the page in the lamp's color, a wash inside the body and a soft
    // halo around it.
    c = mix(c, u_lamp, clamp(glow * 1.1, 0.0, 0.6));
    c = mix(c, u_lamp, clamp(b.g * 0.5 * (1.0 - fill), 0.0, 0.22));
    c = mix(c, u_room, 1.0 - exp(-s.r * 1.5));
    // The person's own lines stay ink; the light that leaves the body (rings,
    // the gaze, the lines of support, the spark) is drawn in the lamp's color.
    vec3 lit = mix(mix(u_lamp, u_person, 0.35), u_person, smoothstep(0.0, 0.6, s.a));
    c = mix(c, lit, 1.0 - exp(-s.g * 2.2));
  }
  float g = hash(uv * vec2(1931.0, 1187.0) + u_post.z) - 0.5;
  // Grain only in the dark rooms: a light page stays as flat as the page.
  c += g * (u_post.x < 0.5 ? 0.018 : 0.0);
  if (u_post.w > 0.5) {
    float m = smoothstep(0.0, u_edges.x, uv.x) * smoothstep(0.0, u_edges.y, 1.0 - uv.x)
            * smoothstep(0.0, u_edges.z, 1.0 - uv.y) * smoothstep(0.0, u_edges.w, uv.y);
    c = mix(u_backdrop, c, m);
  }
  o = vec4(clamp(c, 0.0, 1.0), 1.0);
}
