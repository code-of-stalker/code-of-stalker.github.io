// The whole scene in one pass: each pixel's ray meets the plate (its sand,
// the sound's rings, the projection and dust beyond), the walls of code
// rain round the scene, the dome's shells and the string of the voice, all
// of it light added onto black. Rust puts the version line
// and lib.rs's constants (#define) in front of it.
precision highp float;
precision highp int;

#define TAU 6.28318531
#define PI 3.14159265
#define HALF_PI 1.57079633

uniform vec4 u_eye;   // camera position xyz, loop time
uniform vec4 u_right; // camera axes
uniform vec4 u_up;
uniform vec4 u_fwd;
uniform vec4 u_view;  // lens scale x and y, canvas width and height in px
uniform vec4 u_voice; // swing, harmonic, light, -
uniform vec4 u_waves[WAVES]; // front, light on the dome, on the floor, where it stops
uniform vec3 u_belts[7];     // drawn, light, turn
uniform vec4 u_dome;  // lowest and highest latitude shown, dome light, plate light
uniform vec4 u_mode0; // the sand's figure it leaves
uniform vec4 u_mode1; // the figure it goes to
uniform vec4 u_misc;  // how far between, inner dome, outer dome, -
uniform vec4 u_turn;  // inner dome's turn, outer dome's turn, -, -
uniform vec4 u_spin;  // the floor's rings: how far through their turns, how fast, glow, -
uniform vec3 u_glow;

out vec4 o;

const float EDGES[8] = float[8](BELTS_INIT);
const vec4 PATTERNS[7] = vec4[7](PATTERNS_INIT);
const vec4 NEST_PATTERNS[2] = vec4[2](NEST_PATTERN_0, NEST_PATTERN_1);
const vec3 RAIN[4] = vec3[4](RAIN_INIT);
const vec3 DIALS[2] = vec3[2](DIALS_INIT);
const vec4 GLYPH_RINGS[2] = vec4[2](GLYPH_RINGS_INIT);
const vec4 PANELS[5] = vec4[5](PANELS_INIT);

// A line's Gaussian width in px, and the tangent of one pixel.
float sigma;
float pixel;

float sq(float x) {
  return x * x;
}
// A line `d` px away: a Gaussian core and a wide faint halo.
float line(float d) {
  float q = sq(d / sigma);
  return exp(-0.5 * q) + HALO * exp(-0.5 * q / (HALO_SPREAD * HALO_SPREAD));
}

uint mixBits(uint x) {
  x ^= x >> 16;
  x *= 0x7feb352du;
  x ^= x >> 15;
  x *= 0x846ca68bu;
  x ^= x >> 16;
  return x;
}
float hash(vec2 cell) {
  ivec2 c = ivec2(cell);
  return float(mixBits(uint(c.x) * 0x9e3779b9u ^ mixBits(uint(c.y) + 0x632be5abu)) >> 8) / 16777215.0;
}
float hash3(vec3 cell) {
  ivec3 c = ivec3(cell);
  return float(mixBits(uint(c.x) * 0x9e3779b9u ^ mixBits(uint(c.y) * 0x85ebca6bu ^ mixBits(uint(c.z) + 0x632be5abu))) >> 8) / 16777215.0;
}
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 s = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), s.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), s.x), s.y);
}

// A standing wave m = (m1, a1, m2, a2) on the plate at angle phi, radius
// rho (0..1): its value and the size of its gradient.
vec2 chladni(vec4 m, float phi, float rho) {
  float s1 = sin(PI * m.y * rho);
  float s2 = sin(PI * m.w * rho);
  float c1 = cos(m.x * phi);
  float c2 = cos(m.z * phi);
  float dr = PI * (c1 * m.y * cos(PI * m.y * rho) - c2 * m.w * cos(PI * m.w * rho));
  float dp = (-m.x * sin(m.x * phi) * s1 + m.z * sin(m.z * phi) * s2) / max(rho, 0.02);
  return vec2(c1 * s1 - c2 * s2, length(vec2(dr, dp)));
}

