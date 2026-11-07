// A line across its band: a Gaussian core and a wide faint halo, added
// onto the frame.
in vec3 v_color;
in float v_across;
in float v_sigma;
in float v_warm;
out vec4 o;

void main() {
  float d = v_across / v_sigma;
  float q = d * d;
  float g = exp(-0.5 * q) + HALO * exp(-0.5 * q / (HALO_SPREAD * HALO_SPREAD));
  o = vec4(v_color * g, v_warm * g);
}
