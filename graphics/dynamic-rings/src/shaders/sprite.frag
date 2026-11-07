// A round Gaussian glow, added onto the frame.
in vec3 v_color;
in vec2 v_q;
in float v_warm;
out vec4 o;

void main() {
  float g = exp(-0.5 * dot(v_q, v_q));
  o = vec4(v_color * g, v_warm * g);
}
