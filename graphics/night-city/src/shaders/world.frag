// The night street, one ray a pixel: the wet ground and its mirror, the
// three rows of buildings with their shops, windows and model-like edge
// lines, the lamps and their poles, the neon blade signs, the walker, and
// in the air the lamps' cones in the rain, the cars' light trails, the
// crossing lights, the steam, his breath and the shells of his voice.
// Writes cold light, warm light, depth (z / (z + 8)) and the lens's blur.
//
// It is drawn in passes (browser.rs puts one PASS_ define in front): one
// program with all of it takes D3D's shader compiler (Chrome on Windows)
// minutes, longer than the GPU's watchdog waits, while each pass builds in
// seconds. PASS_HITS traces the eye's ray and the wet ground's mirror ray and
// writes what each met (four float frames); PASS_BUILDINGS, PASS_GROUND and
// PASS_REST light their own kinds of surface from those records and PASS_AIR
// the air, all added up in the world's frame. PASS_ALL is the whole world in
// one program, for a GPU that cannot draw into float frames.
#ifdef PASS_HITS
layout(location = 0) out vec4 o0;
layout(location = 1) out vec4 o1;
layout(location = 2) out vec4 o2;
layout(location = 3) out vec4 o3;
#else
out vec4 o;
#endif
#if !defined(PASS_HITS) && !defined(PASS_ALL)
uniform highp sampler2D u_h0;
uniform highp sampler2D u_h1;
uniform highp sampler2D u_h2;
uniform highp sampler2D u_h3;
#endif
// The walker's shadow in the lamps' light and the cars' gleam: only the
// ground shows them.
#if defined(PASS_ALL) || defined(PASS_GROUND)
#define LIGHT_FULL 1
#else
#define LIGHT_FULL 0
#endif

uniform vec4 u_b[CONES * 3];
const float BLEND[CONES] = float[CONES](BLENDS);

#define SKY 0
#define GROUND 1
#define KERB 2
#define BUILDING 3
#define POLE 4
#define HEAD_LAMP 5
#define SIGN 6
#define FIGURE 7

// The haze's own light: the city's glow in the rain.
const vec2 HAZE_LIGHT = vec2(0.010, 0.014);
const float CLOUD = 92.0;

struct Hit {
  float t;
  int kind;
  vec3 n;
  int row;
  float s;
  int c;
  vec3 lo;
  vec3 hi;
  vec4 info;
};

// ---- the walker: 19 rounded cones blended into one body (body.rs) ----

float roundCone(vec3 p, vec3 a, vec3 b, float r1, float r2) {
  vec3 ba = b - a;
  float l2 = dot(ba, ba);
  float rr = r1 - r2;
  float a2 = l2 - rr * rr;
  float il2 = 1.0 / l2;
  vec3 pa = p - a;
  float y = dot(pa, ba);
  float z = y - l2;
  vec3 xv = pa * l2 - ba * y;
  float x2 = dot(xv, xv);
  float y2 = y * y * l2;
  float z2 = z * z * l2;
  float k = sign(rr) * rr * rr * x2;
  if (sign(z) * a2 * z2 > k) return sqrt(x2 + z2) * il2 - r2;
  if (sign(y) * a2 * y2 < k) return sqrt(x2 + y2) * il2 - r1;
  return (sqrt(x2 * a2 * il2) + y * rr) * il2 - r1;
}
float cone(int c, vec3 p) {
  vec4 a = u_b[3 * c];
  vec4 b = u_b[3 * c + 1];
  vec4 s = u_b[3 * c + 2];
  vec3 m = 0.5 * (a.xyz + b.xyz);
  vec3 q = p + s.xyz * dot(p - m, s.xyz) * (1.0 / s.w - 1.0);
  return roundCone(q, a.xyz, b.xyz, a.w, b.w) * s.w;
}
float smin(float a, float b, float k) {
  float h = max(k - abs(a - b), 0.0) / k;
  return min(a, b) - h * h * k * 0.25;
}
float figure(vec3 p) {
  float d = cone(0, p);
  bool noHead = FIG_LO.w > 0.5;
  for (int c = 1 + ZERO; c < CONES; c++) {
    if (noHead && (c == 3 || c == 4)) continue;
    d = smin(d, cone(c, p), BLEND[c]);
  }
  return d;
}
// His normal from four samples round p, taken in a loop so the compiler
// builds figure() once here; their mean is the distance at p.
vec3 figureNormal(vec3 p, out float d) {
  const float e = 0.0015;
  vec3 n = vec3(0.0);
  d = 0.0;
  for (int i = 0 + ZERO; i < 4; i++) {
    vec3 k = vec3(float(((i + 3) >> 1) & 1), float((i >> 1) & 1), float(i & 1)) * 2.0 - 1.0;
    float f = figure(p + k * e);
    n += k * f;
    d += 0.25 * f;
  }
  return normalize(n);
}
// Whether p is his skin: the head and the hands.
bool skin(vec3 p, float d) {
  float near = d + 0.012;
  return (FIG_LO.w < 0.5 && cone(4, p) < near) || cone(17, p) < near || cone(18, p) < near;
}

// ---- geometry ----

vec3 safeInverse(vec3 d) {
  return 1.0 / vec3(abs(d.x) < 1e-6 ? 1e-6 : d.x, abs(d.y) < 1e-6 ? 1e-6 : d.y, abs(d.z) < 1e-6 ? 1e-6 : d.z);
}
vec2 slab(vec3 ro, vec3 ird, vec3 lo, vec3 hi) {
  vec3 a = (lo - ro) * ird, b = (hi - ro) * ird;
  vec3 n = min(a, b), f = max(a, b);
  return vec2(max(max(n.x, n.y), n.z), min(min(f.x, f.y), f.z));
}
vec3 slabNormal(vec3 ro, vec3 rd, vec3 ird, vec3 lo, vec3 hi) {
  vec3 n = min((lo - ro) * ird, (hi - ro) * ird);
  if (n.x >= n.y && n.x >= n.z) return vec3(-sign(rd.x), 0.0, 0.0);
  if (n.y >= n.z) return vec3(0.0, -sign(rd.y), 0.0);
  return vec3(0.0, 0.0, -sign(rd.z));
}

// Lot c of a row on side s: its box, false where none stands. Row 0 is the
// street's own buildings, row 1 the taller ones behind, row 2 the towers.
bool lot(int row, float s, int c, out vec3 lo, out vec3 hi) {
  lo = vec3(0.0);
  hi = vec3(0.0);
  if (row < 2 && crossing(c)) return false;
  float cl = row == 2 ? TOWER_CELL : CELL;
  float z0 = float(c) * cl - 0.5 * cl;
  uint sd = (s > 0.0 ? 1u : 2u) + uint(row) * 8u;
  int k = row == 2 ? pm(c, 4) : pm(c, 10);
  float h1 = hash1(k, 60u + sd), h2 = hash1(k, 70u + sd), h3 = hash1(k, 80u + sd);
  float xa, xb, za, zb, h;
  if (row == 0) {
    xa = FACADE;
    xb = FACADE + 8.0 + 5.0 * h2;
    za = z0;
    zb = z0 + CELL;
    h = 8.5 + 17.0 * h1 * h1 + (h3 > 0.82 ? 6.0 : 0.0);
  } else if (row == 1) {
    if (h3 < 0.18) return false;
    xa = 22.0 + 3.0 * h2;
    xb = xa + 9.0 + 6.0 * h3;
    za = z0 + 0.5;
    zb = z0 + CELL - 0.5;
    h = 17.0 + 34.0 * h1 * h1;
  } else {
    xa = 44.0 + 4.0 * h2;
    xb = xa + 10.0 + 8.0 * h3;
    float half_ = 4.0 + 3.0 * h3;
    float mid = z0 + 0.5 * cl + (h2 - 0.5) * 6.0;
    za = mid - half_;
    zb = mid + half_;
    h = 42.0 + 58.0 * h1;
  }
  lo = vec3(s > 0.0 ? xa : -xb, 0.0, za);
  hi = vec3(s > 0.0 ? xb : -xa, h, zb);
  return true;
}