// A 3 x 5 dot glyph in cell `id`, `f` across it (0..1), its dots `size` px:
// one of `swap` glyphs, a new one `swap` times a loop, the same at both ends
// of it. Dots under a pixel and a half blur into their mean; a glyph of a
// few pixels is only its mean light.
float glyph(vec2 id, vec2 f, float size, float seed, float swap) {
  float n = mod(floor(u_eye.w / LOOP_SECONDS * swap + hash(id + seed) * swap), swap);
  vec2 s = (f - vec2(0.15, 0.1)) / vec2(0.7, 0.8) * vec2(3.0, 5.0);
  vec2 dotId = floor(s);
  float within = step(0.0, s.x) * step(s.x, 3.0) * step(0.0, s.y) * step(s.y, 5.0);
  float on = step(0.45, hash3(vec3(id.x * 3.0 + dotId.x, id.y * 5.0 + dotId.y, n + seed * 61.0)));
  float r = length(fract(s) - 0.5);
  float disc = 1.0 - smoothstep(0.32 - 0.5 / size, 0.32 + 0.5 / size, r);
  float lit = within * on * mix(0.3, disc, smoothstep(1.2, 2.2, size));
  return mix(0.09, lit, smoothstep(0.4, 0.9, size));
}

// The projection round the plate at radius r, angle phi, a pixel `fp` units
// wide: dials of ticks and rings of glyphs, each turning a whole number of
// cells a loop and spinning up whole turns at the frame beat, and streams of
// code running in over the floor to the plate.
float projection(float r, float phi, float fp) {
  float u = u_eye.w / LOOP_SECONDS;
  float a = phi / TAU + 0.5;
  float light = 0.0;
  for (int i = 0; i < 2; i++) {
    vec3 dial = DIALS[i];
    float x = (a + SPIN[i] * u_spin.x) * dial.y + dial.z * u;
    float n = floor(x + 0.5);
    float tall = mod(n, 5.0) < 0.5 ? 0.09 : 0.04;
    float apart = TAU * r / dial.y / fp;
    float along = clamp(min(r - dial.x, dial.x + tall - r) / fp + 0.5, 0.0, 1.0);
    float ticks = mix(0.3, line(abs(x - n) * apart), smoothstep(1.5, 4.0, apart));
    // Spinning, the ticks smear into their mean like a turning wheel's: all
    // of them by the circle, the long ones every fifth further out.
    float every = r - dial.x < 0.04 ? 1.0 : 5.0;
    float moved = abs(SPIN[i] * u_spin.y) * dial.y / 60.0 / every;
    float band = clamp(min(r - dial.x, dial.x + 0.09 - r) / fp + 0.5, 0.0, 1.0);
    float swept = band * min(0.3, 2.5 * sigma / (every * apart));
    light += mix(along * ticks, swept, smoothstep(0.15, 0.5, moved)) + 0.5 * line(abs(r - dial.x) / fp);
  }
  for (int i = 0; i < 2; i++) {
    vec4 ring = GLYPH_RINGS[i];
    light += 0.35 * (line(abs(r - ring.x) / fp) + line(abs(r - ring.x - ring.y) / fp));
    float y = (r - ring.x) / ring.y;
    if (y < 0.0 || y > 1.0) continue;
    float x = (a + SPIN[2 + i] * u_spin.x) * ring.z + ring.w * u;
    vec2 id = vec2(mod(floor(x), ring.z), float(i));
    if (hash(id + vec2(0.0, 40.0)) < 0.25) continue;
    light += glyph(id, vec2(fract(x), y), ring.y * 0.8 / 5.0 / fp, 50.0 + float(i), 40.0);
  }
  light *= PROJECTION_LIGHT * (1.0 + SPIN_GLOW * u_spin.z);

  // The streams: a bright head running in, its trail fading out behind it.
  float sx = a * STREAMS.y;
  float column = floor(sx);
  float row = (r - STREAMS.x) / STREAMS.z;
  if (row > 0.0 && r < STREAMS.w && hash(vec2(column, 71.0)) > 0.5) {
    float period = floor((STREAMS.w - STREAMS.x) / STREAMS.z) + 6.0;
    float k = 3.0 + floor(hash(vec2(column, 72.0)) * 4.0);
    float head = (1.0 - fract(hash(vec2(column, 73.0)) + u * k)) * period - 3.0;
    float behind = floor(row) - floor(head);
    if (behind >= 0.0) {
      float len = 4.0 + 8.0 * hash(vec2(column, 74.0));
      float trail = exp(-behind / len * 1.3) * (behind < 1.0 ? 2.0 : 1.0);
      // Glyphs of one width however far out the column has spread.
      float gx = (fract(sx) - 0.5) * (TAU * r / STREAMS.y) / (0.6 * STREAMS.z) + 0.5;
      float fade = smoothstep(0.0, 2.0, row) * (1.0 - smoothstep(STREAMS.w - 1.5, STREAMS.w, r));
      light += STREAM_LIGHT * trail * fade
             * glyph(vec2(column, floor(row)), vec2(gx, fract(row)), STREAMS.z * 0.8 / 5.0 / fp, 75.0, 50.0);
    }
  }
  return light;
}

