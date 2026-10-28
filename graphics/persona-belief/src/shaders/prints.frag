// The imprint around the origin, baked once whenever it changes: height in
// two bytes (coarse + fine, both filtered linearly so their sum is too),
// the cover and the pressed sand.
uniform vec2 u_print; // kind, depth
in vec2 v_uv;
out vec4 o;
void main() {
  vec2 p = (v_uv * 2.0 - 1.0) * SPAN;
  vec3 r = imprint(p, int(u_print.x + 0.5), u_print.y);
  float h = clamp((r.x - HMIN) / (HMAX - HMIN), 0.0, 1.0) * 255.0;
  float coarse = floor(h);
  o = vec4(coarse / 255.0, h - coarse, r.y, r.z);
}
