// A line across its band: a Gaussian core and a wide faint halo, added
// onto the frame.
in vec3 v_color;
in float v_across;
in float v_sigma;
out vec4 o;

void main() {
  float d = v_across / v_sigma;
  float q = d * d;
  o = vec4(v_color * (exp(-0.5 * q) + HALO * exp(-0.5 * q / (HALO_SPREAD * HALO_SPREAD))), 1.0);
}