// The floor at p, a pixel `fp` units wide there: the sand on the plate, its
// rim, the sound's rings running out to the horizon, the projection round
// the plate, dust the rings wake.
float ground(vec3 p, float fp) {
  float r = length(p.xz);
  float phi = atan(p.x, p.z);
  float t = u_eye.w;
  float rings = 0.0;
  float shake = 0.0;
  float wake = 0.0;
  for (int i = 0; i < WAVES; i++) {
    vec4 w = u_waves[i];
    if (w.y + w.z <= 0.0) continue;
    float onPlate = mix(max(w.y, w.z), w.z, smoothstep(0.9, 1.1, r));
    float width = 0.02 + 0.02 * w.x;
    float wide = max(width, fp);
    rings += onPlate * exp(-sq((r - w.x) / wide)) * width / wide;
    // The sound fills the plate behind its front.
    rings += 0.1 * onPlate * smoothstep(w.x + wide, w.x - wide, r) * exp(-max(w.x - r, 0.0) / 0.35);
    shake += w.y * exp(-sq((r - w.x) / 0.12));
    wake += w.z * exp(-sq((r - w.x) / 0.3));
  }

  // The sand gathers on the figure's nodal lines and jumps while it changes.
  float s = u_misc.x;
  vec2 a = chladni(u_mode0, phi, r / PLATE);
  vec2 b = chladni(u_mode1, phi, r / PLATE);
  float d = abs(mix(a.x, b.x, s)) / max(mix(a.y, b.y, s), 0.5) * PLATE;
  shake += 4.0 * s * (1.0 - s);
  float width = SAND_WIDTH * (1.0 + 2.5 * shake);
  float wide = max(width, fp);
  float sand = exp(-sq(d / wide)) * width / wide / (1.0 + 1.5 * shake);
  float grain = noise(p.xz / SAND_GRAIN);
  grain = mix(4.0 * grain * grain * grain, 1.0, smoothstep(0.4, 1.2, fp / SAND_GRAIN));
  float breath = 0.92 + 0.08 * sin(TAU * 9.0 * t / LOOP_SECONDS);
  float inside = 1.0 - smoothstep(PLATE - fp, PLATE + fp, r);
  // Toward the horizon the rim's pixels grow wider than the plate: let it go.
  float rw = fwidth(r);
  float rim = line(abs(r - PLATE) / max(rw, 1e-5)) * (1.0 - smoothstep(0.05, 0.3, rw));
  float plate = inside * (SAND_LIGHT * sand * grain * breath + PLATE_FILL) + RIM_LIGHT * rim;

  // Sparse dust beyond the plate, lit as the rings run past.
  vec2 cell = floor(p.xz / 0.04);
  float h = hash(cell + 7.0);
  vec2 at = (cell + 0.2 + 0.6 * vec2(hash(cell + 3.0), hash(cell + 5.0))) * 0.04;
  float size = max(0.0035, 0.7 * fp);
  float dust = step(0.93, h) * exp(-0.5 * sq(length(p.xz - at) / size)) * sq(0.0035 / size);
  dust *= (0.08 + 2.5 * wake) * smoothstep(PLATE, PLATE + 0.15, r);

  float far = exp(-max(r - PLATE, 0.0) / 4.0);
  float shown = breath * (1.0 + 3.0 * wake) * projection(r, phi, fp);
  return u_dome.w * plate + far * (FLOOR_LIGHT * rings + dust + shown);
}

