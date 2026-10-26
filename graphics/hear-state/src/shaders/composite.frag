#version 300 es
precision highp float;
// Maps the light channels to the theme. Dark themes add light to a dark
// room; light themes lay ink on the page. Bloom, grain, the page edges.
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
    c = mix(u_paper, u_body, clamp(s.b, 0.0, 1.0));
    c = mix(c, u_haze, clamp((b.r + b.g) * 0.55, 0.0, 0.5));
    c = mix(c, u_voice, 1.0 - exp(-s.r * 2.1));
    c = mix(c, u_self, 1.0 - exp(-s.g * 2.3));
  }
  // Fine grain keeps the gradients free of banding.
  float g = hash(uv * vec2(1931.0, 1187.0) + u_post.z) - 0.5;
  c += g * (u_post.x < 0.5 ? 0.018 : 0.012);
  if (u_post.w > 0.5) {
    float m = smoothstep(0.0, u_edges.x, uv.x) * smoothstep(0.0, u_edges.y, 1.0 - uv.x)
            * smoothstep(0.0, u_edges.z, 1.0 - uv.y) * smoothstep(0.0, u_edges.w, uv.y);
    c = mix(u_backdrop, c, m);
  }
  o = vec4(clamp(c, 0.0, 1.0), 1.0);
}
