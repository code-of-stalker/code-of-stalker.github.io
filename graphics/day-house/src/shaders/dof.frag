// The lens: each pixel gathers its neighbours along a golden-angle spiral
// out to the widest blur, taking a neighbour only where that neighbour's own
// blur reaches this far; what lies behind the centre may blur at most twice
// the centre's, so a sharp figure keeps its edge against a soft street.
// Writes the blurred light, the centre's depth, and 1.
out vec4 o;
uniform sampler2D u_world;

const float GOLDEN = 2.39996323;

void main() {
  vec2 texel = 1.0 / u_res.xy;
  vec2 uv = gl_FragCoord.xy * texel;
  vec4 c = texelFetch(u_world, ivec2(gl_FragCoord.xy), 0);
  float centre = c.a * BLUR_MAX;
  vec2 sum = c.rg;
  float total = 1.0;
  float radius = RAD_SCALE;
  float angle = 0.0;
  for (int i = 0; i < 160; i++) {
    if (radius >= BLUR_MAX) break;
    vec4 s = texture(u_world, uv + vec2(cos(angle), sin(angle)) * texel * radius);
    float size = s.a * BLUR_MAX;
    if (s.b > c.b) size = min(size, 2.0 * centre);
    float m = smoothstep(radius - 0.5, radius + 0.5, size);
    sum += mix(sum / total, s.rg, m);
    total += 1.0;
    radius += RAD_SCALE / radius;
    angle += GOLDEN;
  }
  o = vec4(sum / total, c.b, 1.0);
}
