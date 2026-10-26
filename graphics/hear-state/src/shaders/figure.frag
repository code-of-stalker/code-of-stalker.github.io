#version 300 es
precision highp float;
// Approved seated figure: red = opaque cover, green = ink contour, blue =
// the body without the chair.
// The voice side catches a rim of light; the contour is the self, and it
// wakes where the scan passes.
uniform sampler2D u_figure;
uniform vec4 u_light; // rim strength, contour strength, rim offset (uv), body
uniform vec4 u_scan;  // scan row (uv), its alpha, what has been felt, half width
in vec2 v_uv;
out vec4 o;
void main() {
  vec2 f = texture(u_figure, v_uv).rg;
  float cover = f.r;
  vec2 dir = vec2(-1.0, 0.45) * u_light.z;
  float inside = texture(u_figure, v_uv + dir).r;
  float rim = cover * (1.0 - inside);
  float wide = cover * (1.0 - texture(u_figure, v_uv + dir * 4.0).r);
  float voice = u_light.x * (rim + 0.25 * wide);
  float d = (v_uv.y - u_scan.x) / u_scan.w;
  float band = exp(-d * d) * u_scan.y;
  float passed = (1.0 - smoothstep(-0.04, 0.02, v_uv.y - u_scan.x)) * u_scan.z;
  // The scan wakes the body's contour; the chair only faintly.
  float body = mix(0.2, 1.0, texture(u_figure, v_uv, 2.5).b);
  float self_ = u_light.y * f.g * (1.0 + (1.4 * band + 0.3 * passed) * body);
  o = vec4(voice, self_, cover * u_light.w, cover);
}
