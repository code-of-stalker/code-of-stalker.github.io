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

// Every figure's cones (lib.rs cones()): a uniform block, as they are more
// than the plain uniforms a phone gives a fragment shader.
layout(std140) uniform Cones {
  vec4 u_b[(FIGURES * CONES + OWN) * 3];
};
const float BLEND[CONES] = float[CONES](BLENDS);

#define SKY 0
#define GROUND 1
#define KERB 2
#define BUILDING 3
#define POLE 4
#define HEAD_LAMP 5
#define SIGN 6
#define FIGURE 7
#define CAR 8
// Page 08's underpass; its row says the part: 0 the floor, 1 a wall or a
// riser, 2 the ceiling, 3 the stone over the street or (c = 1) a rail.
#define UNDER 9

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

// ---- the figures: him, then the passers-by, CONES cones each blended
// into one body (body.rs) ----

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
// A cone cut square at both ends (Inigo Quilez's exact distance).
float cutCone(vec3 p, vec3 a, vec3 b, float ra, float rb) {
  float rba = rb - ra;
  float baba = dot(b - a, b - a);
  float papa = dot(p - a, p - a);
  float paba = dot(p - a, b - a) / baba;
  float x = sqrt(max(papa - paba * paba * baba, 0.0));
  float cax = max(0.0, x - (paba < 0.5 ? ra : rb));
  float cay = abs(paba - 0.5) - 0.5;
  float k = rba * rba + baba;
  float f = clamp((rba * (x - ra) + paba * baba) / k, 0.0, 1.0);
  float cbx = x - ra - f * rba;
  float cby = paba - f;
  float s = (cbx < 0.0 && cay < 0.0) ? -1.0 : 1.0;
  return s * sqrt(min(cax * cax + cay * cay * baba, cbx * cbx + cby * cby * baba));
}
// Cone c (of every figure's, in order) at p: squashed along its axis to |s.w| of its width, flat-ended
// (its edge rounded) where s.w is below zero.
float cone(int c, vec3 p) {
  vec4 a = u_b[3 * c];
  vec4 b = u_b[3 * c + 1];
  vec4 s = u_b[3 * c + 2];
  float keep = abs(s.w);
  vec3 m = 0.5 * (a.xyz + b.xyz);
  vec3 q = p + s.xyz * dot(p - m, s.xyz) * (1.0 / keep - 1.0);
  float d = s.w < 0.0 ? cutCone(q, a.xyz, b.xyz, a.w - CUT_ROUND, b.w - CUT_ROUND) - CUT_ROUND
                      : roundCone(q, a.xyz, b.xyz, a.w, b.w);
  return d * keep;
}
float smin(float a, float b, float k) {
  float h = max(k - abs(a - b), 0.0) / k;
  return min(a, b) - h * h * k * 0.25;
}
// His umbrella's canopy (body.rs CANOPY): a thin dome cut from a sphere,
// its crown at BROLLY_TOP, its rim round BROLLY; between the ribs the
// cloth sags a little.
float brollyCanopy(vec3 p) {
  vec3 axis, e1, e2;
  brollyAxes(axis, e1, e2);
  float r = BROLLY.w;
  float R = brollySphere();
  vec3 q = p - (BROLLY_TOP.xyz - axis * R);
  float y = dot(q, axis);
  vec3 across = q - axis * y;
  float x = length(across);
  float phi = atan(dot(across, e2), dot(across, e1));
  float sag = 1.0 - 0.03 * (0.5 - 0.5 * cos(RIBS * phi)) * smoothstep(0.1, r, x);
  vec2 q2 = vec2(x, y) / sag;
  vec2 rim = vec2(r, R - length(BROLLY_TOP.xyz - BROLLY.xyz));
  float d = rim.y * q2.x > rim.x * q2.y ? length(q2 - rim) : abs(length(q2) - R);
  return d * sag - CANOPY_CLOTH;
}
// His phone (page 08) at p, in its own frame: across, up its length, out of
// its screen.
vec3 phoneLocal(vec3 p) {
  vec3 r = p - PHONE_C.xyz;
  return vec3(dot(r, PHONE_X.xyz), dot(r, PHONE_Y.xyz), dot(r, cross(PHONE_X.xyz, PHONE_Y.xyz)));
}
// The phone: a slab with rounded corners and rounded edges.
float phoneBox(vec3 p) {
  float k = PHONE_C.w;
  vec3 l = phoneLocal(p);
  float e = PHONE_EDGE * k;
  vec2 w = vec2(roundRect(l.xy, vec2(PHONE_X.w, PHONE_Y.w), PHONE_CORNER * k) + e, abs(l.z) - PHONE_T * k + e);
  return min(max(w.x, w.y), 0.0) + length(max(w, 0.0)) - e;
}
// His own parts: the thumbs, the umbrella's handle and shaft, its canopy;
// on page 08 his thumb and fingers round his phone, and the phone.
float ownParts(vec3 p, float d) {
  for (int c = 0 + ZERO; c < OWN - 1; c++) d = smin(d, cone(CONE_OWN + c, p), 0.006);
  if (BROLLY.w > 0.0) d = min(d, brollyCanopy(p));
  if (PHONE_C.w > 0.0) d = min(d, phoneBox(p));
  return d;
}
// Figure `who` at p: 0 him (his head left out while the camera is in
// it), then the passers-by as they stand in their first copy.
float figure(int who, vec3 p) {
  int o = who * CONES;
  float d = cone(o, p);
  bool noHead = who == 0 && FIG_LO.w > 0.5;
  for (int c = 1 + ZERO; c < CONES; c++) {
    if (noHead && c >= CONE_NECK && c <= CONE_COLLAR) continue;
    d = smin(d, cone(o + c, p), BLEND[c]);
  }
  if (who == 0 && BROLLY_TOP.w > 0.5) d = ownParts(p, d);
  return d;
}
// The normal from four samples round p, taken in a loop so the compiler
// builds figure() once here; their mean is the distance at p.
vec3 figureNormal(int who, vec3 p, out float d) {
  const float e = 0.0015;
  vec3 n = vec3(0.0);
  d = 0.0;
  for (int i = 0 + ZERO; i < 4; i++) {
    vec3 k = vec3(float(((i + 3) >> 1) & 1), float((i >> 1) & 1), float(i & 1)) * 2.0 - 1.0;
    float f = figure(who, p + k * e);
    n += k * f;
    d += 0.25 * f;
  }
  return normalize(n);
}
// Whether p is skin: the head and the hands.
bool skin(int who, vec3 p, float d) {
  int o = who * CONES;
  float near = d + 0.012;
  bool thumbs = who == 0 && BROLLY_TOP.w > 0.5 && min(cone(CONE_OWN, p), cone(CONE_OWN + 1, p)) < near;
  // Page 08: the fingers round his phone's edge.
  thumbs = thumbs || (who == 0 && PHONE_C.w > 0.0 && min(cone(CONE_OWN + 2, p), cone(CONE_OWN + 3, p)) < near);
  return ((who > 0 || FIG_LO.w < 0.5) && cone(o + CONE_HEAD, p) < near) || cone(o + CONE_HAND_L, p) < near || cone(o + CONE_HAND_R, p) < near || thumbs;
}
// A figure's box.
void figureBox(int who, out vec3 lo, out vec3 hi) {
  if (who == 0) {
    lo = FIG_LO.xyz;
    hi = FIG_HI.xyz;
  } else {
    lo = PASS_LO(who - 1).xyz;
    hi = PASS_HI(who - 1).xyz;
  }
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

// ---- the cars ----

float roundBox(vec3 p, vec3 b, float r) {
  vec3 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0) - r;
}
// A saloon in its own frame: on the road at y = 0, its middle at the
// origin, nose to +z. Body, glasshouse with raked screens, wheel arches,
// wheels.
float carShape(vec3 q) {
  float body = roundBox(q - vec3(0.0, 0.6, 0.0), vec3(0.88, 0.27, 2.25), 0.17);
  // The nose and the boot fall away a little.
  body = max(body, dot(q - vec3(0.0, 0.8, 2.25), vec3(0.0, 0.94, 0.34)));
  body = max(body, dot(q - vec3(0.0, 0.84, -2.25), vec3(0.0, 0.96, -0.28)));
  vec3 c = q - vec3(0.0, 1.06, -0.2);
  float cabin = roundBox(c, vec3(0.74 - 0.12 * smoothstep(-0.2, 0.3, c.y), 0.25, 1.2), 0.1);
  cabin = max(cabin, dot(c - vec3(0.0, 0.0, 0.62), vec3(0.0, 0.78, 0.63)));
  cabin = max(cabin, dot(c - vec3(0.0, 0.0, -0.78), vec3(0.0, 0.8, -0.6)));
  float d = smin(body, cabin, 0.12);
  vec3 w = vec3(abs(q.x), q.y, abs(q.z) - 1.38);
  float arch = max(length(w.yz - vec2(0.33, 0.0)) - 0.4, 0.62 - w.x);
  d = max(d, -arch);
  float wheel = max(length(w.yz - vec2(0.33, 0.0)) - 0.33, abs(w.x - 0.76) - 0.1);
  return min(d, wheel - 0.02);
}
// The car `id` of a lane (lane 2: page 07's car out of the side street):
// where it stands and which way it faces, (sin, cos) of its heading.
vec3 carAt(int lane, float id, out vec2 f) {
  if (lane == 2) return crossCar(f);
  float x, dir, gap, base;
  laneCars(lane, x, dir, gap, base);
  f = vec2(0.0, dir);
  return vec3(x, -CURB, base + gap * id);
}
vec3 carLocal(vec3 p, vec3 c, vec2 f) {
  vec3 q = p - c;
  return vec3(q.x * f.y - q.z * f.x, q.y, q.x * f.x + q.z * f.y);
}

