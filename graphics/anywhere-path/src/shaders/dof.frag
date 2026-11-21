// The lens: each pixel gathers its neighbours along a golden-angle spiral
// out to the widest blur, taking a neighbour only where that neighbour's own
// blur reaches this far; what lies behind the centre may blur at most twice
// the centre's, so a sharp figure keeps its edge against a soft distance.
// The blur comes from the depth the world wrote (z / (z + 8)), the focus and
// how open the lens is (u_lens). Writes the blurred colour and the depth.
out vec4 o;
uniform sampler2D u_world;
uniform vec4 u_lens; // focus (m), the blur far behind it (px), -, -

const float GOLDEN = 2.39996323;

float blurOf(float depth) {
  float z = 8.0 * depth / max(1.0 - depth, 1e-4);
  return min(u_lens.y * abs(z - u_lens.x) / max(z, 1e-3), BLUR_MAX);
}

void main() {
  vec2 texel = 1.0 / u_res.xy;
  vec2 uv = gl_FragCoord.xy * texel;
  vec4 c = texelFetch(u_world, ivec2(gl_FragCoord.xy), 0);
  float centre = blurOf(c.a);
  vec3 sum = c.rgb;
  float total = 1.0;
  float radius = RAD_SCALE;
  float angle = 0.0;
  for (int i = 0 + ZERO; i < 160; i++) {
    if (radius >= BLUR_MAX) break;
    vec4 s = texture(u_world, uv + vec2(cos(angle), sin(angle)) * texel * radius);
    float size = blurOf(s.a);
    if (s.a > c.a) size = min(size, 2.0 * centre);
    float m = smoothstep(radius - 0.5, radius + 0.5, size);
    sum += mix(sum / total, s.rgb, m);
    total += 1.0;
    radius += RAD_SCALE / radius;
    angle += GOLDEN;
  }
  o = vec4(sum / total, c.a);
}
