// A round Gaussian point, added onto the frame.
in vec3 v_color;
in float v_warm;
out vec4 o;

void main() {
  vec2 q = (gl_PointCoord * 2.0 - 1.0) * 3.0;
  float g = exp(-0.5 * dot(q, q));
  o = vec4(v_color * g, v_warm * g);
}