// The first lot of a row the ray meets on side s, nearer than h.t.
bool traceRow(vec3 ro, vec3 rd, vec3 ird, int row, float s, inout Hit h) {
  float xa = row == 0 ? FACADE : (row == 1 ? 22.0 : 44.0);
  float xb = row == 0 ? FACADE + 13.0 : (row == 1 ? 40.0 : 66.0);
  float top = row == 0 ? 31.5 : (row == 1 ? 51.0 : 100.0);
  float cl = row == 2 ? TOWER_CELL : CELL;
  float t0 = max((s * xa - ro.x) * ird.x, 0.0);
  float t1 = min((s * xb - ro.x) * ird.x, h.t);
  if (rd.y > 0.0) t1 = min(t1, (top - ro.y) * ird.y);
  else if (rd.y < 0.0) t0 = max(t0, (top - ro.y) * ird.y);
  if (t0 >= t1) return false;
  int ca = int(floor((ro.z + rd.z * t0 + 0.5 * cl) / cl));
  int cb = int(floor((ro.z + rd.z * t1 + 0.5 * cl) / cl));
  int dir = cb >= ca ? 1 : -1;
  int n = min(abs(cb - ca), row == 0 ? 30 : 20);
  for (int i = 0 + ZERO; i <= n; i++) {
    int c = ca + i * dir;
    vec3 lo, hi;
    if (!lot(row, s, c, lo, hi)) continue;
    vec2 b = slab(ro, ird, lo, hi);
    if (b.x < b.y && b.x > 0.0 && b.x < h.t) {
      h.t = b.x;
      h.kind = BUILDING;
      h.n = slabNormal(ro, rd, ird, lo, hi);
      h.row = row;
      h.s = s;
      h.c = c;
      h.lo = lo;
      h.hi = hi;
      return true;
    }
  }
  return false;
}

// A neon blade sign on lot c of row 0, side s: the plane it stands in (z),
// its foot and top, and whether it burns warm.
bool bladeSign(float s, int c, out vec4 sg) {
  sg = vec4(0.0);
  if (crossing(c)) return false;
  int k = pm(c, 10);
  uint sd = s > 0.0 ? 1u : 2u;
  if (hash1(k, 90u + sd) < 0.42) return false;
  float z0 = float(c) * CELL - 0.5 * CELL;
  float y0 = 4.3 + 1.2 * hash1(k, 91u + sd);
  sg = vec4(z0 + 0.8 + 1.6 * hash1(k, 93u + sd), y0, y0 + 2.2 + 1.8 * hash1(k, 92u + sd),
            step(0.5, hash1(k, 94u + sd)));
  return true;
}

// The lamps' poles, arms and heads near where the ray crosses their line.
void traceLamps(vec3 ro, vec3 rd, vec3 ird, inout Hit h) {
  for (int side = 0 + ZERO; side < 2; side++) {
    float s = side == 0 ? 1.0 : -1.0;
    float tc = (s * 3.1 - ro.x) * ird.x;
    if (tc <= 0.0 || tc > h.t + 2.0) continue;
    float k0 = floor((ro.z + rd.z * tc) / LAMP_GAP - lampOffset(s) + 0.5);
    for (int j = -1 + ZERO; j <= 1; j++) {
      float k = k0 + float(j);
      float z = (k + lampOffset(s)) * LAMP_GAP;
      vec2 oc = ro.xz - vec2(s * LAMP_POLE, z);
      float a = dot(rd.xz, rd.xz), b = dot(oc, rd.xz), cc = dot(oc, oc) - 0.0056;
      float disc = b * b - a * cc;
      // A pole the camera brushes past would black out the frame: the
      // camera does not see it (its light and its shadow stay).
      bool brushed = length(EYE.xz - vec2(s * LAMP_POLE, z)) < 1.0;
      if (disc > 0.0 && a > 1e-8 && !brushed) {
        float t = (-b - sqrt(disc)) / a;
        float y = ro.y + rd.y * t;
        if (t > 0.0 && t < h.t && y > 0.0 && y < LAMP_HEAD_Y + 0.16) {
          vec2 q = oc + rd.xz * t;
          h.t = t;
          h.kind = POLE;
          h.n = normalize(vec3(q.x, 0.0, q.y));
          h.info = vec4(s, k, 0.0, 0.0);
        }
      }
      vec3 alo = vec3(min(s * LAMP_HEAD_X, s * LAMP_POLE), LAMP_HEAD_Y + 0.08, z - 0.035);
      vec3 ahi = vec3(max(s * LAMP_HEAD_X, s * LAMP_POLE), LAMP_HEAD_Y + 0.14, z + 0.035);
      vec2 ab = slab(ro, ird, alo, ahi);
      if (ab.x < ab.y && ab.x > 0.0 && ab.x < h.t) {
        h.t = ab.x;
        h.kind = POLE;
        h.n = slabNormal(ro, rd, ird, alo, ahi);
        h.info = vec4(s, k, 0.0, 0.0);
      }
      vec3 hlo = vec3(s * LAMP_HEAD_X - 0.42, LAMP_HEAD_Y - 0.05, z - 0.16);
      vec3 hhi = vec3(s * LAMP_HEAD_X + 0.42, LAMP_HEAD_Y + 0.1, z + 0.16);
      vec2 hb = slab(ro, ird, hlo, hhi);
      if (hb.x < hb.y && hb.x > 0.0 && hb.x < h.t) {
        h.t = hb.x;
        h.kind = HEAD_LAMP;
        h.n = slabNormal(ro, rd, ird, hlo, hhi);
        h.info = vec4(s, k, 0.0, 0.0);
      }
    }
  }
}

// The blade signs in the band where they hang over the pavement.
void traceSigns(vec3 ro, vec3 rd, vec3 ird, inout Hit h) {
  for (int side = 0 + ZERO; side < 2; side++) {
    float s = side == 0 ? 1.0 : -1.0;
    float ta = (s * (FACADE - 1.1) - ro.x) * ird.x;
    float tb = (s * (FACADE - 0.12) - ro.x) * ird.x;
    float t0 = max(min(ta, tb), 0.0), t1 = min(max(ta, tb), h.t);
    if (t0 >= t1) continue;
    int ca = cellOf(ro.z + rd.z * t0), cb = cellOf(ro.z + rd.z * t1);
    int dir = cb >= ca ? 1 : -1;
    int n = min(abs(cb - ca), 6);
    for (int i = 0 + ZERO; i <= n; i++) {
      int c = ca + i * dir;
      vec4 sg;
      if (!bladeSign(s, c, sg)) continue;
      float t = (sg.x - ro.z) * ird.z;
      if (t < t0 || t > t1) continue;
      float y = ro.y + rd.y * t;
      if (y < sg.y || y > sg.z) continue;
      h.t = t;
      h.kind = SIGN;
      h.n = vec3(0.0, 0.0, -sign(rd.z));
      h.s = s;
      h.c = c;
      h.info = sg;
      break;
    }
  }
}

float traceFigure(vec3 ro, vec3 rd, vec3 ird, float tmax) {
  vec2 b = slab(ro, ird, FIG_LO.xyz - 0.03, FIG_HI.xyz + 0.03);
  float t = max(b.x, 0.12);
  float end = min(b.y, tmax);
  if (t >= end) return -1.0;
  for (int i = 0 + ZERO; i < 72; i++) {
    float d = figure(ro + rd * t);
    if (d < 0.0008 * t + 0.0004) return t;
    t += d * 0.9;
    if (t > end) break;
  }
  return -1.0;
}

Hit noHit() {
  Hit h;
  h.t = 1e4;
  h.kind = SKY;
  h.n = vec3(0.0, 1.0, 0.0);
  h.row = 0;
  h.s = 0.0;
  h.c = 0;
  h.lo = vec3(0.0);
  h.hi = vec3(0.0);
  h.info = vec4(0.0);
  return h;
}

