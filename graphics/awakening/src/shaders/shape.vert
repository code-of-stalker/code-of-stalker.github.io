#version 300 es
// Authored px → clip space. Everything else is per primitive.
layout(location = 0) in vec2 a_pos;
layout(location = 1) in vec2 a_local;
layout(location = 2) in vec4 a_color;
layout(location = 3) in vec3 a_shape;
uniform vec4 u_view;
out vec2 v_local;
out vec4 v_color;
out vec3 v_shape;
void main() {
  v_local = a_local;
  v_color = a_color;
  v_shape = a_shape;
  float depth = a_color.a < 0.0 ? -a_color.a : 1.0;
  gl_Position = vec4((a_pos * u_view.xy + u_view.zw) * depth, 0.0, depth);
}