// A shell's light at p (radius R, normal n) seen along d: its standing-wave
// lines, its edges, the glass sheen, between latitudes lo and hi; on the
// voice's dome (kind 0) the fronts running down it.
float surface(vec3 p, vec3 d, float R, int kind, float turn, float lo, float hi, float side) {
  vec3 n = p / R;
  float lat = asin(clamp(n.y, -1.0, 1.0));
  float phi = atan(p.x, p.z) + turn;
  float gl = max(fwidth(lat), 1e-5);
  vec4 m;
  float u;
  float light = 1.0;
  if (kind == 0) {
    int k = 0;
    for (int j = 1; j < 7; j++) {
      if (lat >= EDGES[j]) k = j;
    }
    float lo = EDGES[k];
    u = k == 6 ? (HALF_PI - lat) / (HALF_PI - lo) : (lat - lo) / (EDGES[k + 1] - lo);
    m = PATTERNS[k];
    phi += u_belts[k].z;
    light = u_belts[k].y;
  } else {
    u = lat / HALF_PI;
    m = NEST_PATTERNS[kind - 1];
  }
  float f = cos(m.x * phi) * sin(PI * m.y * u) - cos(m.z * phi) * sin(PI * m.w * u);
  float g = fwidth(f);
  // Lines closer than a few pixels melt into their mean light.
  float pattern = mix(line(abs(f) / max(g, 1e-5)), 0.12, smoothstep(0.35, 1.0, g));

  float edges = 0.0;
  for (int j = 0; j < 7; j++) {
    float e = kind == 0 ? EDGES[j] : float(j) * (HALF_PI / 3.0);
    if (kind != 0 && j > 2) break;
    edges += line(abs(lat - e) / gl);
  }
  float sheen = SHEEN / (abs(dot(n, d)) + 0.25);

  float boost = 0.0;
  float band = 0.0;
  float reach = lo;
  if (kind == 0) {
    for (int i = 0; i < WAVES; i++) {
      vec4 w = u_waves[i];
      if (w.y <= 0.0) continue;
      // Past the pole the front runs down the arc.
      float at = HALF_PI + 1.0 - min(w.x, w.w);
      float near = exp(-sq((lat - at) / FRONT_WIDTH));
      band += w.y * near * smoothstep(HALF_PI + 0.1, HALF_PI, at);
      boost += 2.0 * w.y * exp(-sq((lat - at) / 0.15));
      reach = min(reach, at);
    }
  }
  float above = clamp(lat / gl + 0.5, 0.0, 1.0);
  float built = clamp((lat - lo) / gl + 0.5, 0.0, 1.0) * clamp((hi - lat) / gl + 0.5, 0.0, 1.0);
  float shown = clamp((lat - reach + 0.02) / gl + 0.5, 0.0, 1.0);
  return side * above * (built * u_dome.z * (PATTERN_LIGHT * light * pattern * (1.0 + boost)
                                            + EDGE_LIGHT * edges + sheen)
                         + shown * FRONT_LIGHT * band);
}

// A shell of radius R round the plate's centre along the ray o + t d: its
// near and far side, the far one dimmer.
float shell(vec3 o, vec3 d, float R, int kind, float turn, float lo, float hi) {
  float b = dot(o, d);
  float c = dot(o, o) - R * R;
  float h = b * b - c;
  float root = sqrt(max(h, 0.0));
  float t0 = -b - root;
  float t1 = -b + root;
  // A ray that misses takes the shell's nearest point, so the lines'
  // derivatives stay smooth across the outline.
  vec3 nearest = o - d * b;
  vec3 miss = nearest / max(length(nearest), 1e-6) * R;
  bool hit = h > 0.0;
  vec3 p0 = hit ? o + d * t0 : miss;
  vec3 p1 = hit ? o + d * t1 : miss;
  float apart = sqrt(max(dot(nearest, nearest), 0.0));
  float cover = clamp((R - apart) / (max(-b, 1e-3) * pixel) + 0.5, 0.0, 1.0);
  float front = surface(p0, d, R, kind, turn, lo, hi, 1.0) * step(0.0, t0);
  float back = surface(p1, d, R, kind, turn, lo, hi, BACK) * step(0.0, t1);
  return cover * (front + back);
}