Hit trace(vec3 ro, vec3 rd, bool walker) {
  Hit h = noHit();
  vec3 ird = safeInverse(rd);
  if (rd.y < 0.0) {
    float t = -ro.y * ird.y;
    vec3 p = ro + rd * t;
    if (abs(p.x) >= ROAD) {
      h.t = t;
      h.kind = GROUND;
    } else {
      float tr = (-CURB - ro.y) * ird.y;
      vec3 q = ro + rd * tr;
      if (abs(q.x) < ROAD) {
        h.t = tr;
        h.kind = GROUND;
      } else {
        float sx = sign(q.x);
        h.t = (sx * ROAD - ro.x) * ird.x;
        h.kind = KERB;
        h.n = vec3(-sx, 0.0, 0.0);
      }
    }
  }
  float s = rd.x >= 0.0 ? 1.0 : -1.0;
  for (int row = 0 + ZERO; row < 3; row++) {
    if (traceRow(ro, rd, ird, row, s, h)) break;
  }
  traceLamps(ro, rd, ird, h);
  traceSigns(ro, rd, ird, h);
  if (walker) {
    float t = traceFigure(ro, rd, ird, h.t);
    if (t > 0.0) {
      h.t = t;
      h.kind = FIGURE;
    }
  }
  return h;
}

// How much of a lamp's light at p the walker leaves (soft).
float walkerShadow(vec3 p, vec3 lamp) {
  vec3 d = lamp - p;
  float len = length(d);
  d /= len;
  vec3 ird = safeInverse(d);
  vec2 b = slab(p, ird, FIG_LO.xyz - 0.02, FIG_HI.xyz + 0.02);
  if (b.x >= b.y || b.y <= 0.0) return 1.0;
  float t = max(b.x, 0.02);
  float res = 1.0;
  for (int i = 0 + ZERO; i < 28; i++) {
    float e = figure(p + d * t);
    res = min(res, 10.0 * e / t);
    if (res < 0.02) return 0.0;
    t += clamp(e, 0.02, 0.2);
    if (t > b.y) break;
  }
  return smoothstep(0.0, 1.0, res);
}

// The lamps' light at p (cold, warm); n = 0 lights from every side. With
// `shadowed` the walker's shadow falls in it near him.
vec2 lamps(vec3 p, vec3 n, float wrap, bool shadowed) {
  vec3 centre = 0.5 * (FIG_LO.xyz + FIG_HI.xyz);
  shadowed = shadowed && length(p.xz - centre.xz) <= 9.0;
  vec2 l = vec2(0.0);
  for (int side = 0 + ZERO; side < 2; side++) {
    float s = side == 0 ? 1.0 : -1.0;
    float k0 = floor(p.z / LAMP_GAP - lampOffset(s) + 0.5);
    for (int j = -1 + ZERO; j <= 1; j++) {
      float k = k0 + float(j);
      vec3 c = lampHead(s, k);
      vec3 d = p - c;
      float d2 = dot(d, d);
      float lambert = 1.0;
      if (dot(n, n) > 0.0) lambert = clamp((dot(n, -d) * inversesqrt(d2) + wrap) / (1.0 + wrap), 0.0, 1.0);
      float i = LAMP_LIGHT * lampFlicker(s, k) * lampCone(d) * lambert / max(d2, 0.25);
#if LIGHT_FULL
      if (shadowed && i > 0.002) i *= walkerShadow(p + n * 0.01, c);
#endif
      if (side == 0) l.x += i; else l.y += i;
    }
  }
  return l;
}

// The lamps' gleam in a wet surface (GGX), cold and warm.
vec2 lampsGleam(vec3 p, vec3 n, vec3 v, float a2) {
  vec2 l = vec2(0.0);
  float nv = max(dot(n, v), 0.05);
  for (int side = 0 + ZERO; side < 2; side++) {
    float s = side == 0 ? 1.0 : -1.0;
    float k0 = floor(p.z / LAMP_GAP - lampOffset(s) + 0.5);
    for (int j = -2 + ZERO; j <= 2; j++) {
      float k = k0 + float(j);
      vec3 c = lampHead(s, k);
      vec3 d = c - p;
      float d2 = dot(d, d);
      vec3 ld = d * inversesqrt(d2);
      vec3 hv = normalize(ld + v);
      float nh = max(dot(n, hv), 0.0);
      float q = nh * nh * (a2 - 1.0) + 1.0;
      float D = a2 / (PI * q * q);
      float F = 0.02 + 0.98 * pow(1.0 - max(dot(hv, v), 0.0), 5.0);
      float i = LAMP_LIGHT * lampFlicker(s, k) * lampCone(-d) * D * F / (4.0 * nv) / max(d2, 0.25);
      i *= step(0.0, dot(n, ld));
      if (side == 0) l.x += i; else l.y += i;
    }
  }
  return l;
}

// The cars' lamps in the wet road.
vec2 carsGleam(vec3 p, vec3 n, vec3 v, float a2) {
  vec2 l = vec2(0.0);
  float nv = max(dot(n, v), 0.05);
  float nc = floor(p.z / REPEAT);
  for (int lane = 0 + ZERO; lane < 2; lane++) {
    int count = int(lane == 0 ? CARS_0_COUNT : CARS_1_COUNT);
    float x = lane == 0 ? -CAR_LANE : CAR_LANE;
    for (int m = -1 + ZERO; m <= 1; m++) {
      for (int j = 0 + ZERO; j < 3; j++) {
        if (j >= count) break;
        float z = carZ(lane, j, nc + float(m));
        if (abs(z - p.z) > 30.0) continue;
        vec3 d = vec3(x, 0.65, z) - p;
        float d2 = dot(d, d);
        vec3 ld = d * inversesqrt(d2);
        vec3 hv = normalize(ld + v);
        float nh = max(dot(n, hv), 0.0);
        float q = nh * nh * (a2 - 1.0) + 1.0;
        float D = a2 / (PI * q * q);
        // Wet asphalt mirrors at a glance and hardly at all from above:
        // a crane over the road must not see a car's lamps pooled on it.
        float F = 0.25 * clamp(1.6 * (1.0 - max(dot(hv, v), 0.0)), 0.06, 1.0);
        float i = 2.0 * CAR_LIGHT * D * F / (4.0 * nv) / max(d2, 0.25);
        if (lane == 0) l.y += i; else l.x += 1.4 * i;
      }
    }
  }
  return l;
}

// ---- surfaces ----

// What a surface makes of the light at p: its own glow, how much of the
// lamps' (and its extra) light it gives back, the lamps' and the cars'
// gleam in it, its share of the voice's rings and the shade of his feet.
// Every surface fills one and lightOf() lights it, so the shader compiler
// builds each light once: D3D's compiler (Chrome on Windows) takes minutes
// over a shader that calls them from every surface.
struct Mat {
  vec2 L;
  float albedo;
  vec3 n;
  float wrap;
  bool shadowed;
  vec2 extra;
  float gleam;
  float cars;
  vec3 gn;
  float a2;
  float rings;
  float mul;
};
Mat emits(vec2 L) {
  Mat m;
  m.L = L;
  m.albedo = 0.0;
  m.n = vec3(0.0);
  m.wrap = 0.0;
  m.shadowed = false;
  m.extra = vec2(0.0);
  m.gleam = 0.0;
  m.cars = 0.0;
  m.gn = vec3(0.0, 1.0, 0.0);
  m.a2 = 0.1;
  m.rings = 0.0;
  m.mul = 1.0;
  return m;
}
Mat matte(float albedo, vec3 n, float wrap, vec2 extra) {
  Mat m = emits(vec2(0.0));
  m.albedo = albedo;
  m.n = n;
  m.wrap = wrap;
  m.extra = extra;
  return m;
}
vec2 lightOf(Mat m, vec3 p, vec3 v) {
  vec2 L = m.L;
  if (m.albedo > 0.0) L += m.albedo * (lamps(p, m.n, m.wrap, m.shadowed) + m.extra);
  if (m.gleam > 0.0) L += m.gleam * lampsGleam(p, m.gn, v, m.a2);
#if LIGHT_FULL
  if (m.cars > 0.0) L += m.cars * carsGleam(p, m.gn, v, m.a2);
#endif
  if (m.rings > 0.0) L.x += m.rings * shellRings(p);
  return L * m.mul;
}

// A line of the model's drawing at distance e (m) from it, about a pixel wide.
float edgeLine(float e, float w) {
  return exp(-max(e, 0.0) / w);
}

