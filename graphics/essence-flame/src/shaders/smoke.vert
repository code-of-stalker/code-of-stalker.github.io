#version 300 es
// Smoke ribbons: authored px → clip, across the ribbon and its light.
layout(location = 0) in vec2 a_pos;
layout(location = 1) in float a_across;
layout(location = 2) in float a_light;
uniform vec2 u_size;
out float v_across;
out float v_light;
void main() {
  v_across = a_across;
  v_light = a_light;
  gl_Position = vec4(a_pos.x / u_size.x * 2.0 - 1.0, 1.0 - a_pos.y / u_size.y * 2.0, 0.0, 1.0);
}
