#version 300 es
precision highp float;
// Maps the light channels to the theme. Dark themes add light to a dark
// room; light themes lay ink on the page itself. Bloom, grain, the page edges.
uniform sampler2D u_scene;
uniform sampler2D u_bloom;
uniform sampler2D u_wide;
uniform vec3 u_paper;
uniform vec3 u_voice;
uniform vec3 u_self;
uniform vec3 u_body;
uniform vec3 u_haze;
uniform vec3 u_backdrop;
uniform vec4 u_post;   // light theme, vignette, grain seed, soft edges
uniform vec4 u_edges;  // left, right, top, bottom
in vec2 v_uv;
out vec4 o;
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main() {
  vec2 uv = v_uv;
  vec4 s = texture(u_scene, uv);
  vec2 b = texture(u_bloom, uv).rg * 0.9 + texture(u_wide, uv).rg * 0.7;
  vec3 c;
  if (u_post.x < 0.5) {
    vec3 base = mix(u_paper, u_body, clamp(s.b, 0.0, 1.0));
    vec3 light = u_voice * (s.r * 1.25 + b.r) + u_self * (s.g * 1.25 + b.g);
    c = base + (1.0 - base) * (1.0 - exp(-light * 1.35));
    float v = length((uv - 0.5) * vec2(1.25, 1.0));
    c *= 1.0 - u_post.y * smoothstep(0.35, 0.95, v);
  } else {
    // On a light page the scene's paper is the page itself: no room air (the
    // renderer leaves it out), no haze, no body fill, nothing lighter or
    // darker than the page but the ink. The person and the chair hide what
    // lies behind them, so their lines alone draw them.
    c = u_backdrop;
    // The voice glows as a faint wash of its own soft color, never a flood.
    c = mix(c, u_haze, clamp(b.r * 0.6, 0.0, 0.3));
    c = mix(c, u_voice, 1.0 - exp(-s.r * 2.1));
    c = mix(c, u_self, 1.0 - exp(-s.g * 2.3));
  }
  // Fine grain keeps the dark gradients free of banding; a light page stays
  // as flat as the page.
  float g = hash(uv * vec2(1931.0, 1187.0) + u_post.z) - 0.5;
  c += g * (u_post.x < 0.5 ? 0.018 : 0.0);
  if (u_post.w > 0.5) {
    float m = smoothstep(0.0, u_edges.x, uv.x) * smoothstep(0.0, u_edges.y, 1.0 - uv.x)
            * smoothstep(0.0, u_edges.z, 1.0 - uv.y) * smoothstep(0.0, u_edges.w, uv.y);
    c = mix(u_backdrop, c, m);
  }
  o = vec4(clamp(c, 0.0, 1.0), 1.0);
}