// The room behind a window, entered at o in a box `size` deep along z
// (x across the window, y up): how bright the point the eye meets is. A
// shop has light strips in its ceiling and shelves of goods on its walls;
// a flat has one lamp and a dim back.
float room(vec3 o_, vec3 dl, vec3 size, bool shelves, uint salt) {
  dl = vec3(abs(dl.x) < 1e-4 ? 1e-4 : dl.x, abs(dl.y) < 1e-4 ? 1e-4 : dl.y, max(dl.z, 1e-3));
  vec3 t = (step(0.0, dl) * size - o_) / dl;
  float tm = min(min(t.x, t.y), t.z);
  vec3 q = o_ + dl * tm;
  vec3 rel = clamp(q / size, 0.0, 1.0);
  // The light falls from the ceiling and from the front.
  float fall = (0.35 + 0.65 * rel.y) * (1.0 - 0.45 * rel.z);
  float b;
  if (tm == t.y && dl.y > 0.0) {
    // The ceiling: dim, with the light strips across it.
    b = 0.1;
    if (shelves) {
      float strip = abs(fract(q.z / 1.25 + 0.5) - 0.5) * 1.25;
      b += 2.6 * smoothstep(0.05, 0.025, strip) * step(0.12, rel.x) * step(rel.x, 0.88);
    } else {
      b += 1.8 * smoothstep(0.22, 0.12, length(q.xz - size.xz * vec2(0.5, 0.4)));
    }
    return b;
  }
  if (tm == t.y) {
    // The floor: dark, a pale band where the strips' light lands.
    b = 0.06 + (shelves ? 0.1 * smoothstep(0.35, 0.0, abs(fract(q.z / 1.25 + 0.5) - 0.5)) : 0.0);
    return b * (1.0 - 0.4 * rel.z);
  }
  // A wall: the back one (z) or a side one (x); u runs along it.
  float u = tm == t.z ? q.x : q.z;
  b = 0.32 * fall;
  if (shelves && q.y > 0.25 && q.y < 2.3) {
    // Shelves every 0.42 m, goods on them in boxes of their own shade.
    float sy = q.y / 0.42;
    float board = smoothstep(0.08, 0.03, fract(sy));
    vec2 cell = floor(vec2(u / 0.22, sy));
    float good = hash3(int(cell.x), int(cell.y), int(tm == t.z), salt);
    float gap = step(0.1, fract(u / 0.22)) * step(fract(sy), 0.78) * step(0.18, good);
    b = mix(b * 0.35, b * (0.6 + 1.1 * good), gap);
    b = mix(b, 0.06, board);
  } else if (!shelves) {
    // A picture or a cupboard on the wall, darker than the wall.
    float k = hash3(int(floor(u / 1.1)), 0, int(tm == t.z), salt);
    b *= 1.0 - 0.6 * step(0.5, k) * step(0.6, q.y) * step(q.y, 0.6 + 1.2 * k);
  }
  return b;
}

// A 5×7 glyph of dots (the neon's letters), at f in 0..1 over the glyph.
float glyph(vec2 f, int k, int g, uint salt) {
  vec2 cell = f * vec2(5.0, 7.0);
  vec2 b = floor(cell);
  if (b.x < 0.0 || b.y < 0.0 || b.x > 4.0 || b.y > 6.0) return 0.0;
  float on = step(0.52, hash3(k, g, int(b.x + 5.0 * b.y), salt));
  vec2 q = abs(fract(cell) - 0.5);
  return on * smoothstep(0.5, 0.3, max(q.x, q.y));
}

// Neon stutter while the street is restless.
float stutter(int id) {
  int epoch = pm(int(floor(TIME * 9.0)), int(LOOP * 9.0));
  return 1.0 - step(hash2(id, epoch, 21u), 0.3 * CITY.x);
}

Mat building(vec3 p, vec3 n, vec3 rd, float t, Hit h) {
  float pxm = pixelAt(t);
  int row = h.row;
  int k = row == 2 ? pm(h.c, 4) : pm(h.c, 10);
  uint sd = (h.s > 0.0 ? 1u : 2u) + uint(row) * 8u;
  float lw = max(0.012, 1.1 * pxm);
  float lineLight = row == 0 ? 0.16 : (row == 1 ? 0.11 : 0.085);
  Mat m = matte(0.05, n, 0.25, vec2(0.02, 0.015));
  m.rings = 0.45;
  if (n.y > 0.5) {
    vec2 e = min(p.xz - h.lo.xz, h.hi.xz - p.xz);
    m.L.x += lineLight * edgeLine(min(e.x, e.y), lw);
    if (row == 2) {
      // The tower's beacon, slow and warm.
      float d = length(p.xz - 0.5 * (h.lo.xz + h.hi.xz));
      float blink = step(fract(TIME / 2.0 + hash1(k, 120u + sd)), 0.18);
      m.L.y += 6.0 * blink * smoothstep(0.7 + pxm, 0.4, d);
    }
    return m;
  }
  bool front = abs(n.x) > 0.5;
  vec3 ua = front ? vec3(0.0, 0.0, 1.0) : vec3(1.0, 0.0, 0.0);
  float u = dot(p - h.lo, ua);
  float W = dot(h.hi - h.lo, ua);
  float v = p.y;
  float top = h.hi.y;
  // The model's edges: the lot's corners, its roof line and its foot.
  float e = min(min(u, W - u), min(v, top - v));
  m.L.x += lineLight * edgeLine(e, lw);
  vec3 dl = vec3(dot(rd, ua), rd.y, dot(rd, -n));
  bool street = row == 0 && front;
  float base = street ? 4.2 : 1.0;
  bool shopFloor = street && v < base;
  // The room the eye meets behind the glass, the shop's or a flat's: asked
  // for below and looked into once.
  bool seeRoom = false;
  vec3 at = vec3(0.0), size = vec3(1.0);
  uint salt = 0u;
  bool glass = false;
  float F = 0.0;
  float fh = row == 2 ? 3.6 : 3.3;
  float floorIx = 0.0, bay = 0.0;
  bool inside = false;
  int wk = 0;
  float detail = 0.0;
  if (shopFloor) {
    // The shop: lit glass with the room behind it, its sign above.
    float canopy = edgeLine(abs(v - 3.5), lw);
    m.L.x += 0.22 * canopy;
    glass = v > 0.35 && v < 3.4 && u > 0.5 && u < W - 0.5;
    // The window's frame: mullions every 1.8 m, a transom at 2.7 m.
    float mull = abs(fract((u - 0.5) / 1.8 + 0.5) - 0.5) * 1.8;
    float frame_ = min(mull, abs(v - 2.7));
    if (glass && frame_ < 0.035) {
      // Dark metal with a thin wet edge.
      m.L.x += 0.05 * edgeLine(0.035 - frame_, lw) + 0.003;
      m.gleam = 0.25;
      m.gn = n;
      m.a2 = 0.04;
      glass = false;
    } else if (glass) {
      // Glass: the steeper the look, the more of the room; along the street
      // it turns into a mirror of the lamps and the wet street.
      float cosv = clamp(dot(n, -rd), 0.0, 1.0);
      F = 0.04 + 0.96 * pow(1.0 - cosv, 5.0);
      seeRoom = true;
      at = vec3(u - 0.5, v - 0.35, 0.0);
      size = vec3(W - 1.0, 3.05, 5.0);
      salt = 200u + uint(k) + sd * 16u;
      m.gleam = 0.6 * F;
      m.gn = n;
      m.a2 = 0.0025;
      m.L += F * vec2(0.012, 0.01);
      m.L.x += 0.004;
    }
    if (v > 3.62 && v < 4.12 && u > 1.0 && u < W - 1.0 && hash1(k, 130u + sd) > 0.35) {
      float gw = 0.42;
      float gu = (u - 1.0) / gw;
      float f = glyph(vec2(fract(gu) * 1.25 - 0.1, (v - 3.62) / 0.5), k, int(gu), 140u + sd);
      float far = smoothstep(0.03, 0.012, pxm);
      f = mix(0.18, f, far);
      float i = 1.6 * f * stutter(k * 2 + int(sd));
      if (hash1(k, 150u + sd) > 0.5) m.L.y += i; else m.L.x += i;
    }
  } else {
    // The floors above: windows, some lit, the room behind each.
    float fy = (v - base) / fh;
    floorIx = floor(fy);
    float bw0 = row == 0 ? 2.04 : (row == 1 ? 1.8 : 1.5);
    float nb = max(1.0, floor(W / bw0));
    float bw = W / nb;
    float bx = u / bw;
    bay = floor(bx);
    vec2 f = vec2(fract(bx), fract(fy));
    m.L.x += 0.03 * edgeLine(abs(fract(fy + 0.5) - 0.5) * fh, lw);
    if (v > top - 0.9) return m;
    inside = f.x > 0.16 && f.x < 0.84 && f.y > 0.2 && f.y < 0.82;
    int face = front ? 0 : 1;
    wk = k * 7 + face + 3 * int(sd);
    seeRoom = inside;
    at = vec3((f.x - 0.16) * bw, (f.y - 0.2) * fh, 0.0);
    size = vec3(bw * 0.68, fh * 0.62, 3.5);
    salt = uint(wk) * 31u + uint(floorIx);
    // Far away a window is less than a few pixels: its average.
    detail = smoothstep(1.5, 4.0, bw / pxm);
  }
  float r = seeRoom ? room(at, dl, size, glass, salt) : 0.0;
  if (shopFloor) {
    if (glass) {
      vec3 sh = shop(h.s, h.c);
      float i = SHOP_LIGHT * sh.x * r * (1.0 - F);
      // Rain runs down the glass in streaks.
      float run = noiseP(vec2(u * 9.0, v * 0.8 + TIME * 0.6 * hash1(int(u * 9.0), 7u)), 4096);
      float wet = 0.85 + 0.3 * smoothstep(0.55, 0.9, run);
      if (sh.y > 0.5) m.L.y += i * wet; else m.L.x += i * wet;
    }
    return m;
  }
  float litShare = 0.16 + 0.38 * hash1(k, 100u + sd);
  int slow = pm(int(floor(TIME / 16.0)), 4);
  float lit_ = step(hash3(wk, int(floorIx), int(bay), 7u), litShare);
  if (hash3(wk, int(floorIx), int(bay), 8u) < 0.1) lit_ = step(0.5, hash3(wk, int(floorIx), int(bay) + 97 * slow, 9u));
  // The restless street: pairs of windows open like eyes.
  int epoch = pm(int(floor(TIME)), int(LOOP));
  float tick = fract(TIME);
  float eyes = CITY.x * step(hash3(wk + 31 * int(floorIx), int(bay / 2.0), epoch, 10u), 0.05)
             * smoothstep(0.0, 0.12, tick) * smoothstep(1.0, 0.75, tick);
  float warm = step(0.35, hash3(wk, int(floorIx), int(bay), 11u));
  float bright = 0.22 + 0.4 * hash3(wk, int(floorIx), int(bay), 12u);
  float mean = 0.24 * (litShare * 0.55 + 0.1 * eyes);
  float win = mix(mean, float(inside) * (lit_ * bright * r + eyes * 1.3 * r), detail);
  float glassDark = mix(0.0, float(inside) * 0.006, detail);
  float shareWarm = mix(0.65, warm, detail);
  m.L.y += win * shareWarm * (1.0 - eyes * detail);
  m.L.x += win * (1.0 - shareWarm * (1.0 - eyes * detail)) + glassDark;
  return m;
}

