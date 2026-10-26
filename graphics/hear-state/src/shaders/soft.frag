#version 300 es
precision highp float;
// Discs (uv on a square) and strips (uv.y across): a soft profile whose
// flat core grows with the hardness. Premultiplied channels.
in vec2 v_uv;
in vec4 v_color;
in float v_hard;
out vec4 o;
void main() {
  float d = length(v_uv);
  if (d >= 1.0) discard;
  float k = 1.0 - smoothstep(v_hard * 0.92, 1.0, d);
  o = v_color * (v_hard >= 1.0 ? 1.0 : k * k);
}
