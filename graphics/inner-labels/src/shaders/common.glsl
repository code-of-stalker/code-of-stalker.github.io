// What every pass shares: the camera, the frame, the theme's colours and a
// few small helpers. Rust puts the version line and the constants of lib.rs
// (#define) in front of it, and the pass's own code after it.
precision highp float;
precision highp int;

#define TAU 6.28318531

uniform vec4 u_eye;    // eye xyz, loop time
uniform vec4 u_right;
uniform vec4 u_up;
uniform vec4 u_fwd;    // forward, tangent of half the frame's height
uniform vec4 u_view;   // frame scale x and y, canvas width and height in px
uniform vec4 u_misc;   // the first ring's turn, the second ring's light, the comb, soft edges
uniform vec3 u_cold;
uniform vec3 u_warm;
uniform vec3 u_pale;
uniform vec3 u_backdrop; // the page
uniform vec4 u_edges;    // left, right, top, bottom

float sq(float x) {
  return x * x;
}

uint mixBits(uint x) {
  x ^= x >> 16;
  x *= 0x7feb352du;
  x ^= x >> 15;
  x *= 0x846ca68bu;
  x ^= x >> 16;
  return x;
}
float hash2(vec2 cell, uint k) {
  ivec2 c = ivec2(cell);
  return float(mixBits(uint(c.x) * 0x9e3779b9u ^ mixBits(uint(c.y) + 0x632be5abu + k * 0x27d4eb2du)) >> 8) / 16777215.0;
}
float hash1(uint i, uint k) {
  return float(mixBits(i * 0x9e3779b9u + k * 0x632be5abu + 0x27d4eb2du) >> 8) / 16777215.0;
}
float vnoise2(vec2 p) {
  vec2 i = floor(p) + 4096.0;
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash2(i, 3u);
  float b = hash2(i + vec2(1.0, 0.0), 3u);
  float c = hash2(i + vec2(0.0, 1.0), 3u);
  float d = hash2(i + vec2(1.0, 1.0), 3u);
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
float segd(vec2 p, vec2 a, vec2 b, out float h) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-10), 0.0, 1.0);
  return length(pa - ba * h);
}
// How far the scene has melted into the page at this pixel (1 inside).
float softEdge(vec2 frag) {
  if (u_misc.w < 0.5) return 1.0;
  vec2 uv = frag / u_view.zw;
  return smoothstep(0.0, u_edges.x, uv.x) * smoothstep(0.0, u_edges.y, 1.0 - uv.x)
       * smoothstep(0.0, u_edges.z, 1.0 - uv.y) * smoothstep(0.0, u_edges.w, uv.y);
}
// Depth as the passes share it, from the distance along the view.
float depthOf(float vz) {
  return FAR / (FAR - NEAR) * (1.0 - NEAR / max(vz, NEAR));
}
