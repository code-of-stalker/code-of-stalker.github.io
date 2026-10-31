#version 300 es
// A soft round dot: a Gaussian across the sprite (lib.rs DOT_SIGMA),
// added onto the frame.
precision mediump float;
in vec3 v_color;
out vec4 o;
void main() {
  vec2 q = gl_PointCoord - 0.5;
  o = vec4(v_color * exp(-16.0 * dot(q, q)), 1.0);
}
