#version 300 es
precision highp float;
// Strokes (local.y across, px) and specks (local on a square, px): a flat
// core and a soft edge that the lens has already widened. A speck out of
// focus gets a faint bright rim, like a real lens. Premultiplied channels.
in vec2 v_local;
in vec4 v_color;
in vec3 v_shape; // core, soft, rim
out vec4 o;
void main() {
  float d = length(v_local);
  float k = 1.0 - smoothstep(v_shape.x - v_shape.y, v_shape.x + v_shape.y, d);
  if (k <= 0.0) discard;
  k *= 1.0 + v_shape.z * smoothstep(v_shape.x * 0.45, v_shape.x, d);
  o = v_color * k;
}