// The ground's paint and stone at p: its albedo, how wet it is (out), the
// normal its water shows (out), and the lines of light it carries.
Mat ground(vec3 p, vec3 rd, float t, bool full, out float mirror, out vec3 nw) {
  float pxm = pixelAt(t);
  float ax = abs(p.x);
  int c = cellOf(p.z);
  bool cross_ = crossing(c);
  float z0 = float(c) * CELL - 0.5 * CELL;
  float u = p.z - z0;
  float aa = 0.6 * pxm + 0.004;
  float albedo;
  float paint = 0.0;
  float joint = 0.0;
  if (ax < ROAD) {
    albedo = 0.04 + 0.025 * noiseP(p.xz * (245.0 / REPEAT), 245);
    float dash = step(fract(p.z * 9.0 / REPEAT), 0.36);
    paint += smoothstep(0.07 + aa, 0.07 - aa, ax) * dash;
    paint += smoothstep(0.06 + aa, 0.06 - aa, abs(ax - (ROAD - 0.3)));
    if (cross_ && u > 0.3 && u < 3.1 && ax < ROAD - 0.45) {
      float bar = abs(fract(p.x / 0.9 + 0.25) - 0.5);
      paint += smoothstep(0.25 - aa, 0.25 + aa, bar);
    }
    // The manhole the steam rises from.
    float k = floor((p.z - 27.0) / BLOCK + 0.5);
    float dm = length(p.xz - vec2(1.3, k * BLOCK + 27.0));
    if (dm < 0.4) {
      albedo = 0.07;
      joint = smoothstep(0.02, 0.0, abs(dm - 0.36)) + 0.5 * step(0.5, fract(p.z * 8.0)) * step(dm, 0.3);
    }
  } else if (cross_ && ax < FACADE) {
    // The raised crossing over the side street: zebra across the walk.
    albedo = 0.07;
    if (u > 0.5 && u < CELL - 0.5 && ax > ROAD + 0.35 && ax < FACADE - 0.35) {
      float bar = abs(fract(u / 0.9) - 0.5);
      paint += smoothstep(0.25 - aa, 0.25 + aa, bar);
    }
  } else if (cross_) {
    // The side street.
    albedo = 0.045;
    paint += smoothstep(0.07 + aa, 0.07 - aa, abs(u - 0.5 * CELL)) * step(fract(p.x / 4.0), 0.5);
  } else if (ax < ROAD + 0.25) {
    albedo = 0.15;
    joint = smoothstep(aa, 0.0, abs(fract(p.z / 1.2 + 0.5) - 0.5) * 1.2);
  } else {
    // Pavement slabs, each a little different, the joints holding water.
    vec2 g = p.xz / 0.6;
    vec2 q = abs(fract(g) - 0.5) * 0.6;
    joint = smoothstep(0.012 + aa, 0.0, 0.3 - max(q.x, q.y));
    albedo = 0.085 + 0.045 * hash2(int(floor(g.x)), pm(int(floor(g.y)), 136), 3u);
  }
  albedo = mix(albedo, 0.32, clamp(paint, 0.0, 1.0));
  albedo = mix(albedo, 0.03, joint);
  float wet = puddle(p.xz);
  mirror = mix(0.42 + 0.25 * joint, 1.0, wet);
  albedo *= mix(0.75, 0.35, wet);

  // The water's surface: a slow wobble, the rain's rings, the steps' rings.
  vec2 dn = vec2(0.0);
  for (int i = 0 + ZERO; i < 2; i++) {
    float nz = noiseP(p.xz * (980.0 / REPEAT) + 7.3 * float(i), 980);
    if (i == 0) dn.x = nz; else dn.y = nz;
  }
  dn = (dn - 0.5) * mix(0.08, 0.006, wet);
  vec2 lightRings = vec2(0.0);
  if (full) {
    for (int layer = 0 + ZERO; layer < 2; layer++) {
      vec2 g = p.xz / (REPEAT / 160.0) + float(layer) * 0.5;
      ivec2 ci = ivec2(floor(g));
      int cz = pm(ci.y, 160);
      vec2 ctr = vec2(ci) + 0.3 + 0.4 * vec2(hash2(ci.x, cz, 40u + uint(layer)), hash2(ci.x, cz, 42u + uint(layer)));
      float ph = fract(TIME * 71.0 / LOOP + hash2(ci.x, cz, 44u + uint(layer)));
      vec2 rel = (g - ctr) * (REPEAT / 160.0);
      float d = length(rel);
      float r = ph * 0.16;
      float wave = sin((d - r) * 70.0) * exp(-pow((d - r) / 0.022, 2.0)) * (1.0 - ph) * (1.0 - ph);
      dn += rel / max(d, 1e-4) * wave * 0.3 * (0.35 + 0.65 * wet);
    }
    for (int i = 0 + ZERO; i < STEP_MARKS; i++) {
      vec4 s = STEP(i);
      if (s.z > 2.4) continue;
      vec2 rel = p.xz - s.xy;
      float d = length(rel);
      float r = 0.1 + 0.55 * s.z;
      float fade = (1.0 - s.z / 2.4) * (1.0 - s.z / 2.4);
      float wave = sin((d - r) * 32.0) * exp(-pow((d - r) / 0.07, 2.0)) * fade;
      dn += rel / max(d, 1e-4) * wave * 0.32 * (0.3 + wet);
      // Each step rings in the wet stone: a line of light out from it.
      float ring = exp(-pow((d - r) / 0.022, 2.0)) * fade;
      float print = exp(-dot(rel / vec2(0.06, 0.13), rel / vec2(0.06, 0.13))) * exp(-s.z / 2.5);
      lightRings.x += CITY.z * (0.5 * ring * (0.35 + 0.65 * wet) + 0.22 * print);
    }
  }
  nw = normalize(vec3(dn.x, 1.0, dn.y));
  Mat m = matte(albedo, vec3(0.0, 1.0, 0.0), 0.0, shopSpill(p) + vec2(0.006, 0.005));
  m.shadowed = full;
  if (full) {
    m.gleam = 1.0 - 0.6 * wet;
    m.cars = m.gleam;
    m.gn = nw;
    m.a2 = mix(0.09, 0.012, wet);
    m.L = lightRings;
    m.rings = 0.45;
    // Where his feet stand the ground is in his shade.
    for (int i = 0 + ZERO; i < 2; i++) {
      vec2 rel = p.xz - STEP(i).xy;
      m.mul *= 1.0 - 0.45 * exp(-dot(rel, rel) / 0.03);
    }
  }
  return m;
}

