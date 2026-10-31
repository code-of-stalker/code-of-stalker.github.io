// A round Gaussian glow, added onto the frame.
in vec3 v_color;
in vec2 v_q;
out vec4 o;

void main() {
  o = vec4(v_color * exp(-0.5 * dot(v_q, v_q)), 1.0);
}
