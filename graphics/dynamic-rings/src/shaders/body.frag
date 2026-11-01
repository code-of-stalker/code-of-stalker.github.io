// A round Gaussian point, added onto the frame.
in vec3 v_color;
out vec4 o;

void main() {
  vec2 q = (gl_PointCoord * 2.0 - 1.0) * 3.0;
  o = vec4(v_color * exp(-0.5 * dot(q, q)), 1.0);
}