// Code rain on the far side of a wall of radius R round the scene along
// o + t d: columns of glyphs `cw` wide falling down it, a bright head and a
// fading trail each, a whole number of times a loop.
float rain(vec3 o, vec3 d, float R, float cw, float seed) {
  float a = dot(d.xz, d.xz);
  if (a < 1e-6) return 0.0;
  float b = dot(o.xz, d.xz);
  float c = dot(o.xz, o.xz) - R * R;
  float h = b * b - a * c;
  if (h < 0.0) return 0.0;
  float t = (-b + sqrt(h)) / a;
  if (t <= 0.0) return 0.0;
  vec3 q = o + d * t;
  // Under the floor the floor is nearer.
  if (q.y <= 0.0) return 0.0;
  float columns = floor(TAU * R / cw);
  vec2 g = vec2((atan(q.x, q.z) / TAU + 0.5) * columns, -q.y / (cw * 1.6));
  vec2 id = floor(g);
  if (hash(vec2(id.x, seed)) < 0.3) return 0.0;
  float period = floor(RAIN_HEIGHT / (cw * 1.6)) + 4.0;
  float k = 4.0 + floor(hash(vec2(id.x, seed + 1.0)) * 5.0);
  float head = fract(hash(vec2(id.x, seed + 2.0)) + u_eye.w / LOOP_SECONDS * k) * period - (period - 4.0);
  float behind = floor(head) - id.y;
  if (behind < 0.0) return 0.0;
  float len = 8.0 + 16.0 * hash(vec2(id.x, seed + 3.0));
  float trail = exp(-behind / len * 1.3) * (behind < 1.0 ? 2.2 : 1.0);
  float keep = smoothstep(0.0, 0.5, q.y) * (1.0 - smoothstep(0.6 * RAIN_HEIGHT, RAIN_HEIGHT, q.y))
             * exp(-max(t - 8.0, 0.0) * 0.06);
  return trail * keep * glyph(id, fract(g), cw * 0.7 / 3.0 / (t * pixel), seed, 60.0);
}

// The projections standing round the scene along o + t d, each facing the
// plate: a frame with bright corners, a header, lines of code scrolling up
// it a whole number of lines a loop, and the voice's own wave at its foot.
float panels(vec3 o, vec3 d) {
  float light = 0.0;
  float u = u_eye.w / LOOP_SECONDS;
  for (int i = 0; i < 5; i++) {
    vec4 pn = PANELS[i];
    vec3 outward = vec3(sin(pn.x), 0.0, cos(pn.x));
    vec3 side = vec3(cos(pn.x), 0.0, -sin(pn.x));
    float bob = 0.03 * sin(TAU * (2.0 * u + 0.2 * float(i)));
    vec3 c = outward * pn.y + vec3(0.0, PANEL_FLOAT + 0.5 * pn.w + bob, 0.0);
    float dn = dot(d, outward);
    if (abs(dn) < 1e-3) continue;
    float t = dot(c - o, outward) / dn;
    if (t <= 0.0) continue;
    vec3 q = o + d * t;
    vec2 at = vec2(dot(q - c, side), q.y - c.y);
    vec2 half_ = 0.5 * pn.zw;
    float px = t * pixel / max(abs(dn), 0.25);
    vec2 e = abs(at) - half_;
    float box = length(max(e, 0.0)) + min(max(e.x, e.y), 0.0);
    if (box > 10.0 * px) continue;
    float corner = step(-0.07, e.x) * step(-0.07, e.y);
    float shown = (0.35 + 0.65 * corner) * line(abs(box) / px);
    if (box < 0.0) {
      float top = half_.y - at.y;
      shown += 0.04 + 0.5 * line(abs(top - 0.07) / px);
      // Lines of code under the header, over the wave.
      float row = 0.1;
      float cell = 0.07;
      float columns = floor((pn.z - 0.1) / cell);
      float y = top - 0.1 + u * 40.0 * row;
      float x = (at.x + half_.x - 0.05) / cell;
      vec2 id = vec2(floor(x), mod(floor(y / row), 40.0) + 1000.0 * float(i));
      float written = floor(columns * (0.3 + 0.7 * hash(vec2(id.y, 91.0))));
      float text = step(0.1, top) * step(0.32 * pn.w, half_.y + at.y) * step(0.0, x) * step(id.x, written - 1.0);
      if (text > 0.0) shown += glyph(id, vec2(fract(x), fract(y / row)), cell * 0.7 / 3.0 / px, 90.0, 30.0);
      // The voice's own standing wave, ringing with it.
      float w = (at.x + half_.x) / pn.z;
      float amp = pn.w * (0.015 + u_voice.x);
      float wave = amp * sin(u_voice.y * PI * w) * cos(TAU * VOICE_HZ * u_eye.w + float(i));
      float base = -half_.y + 0.15 * pn.w;
      shown += 0.9 * line(abs(at.y - base - wave) / px) + 0.2 * line(abs(at.y - base) / px);
    }
    light += (0.7 + 0.3 * hash(vec2(float(i), 97.0))) * shown;
  }
  return PANEL_LIGHT * light;
}

vec3 toView(vec3 p) {
  vec3 q = p - u_eye.xyz;
  return vec3(dot(q, u_right.xyz), dot(q, u_up.xyz), dot(q, u_fwd.xyz));
}
vec2 toPx(vec3 v) {
  return (v.xy / v.z * u_view.xy * 0.5 + 0.5) * u_view.zw;
}

