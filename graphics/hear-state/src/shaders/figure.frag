#version 300 es
precision highp float;
// Approved seated figure: red = opaque cover, green = ink contour.
// The voice side catches a rim of light; the contour is the self.
uniform sampler2D u_figure;
uniform vec4 u_light; // rim strength, contour strength, rim offset (uv), body
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
  float self_ = u_light.y * f.g;
  o = vec4(voice, self_, cover * u_light.w, cover);
}
