#version 300 es
precision highp float;
// The character: the shell of plates from page 01/08, the cells of a
// Voronoi mosaic whose sites Rust moves a little. A frosted fill that dims
// the body behind, the fading mark of what each plate was made of (a
// picture, lines of borrowed words, a crack of fear, a strip of film), a
// glint while the impulse passes its node, and its seams, where the living
// light inside still shows through, most where it gathers at the heart.
// Rust decides every value; this only paints them.
uniform sampler2D u_figure;
uniform vec4 u_sites[64];  // x, y (SVG units), kind (0 image, 1 attitude, 2 fear, 3 memory), glint
uniform vec4 u_plates[16]; // how far each plate is in place, four to a vector
uniform vec4 u_shell;      // blur radius (SVG units), the living light, time (s), exposure
uniform vec4 u_count;      // plates, breath, the marks left, how much it hides
uniform vec4 u_heart;      // where the living light gathers (SVG x, y, radius) and how much
in vec2 v_local;
out vec4 o;
const vec2 SVG = vec2(335.0, 530.0);
const float TEXELS = 4.0; // per SVG unit
float body(vec2 p, float lod) { return textureLod(u_figure, p / SVG, lod).b; }
// The body grown by `r` SVG units: the shell lies just outside the skin.
float grown(vec2 p, float r, float lod) {
  float m = body(p, lod);
  for (int i = 0; i < 8; i++) {
    float a = float(i) * 0.7853982;
    m = max(m, body(p + vec2(cos(a), sin(a)) * r, lod));
  }
  return m;
}
float plate(int i) {
  vec4 v = u_plates[i / 4];
  int k = i - 4 * (i / 4);
  return k == 0 ? v.x : k == 1 ? v.y : k == 2 ? v.z : v.w;
}
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float stroke(float d, float w, float aa) { return 1.0 - smoothstep(w, w + aa, abs(d)); }
float box(vec2 q, vec2 b) { vec2 d = abs(q) - b; return max(d.x, d.y); }
// The mark a plate carries, around its site (SVG units).
float mark(float kind, vec2 q, float seed, float aa) {
  if (kind < 0.5) {
    // A picture: a small frame with a ridge of mountains in it.
    float frame = stroke(box(q, vec2(7.0, 5.2)), 0.3, aa);
    float ridge = q.y + 1.5 - 5.0 * abs(fract(q.x / 7.0 + seed) - 0.5);
    float inside = step(abs(q.x), 6.6) * step(abs(q.y), 4.8);
    return max(frame, 0.8 * stroke(ridge, 0.3, aa) * inside);
  }
  if (kind < 1.5) {
    // Borrowed attitudes: lines of words without letters.
    float m = 0.0;
    for (int k = 0; k < 3; k++) {
      float y = -3.6 + 3.6 * float(k);
      float len = 7.0 + 7.0 * fract(seed * 7.13 + float(k) * 0.371);
      m = max(m, stroke(q.y - y, 0.5, aa) * step(-7.5, q.x) * step(q.x, -7.5 + len));
    }
    return m;
  }
  if (kind < 2.5) {
    // Fear: a sharp crack across the plate.
    float a = seed * 6.2831853;
    vec2 r = mat2(cos(a), sin(a), -sin(a), cos(a)) * q;
    float zig = r.y - 2.0 * (abs(fract(r.x / 4.6) - 0.5) * 4.0 - 1.0);
    return stroke(zig, 0.3, aa) * step(abs(r.x), 9.0);
  }
  // Memory: a strip of film, its rails and holes, faded.
  float rails = stroke(abs(q.y) - 5.2, 0.3, aa) * step(abs(q.x), 9.0);
  vec2 h = vec2(fract(q.x / 3.2 + seed) - 0.5, abs(q.y) - 7.0);
  float holes = step(abs(h.x), 0.16) * step(abs(h.y), 0.8) * step(abs(q.x), 8.5);
  float horizon = stroke(q.y - 0.8, 0.3, aa) * step(abs(q.x), 6.0);
  return 0.65 * max(max(rails, holes), 0.6 * horizon);
}
void main() {
  vec2 p = v_local * SVG;
  float blur = u_shell.x;
  float aa = max(fwidth(p.x), fwidth(p.y)) + blur;
  float lod = clamp(log2(max(blur * TEXELS, 1.0)), 0.0, 5.0);
  float shell = smoothstep(0.3, 0.6, grown(p, 4.5, 1.5 + lod));
  if (shell <= 0.002) discard;
  float skin = smoothstep(0.3, 0.6, grown(p, 2.4, 1.5 + lod));
  // The two nearest sites: the plate here, and its neighbour across the seam.
  int count = int(u_count.x);
  float d1 = 1e9, d2 = 1e9;
  int a = 0, b = 0;
  for (int i = 0; i < 64; i++) {
    if (i >= count) break;
    float d = distance(p, u_sites[i].xy);
    if (d < d1) { d2 = d1; b = a; d1 = d; a = i; }
    else if (d < d2) { d2 = d; b = i; }
  }
  vec4 s = u_sites[a];
  vec2 across = u_sites[b].xy - s.xy;
  float edge = dot(0.5 * (s.xy + u_sites[b].xy) - p, across / max(length(across), 1e-3));
  float shown = plate(a);
  // A locking plate opens from its middle out to its seams.
  float open = shown > 0.0 ? 1.0 - smoothstep(30.0 * shown - 4.0, 30.0 * shown, d1) : 0.0;
  float here = open * shell;
  if (here <= 0.002) discard;
  float seam = 1.0 - smoothstep(0.2, 0.75 + aa, edge);
  float outline = clamp(shell - skin, 0.0, 1.0);
  float seed = hash(s.xy * 0.37 + float(a));
  float detail = clamp(1.3 - 0.25 * blur, 0.0, 1.0);
  float m = mark(s.z, p - s.xy, seed, aa) * detail * u_count.z;
  float t = u_shell.z;
  // Each plate is its own piece: pictures a little brighter, fears darker
  // and denser, memory faded and thin.
  float tone = s.z < 0.5 ? 1.15 : s.z < 1.5 ? 0.95 : s.z < 2.5 ? 0.55 : 0.75;
  tone *= 0.75 + 0.5 * seed;
  float density = s.z > 1.5 && s.z < 2.5 ? 0.72 : s.z > 2.5 ? 0.46 : 0.58;
  // The living light, seen through the seams only, leaking unevenly.
  float leak = noise(p / 9.0 + vec2(t * 0.21, -t * 0.13));
  vec2 h = (p - u_heart.xy) / u_heart.z;
  float gathered = 1.0 + 1.6 * u_heart.w * exp(-dot(h, h));
  float through = seam * u_shell.y * gathered * (0.25 + 0.45 * leak * leak + 0.06 * u_count.y);
  float glint = s.w;
  float exposure = u_shell.w;
  float room = (here * (0.03 * tone + 0.36 * m * tone + 0.4 * glint) + 0.32 * outline * open) * exposure;
  float person = here * (0.32 * through + 0.2 * glint) * mix(0.55, 1.0, exposure);
  // Frosted where it is whole, thinner along the seams.
  float cover = here * mix(density, 0.25, seam) * u_count.w;
  float glow = clamp(0.8 * through, 0.0, 1.0);
  o = vec4(room, person, 0.5 * cover * (1.0 + glow), cover);
}