Mat figureMat(vec3 p, vec3 rd) {
  float d;
  vec3 n = figureNormal(p, d);
  vec3 v = -rd;
  bool sk = skin(p, d);
  vec3 sh = shop(-1.0, cellOf(p.z));
  float fromShops = SHOP_LIGHT * 0.45 * sh.x * clamp(-n.x * 0.8 + 0.2, 0.0, 1.0);
  vec2 shops = sh.y > 0.5 ? vec2(0.0, fromShops) : vec2(fromShops, 0.0);
  Mat m = matte(sk ? 0.2 : 0.06, n, 0.3, shops + vec2(0.012, 0.01));
  float rim = pow(1.0 - max(dot(n, v), 0.0), 3.0) * FIG_HI.w;
  m.L = rim * vec2(0.2 * smoothstep(-0.3, 0.6, -n.x) + 0.05, 0.22 * smoothstep(-0.3, 0.6, n.x) + 0.04);
  // The wet coat's sheen.
  m.gleam = 0.35;
  m.gn = n;
  m.a2 = sk ? 0.25 : 0.12;
  m.rings = 0.5;
  return m;
}

vec2 signLight(vec3 p, float t, Hit h) {
  vec4 sg = h.info;
  float pxm = pixelAt(t);
  float u = (abs(p.x) - (FACADE - 1.1)) / 0.98;
  float v = (p.y - sg.y) / (sg.z - sg.y);
  float hgt = sg.z - sg.y;
  // The tube round its edge.
  vec2 e = vec2(min(u, 1.0 - u) * 0.98, min(v, 1.0 - v) * hgt);
  float tube = exp(-pow((min(e.x, e.y) - 0.05) / max(0.012, pxm), 2.0));
  // The letters, one above the other.
  float gh = 0.62;
  float gy = (p.y - sg.y - 0.12) / gh;
  float g = glyph(vec2((u - 0.18) / 0.64, fract(gy) * 1.15 - 0.08), pm(h.c, 10), int(floor(gy)), 160u + uint(h.s + 2.0));
  float far = smoothstep(0.04, 0.015, pxm);
  g = mix(0.16, g, far);
  float inside = step(0.1, e.x) * step(0.1, e.y);
  float i = (2.2 * tube + 1.8 * g * inside + 0.025) * stutter(pm(h.c, 10) * 2 + (h.s > 0.0 ? 1 : 0) + 40);
  return sg.w > 0.5 ? vec2(0.12 * i, i) : vec2(i, 0.08 * i);
}

vec2 sky(vec3 ro, vec3 rd);

// What the ray from ro met, other than a building or the ground, makes of
// the light.
Mat rest(Hit h, vec3 ro, vec3 rd, float pathT) {
  vec3 p = ro + rd * h.t;
  if (h.kind == SKY) return emits(sky(ro, rd));
  if (h.kind == FIGURE) return figureMat(p, rd);
  if (h.kind == SIGN) return emits(signLight(p, pathT, h));
  if (h.kind == KERB) return matte(0.12, h.n, 0.2, vec2(0.01));
  if (h.kind == POLE) {
    Mat m = matte(0.04, h.n, 0.3, vec2(0.02, 0.015));
    m.gleam = 0.3;
    m.gn = h.n;
    m.a2 = 0.08;
    return m;
  }
  if (h.kind == HEAD_LAMP) {
    float s = h.info.x;
    float on = h.n.y < -0.5 ? 0.5 * LAMP_LIGHT * lampFlicker(s, h.info.y) : 0.03;
    return emits(s > 0.0 ? vec2(on, 0.0) : vec2(0.0, on));
  }
  return emits(vec2(0.0));
}

// What the ray from ro met makes of the light. `full` is the eye's own look
// at the ground (its ripples, his shadow, the gleams); the mirror's look
// takes the plain ground. A ground hit also gives its mirror and water.
Mat material(Hit h, vec3 ro, vec3 rd, float pathT, bool full, out float mirror, out vec3 nw) {
  mirror = 0.0;
  nw = vec3(0.0, 1.0, 0.0);
  vec3 p = ro + rd * h.t;
  if (h.kind == GROUND) return ground(p, rd, pathT, full, mirror, nw);
  if (h.kind == BUILDING) return building(p, h.n, rd, pathT, h);
  return rest(h, ro, rd, pathT);
}

// ---- the sky and the air ----

vec2 sky(vec3 ro, vec3 rd) {
  float e = max(rd.y, 0.0);
  vec2 L = vec2(0.005 + 0.016 * exp(-e * 5.0), 0.004 + 0.026 * exp(-e * 4.0));
  if (rd.y > 0.01) {
    float t = (CLOUD - ro.y) / rd.y;
    vec3 p = ro + rd * t;
    float d = fbmP(p.xz * (2.0 / REPEAT) + vec2(0.0, 0.0), 2);
    float cl = smoothstep(0.38, 0.82, d);
    L += cl * vec2(0.02, 0.034) * exp(-t * 0.004);
  }
  return L;
}

// A small light's glare through the lens: constant in angle.
float glare(vec3 ro, vec3 rd, vec3 c, float T) {
  vec3 oc = c - ro;
  float b = dot(oc, rd);
  if (b <= 0.0 || b > T + 0.2) return 0.0;
  float a2 = max(dot(oc, oc) - b * b, 0.0) / (b * b);
  return (2e-5 / (a2 + 2e-5) + 0.12 * 4e-4 / (a2 + 4e-4)) * exp(-HAZE * b);
}

