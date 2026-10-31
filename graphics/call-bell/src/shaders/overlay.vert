#version 300 es
// Threads, rings of sound and dust, laid out in lib.rs: authored px → clip,
// the view depth into the depth test, the blur circle into alpha.
layout(location = 0) in vec2 a_pos;
layout(location = 1) in float a_z;
layout(location = 2) in vec2 a_line;   // across (-1..1), along
layout(location = 3) in vec2 a_glint;  // place, strength
layout(location = 4) in vec2 a_paint;  // own light, kind
uniform float u_aspect;
uniform vec2 u_lens;   // focus distance, aperture
uniform float u_far;
out vec2 v_line;
out vec2 v_glint;
out vec2 v_paint;
out float v_fade;
out float v_coc;
void main() {
  v_line = a_line;
  v_glint = a_glint;
  v_paint = a_paint;
  // what passes right by the lens melts away instead of crossing it
  v_fade = smoothstep(0.3, 0.9, a_z);
  v_coc = clamp(u_lens.y * (a_z - u_lens.x) / max(a_z, 0.01), -22.0, 22.0);
  // a hair nearer than it is, so what lies on the bell is not hidden by it
  float depth = clamp((a_z - 0.02) / u_far, 0.0, 1.0);
  gl_Position = vec4((a_pos.x - 768.0) / 512.0 / u_aspect, 1.0 - a_pos.y / 512.0, depth * 2.0 - 1.0, 1.0);
}
