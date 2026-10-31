// The whole scene in one pass: each pixel's ray meets the plate (its sand,
// the sound's rings, the dust beyond), the dome's shells and the string of
// the voice, all of it light added onto black. Rust puts the version line
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
uniform vec4 u_waves[WAVES]; // front, light on the dome, on the floor, where it stops climbing
uniform vec3 u_belts[7];     // drawn, light, turn
uniform vec4 u_dome;  // top latitude, dome light, plate light, -
uniform vec4 u_mode0; // the sand's figure it leaves
uniform vec4 u_mode1; // the figure it goes to
uniform vec4 u_misc;  // how far between, inner dome, outer dome, -
uniform vec4 u_turn;  // inner dome's turn, outer dome's turn, -, -
uniform vec3 u_glow;

out vec4 o;

const float EDGES[8] = float[8](BELTS_INIT);
const vec4 PATTERNS[7] = vec4[7](PATTERNS_INIT);
const vec4 NEST_PATTERNS[2] = vec4[2](NEST_PATTERN_0, NEST_PATTERN_1);

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

// The floor at p, a pixel `fp` units wide there: the sand on the plate, its
// rim, the sound's rings running out to the horizon, dust they wake.
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
  float plate = inside * (SAND_LIGHT * sand * grain * breath * (1.0 - 0.5 * u_dome.w) + PLATE_FILL)
              + RIM_LIGHT * rim;

  // Sparse dust beyond the plate, lit as the rings run past.
  vec2 cell = floor(p.xz / 0.04);
  float h = hash(cell + 7.0);
  vec2 at = (cell + 0.2 + 0.6 * vec2(hash(cell + 3.0), hash(cell + 5.0))) * 0.04;
  float size = max(0.0035, 0.7 * fp);
  float dust = step(0.93, h) * exp(-0.5 * sq(length(p.xz - at) / size)) * sq(0.0035 / size);
  dust *= (0.08 + 2.5 * wake) * smoothstep(PLATE, PLATE + 0.15, r);

  float far = exp(-max(r - PLATE, 0.0) / 4.0);
  return u_dome.z * plate + far * (FLOOR_LIGHT * rings + dust);
}

// A shell's light at p (radius R, normal n) seen along d: its standing-wave
// lines, its edges, the glass sheen; on the voice's dome (kind 0) only the
// belts built so far, and the fronts climbing it.
float surface(vec3 p, vec3 d, float R, int kind, float turn, float top, float side) {
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
    edges += line(abs(lat - e) / gl) * step(e, top + 0.01);
  }
  float sheen = SHEEN / (abs(dot(n, d)) + 0.25);

  float boost = 0.0;
  float band = 0.0;
  float reach = top;
  if (kind == 0) {
    for (int i = 0; i < WAVES; i++) {
      vec4 w = u_waves[i];
      if (w.y <= 0.0) continue;
      float at = min(w.x, w.w) - 1.0;
      float near = exp(-sq((lat - at) / FRONT_WIDTH));
      band += w.y * near * smoothstep(-0.1, 0.0, at);
      boost += 2.0 * w.y * exp(-sq((lat - at) / 0.15));
      reach = max(reach, at);
    }
  }
  float above = clamp(lat / gl + 0.5, 0.0, 1.0);
  float built = clamp((top - lat) / gl + 0.5, 0.0, 1.0);
  float shown = clamp((reach + 0.02 - lat) / gl + 0.5, 0.0, 1.0);
  return side * above * (built * u_dome.y * (PATTERN_LIGHT * light * pattern * (1.0 + boost)
                                            + EDGE_LIGHT * edges + sheen)
                         + shown * FRONT_LIGHT * band);
}

// A shell of radius R round the plate's centre along the ray o + t d: its
// near and far side, the far one dimmer.
float shell(vec3 o, vec3 d, float R, int kind, float turn, float top) {
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
  float front = surface(p0, d, R, kind, turn, top, 1.0) * step(0.0, t0);
  float back = surface(p1, d, R, kind, turn, top, BACK) * step(0.0, t1);
  return cover * (front + back);
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

  light += shell(eye, d, 1.0, 0, 0.0, u_dome.x);
  if (u_misc.y > 0.0) light += u_misc.y * NEST_LIGHT * shell(eye, d, NEST_0, 1, u_turn.x, HALF_PI + 0.1);
  if (u_misc.z > 0.0) light += u_misc.z * NEST_LIGHT * shell(eye, d, NEST_1, 2, u_turn.y, HALF_PI + 0.1);
  light += voice(frag);
  o = vec4(u_glow * light, 1.0);
}