vec2 air(vec3 ro, vec3 rd, float T, float jitter) {
  vec2 L = vec2(0.0);
  // The lamps' light poured through the rain, and their glare.
  for (int side = 0 + ZERO; side < 2; side++) {
    float s = side == 0 ? 1.0 : -1.0;
    float k0 = floor(ro.z / LAMP_GAP - lampOffset(s));
    for (int j = -3 + ZERO; j <= 10; j++) {
      float k = k0 + float(j);
      vec3 c = lampHead(s, k);
      vec3 oc = c - ro;
      float b = dot(oc, rd);
      float h2 = dot(oc, oc) - b * b;
      if (h2 > 64.0 || b < -8.0) continue;
      float t0 = max(0.0, b - 7.0), t1 = min(T, b + 7.0);
      float acc = 0.0;
      if (t1 > t0) {
        float dt = (t1 - t0) / 6.0;
        for (int i = 0 + ZERO; i < 6; i++) {
          float tt = t0 + (float(i) + jitter) * dt;
          vec3 d = ro + rd * tt - c;
          acc += lampCone(d) / (dot(d, d) + 0.6);
        }
        acc *= dt;
      }
      float below = smoothstep(0.35, -0.15, -oc.y / max(length(oc), 1e-3));
      float i = LAMP_LIGHT * lampFlicker(s, k) * (AIR * acc * exp(-HAZE * max(b, 0.0))
                + 0.5 * below * glare(ro, rd, c - vec3(0.0, 0.06, 0.0), T));
      if (side == 0) L.x += i; else L.y += i;
    }
  }
  // The cars: their lamps drawn out by their speed.
  float nc = floor(ro.z / REPEAT);
  for (int lane = 0 + ZERO; lane < 2; lane++) {
    int count = int(lane == 0 ? CARS_0_COUNT : CARS_1_COUNT);
    float x = lane == 0 ? -CAR_LANE : CAR_LANE;
    float dz = lane == 0 ? 1.0 : -1.0;
    for (int m = -1 + ZERO; m <= 2; m++) {
      for (int j = 0 + ZERO; j < 3; j++) {
        if (j >= count) break;
        float z = carZ(lane, j, nc + float(m));
        vec3 cc = vec3(x, 0.65, z);
        vec3 oc = cc - ro;
        float b = dot(oc, rd);
        if (b < 0.0 || b > T + 3.0) continue;
        if (dot(oc, oc) - b * b > 0.02 * b * b + 4.0) continue;
        for (int side = 0 + ZERO; side < 2; side++) {
          vec3 a = cc + vec3(side == 0 ? -0.72 : 0.72, 0.0, 0.0);
          vec3 e = a - vec3(0.0, 0.0, dz * 2.8);
          // Closest points of the ray and the trail.
          vec3 sd = e - a;
          vec3 w0 = ro - a;
          float bb = dot(rd, sd), cc2 = dot(sd, sd), dd = dot(rd, w0), ee = dot(sd, w0);
          float den = cc2 - bb * bb;
          float sc = clamp(den > 1e-6 ? (ee - bb * dd) / den : 0.0, 0.0, 1.0);
          vec3 q = a + sd * sc;
          float tq = dot(q - ro, rd);
          if (tq <= 0.0 || tq > T) continue;
          float a2 = max(dot(q - ro, q - ro) - tq * tq, 0.0) / (tq * tq);
          float head = 1.0 - 0.75 * sc;
          float g = (6e-6 / (a2 + 6e-6) + 0.1 * 1.5e-4 / (a2 + 1.5e-4)) * head * exp(-HAZE * tq);
          if (lane == 0) L.y += CAR_LIGHT * g; else L.x += 1.5 * CAR_LIGHT * g;
        }
      }
    }
  }
  // The crossing lights: the walkers' at the corners, the cars' over the road.
  int c0 = cellOf(ro.z);
  int first = c0 - pm(c0 - CROSS, 5) - 5;
  for (int m = 0 + ZERO; m < 4; m++) {
    int c = first + 5 * m;
    float z0 = float(c) * CELL - 0.5 * CELL, z1 = z0 + CELL;
    for (int corner = 0 + ZERO; corner < 4; corner++) {
      float sx = corner < 2 ? 1.0 : -1.0;
      float z = (corner % 2 == 0) ? z0 - 0.3 : z1 + 0.3;
      vec3 stop = vec3(sx * (ROAD + 0.3), 2.62, z);
      vec3 go = stop - vec3(0.0, 0.26, 0.0);
      L.y += 1.4 * CITY.y * glare(ro, rd, stop, T);
      L.x += 1.4 * (1.0 - CITY.y) * glare(ro, rd, go, T);
    }
    vec3 a = vec3(-1.6, 5.3, z0 - 0.8);
    vec3 b = vec3(1.6, 5.3, z1 + 0.8);
    L.y += 1.8 * (1.0 - CITY.y) * (glare(ro, rd, a, T) + glare(ro, rd, b, T));
    L.x += 1.8 * CITY.y * (glare(ro, rd, a - vec3(0.0, 0.3, 0.0), T) + glare(ro, rd, b - vec3(0.0, 0.3, 0.0), T));
  }
  // The steam over the manholes, lit by what is near.
  float kb = floor(ro.z / BLOCK);
  for (int m = -1 + ZERO; m <= 3; m++) {
    vec3 c = vec3(1.3, -CURB, (kb + float(m)) * BLOCK + 27.0);
    vec2 oc = ro.xz - c.xz;
    float a = dot(rd.xz, rd.xz), b = dot(oc, rd.xz), cc = dot(oc, oc) - 2.4 * 2.4;
    float disc = b * b - a * cc;
    if (disc <= 0.0 || a < 1e-8) continue;
    float sq = sqrt(disc);
    float t0 = max((-b - sq) / a, 0.0), t1 = min((-b + sq) / a, T);
    if (t1 <= t0) continue;
    float dt = (t1 - t0) / 7.0;
    // Seen from above the eye looks down the whole lit column: a crane
    // over it sees a thin veil, not a blot of light.
    float down = mix(1.0, 0.15, smoothstep(0.35, 0.85, -rd.y));
    float ph = fract(TIME / 4.0);
    float w1 = 1.0 - abs(2.0 * ph - 1.0);
    for (int i = 0 + ZERO; i < 7; i++) {
      float tq = t0 + (float(i) + jitter) * dt;
      vec3 q = ro + rd * tq;
      float y = q.y - c.y;
      if (y < 0.0 || y > 7.0) continue;
      float r = length(q.xz - c.xz);
      float w = 0.3 + 0.2 * y;
      vec3 sp = q * 1.4;
      // Two drifting noises crossfaded (one loop: one noise3 to build).
      float nf = 0.0;
      for (int l = 0 + ZERO; l < 2; l++) {
        float shift = l == 0 ? fract(ph + 0.5) : ph;
        float nl = noise3(sp - vec3(0.0, shift * 5.0, 0.0) + (l == 0 ? 19.7 : 0.0));
        nf += nl * (l == 0 ? 1.0 - w1 : w1);
      }
      float dens = exp(-(r / w) * (r / w)) * smoothstep(7.0, 2.0, y) * smoothstep(0.0, 0.3, y)
                 * smoothstep(0.3, 0.75, nf + 0.15)
                 // A crane passing over it does not fly through the cloud.
                 * smoothstep(3.0, 9.0, tq) * down;
      vec2 lit = lampsAt(q, vec3(0.0), 0.0) + shopSpill(q) + vec2(0.02, 0.015);
      // Right under a lamp head the steam would burn white: it saturates.
      lit /= 1.0 + 0.2 * lit;
      L += lit * dens * dt * 0.5;
    }
  }
  // His breath in the cold air.
  for (int i = 0 + ZERO; i < PUFFS; i++) {
    vec4 pf = PUFF(i);
    if (pf.w < 0.0) continue;
    float age = pf.w / PUFF_LIFE;
    float r = 0.07 + 0.24 * age;
    vec3 oc = ro - pf.xyz;
    float b = dot(oc, rd);
    float disc = b * b - (dot(oc, oc) - r * r);
    if (disc <= 0.0) continue;
    float sq = sqrt(disc);
    float t0 = max(-b - sq, 0.0), t1 = min(-b + sq, T);
    if (t1 <= t0) continue;
    float dens = 0.0;
    for (int k = 0 + ZERO; k < 3; k++) {
      vec3 q = ro + rd * mix(t0, t1, (float(k) + 0.5) / 3.0);
      float fall = 1.0 - length(q - pf.xyz) / r;
      dens += max(fall, 0.0) * smoothstep(0.25, 0.75, noise3(q * 16.0 + vec3(0.0, -pf.w * 0.6, 0.0) + float(i) * 7.1));
    }
    float fade = (1.0 - age) * (1.0 - age) * smoothstep(0.0, 0.25, pf.w) * MOUTH.w;
    // Lit by the lamps and the shop, brightest against the light.
    vec2 lit = lampsAt(pf.xyz, vec3(0.0), 0.0) + shopSpill(pf.xyz) * 2.5 + vec2(0.06, 0.045);
    L += lit * dens / 3.0 * (t1 - t0) * fade * 6.0;
  }
  // The voice's shells and the echo's, thin as soap.
  for (int i = 0 + ZERO; i < 4; i++) {
    vec3 c;
    vec4 s = shell(i, c);
    if (s.x <= 0.0 || s.y <= 0.0) continue;
    vec3 oc = ro - c;
    float b = dot(oc, rd);
    float disc = b * b - (dot(oc, oc) - s.x * s.x);
    if (disc <= 0.0) continue;
    float sq = sqrt(disc);
    for (int k = 0 + ZERO; k < 2; k++) {
      float t = k == 0 ? -b - sq : -b + sq;
      if (t <= 0.05 || t > T) continue;
      vec3 nrm = (ro + rd * t - c) / s.x;
      float through = 0.028 / max(abs(dot(rd, nrm)), 0.1);
      float grain = 0.75 + 0.25 * noise3(nrm * 9.0 + float(i));
      L.x += s.y * through * grain * exp(-HAZE * t);
    }
  }
  return L;
}