// The nearest car the ray meets before h.t: each lane's cars over the
// stretch where the ray runs above that lane, nearest first, then page
// 07's car (lane 2), all in one loop so the compiler builds carShape once.
void traceCars(vec3 ro, vec3 rd, vec3 ird, inout Hit h) {
  const float TOP = 1.36;
  for (int lane = 0 + ZERO; lane < 3; lane++) {
    vec2 f;
    vec3 side = crossCar(f);
    vec2 half_ = vec2(0.92, 2.45);
    float x = 0.0, dir = 1.0, gap = 1.0, base = 0.0, lo = 0.0, hi = 0.0;
    bool up = true;
    int n = 0;
    if (lane < 2) {
      laneCars(lane, x, dir, gap, base);
      f = vec2(0.0, dir);
      float ta = (x - 0.95 - ro.x) * ird.x, tb = (x + 0.95 - ro.x) * ird.x;
      float t0 = max(min(ta, tb), 0.0), t1 = min(max(ta, tb), h.t);
      float ty = (TOP - CURB - ro.y) * ird.y;
      if (rd.y > 0.0) t1 = min(t1, ty); else t0 = max(t0, ty);
      if (t0 >= t1) continue;
      float za = ro.z + rd.z * t0, zb = ro.z + rd.z * t1;
      lo = floor((min(za, zb) - 2.45 - base) / gap);
      hi = ceil((max(za, zb) + 2.45 - base) / gap);
      up = rd.z >= 0.0;
      n = int(min(hi - lo, 9.0));
    } else {
      if (CROSSCAR.w <= 0.0) continue;
      half_ = abs(f.yx) * 0.92 + abs(f) * 2.45;
    }
    for (int k = 0 + ZERO; k <= n; k++) {
      float id = up ? lo + float(k) : hi - float(k);
      vec3 c = lane < 2 ? vec3(x, -CURB, base + gap * id) : side;
      vec2 b = slab(ro, ird, c - vec3(half_.x, 0.0, half_.y), c + vec3(half_.x, TOP, half_.y));
      if (b.x >= b.y || b.y <= 0.0 || b.x >= h.t) continue;
      float t = max(b.x, 0.0), end = min(b.y, h.t);
      bool hit = false;
      for (int i = 0 + ZERO; i < 48; i++) {
        float d = carShape(carLocal(ro + rd * t, c, f));
        if (d < 0.0015 + 0.0006 * t) { hit = true; break; }
        t += d;
        if (t > end) break;
      }
      if (hit) {
        h.t = t;
        h.kind = CAR;
        h.row = lane;
        h.c = int(id);
        break;
      }
    }
  }
}

