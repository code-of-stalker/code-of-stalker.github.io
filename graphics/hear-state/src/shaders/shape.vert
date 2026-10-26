#version 300 es
// Authored px → clip space. Everything else is per primitive.
layout(location = 0) in vec2 a_pos;
layout(location = 1) in vec2 a_uv;
layout(location = 2) in vec4 a_color;
layout(location = 3) in float a_hard;
uniform vec4 u_view;
out vec2 v_uv;
out vec4 v_color;
out float v_hard;
out vec2 v_pos;
void main() {
  v_pos = a_pos;
  v_uv = a_uv;
  v_color = a_color;
  v_hard = a_hard;
  gl_Position = vec4(a_pos * u_view.xy + u_view.zw, 0.0, 1.0);
}