// ---- the passes ----

vec3 eyeRay() {
  vec2 ndc = gl_FragCoord.xy / u_res.xy * 2.0 - 1.0;
  return normalize(FWD.xyz + RIGHT.xyz * (ndc.x / VIEW.x) + UP.xyz * (ndc.y / VIEW.y));
}
float frameJitter() {
  return fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
}
// How much of a hit's light the haze leaves on the way to the eye.
float hazeLeft(Hit h) {
  return exp(-HAZE * (h.kind == SKY ? 140.0 : h.t));
}
// The world's frame from the light and the eye's own hit: its depth and the
// lens's blur.
vec4 worldPixel(vec2 L, Hit first) {
  float z = (first.kind == SKY ? 1e4 : first.t) * dot(eyeRay(), FWD.xyz);
  float blur = min(blurAt(z), BLUR_MAX) / BLUR_MAX;
  return vec4(max(L, 0.0) * u_res.z, z / (z + 8.0), blur);
}
// A hit from its record (t, kind | row << 3 | far side << 5, its lot's cell
// or its lamp's index, ...) and its normal. A building's box and a sign's
// plane are not in it: the pass that lights them finds them again.
Hit fromRecord(vec4 a, vec3 n) {
  Hit h = noHit();
  int code = int(a.y + 0.5);
  h.t = a.x;
  h.kind = code & 7;
  h.row = (code >> 3) & 3;
  h.s = (code & 32) != 0 ? 1.0 : -1.0;
  h.c = int(floor(a.z + 0.5));
  h.n = n;
  h.info = vec4(h.s, a.z, 0.0, 0.0);
  return h;
}

#if defined(PASS_HITS)
vec4 recordOf(Hit h, float extra) {
  bool lamp = h.kind == POLE || h.kind == HEAD_LAMP;
  float s = lamp ? h.info.x : h.s;
  int code = h.kind + 8 * h.row + (s > 0.0 ? 32 : 0);
  return vec4(h.t, float(code), lamp ? h.info.y : float(h.c), extra);
}

// The eye's ray and, where it meets the ground, the wet street's mirror ray
// (one loop, so the compiler builds trace() once). Records: the eye's hit
// with how much the mirror carries; its normal, or on the ground the mirror
// ray's way; the mirror's hit; its normal.
void main() {
  vec3 o_ = EYE.xyz, d = eyeRay();
  Hit first = noHit(), second = noHit();
  float w = 0.0;
  vec3 r = vec3(0.0, 1.0, 0.0);
  for (int b = 0 + ZERO; b < 2; b++) {
    Hit h = trace(o_, d, true);
    if (b == 0) first = h; else second = h;
    if (b > 0 || h.kind != GROUND) break;
    vec3 p = o_ + d * h.t;
    float mirror;
    vec3 nw;
    ground(p, d, h.t, true, mirror, nw);
    r = reflect(d, nw);
    r.y = max(r.y, 0.02);
    r = normalize(r);
    float F = 0.02 + 0.98 * pow(1.0 - max(dot(-d, nw), 0.0), 5.0);
    w = exp(-HAZE * h.t) * max(F, 0.05) * mirror;
    o_ = p + vec3(0.0, 0.003, 0.0);
    d = r;
  }
  o0 = recordOf(first, w);
  o1 = vec4(first.kind == GROUND ? r : first.n, 0.0);
  o2 = recordOf(second, 0.0);
  o3 = vec4(second.n, 0.0);
}

#elif defined(PASS_ALL)
void main() {
  vec3 ro = EYE.xyz;
  vec3 rd = eyeRay();
  // The eye's look, then where it meets the wet ground the street's mirror:
  // one loop, so the compiler builds trace() and the surfaces once.
  vec3 o_ = ro, d = rd;
  vec2 L = vec2(0.0);
  float w = 1.0, pathT = 0.0;
  Hit first = noHit();
  for (int b = 0 + ZERO; b < 2; b++) {
    Hit h = trace(o_, d, true);
    if (b == 0) first = h;
    pathT += h.t;
    vec3 p = o_ + d * h.t;
    float mirror;
    vec3 nw;
    Mat m = material(h, o_, d, pathT, b == 0, mirror, nw);
    float fr = hazeLeft(h);
    L += w * (lightOf(m, p, -d) * fr + HAZE_LIGHT * (1.0 - fr));
    if (b > 0 || h.kind != GROUND) break;
    vec3 r = reflect(d, nw);
    r.y = max(r.y, 0.02);
    r = normalize(r);
    float F = 0.02 + 0.98 * pow(1.0 - max(dot(-d, nw), 0.0), 5.0);
    w = fr * max(F, 0.05) * mirror;
    o_ = p + vec3(0.0, 0.003, 0.0);
    d = r;
  }
  L += air(ro, rd, first.t, frameJitter());
  o = worldPixel(L, first);
}

#else
// The eye's ray (b = 0) or the mirror's (b = 1) from the records: where it
// starts, its way, how much of the pixel it carries, the path's length and
// what it met. False when there is no mirror ray.
bool bounce(int b, out vec3 o_, out vec3 d, out float w, out float pathT, out Hit h) {
  ivec2 px = ivec2(gl_FragCoord.xy);
  vec4 a = texelFetch(u_h0, px, 0);
  vec4 n = texelFetch(u_h1, px, 0);
  vec3 rd = eyeRay();
  if (b == 0) {
    o_ = EYE.xyz;
    d = rd;
    w = 1.0;
    pathT = a.x;
    h = fromRecord(a, n.xyz);
    return true;
  }
  vec4 a1 = texelFetch(u_h2, px, 0);
  h = fromRecord(a1, texelFetch(u_h3, px, 0).xyz);
  o_ = EYE.xyz + rd * a.x + vec3(0.0, 0.003, 0.0);
  d = n.xyz;
  w = a.w;
  pathT = a.x + a1.x;
  return w > 0.0;
}

#if defined(PASS_AIR)
void main() {
  float T = texelFetch(u_h0, ivec2(gl_FragCoord.xy), 0).x;
  o = vec4(max(air(EYE.xyz, eyeRay(), T, frameJitter()), 0.0) * u_res.z, 0.0, 0.0);
}

#else
void main() {
  vec2 L = vec2(0.0);
  Hit first = noHit();
  for (int b = 0 + ZERO; b < 2; b++) {
    vec3 o_, d;
    float w, pathT;
    Hit h;
    if (!bounce(b, o_, d, w, pathT, h)) break;
    if (b == 0) first = h;
    vec3 p = o_ + d * h.t;
    float fr = hazeLeft(h);
#if defined(PASS_BUILDINGS)
    if (h.kind != BUILDING) continue;
    lot(h.row, h.s, h.c, h.lo, h.hi);
    L += w * lightOf(building(p, h.n, d, pathT, h), p, -d) * fr;
#elif defined(PASS_GROUND)
    if (h.kind != GROUND) continue;
    float mirror;
    vec3 nw;
    L += w * lightOf(ground(p, d, pathT, b == 0, mirror, nw), p, -d) * fr;
#else
    // The rest, and the haze over every hit.
    L += w * HAZE_LIGHT * (1.0 - fr);
    if (h.kind == BUILDING || h.kind == GROUND) continue;
    if (h.kind == SIGN) bladeSign(h.s, h.c, h.info);
    L += w * lightOf(rest(h, o_, d, pathT), p, -d) * fr;
#endif
  }
#if defined(PASS_REST)
  o = worldPixel(L, first);
#else
  o = vec4(max(L, 0.0) * u_res.z, 0.0, 0.0);
#endif
}
#endif
#endif