// Him, and each passer's three copies nearest the ray's start (the street
// repeats them every REPEAT), in one loop so the compiler builds figure()
// once here. A hit keeps who in its row and the copy in its index.
void traceFigures(vec3 ro, vec3 rd, vec3 ird, inout Hit h) {
  for (int i = 0 + ZERO; i < 1 + 3 * PASSERS; i++) {
    int who = i == 0 ? 0 : 1 + (i - 1) / 3;
    vec3 lo, hi;
    figureBox(who, lo, hi);
    float k = 0.0;
    if (who > 0) k = floor((ro.z - 0.5 * (lo.z + hi.z)) / REPEAT + 0.5) + float(i - 1 - 3 * (who - 1) - 1);
    vec3 o_ = ro - vec3(0.0, 0.0, k * REPEAT);
    vec2 b = slab(o_, ird, lo - 0.03, hi + 0.03);
    float t = max(b.x, 0.12);
    float end = min(b.y, h.t);
    if (t >= end) continue;
    for (int s = 0 + ZERO; s < 72; s++) {
      float d = figure(who, o_ + rd * t);
      if (d < 0.0008 * t + 0.0004) {
        h.t = t;
        h.kind = FIGURE;
        h.row = who;
        h.c = int(k);
        break;
      }
      t += d * 0.9;
      if (t > end) break;
    }
  }
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

// ---- page 08's underpass (its plan is in common.glsl) ----

const float PARAPET = 0.9;
const float PARAPET_W = 0.14;
const float RAIL_R = 0.022;

void underHit(inout Hit h, float t, int part, vec3 n, int c) {
  h.t = t;
  h.kind = UNDER;
  h.row = part;
  h.n = n;
  h.c = c;
}
// Where the ray first meets the capsule from a to b, r thick (Inigo
// Quilez's), or -1.
float capsule(vec3 ro, vec3 rd, vec3 a, vec3 b, float r) {
  vec3 ba = b - a, oa = ro - a;
  float baba = dot(ba, ba), bard = dot(ba, rd), baoa = dot(ba, oa);
  float k2 = baba - bard * bard;
  float k1 = baba * dot(oa, rd) - baoa * bard;
  float k0 = baba * dot(oa, oa) - baoa * baoa - r * r * baba;
  float h = k1 * k1 - k2 * k0;
  if (h < 0.0) return -1.0;
  float t = (-k1 - sqrt(h)) / k2;
  float y = baoa + t * bard;
  if (y > 0.0 && y < baba) return t;
  vec3 oc = y <= 0.0 ? oa : ro - b;
  float b1 = dot(rd, oc);
  float c1 = dot(oc, oc) - r * r;
  h = b1 * b1 - c1;
  return h > 0.0 ? -b1 - sqrt(h) : -1.0;
}
// Stone box i (< 6) round the openings of the copy at z0: the parapets
// along each opening's sides and the slab's edge with the parapet on it.
void underStone(int i, float z0, out vec3 lo, out vec3 hi) {
  int end = i / 3;
  int part = i - 3 * end;
  float za = end == 0 ? z0 : z0 + UNDER_LEN - OPEN;
  if (part == 2) {
    float e = end == 0 ? za + OPEN : za - PARAPET_W;
    lo = vec3(UNDER_X0 - PARAPET_W, -SLAB, e);
    hi = vec3(UNDER_X1 + PARAPET_W, PARAPET, e + PARAPET_W);
    return;
  }
  float x = part == 0 ? UNDER_X0 - PARAPET_W : UNDER_X1;
  lo = vec3(x, -CURB, za);
  hi = vec3(x + PARAPET_W, PARAPET, za + OPEN);
}
// Rail k (< 4) of the copy at z0: along wall X0 (even k) or X1, down the
// first flight (k < 2) or up the second, RAIL_H over the treads' line.
void underRail(int k, float z0, out vec3 a, out vec3 b) {
  float x = (k & 1) == 0 ? UNDER_X0 + RAIL_IN : UNDER_X1 - RAIL_IN;
  float slope = RISE / TREAD;
  float top = RAIL_H - slope * 0.5 * TREAD, bottom = top - slope * FLIGHT;
  a = vec3(x, top, z0);
  b = vec3(x, bottom, z0 + FLIGHT);
  if (k >= 2) {
    a = vec3(x, bottom, z0 + UNDER_LEN - FLIGHT);
    b = vec3(x, top, z0 + UNDER_LEN);
  }
}
// What of the underpass the ray meets before h, which holds the ground's
// hit: where that falls in an opening the ray goes on down into it.
void traceUnder(vec3 ro, vec3 rd, vec3 ird, inout Hit h) {
  float t = -1.0;
  if (underInside(ro)) {
    t = 0.0;
  } else if (h.kind == GROUND) {
    vec3 p = ro + rd * h.t;
    float u = underAlong(p.z);
    if (p.x > UNDER_X0 && p.x < UNDER_X1 && u >= 0.0 && u < UNDER_LEN && !underRoofed(u)) {
      t = h.t;
      h = noHit();
    }
  }
  if (t >= 0.0) {
    // Inside: from cell to cell along it (the treads, the floor), each
    // with its level and its roof (the slab, or the sky in the openings).
    float z0 = ro.z + rd.z * t;
    z0 -= underAlong(z0);
    float dir = ird.z > 0.0 ? 1.0 : -1.0;
    float tw = ((ird.x > 0.0 ? UNDER_X1 : UNDER_X0) - ro.x) * ird.x;
    for (int i = 0 + ZERO; i < 40; i++) {
      float u = ro.z + rd.z * t - z0;
      float ua, ub;
      float lv = underCell(u + 1e-3 * dir, ua, ub);
      float roof = underRoofed(0.5 * (ua + ub)) ? -SLAB : 0.0;
      float nb = dir > 0.0 ? ub : ua;
      float tz = (z0 + nb - ro.z) * ird.z;
      float tf = ird.y < 0.0 ? (lv - ro.y) * ird.y : 1e9;
      float tc = ird.y > 0.0 ? (roof - ro.y) * ird.y : 1e9;
      float tm = min(min(tz, tw), min(tf, tc));
      if (tm >= h.t) break;
      if (tm == tf) { underHit(h, tf, 0, vec3(0.0, 1.0, 0.0), 0); break; }
      if (tm == tc) {
        if (roof < 0.0) underHit(h, tc, 2, vec3(0.0, -1.0, 0.0), 0);
        break;
      }
      if (tm == tw) { underHit(h, tw, 1, vec3(-sign(rd.x), 0.0, 0.0), 0); break; }
      // On into the next cell, unless its riser or the slab's edge stands
      // in the way.
      float y = ro.y + rd.y * tz;
      float va, vb;
      float next = nb + 1e-3 * dir;
      if (y < underCell(next, va, vb)) { underHit(h, tz, 1, vec3(0.0, 0.0, -dir), 0); break; }
      if (y > (underRoofed(next) ? -SLAB : 0.0)) { underHit(h, tz, 3, vec3(0.0, 0.0, -dir), 0); break; }
      t = tz;
    }
  }
  // Its stone and its rails, in the two copies before the ray.
  float z1 = UNDER_Z + REPEAT * floor((ro.z - UNDER_Z) / REPEAT);
  float z2 = z1 + (rd.z >= 0.0 ? REPEAT : -REPEAT);
  for (int i = 0 + ZERO; i < 12; i++) {
    vec3 lo, hi;
    underStone(i - 6 * (i / 6), i < 6 ? z1 : z2, lo, hi);
    vec2 b = slab(ro, ird, lo, hi);
    if (b.x < b.y && b.x > 0.0 && b.x < h.t) underHit(h, b.x, 3, slabNormal(ro, rd, ird, lo, hi), 0);
  }
  for (int i = 0 + ZERO; i < 8; i++) {
    vec3 a, b;
    underRail(i & 3, i < 4 ? z1 : z2, a, b);
    float tr = capsule(ro, rd, a, b, RAIL_R);
    if (tr > 0.0 && tr < h.t) {
      vec3 p = ro + rd * tr - a, ba = b - a;
      underHit(h, tr, 3, normalize(p - ba * clamp(dot(p, ba) / dot(ba, ba), 0.0, 1.0)), 1);
    }
  }
}

Hit trace(vec3 ro, vec3 rd, bool walker) {
  Hit h = noHit();
  vec3 ird = safeInverse(rd);
  // In the underpass the street's ground is over the eye.
  if (rd.y < 0.0 && !underInside(ro)) {
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
  if (UNDERPASS) traceUnder(ro, rd, ird, h);
  float s = rd.x >= 0.0 ? 1.0 : -1.0;
  for (int row = 0 + ZERO; row < 3; row++) {
    if (traceRow(ro, rd, ird, row, s, h)) break;
  }
  traceLamps(ro, rd, ird, h);
  traceSigns(ro, rd, ird, h);
  traceCars(ro, rd, ird, h);
  if (walker) traceFigures(ro, rd, ird, h);
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
    float e = figure(0, p + d * t);
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
  return l * streetShare(p + 0.01 * n) + tubesAt(p, n, wrap);
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
  return l * streetShare(p + 0.01 * n);
}

// Page 08: the underpass's tubes in its glazed tiles (GGX), from the point
// of each tube nearest the mirrored look.
float tubesGleam(vec3 p, vec3 n, vec3 v, float a2) {
  p += 0.02 * n;
  if (!underInside(p)) return 0.0;
  float u = underAlong(p.z);
  float k0 = tubeNear(u);
  float nv = max(dot(n, v), 0.05);
  vec3 r = reflect(-v, n);
  float l = 0.0;
  for (int j = -2 + ZERO; j <= 2; j++) {
    float k = k0 + float(j);
    if (k < 0.0 || k > TUBES - 1.0) continue;
    vec3 c = tubeAt(p.z - u, k);
    vec3 w = p - c;
    float s = clamp((w.z - r.z * dot(r, w)) / max(1.0 - r.z * r.z, 1e-3), -TUBE_HALF, TUBE_HALF);
    vec3 d = c + vec3(0.0, 0.0, s) - p;
    float d2 = dot(d, d);
    vec3 ld = d * inversesqrt(d2);
    vec3 hv = normalize(ld + v);
    float nh = max(dot(n, hv), 0.0);
    float q = nh * nh * (a2 - 1.0) + 1.0;
    float F = 0.04 + 0.96 * pow(1.0 - max(dot(hv, v), 0.0), 5.0);
    l += tubeFlicker(k) * step(0.0, dot(n, ld)) * a2 / (PI * q * q) * F / (4.0 * nv) / max(d2, 0.3);
  }
  return TUBE_LIGHT * l;
}

// The cars' lamps in the wet road and their light on it: the headlights
// (cold) throw ahead, the taillights (warm) glow behind.
// One car lamp's gleam at p: `ahead` the way it shines (x, z).
float carGleam(vec3 p, vec3 n, vec3 v, float a2, float nv, vec3 lamp, vec2 ahead) {
  vec3 d = lamp - p;
  float d2 = dot(d, d);
  vec3 ld = d * inversesqrt(d2);
  // Only what lies before a lamp sees it.
  float beam = smoothstep(-0.05, 0.5, -dot(ld.xz, ahead));
  if (beam <= 0.0) return 0.0;
  vec3 hv = normalize(ld + v);
  float nh = max(dot(n, hv), 0.0);
  float q = nh * nh * (a2 - 1.0) + 1.0;
  float D = a2 / (PI * q * q);
  // Wet asphalt mirrors at a glance and hardly at all from above:
  // a crane over the road must not see a car's lamps pooled on it.
  float F = 0.25 * clamp(1.6 * (1.0 - max(dot(hv, v), 0.0)), 0.06, 1.0);
  return beam * (D * F / (4.0 * nv) + 0.004 * max(dot(n, ld), 0.0) * beam) / max(d2, 0.25);
}
vec2 carsGleam(vec3 p, vec3 n, vec3 v, float a2) {
  vec2 l = vec2(0.0);
  float nv = max(dot(n, v), 0.05);
  if (CROSSCAR.w > 0.0) {
    vec2 f;
    vec3 c = crossCar(f);
    l.x += 2.4 * CAR_LIGHT * CROSSCAR.w * carGleam(p, n, v, a2, nv, c + vec3(2.3 * f.x, 0.68, 2.3 * f.y), f);
  }
  for (int lane = 0 + ZERO; lane < 2; lane++) {
    float x, dir, gap, base;
    laneCars(lane, x, dir, gap, base);
    float near = floor((p.z - base) / gap);
    for (int k = -1 + ZERO; k <= 2; k++) {
      float z = base + gap * (near + float(k));
      if (abs(z - p.z) > 34.0) continue;
      for (int e = 0 + ZERO; e < 2; e++) {
        // e = 0 the headlights, 1 the taillights.
        float ahead = e == 0 ? dir : -dir;
        vec3 lamp = vec3(x, -CURB + (e == 0 ? 0.68 : 0.78), z + ahead * 2.3);
        float power = e == 0 ? 1.6 * CAR_LIGHT : 0.7 * CAR_LIGHT;
        float i = power * carGleam(p, n, v, a2, nv, lamp, vec2(0.0, ahead));
        if (e == 0) l.x += i; else l.y += i;
      }
    }
  }
  return l;
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

// ---- the code under the city ----

// How brightly the code runs down the walls, and inside the sphere.
const float CODE_LIGHT = 0.26;
const float ESSENCE_LIGHT = 0.4;
// The second ring's radius round his body.
const float SECOND_RING_R = 0.42;

// A line w wide at distance e from it.
float sline(float e, float w) {
  float x = e / w;
  return exp(-x * x);
}

// Falling code over a surface: columns cell.x apart along uv.x, glyphs
// cell.y tall up uv.y. In a `density` share of the columns a head falls
// down and leaves a fading trail; it comes round every `span` glyphs a
// whole number of times a loop. `period` columns (0: none) keep the
// street's repeat along uv.x. pxm: metres a pixel spans there.
float code(vec2 uv, vec2 cell, int period, float span, float density, float pxm, uint salt) {
  vec2 g = uv / cell;
  int cx = int(floor(g.x));
  if (period > 0) cx = pm(cx, period);
  if (hash2(cx, 0, salt) > density) return 0.0;
  float laps = float(5 + int(hash2(cx, 1, salt) * 9.0));
  float row = floor(g.y);
  float s = fract(row / span + TIME * laps / LOOP + hash2(cx, 2, salt));
  float trail = pow(1.0 - s, 2.5);
  float head = step(s, 1.0 / span);
  // A share of the glyphs keeps changing as the code runs.
  int sym = int(row);
  if (hash3(cx, sym, 3, salt) < 0.35) {
    sym += 131 * pm(int(floor(TIME * 6.0 + hash2(cx, 4, salt))), int(LOOP * 6.0));
  }
  vec2 f = fract(g);
  float gl = glyph(vec2(f.x * 1.4 - 0.2, f.y * 1.2 - 0.1), cx, sym, salt + 7u);
  // Far off a glyph is smaller than its dots: their mean.
  float dots = cell.x / 7.0;
  gl = mix(0.3, gl, smoothstep(dots * 1.5, dots * 0.6, pxm));
  return gl * (0.8 * trail + 1.4 * head);
}

// Inside the sphere round him a thing shows its code: its own light sinks
// to a ghost (by `k`, its share) and falling glyphs cover it. Where it
// crosses the glass a thin line rings it, and the first ring's plane
// draws its line over what is inside.
vec2 essence(vec3 p, vec3 n, vec2 L, float k) {
  vec3 rel = p - SPHERE.xyz;
  float R = SPHERE.w;
  float d2 = dot(rel, rel);
  if (d2 > (R + 0.06) * (R + 0.06)) return L;
  // Opened wide (page 07) the sphere takes in the street: its code only
  // shows through, the street keeps its light.
  k *= 1.0 - 0.7 * smoothstep(1.6, 6.0, R);
  float d = sqrt(d2);
  float inside = smoothstep(R + 0.02, R - 0.06, d);
  vec3 an = abs(n);
  bool flat_ = an.y > max(an.x, an.z);
  bool alongZ = flat_ || an.x > an.z;
  vec2 uv = flat_ ? p.zx : (alongZ ? p.zy : p.xy);
  float cw = REPEAT / 1800.0;
  float pxm = pixelAt(length(p - EYE.xyz));
  float c = code(uv, vec2(cw, cw * 1.4), alongZ ? 1800 : 0, 16.0, 0.85, pxm, 500u);
  vec2 inner = L * mix(1.0, 0.12, k) + vec2(ESSENCE_LIGHT * k * (0.05 + c), 0.0);
  L = mix(L, inner, inside);
  float edge = sline(d - R, 0.012);
  float plane = sline(p.y - RINGS.x, 0.012) * inside * RINGVIS.x;
  L.x += RINGS.w * (0.18 * edge + 0.22 * plane);
  return L;
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
  // How much of its code it shows inside the sphere (0: none, him).
  float essence;
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
  m.essence = 1.0;
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
// Page 07: the side street's car's headlights flood what stands before them.
vec2 crossLight(vec3 p, vec3 n) {
  if (CROSSCAR.w <= 0.0) return vec2(0.0);
  vec2 f;
  vec3 c = crossCar(f);
  vec3 d = p - (c + vec3(2.3 * f.x, 0.68, 2.3 * f.y));
  float d2 = dot(d, d);
  vec3 ld = d * inversesqrt(d2);
  float cone = smoothstep(0.5, 0.9, dot(ld.xz, f)) * smoothstep(0.75, 0.0, ld.y);
  float lambert = dot(n, n) > 0.0 ? max(dot(n, -ld), 0.0) : 1.0;
  return vec2(CROSS_LIGHT * CROSSCAR.w * cone * lambert / max(d2, 0.5), 0.0);
}
vec2 lightOf(Mat m, vec3 p, vec3 v) {
  vec2 L = m.L;
  if (m.albedo > 0.0) L += m.albedo * (lamps(p, m.n, m.wrap, m.shadowed) + m.extra + crossLight(p, m.n));
  if (m.gleam > 0.0) L += m.gleam * lampsGleam(p, m.gn, v, m.a2);
#if LIGHT_FULL
  if (m.cars > 0.0) L += m.cars * carsGleam(p, m.gn, v, m.a2);
#endif
  if (m.rings > 0.0) L.x += m.rings * shellRings(p);
  L *= m.mul;
  if (m.essence > 0.0) L = essence(p, m.n, L, m.essence);
  return L;
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
  // The code runs down the walls over the shops, on the towers wider.
  if (!(row == 0 && front && v < 4.2)) {
    int cols = row == 2 ? 136 : 272;
    float cw = REPEAT / float(cols);
    float along = front ? p.z : p.x;
    m.L.x += CODE_LIGHT * (1.0 - 0.7 * CHECK.y) * code(vec2(along, v), vec2(cw, cw * 1.35), front ? cols : 0, 32.0, 0.3, pxm, 300u + sd);
  }
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
      // Page 08: a step down in the underpass rings on its own floor.
      if (s.z > 2.4 || underFoot(s.xy)) continue;
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
  if (full && CHECK.z + CHECK.w > 0.0) {
    // Page 07: the light comes back at his soles, then the support: the
    // pavement lights in circles out from where he stands.
    for (int i = 0 + ZERO; i < 2; i++) {
      vec2 rel = (p.xz - STEP(i).xy) / vec2(0.09, 0.17);
      lightRings.x += 0.5 * CHECK.z * exp(-dot(rel, rel));
    }
    float ph = CHECK.w;
    float fade = smoothstep(0.0, 0.12, ph) * (1.0 - smoothstep(1.0, 2.0, ph));
    float d = length(p.xz - 0.5 * (STEP(0).xy + STEP(1).xy));
    for (int j = 0 + ZERO; j < 3; j++) {
      float r = 0.25 + 3.2 * max(ph - 0.28 * float(j), 0.0);
      lightRings.x += 0.7 * fade * sline(abs(d - r), 0.02 + 0.004 * r) * exp(-r / 4.5);
    }
    lightRings.x += 0.05 * fade * exp(-d * d / 2.5);
  }
  nw = normalize(vec3(dn.x, 1.0, dn.y));
  Mat m = matte(albedo, vec3(0.0, 1.0, 0.0), 0.0, shopSpill(p) + vec2(0.006, 0.005));
  m.shadowed = full;
  m.essence = 0.25;
  if (full) {
    m.gleam = 1.0 - 0.6 * wet;
    m.cars = m.gleam;
    m.gn = nw;
    m.a2 = mix(0.09, 0.012, wet);
    m.L = lightRings;
    m.rings = 0.45;
    // Where his feet stand the ground is in his shade, and under a car
    // in the car's.
    for (int i = 0 + ZERO; i < 2; i++) {
      vec2 rel = p.xz - STEP(i).xy;
      if (!underFoot(STEP(i).xy)) m.mul *= 1.0 - 0.45 * exp(-dot(rel, rel) / 0.03);
      float x, dir, gap, base;
      laneCars(i, x, dir, gap, base);
      vec2 under = abs(vec2(p.x - x, p.z - base - gap * floor((p.z - base) / gap + 0.5)));
      vec2 out_ = max(under - vec2(0.7, 2.0), 0.0);
      m.mul *= 1.0 - 0.8 * exp(-dot(out_, out_) / 0.04);
      // And under each passer, in their own shade.
      vec3 c = 0.5 * (PASS_LO(i).xyz + PASS_HI(i).xyz);
      c.z += REPEAT * floor((p.z - c.z) / REPEAT + 0.5);
      vec2 rel2 = (p.xz - c.xz) / vec2(0.3, 0.34);
      m.mul *= 1.0 - 0.5 * exp(-dot(rel2, rel2));
    }
    if (CROSSCAR.w > 0.0) {
      // Page 07's car in its own shade too.
      vec2 f;
      vec3 c = crossCar(f);
      vec2 out_ = max(abs(carLocal(p, c, f).xz) - vec2(0.7, 2.0), 0.0);
      m.mul *= 1.0 - 0.8 * min(4.0 * CROSSCAR.w, 1.0) * exp(-dot(out_, out_) / 0.04);
    }
  }
  return m;
}

Mat figureMat(Hit h, vec3 p, vec3 rd) {
  int who = h.row;
  int o = who * CONES;
  // The point on the figure's first copy.
  vec3 q = p - vec3(0.0, 0.0, float(h.c) * REPEAT);
  float d;
  vec3 n = figureNormal(who, q, d);
  vec3 v = -rd;
  bool sk = skin(who, q, d);
  // The phone's screen glows; its back is dark.
  bool phone = (who == FIG_PHONE || (who == 0 && RINGVIS.w > 0.0)) && cone(o + CONE_PROP, q) < d + 0.006;
  // His own phone (page 07) faces his eyes: its cut's axis.
  vec3 screenAt = SCREEN.xyz, screenDir = SCREEN_DIR.xyz;
  float screenLight = who == FIG_PHONE ? SCREEN.w : 0.0;
  if (who == 0) {
    screenAt = 0.5 * (u_b[3 * CONE_PROP].xyz + u_b[3 * CONE_PROP + 1].xyz);
    screenDir = u_b[3 * CONE_PROP + 2].xyz;
    screenLight = 0.15 * RINGVIS.w;
  }
  if (phone && dot(n, screenDir) > 0.5) return emits(vec2(6.0, 0.25) * (who == 0 ? RINGVIS.w : 0.4));
  if (who == 0 && PHONE_C.w > 0.0) {
    // Page 08: his phone, unless his thumb or fingers are nearer. Its
    // screen shows our app; the rest is black glass and its dark rim.
    float k = PHONE_C.w;
    vec3 face = cross(PHONE_X.xyz, PHONE_Y.xyz);
    screenAt = PHONE_C.xyz + face * (PHONE_T * k);
    screenDir = face;
    screenLight = 0.06 * PHONE_UI.w;
    float dp = phoneBox(q);
    float fingers = min(min(cone(CONE_OWN, q), cone(CONE_OWN + 1, q)), min(cone(CONE_OWN + 2, q), cone(CONE_OWN + 3, q)));
    if (dp < d + 0.002 && dp < min(fingers, cone(o + CONE_HAND_L, q))) {
      vec3 l = phoneLocal(q);
      vec2 half_ = vec2(PHONE_SCREEN_W, PHONE_SCREEN_H) * k;
      float t = length(p - EYE.xyz);
      Mat m;
      if (dot(n, face) > 0.6 && roundRect(l.xy, half_, SCREEN_CORNER * k) < 0.0) {
        vec2 uv = vec2(0.5 + 0.5 * l.x / half_.x, 0.5 - 0.5 * l.y / half_.y);
        float lod = log2(max(pixelAt(t) * UI_CELL.y / (2.0 * half_.y), 1.0));
        m = emits(vec2(phoneUi(uv, lod) / EXPOSURE, 0.0));
        m.gleam = 0.5;
      } else {
        m = matte(0.02, n, 0.2, vec2(0.004));
        m.gleam = 1.0;
      }
      m.gn = n;
      m.a2 = 0.01;
      m.essence = 0.0;
      return m;
    }
  }
  // His umbrella: the wet canopy, the shaft and the handle in his fist.
  bool brolly = who == 0 && BROLLY.w > 0.0
    && min(brollyCanopy(q), min(cone(CONE_OWN + 2, q), cone(CONE_OWN + 3, q))) < d + 0.004;
  sk = sk && !brolly;
  bool canopy = (who == FIG_UMBRELLA && cone(o + CONE_PROP + 1, q) < d + 0.01) || brolly;
  vec3 sh = shop(-1.0, cellOf(p.z));
  float fromShops = SHOP_LIGHT * 0.45 * sh.x * clamp(-n.x * 0.8 + 0.2, 0.0, 1.0);
  vec2 shops = sh.y > 0.5 ? vec2(0.0, fromShops) : vec2(fromShops, 0.0);
  vec2 extra = shops + vec2(0.012, 0.01);
  if (screenLight > 0.0) {
    // The screen lights the face over it and the hands round it.
    vec3 l = screenAt - q;
    float d2 = dot(l, l);
    l *= inversesqrt(d2);
    extra.x += screenLight * max(dot(n, l), 0.0) * max(dot(-l, screenDir), 0.0) / (d2 + 0.02);
  }
  float albedo = sk ? 0.2 : (phone || canopy ? 0.025 : (who == FIG_PHONE ? 0.09 : 0.06));
  // Page 08 in his eyes: his hand in the dark street, dimmer than the
  // screen it holds.
  if (sk && who == 0) albedo *= 1.0 - 0.4 * PHONE_TAP.w;
  Mat m = matte(albedo, n, 0.3, extra);
  float rim = pow(1.0 - max(dot(n, v), 0.0), 3.0) * (who == 0 ? FIG_HI.w : 0.7);
  m.L = rim * vec2(0.2 * smoothstep(-0.3, 0.6, -n.x) + 0.05, 0.22 * smoothstep(-0.3, 0.6, n.x) + 0.04);
  // The wet coat's sheen; the umbrella's wet cloth shines more, the
  // short jacket's quilted nylon wider.
  m.gleam = canopy ? 1.0 : 0.35;
  m.gn = n;
  m.a2 = sk ? 0.25 : (canopy ? 0.02 : (who == FIG_PHONE ? 0.07 : 0.12));
  m.rings = 0.5;
  if (who == 0) {
    // He is not code; the second ring draws its line round him.
    m.essence = 0.0;
    m.L.x += RINGS.w * RINGVIS.y * 0.3 * sline(p.y - RINGS.y, 0.008);
    // Page 07: the light comes back at his soles first.
    m.L.x += 0.6 * CHECK.z * smoothstep(0.12, 0.0, q.y);
  }
  return m;
}

Mat carMat(Hit h, vec3 p, vec3 rd) {
  vec2 f;
  vec3 c = carAt(h.row, float(h.c), f);
  vec3 q = carLocal(p, c, f);
  vec3 nl = vec3(0.0);
  for (int i = 0 + ZERO; i < 4; i++) {
    vec3 k = vec3(float(((i + 3) >> 1) & 1), float((i >> 1) & 1), float(i & 1)) * 2.0 - 1.0;
    nl += k * carShape(q + k * 0.002);
  }
  nl = normalize(nl);
  vec3 n = vec3(nl.x * f.y + nl.z * f.x, nl.y, nl.z * f.y - nl.x * f.x);
  int look = carLook(h.row, float(h.c));
  // Page 07's car is a pale one, so its body reads against the dark street.
  float shade = h.row == 2 ? 0.8 : hash1(look, 301u + uint(h.row));
  float on = h.row == 2 ? CROSSCAR.w : 1.0;
  vec3 aq = abs(q);
  // The lamps: two headlights in the nose, two taillights in the tail.
  bool nose = q.z > 1.9 && nl.z > 0.35, tail = q.z < -1.9 && nl.z < -0.35;
  if (nose && q.y > 0.55 && q.y < 0.76 && aq.x > 0.4 && aq.x < 0.82) {
    // Page 07's car is seen close: its lamps are rounded, and dipped they
    // glow, not burn.
    vec2 e = (vec2(aq.x, q.y) - vec2(0.61, 0.655)) / vec2(0.21, 0.105);
    float shape = h.row == 2 ? smoothstep(1.0, 0.55, length(e)) : 1.0;
    if (shape > 0.0) return emits(on * on * on * shape * vec2(3.2 * CAR_LIGHT, 0.25 * CAR_LIGHT));
  }
  if (tail && q.y > 0.68 && q.y < 0.86 && aq.x > 0.42 && aq.x < 0.84) return emits(on * vec2(0.05, 1.6 * CAR_LIGHT));
  // The wheels: dark rubber round a dull hub.
  vec2 wq = vec2(q.y - 0.33, aq.z - 1.38);
  if (aq.x > 0.6 && dot(wq, wq) < 0.36 * 0.36 && q.y < 0.72) {
    Mat m = matte(length(wq) < 0.19 ? 0.05 : 0.012, n, 0.2, vec2(0.004));
    m.gleam = 0.3;
    m.gn = n;
    m.a2 = 0.1;
    return m;
  }
  // The glass: black, a sharp mirror of the lamps.
  bool glass = q.y > 0.9 && nl.y < 0.8 && aq.x < 0.86;
  Mat m = matte(glass ? 0.006 : mix(0.025, 0.16, shade * shade), n, 0.15, vec2(0.006, 0.005));
  m.gleam = glass ? 1.4 : 0.9;
  m.gn = n;
  m.a2 = glass ? 0.002 : 0.012;
  m.rings = 0.3;
  if (h.row == 2) {
    // Page 07's car stands in the dark side street: a sheen along its
    // edges keeps its body in sight.
    m.L += vec2(0.08, 0.035) * pow(1.0 - max(dot(n, -rd), 0.0), 2.5);
    m.extra += vec2(0.1, 0.05);
  }
  // Under the sills the car is in its own shade.
  m.mul = mix(0.35, 1.0, smoothstep(0.25, 0.5, q.y));
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
  i *= 1.0 - 0.5 * CHECK.y;
  return sg.w > 0.5 ? vec2(0.12 * i, i) : vec2(i, 0.08 * i);
}

// ---- page 08's underpass: its stone, its tiles, its tubes ----

const float TUBE_GLOW = 4.0;
const float TILE = 0.15;
const float LINE_LIGHT = 0.16;
// Where each phrase left his mouth: its line of code in the tiles reaches
// VOICE_REACH from there.
const vec3 VOICE_LINE[7] = vec3[7](VOICE_LINES);

// How much its floor mirrors at p, and the normal its water shows: wet
// down the open stairs, in pools along the floor under the slab.
float underWater(vec3 p, out vec3 nw) {
  float u = underAlong(p.z);
  vec2 g = vec2(p.x, u);
  float open = smoothstep(1.5, -0.5, min(u, UNDER_LEN - u) - OPEN);
  float wet = max(open, 0.8 * smoothstep(0.55, 0.68, noiseP(g * 1.3, 4096)));
  vec2 dn = (vec2(noiseP(g * 11.0, 4096), noiseP(g * 11.0 + 7.3, 4096)) - 0.5) * mix(0.06, 0.008, wet);
  nw = normalize(vec3(dn.x, 1.0, dn.y));
  return mix(0.3, 0.92, wet);
}

Mat underMat(Hit h, vec3 p, vec3 rd, float t) {
  float pxm = pixelAt(t);
  float aa = 0.6 * pxm + 0.002;
  float u = underAlong(p.z);
  vec3 n = h.n;
  if (h.row == 3) {
    // The stone over the street, and the rails' wet steel.
    bool rail = h.c == 1;
    Mat m = matte(rail ? 0.06 : 0.11, n, 0.2, vec2(0.012, 0.01));
    m.gleam = rail ? 0.7 : 0.15;
    m.gn = n;
    m.a2 = rail ? 0.02 : 0.1;
    m.rings = 0.5;
    m.essence = 0.25;
    return m;
  }
  float ua, ub;
  float lv = underCell(clamp(u, 0.0, UNDER_LEN - 1e-3), ua, ub);
  if (h.row == 2) {
    // The ceiling: plaster in panels, the tubes along its middle.
    float k = tubeNear(u);
    vec2 e = abs(p.xz - tubeAt(p.z - u, k).xz);
    float tube = smoothstep(0.035 + aa, 0.035 - aa, e.x) * smoothstep(TUBE_HALF + aa, TUBE_HALF - aa, e.y);
    float housing = smoothstep(0.08 + aa, 0.08 - aa, e.x) * smoothstep(TUBE_HALF + 0.05 + aa, TUBE_HALF + 0.05 - aa, e.y);
    float joint = smoothstep(aa + 0.006, 0.0, abs(fract(u / 1.2 + 0.5) - 0.5) * 1.2);
    float halo = exp(-length(max(e - vec2(0.0, TUBE_HALF), 0.0)) / 0.35);
    Mat m = matte(mix(0.14, 0.05, max(joint, housing)), n, 0.0, vec2(TUBE_LIGHT * (0.06 + 0.25 * halo), 0.0));
    m.L = vec2(tubeFlicker(k) * (TUBE_GLOW * tube + 0.05 * halo), 0.0);
    m.essence = 0.25;
    return m;
  }
  if (abs(n.z) > 0.5) {
    // A riser: dark stone.
    Mat m = matte(0.06, n, 0.2, vec2(0.004, 0.003));
    m.rings = 0.7;
    m.essence = 0.25;
    return m;
  }
  if (h.row == 1) {
    // A wall: pale glazed tiles in rows up from the floor under the slab,
    // a dark skirting at the foot, and the lines of code the phrases left.
    int side = n.x > 0.0 ? 0 : 1;
    vec2 g = vec2(u, p.y + UNDER_DEPTH) / TILE;
    vec2 cell = floor(g), f = fract(g);
    vec2 q = abs(f - 0.5) * TILE;
    float grout = smoothstep(0.005 + aa, 0.002, 0.5 * TILE - max(q.x, q.y));
    float skirt = smoothstep(lv + 0.3 + aa, lv + 0.3 - aa, p.y);
    float shade = hash2(int(cell.x), int(cell.y) + 97 * side, 61u);
    float albedo = mix(0.26, 0.34, shade);
    albedo = mix(albedo, 0.035, max(grout, skirt));
    vec3 gn = normalize(n + vec3(0.0, 0.05 * (hash2(int(cell.x), int(cell.y), 63u) - 0.5), 0.05 * (shade - 0.5)));
    Mat m = matte(albedo, n, 0.1, vec2(0.006, 0.004));
    m.gleam = 0.5 * (1.0 - skirt);
    m.gn = gn;
    m.a2 = 0.006;
    m.L.x += 0.5 * (1.0 - max(grout, skirt)) * tubesGleam(p, gn, -rd, 0.006);
    float li = (cell.y - 4.0) * 0.5;
    if (li >= 0.0 && li == floor(li) && li < CROSSCAR.x) {
      int i = int(li);
      bool live = li == CROSSCAR.x - 1.0 && VOICE_A.w > 0.0;
      float reach = live ? VOICE_A.w : VOICE_REACH;
      float d = length(p - VOICE_LINE[i]);
      float gl = glyph(vec2(f.x * 1.4 - 0.2, f.y * 1.2 - 0.1), i + 8 * side, int(cell.x), 600u);
      float dots = TILE / 7.0;
      gl = mix(0.3, gl, smoothstep(dots * 1.5, dots * 0.6, pxm));
      float front = live ? 2.5 * sline(d - reach, 0.35) : 0.0;
      m.L.x += LINE_LIGHT * CROSSCAR.y * gl * smoothstep(reach, reach - 0.6, d) * (1.0 + front);
    }
    m.rings = 0.7;
    m.essence = 0.25;
    return m;
  }
  // The floor: granite slabs on the flat, a pale strip along each tread's
  // nosing, the steps' rings of light.
  bool down = u < FLIGHT, up = u >= FLIGHT + FLAT;
  vec2 g = vec2(p.x - UNDER_X0, u) / 0.4;
  vec2 q = abs(fract(g) - 0.5) * 0.4;
  float joint = (down || up) ? 0.0 : smoothstep(0.004 + aa, 0.0, 0.2 - max(q.x, q.y));
  float albedo = 0.15 + 0.05 * hash2(int(floor(g.x)), int(floor(g.y)), 62u);
  float nose = down ? ub - u : (up ? u - ua : 1.0);
  albedo = mix(albedo, 0.32, smoothstep(0.05 + aa, 0.05 - aa, nose));
  albedo = mix(albedo, 0.03, joint);
  vec3 nw;
  float mirror = underWater(p, nw);
  float wet = (mirror - 0.3) / 0.62;
  albedo *= mix(0.85, 0.5, wet);
  vec2 rings = vec2(0.0);
  float mul = 1.0;
  for (int i = 0 + ZERO; i < STEP_MARKS; i++) {
    vec4 s = STEP(i);
    if (s.z > 2.4 || !underFoot(s.xy)) continue;
    vec2 rel = p.xz - s.xy;
    float d = length(rel);
    float r = 0.1 + 0.55 * s.z;
    float fade = (1.0 - s.z / 2.4) * (1.0 - s.z / 2.4);
    float ring = exp(-pow((d - r) / 0.022, 2.0)) * fade;
    float print = exp(-dot(rel / vec2(0.06, 0.13), rel / vec2(0.06, 0.13))) * exp(-s.z / 2.5);
    rings.x += CITY.z * (0.5 * ring * (0.35 + 0.65 * wet) + 0.22 * print);
    if (i < 2) mul *= 1.0 - 0.45 * exp(-dot(rel, rel) / 0.03);
  }
  Mat m = matte(albedo, vec3(0.0, 1.0, 0.0), 0.0, vec2(0.004, 0.003));
  m.L = rings;
  m.gleam = 1.0 - 0.6 * wet;
  m.gn = nw;
  m.a2 = mix(0.09, 0.012, wet);
  // The tubes' long gleam down the wet floor.
  m.L.x += 0.6 * m.gleam * tubesGleam(p, nw, -rd, m.a2);
  m.rings = 0.7;
  m.mul = mul;
  m.essence = 0.25;
  return m;
}

vec2 sky(vec3 ro, vec3 rd);

// What the ray from ro met, other than a building or the ground, makes of
// the light.
Mat rest(Hit h, vec3 ro, vec3 rd, float pathT) {
  vec3 p = ro + rd * h.t;
  if (h.kind == SKY) return emits(sky(ro, rd));
  if (h.kind == UNDER) return underMat(h, p, rd, pathT);
  if (h.kind == FIGURE) return figureMat(h, p, rd);
  if (h.kind == CAR) return carMat(h, p, rd);
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
  if (h.kind == UNDER && h.row == 0) mirror = underWater(p, nw);
  return rest(h, ro, rd, pathT);
}
// Whether a hit's surface mirrors the street: the wet ground, the
// underpass's floor.
bool mirrors(Hit h) {
  return h.kind == GROUND || (h.kind == UNDER && h.row == 0);
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

// The sphere round him, barely there: its glass shows only where the eye
// grazes it; the first ring runs over it, two lines with beads between
// them; the third, a meridian, turns and leaves the glass it passed lit a
// little; the second ring hugs his body.
float sphereAir(vec3 ro, vec3 rd, float T) {
  vec3 C = SPHERE.xyz;
  float R = SPHERE.w;
  float L = 0.0;
  vec3 oc = ro - C;
  float b = dot(oc, rd);
  float disc = b * b - (dot(oc, oc) - R * R);
  if (disc > 0.0) {
    float sq = sqrt(disc);
    vec3 mer = vec3(cos(RINGS.z), 0.0, sin(RINGS.z));
    for (int k = 0 + ZERO; k < 2; k++) {
      float t = k == 0 ? -b - sq : -b + sq;
      if (t <= 0.05 || t > T) continue;
      vec3 q = ro + rd * t;
      // Cut at his floor (the street, or the underpass's steps on page 08).
      if (q.y < SPHERE.y - SPHERE_Y) continue;
      vec3 nr = (q - C) / R;
      float w = max(0.006, 1.2 * pixelAt(t));
      float glass = 0.002 / max(abs(dot(rd, nr)), 0.15);
      float dy = q.y - RINGS.x;
      float first = sline(abs(dy) - 0.02, w);
      float phi = atan(nr.z, nr.x);
      float rr = length(q.xz - C.xz);
      float arc = abs(fract((phi + TAU * TIME / 16.0) * (24.0 / TAU)) - 0.5) * (TAU / 24.0) * rr;
      float bead = sline(length(vec2(arc, dy)), max(0.011, w));
      float third = sline(dot(q - C, mer), w);
      float lag = fract((RINGS.z + 0.5 * PI - phi) / PI);
      float trail = 0.015 * exp(-6.0 * lag);
      float fade = exp(-HAZE * t) * (k == 0 ? 1.0 : 0.7);
      L += (glass + RINGVIS.x * (0.15 * first + 0.3 * bead) + RINGVIS.z * (0.12 * third + trail)) * fade;
    }
  }
  // The second ring: where the ray crosses its plane, or the upright
  // cylinder it lies on, nearest the ring.
  vec2 o2 = ro.xz - C.xz;
  float r2 = SECOND_RING_R, y2 = RINGS.y;
  float best = 1e3, tb = -1.0;
  if (abs(rd.y) > 1e-4) {
    float t = (y2 - ro.y) / rd.y;
    if (t > 0.05 && t < T) {
      float e = abs(length(o2 + rd.xz * t) - r2);
      if (e < best) { best = e; tb = t; }
    }
  }
  float a = dot(rd.xz, rd.xz), bb = dot(o2, rd.xz), cc = dot(o2, o2) - r2 * r2;
  float dd = bb * bb - a * cc;
  if (dd > 0.0 && a > 1e-6) {
    float sq = sqrt(dd);
    for (int k = 0 + ZERO; k < 2; k++) {
      float t = (-bb + (k == 0 ? -sq : sq)) / a;
      if (t <= 0.05 || t > T) continue;
      float e = abs(ro.y + rd.y * t - y2);
      if (e < best) { best = e; tb = t; }
    }
  }
  if (tb > 0.0) L += RINGVIS.y * 0.18 * sline(best, max(0.005, 1.2 * pixelAt(tb))) * exp(-HAZE * tb);
  return L * RINGS.w;
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
          acc += lampCone(d) / (dot(d, d) + 0.6) * streetShare(ro + rd * tt);
        }
        acc *= dt;
      }
      float below = smoothstep(0.35, -0.15, -oc.y / max(length(oc), 1e-3));
      float i = LAMP_LIGHT * lampFlicker(s, k) * (AIR * acc * exp(-HAZE * max(b, 0.0))
                + 0.5 * below * glare(ro, rd, c - vec3(0.0, 0.06, 0.0), T));
      if (side == 0) L.x += i; else L.y += i;
    }
  }
  if (UNDERPASS) {
    // Page 08: the underpass's tubes, two glints along each.
    float z0 = ro.z - underAlong(ro.z);
    for (int k = 0 + ZERO; k < int(TUBES); k++) {
      vec3 c = tubeAt(z0, float(k));
      float g = glare(ro, rd, c - vec3(0.0, 0.0, 0.35), T) + glare(ro, rd, c + vec3(0.0, 0.0, 0.35), T);
      L.x += 0.5 * tubeFlicker(float(k)) * g;
    }
  }
  // The cars' lamps: their glare where the eye stands before them.
  for (int lane = 0 + ZERO; lane < 2; lane++) {
    float x, dir, gap, base;
    laneCars(lane, x, dir, gap, base);
    float near = floor((ro.z - base) / gap);
    for (int k = -2 + ZERO; k <= 6; k++) {
      float z = base + gap * (near + float(k));
      vec3 cc = vec3(x, 0.0, z);
      vec3 oc = cc - ro;
      float b = dot(oc, rd);
      if (b < -3.0 || b > T + 3.0) continue;
      if (dot(oc, oc) - b * b > 0.02 * b * b + 9.0) continue;
      for (int e = 0 + ZERO; e < 4; e++) {
        // Headlights (e < 2) and taillights, left and right.
        bool front = e < 2;
        float ahead = front ? dir : -dir;
        vec3 lamp = vec3(x + ((e & 1) == 0 ? -0.62 : 0.62), -CURB + (front ? 0.66 : 0.77), z + ahead * 2.32);
        float facing = smoothstep(0.0, 0.6, -rd.z * ahead);
        if (facing <= 0.0) continue;
        float g = glare(ro, rd, lamp, T + 0.05) * facing;
        if (front) L.x += 1.8 * CAR_LIGHT * g; else L.y += 1.1 * CAR_LIGHT * g;
      }
    }
  }
  // Page 07's car: its headlights' beams poured through the rain, and the
  // glare of its lamps.
  if (CROSSCAR.w > 0.0) {
    vec2 f;
    vec3 c = crossCar(f);
    vec3 head = vec3(f.x, 0.0, f.y), across = vec3(f.y, 0.0, -f.x);
    vec3 nose = c + head * 2.32 + vec3(0.0, 0.66, 0.0);
    float front = smoothstep(0.0, 0.6, -dot(rd, head)), back = smoothstep(0.0, 0.6, dot(rd, head));
    float w2 = CROSSCAR.w * CROSSCAR.w;
    for (int e = 0 + ZERO; e < 2; e++) {
      vec3 s = across * (e == 0 ? -0.62 : 0.62);
      L.x += 1.8 * CAR_LIGHT * w2 * front * glare(ro, rd, nose + s, T + 0.05);
      L.y += 1.1 * CAR_LIGHT * CROSSCAR.w * back * glare(ro, rd, nose + s - head * 4.64 + vec3(0.0, 0.11, 0.0), T + 0.05);
    }
    float b = dot(nose - ro, rd);
    float t0 = max(0.0, b - 12.0), t1 = min(T, b + 12.0);
    if (t1 > t0) {
      float dt = (t1 - t0) / 8.0, acc = 0.0;
      for (int i = 0 + ZERO; i < 8; i++) {
        vec3 d = ro + rd * (t0 + (float(i) + jitter) * dt) - nose;
        float along = dot(d, head);
        acc += crossBeam(along, d - head * along) / (dot(d, d) + 1.0);
      }
      L.x += 6.0 * AIR * CROSS_LIGHT * CROSSCAR.w * acc * dt;
    }
    // Close to the eye they flood the frame: a wide halo round them.
    vec3 on_ = nose - ro;
    float bb = dot(on_, rd);
    if (bb > 0.0 && bb < T + 3.0) {
      float a2 = max(dot(on_, on_) - bb * bb, 0.0) / (bb * bb);
      L.x += 0.2 * CAR_LIGHT * w2 * front * 0.03 / (a2 + 0.03) * exp(-HAZE * bb);
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
    float r = (0.07 + 0.24 * age) * max(MOUTH.w, 1.0);
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
    float fade = (1.0 - age) * (1.0 - age) * smoothstep(0.0, 0.25, pf.w) * min(MOUTH.w, 1.0);
    // Lit by the lamps and the shop, brightest against the light.
    vec2 lit = lampsAt(pf.xyz, vec3(0.0), 0.0) + shopSpill(pf.xyz) * 2.5 + vec2(0.06, 0.045);
    // Page 07's long breath stands in the car's cold light.
    lit = vec2(lit.x, lit.y / max(MOUTH.w, 1.0)) + 0.6 * crossLight(pf.xyz, vec3(0.0));
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
  L.x += sphereAir(ro, rd, T);
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
// A hit from its record (t, kind | row << 4 | far side << 6, its lot's cell
// or its lamp's index, ...) and its normal. A building's box and a sign's
// plane are not in it: the pass that lights them finds them again.
Hit fromRecord(vec4 a, vec3 n) {
  Hit h = noHit();
  int code = int(a.y + 0.5);
  h.t = a.x;
  h.kind = code & 15;
  h.row = (code >> 4) & 3;
  h.s = (code & 64) != 0 ? 1.0 : -1.0;
  h.c = int(floor(a.z + 0.5));
  h.n = n;
  h.info = vec4(h.s, a.z, 0.0, 0.0);
  return h;
}

#if defined(PASS_HITS)
vec4 recordOf(Hit h, float extra) {
  bool lamp = h.kind == POLE || h.kind == HEAD_LAMP;
  float s = lamp ? h.info.x : h.s;
  int code = h.kind + 16 * h.row + (s > 0.0 ? 64 : 0);
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
    if (b > 0 || !mirrors(h)) break;
    vec3 p = o_ + d * h.t;
    float mirror;
    vec3 nw;
    if (h.kind == GROUND) ground(p, d, h.t, true, mirror, nw);
    else mirror = underWater(p, nw);
    r = reflect(d, nw);
    r.y = max(r.y, 0.02);
    r = normalize(r);
    float F = 0.02 + 0.98 * pow(1.0 - max(dot(-d, nw), 0.0), 5.0);
    w = exp(-HAZE * h.t) * max(F, 0.05) * mirror;
    o_ = p + vec3(0.0, 0.003, 0.0);
    d = r;
  }
  o0 = recordOf(first, w);
  o1 = vec4(mirrors(first) ? r : first.n, 0.0);
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
    if (b > 0 || !mirrors(h)) break;
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