// The string of the voice: its standing wave, the blur of its swing, the
// bead of light on top.
float voice(vec2 frag) {
  vec3 va = toView(vec3(0.0));
  vec3 vb = toView(vec3(0.0, VOICE_HEIGHT, 0.0));
  vec2 a = toPx(va);
  vec2 b = toPx(vb);
  vec2 ab = b - a;
  float span = length(ab);
  vec2 along = span > 0.5 ? ab / span : vec2(0.0, 1.0);
  vec2 across = vec2(-along.y, along.x);
  float u = clamp(dot(frag - a, along) / max(span, 1e-3), 0.0, 1.0);
  vec2 q = frag - (a + along * u * span);
  float x = dot(q, across);
  float y = dot(q, along);
  float scale = u_view.y * 0.5 * u_view.w / mix(va.z, vb.z, u);
  float envelope = u_voice.x * sin(u_voice.y * PI * u) * scale;
  float swing = envelope * cos(TAU * VOICE_HZ * u_eye.w);
  float core = line(length(vec2(x - swing, y)));
  float blur = 0.2 * (1.0 - smoothstep(abs(envelope) - 1.0, abs(envelope) + 1.0, abs(x)))
             * smoothstep(1.0, 4.0, abs(envelope)) * step(abs(y), 0.5);
  float db = length(frag - b);
  float bead = 1.6 * exp(-0.5 * sq(db / (2.4 * sigma))) + 0.25 * exp(-db / (14.0 * sigma));
  return VOICE_LIGHT * u_voice.z * (core + blur + bead);
}

// Each phrase's sound rising from the string to the pole before it runs
// down the dome: a bead and its trail along the axis.
float rise(vec2 frag) {
  vec2 a = toPx(toView(vec3(0.0, VOICE_HEIGHT, 0.0)));
  vec2 b = toPx(toView(vec3(0.0, 1.0, 0.0)));
  vec2 ab = b - a;
  float span = max(length(ab), 1e-3);
  vec2 along = ab / span;
  float u = dot(frag - a, along) / span;
  float x = abs(dot(frag - a, vec2(-along.y, along.x)));
  float light = 0.0;
  for (int i = 0; i < WAVES; i++) {
    vec4 w = u_waves[i];
    if (w.y <= 0.0 || w.x > 1.2) continue;
    float s = min(w.x, 1.0);
    float fade = w.y * (1.0 - smoothstep(0.9, 1.15, w.x));
    float behind = s - u;
    float trail = step(0.0, behind) * step(0.0, u) * exp(-behind / 0.3);
    float dh = length(frag - mix(a, b, s));
    light += fade * (0.6 * trail * line(x) + 1.4 * exp(-0.5 * sq(dh / (2.4 * sigma)))
                     + 0.2 * exp(-dh / (12.0 * sigma)));
  }
  return VOICE_LIGHT * light;
}

void main() {
  vec2 frag = gl_FragCoord.xy;
  sigma = LINE_WIDTH * u_view.w;
  pixel = 2.0 / (u_view.y * u_view.w);
  vec2 lens = (frag / u_view.zw * 2.0 - 1.0) / u_view.xy;
  vec3 d = normalize(u_fwd.xyz + u_right.xyz * lens.x + u_up.xyz * lens.y);
  vec3 eye = u_eye.xyz;

  float down = -d.y;
  float onFloor = step(1e-4, down);
  float tf = eye.y / max(down, 1e-4);
  vec3 p = eye + d * tf;
  float fp = tf * pixel / max(down, 0.06);
  float light = onFloor * ground(p, fp);

  // The walls of rain brighten a little while the voice rings.
  float code = 0.0;
  for (int i = 0; i < 4; i++) code += RAIN[i].z * rain(eye, d, RAIN[i].x, RAIN[i].y, float(11 + 13 * i));
  light += code * (1.0 + 0.4 * (u_voice.z - 1.0)) + panels(eye, d);

  light += shell(eye, d, 1.0, 0, 0.0, u_dome.x, u_dome.y);
  if (u_misc.y > 0.0) light += u_misc.y * NEST_LIGHT * shell(eye, d, NEST_0, 1, u_turn.x, -0.1, HALF_PI + 0.1);
  if (u_misc.z > 0.0) light += u_misc.z * NEST_LIGHT * shell(eye, d, NEST_1, 2, u_turn.y, -0.1, HALF_PI + 0.1);
  light += voice(frag) + rise(frag);
  o = vec4(u_glow * light, 1.0);
}
