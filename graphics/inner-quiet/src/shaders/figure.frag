// Him in the theme's colours: the picture's glowing outline and face in the
// cold line, his clothes a dark fill. Inside his clothes his own land of
// lines: blurred and noisy while he looks only outward, sharp from «Второй
// уровень», brighter and warm where the second ring passes, flat and quiet
// at the end like the land.
uniform sampler2D u_figure;
uniform vec4 u_inner; // its noise, how sharp, how bright, the second ring's height over his soles
in vec2 v_uv;
out vec4 o;

void main() {
  time = u_eye.w;
  float K8 = px800();
  vec4 c = texture(u_figure, vec2(v_uv.x, 1.0 - v_uv.y));
  // Where he is and how far each pixel is in metres, worked out before any
  // branch.
  float h = v_uv.y * CARD.y - CARD.z;
  float x = (v_uv.x - 0.5) * CARD.x;
  float fh = max(fwidth(h), 1e-6);
  if (c.a < 0.03) discard;

  float lum = max(c.r, max(c.g, c.b));
  vec3 col = page() * 0.5 + COLD * lum * 1.3;

  // His inside: dark and opaque, away from the drawn lines.
  float inside = smoothstep(0.75, 0.98, c.a) * (1.0 - smoothstep(0.05, 0.16, lum));
  if (inside > 0.0 && u_inner.z > 0.0) {
    float k = floor(h / INNER_ROW + 0.5);
    float wave = u_inner.x * (vnoise2(vec2(x * 9.0 - 0.4 * time, k * 1.7)) - 0.5) * 3.2
               + u_inner.x * (vnoise2(vec2(x * 23.0 + 0.7 * time, k * 2.9)) - 0.5) * 1.4;
    float d = abs(h / INNER_ROW - k - wave * 0.9) * INNER_ROW / fh;
    // Blurred: wide and dim; sharp: a fine line.
    float sigma = mix(9.0, 0.55, u_inner.y) * K8;
    float w = 0.9 * K8;
    float line = clamp(0.5 * w + 0.5 - d, 0.0, 1.0) * u_inner.y + exp(-sq(d / sigma)) * mix(0.45, 0.25, u_inner.y);
    float ring = exp(-sq((h - u_inner.w) / 0.16));
    vec3 ink = mix(COLD, WARM, 0.85 * ring);
    col += ink * line * inside * u_inner.z * (0.4 + 0.8 * ring);
  }
  o = vec4(col, c.a);
}
