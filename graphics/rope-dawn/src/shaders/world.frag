// Dawn over the fog, one ray a pixel: the sky with its last stars, high
// cloud and the cloud bank the low sun comes out of; a city of glass and
// stone towers standing out of a sea of fog, the sun rising up a canyon
// between them; the rope from roof to roof, the pole, the walker; the city
// waking under the fog where it opens; his shadow on the fog with the glory
// round its head, coming apart into code; and in the air the three rings
// round him, the double that rises out of him, birds, the beacons, the
// wind and the motes in the light. Writes cold light, warm light, depth
// (z / (z + 8)) and the lens's blur.
//
// It is drawn in passes (browser.rs puts one PASS_ define in front), so
// D3D's shader compiler (Chrome on Windows) builds each in seconds:
// PASS_HITS traces the eye's ray and writes what it met and the nearest
// line in front of it (three float frames); PASS_FOG (the sky, the fog, the
// haze; it writes the depth and the blur), PASS_SET (the towers, the rope,
// the pole, the birds), PASS_FIGURE (him), PASS_CITY (under the fog),
// PASS_AIR (the rings, the lamps, the wind) and PASS_GHOST (the double) add
// their light up in the world's frame. PASS_ALL is all of it in one
// program, for a GPU that cannot draw into float frames.

#ifdef PASS_HITS
layout(location = 0) out vec4 o0;
layout(location = 1) out vec4 o1;
layout(location = 2) out vec4 o2;
#else
out vec4 o;
#endif
#if !defined(PASS_HITS) && !defined(PASS_ALL)
uniform highp sampler2D u_h0;
uniform highp sampler2D u_h1;
uniform highp sampler2D u_h2;
#endif

uniform vec4 u_b[CONES * 3];
const float BLEND[CONES] = float[CONES](BLENDS);

#define K_SKY 0
#define K_TOWER 1
#define K_FIGURE 2
#define K_FOG 3
#define K_FIELD 4
#define LINE_ROPE 1
#define LINE_POLE 2
#define LINE_BIRD 3

// How deep the towers go into the fog before the fog hides them.
#define TOWER_FOOT (FOG.x - 10.0)
// The billows' reach over and under the fog's top.
#define BILLOW 5.8
// The second ring's scan on him: its line's half width (m), how bright;
// how far behind it what it passed still glows (m); the rest of him, dimmed.
#define SCAN_SLICE 0.022
#define SCAN_LIGHT 0.42
#define SCAN_GLOW 0.45
#define SCAN_DIM 0.7
// The field of towers round the rope: one may stand in each CELL square,
// none higher than FIELD_TOP.
#define CELL 40.0
#define FIELD_TOP 75.0
// The rope's towers: their body, the housing on the roof, the mast, and
// the four posts the rope is made fast to.
#define TOWER_PARTS 7

struct Hit {
  float t;
  int kind;
  vec3 n;
  float k;     // which tower: the rope's index and part, or the field's cell
  float lt;    // the nearest line in front: how far, which, how much of
  int lk;      // the pixel it covers and its normal
  float cov;
  vec3 ln;
};

Hit noHit() {
  Hit h;
  h.t = 1e5;
  h.kind = K_SKY;
  h.n = vec3(0.0, 1.0, 0.0);
  h.k = 0.0;
  h.lt = 1e5;
  h.lk = 0;
  h.cov = 0.0;
  h.ln = vec3(0.0, 1.0, 0.0);
  return h;
}

// How much of a pixel w cells wide round x falls in each cell's band
// [0, b): the band's pulses box-filtered, so far grids turn grey, not noise.
float band(float x, float b, float w) {
  w = max(w, 1e-4);
  float x0 = x - 0.5 * w, x1 = x + 0.5 * w;
  float i0 = floor(x0) * b + min(fract(x0), b);
  float i1 = floor(x1) * b + min(fract(x1), b);
  return (i1 - i0) / w;
}
// A line `width` thick at distance e, seen with pixels px wide: never
// thinner than a pixel, dimmer where it is thinner than one.
float lineK(float e, float width, float px) {
  float w = max(width, px);
  return sline(e, w) * width / w;
}
// From angle b to angle a the short way round, -PI … PI.
float angleTo(float a, float b) {
  return mod(a - b + PI, TAU) - PI;
}

// ---- him: CONES cones blended into one body (body.rs) ----

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
// Cone c at p: squashed along its axis to |s.w| of its width, flat-ended
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
// Him at p, his head left out while the camera is in it.
float figure(vec3 p) {
  float d = cone(0, p);
  bool noHead = FIG_LO.w > 0.5;
  for (int c = 1 + ZERO; c < CONES; c++) {
    if (noHead && c >= CONE_NECK && c <= CONE_COLLAR) continue;
    d = softmin(d, cone(c, p), BLEND[c]);
  }
  return d;
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
// Part `part` of the rope's tower k (one stands every SPAN along it). The
// far roof he walks onto (k = 1) is bare where his pole sweeps it.
bool towerPart(float k, int part, out vec3 lo, out vec3 hi) {
  float z = k * SPAN;
  lo = vec3(0.0);
  hi = vec3(0.0);
  if (part == 0) {
    lo = vec3(-TOWER_X, TOWER_FOOT, z - TOWER_Z);
    hi = vec3(TOWER_X, 0.0, z + TOWER_Z);
    return true;
  }
  if (part == 1) {
    lo = vec3(-2.75, 0.0, z - 2.15);
    hi = vec3(-1.15, 2.3, z + 0.45);
    return k != 1.0;
  }
  if (part == 2) {
    lo = vec3(-2.44, 0.0, z + 1.6);
    hi = vec3(-2.32, 6.8, z + 1.72);
    return k != 1.0;
  }
  int q = part - 3;
  float x = (q & 1) == 0 ? -0.32 : 0.32;
  float zz = q < 2 ? z + TOWER_Z - 0.14 : z - TOWER_Z + 0.14;
  lo = vec3(x - 0.045, 0.0, zz - 0.045);
  hi = vec3(x + 0.045, 0.7, zz + 0.045);
  return true;
}
// The pole's curve: s from -1 (its left tip) to 1.
vec3 poleAt(float s) {
  return POLE_C.xyz + POLE_H.xyz * s - vec3(0.0, POLE_H.w * s * s, 0.0);
}

// The ray's closest approach to the segment a–b: how far along the ray,
// how far from the segment, and the segment's point there.
vec2 closest(vec3 ro, vec3 rd, vec3 a, vec3 b, out vec3 q) {
  vec3 ba = b - a, oa = ro - a;
  float baba = dot(ba, ba), bard = dot(ba, rd), baoa = dot(ba, oa), rdoa = dot(rd, oa);
  float s = clamp((baoa - bard * rdoa) / max(baba - bard * bard, 1e-9), 0.0, 1.0);
  q = a + ba * s;
  float t = max(dot(q - ro, rd), 0.0);
  return vec2(t, length(ro + rd * t - q));
}

// ---- the field of towers ----

// The tower in cell c of the field round the rope, false where none
// stands: its body, a narrower crown over it (its top under the body's
// where none), a spire over that (its top -1e3 where none), its middle, and
// what it is made of (under 0.6 glass, else stone).
struct Field {
  vec3 lo;
  vec3 hi;
  vec3 clo;
  vec3 chi;
  vec2 centre;
  float spire;
  float look;
};

bool fieldTower(ivec2 c, out Field f) {
  f.lo = vec3(0.0);
  f.hi = vec3(0.0);
  f.clo = vec3(0.0);
  f.chi = vec3(0.0, -1e3, 0.0);
  f.centre = vec2(0.0);
  f.spire = -1e3;
  f.look = 0.0;
  // The rope's own column stays open.
  if (c.x == 0) return false;
  if (hash2(c.x, c.y, 101u) > 0.76) return false;
  vec2 centre = vec2(c) * CELL + (vec2(hash2(c.x, c.y, 103u), hash2(c.x, c.y, 105u)) - 0.5) * 16.0;
  vec2 half_ = vec2(mix(5.0, 11.0, hash2(c.x, c.y, 107u)), mix(5.0, 11.0, hash2(c.x, c.y, 109u)));
  // The sun's way stays open both ways from the rope: the sun rises up a
  // canyon of towers, and his shadow falls on open fog.
  vec2 a = normalize(SUN.xz);
  vec2 across = vec2(a.y, -a.x);
  float d0 = dot(centre - vec2(0.0, -10.0), across), d1 = dot(centre - vec2(0.0, 45.0), across);
  float off = d0 * d1 < 0.0 ? 0.0 : min(abs(d0), abs(d1));
  if (off < 24.0 + max(half_.x, half_.y)) return false;
  float top = -32.0 + 92.0 * pow(hash2(c.x, c.y, 111u), 1.6);
  f.centre = centre;
  f.lo = vec3(centre.x - half_.x, TOWER_FOOT, centre.y - half_.y);
  f.hi = vec3(centre.x + half_.x, top, centre.y + half_.y);
  f.look = hash2(c.x, c.y, 113u);
  float over = top;
  if (hash2(c.x, c.y, 115u) < 0.45 && top > -12.0) {
    vec2 ch = half_ * mix(0.5, 0.7, hash2(c.x, c.y, 117u));
    over = top + mix(5.0, 14.0, hash2(c.x, c.y, 119u));
    f.clo = vec3(centre.x - ch.x, top - 0.01, centre.y - ch.y);
    f.chi = vec3(centre.x + ch.x, over, centre.y + ch.y);
  }
  if (hash2(c.x, c.y, 121u) < 0.4 && top > -6.0) {
    f.spire = over + mix(7.0, 18.0, hash2(c.x, c.y, 123u));
  }
  return true;
}
// The cell's number as one float in the hit record, and back.
float cellCode(ivec2 c) {
  return float((c.x + 512) * 1024 + (c.y + 512));
}
ivec2 cellOf(float k) {
  int n = int(k + 0.5);
  return ivec2(n / 1024 - 512, pm(n, 1024) - 512);
}
#define SPIRE_R 0.3

#if defined(PASS_HITS) || defined(PASS_ALL)

// ---- the trace ----

void traceFigure(vec3 ro, vec3 rd, vec3 ird, inout Hit h) {
  vec2 b = slab(ro, ird, FIG_LO.xyz - 0.03, FIG_HI.xyz + 0.03);
  float t = max(b.x, 0.12);
  float end = min(b.y, h.t);
  if (t >= end) return;
  for (int s = 0 + ZERO; s < 72; s++) {
    float d = figure(ro + rd * t);
    if (d < 0.0008 * t + 0.0004) {
      h.t = t;
      h.kind = K_FIGURE;
      return;
    }
    t += d * 0.9;
    if (t > end) return;
  }
}

// The rope's towers in the ray's order along it, the first it meets.
void traceTowers(vec3 ro, vec3 rd, vec3 ird, inout Hit h) {
  // The prism they all stand in.
  vec2 tx = (vec2(-TOWER_X, TOWER_X) - ro.x) * ird.x;
  vec2 ty = (vec2(TOWER_FOOT, 7.0) - ro.y) * ird.y;
  float ta = max(max(min(tx.x, tx.y), min(ty.x, ty.y)), 0.0);
  float tb = min(min(max(tx.x, tx.y), max(ty.x, ty.y)), h.t);
  if (ta >= tb) return;
  float ka = floor((ro.z + rd.z * ta) / SPAN + 0.5);
  float kb = floor((ro.z + rd.z * tb) / SPAN + 0.5);
  float dir = kb >= ka ? 1.0 : -1.0;
  for (int i = 0 + ZERO; i < 12; i++) {
    float k = ka + dir * float(i);
    if ((k - kb) * dir > 0.0) return;
    bool found = false;
    for (int part = 0 + ZERO; part < TOWER_PARTS; part++) {
      vec3 lo, hi;
      if (!towerPart(k, part, lo, hi)) continue;
      vec2 b = slab(ro, ird, lo, hi);
      if (b.x < b.y && b.y > 0.0 && b.x < h.t) {
        h.t = max(b.x, 0.0);
        h.kind = K_TOWER;
        h.k = k + 0.1 * float(part);
        h.n = slabNormal(ro, rd, ird, lo, hi);
        found = true;
      }
    }
    if (found) return;
  }
}

// The field's towers, cell by cell along the ray: the first it meets
// (each stands wholly in its own cell).
void traceField(vec3 ro, vec3 rd, vec3 ird, inout Hit h) {
  vec2 ty = (vec2(TOWER_FOOT, FIELD_TOP) - ro.y) * ird.y;
  float ta = max(min(ty.x, ty.y), 0.0);
  float tb = min(max(ty.x, ty.y), min(h.t, 1600.0));
  if (ta >= tb) return;
  vec3 p = ro + rd * ta;
  ivec2 c = ivec2(floor((p.xz + 0.5 * CELL) / CELL));
  ivec2 st = ivec2(rd.x > 0.0 ? 1 : -1, rd.z > 0.0 ? 1 : -1);
  for (int s = 0 + ZERO; s < 32; s++) {
    vec2 edge = (vec2(c) + 0.5 * vec2(st)) * CELL;
    float tx = (edge.x - ro.x) * ird.x, tz = (edge.y - ro.z) * ird.z;
    Field f;
    if (fieldTower(c, f)) {
      float best = h.t;
      vec3 n = vec3(0.0, 1.0, 0.0);
      vec2 b = slab(ro, ird, f.lo, f.hi);
      if (b.x < b.y && b.y > 0.0 && b.x < best) {
        best = max(b.x, 0.0);
        n = slabNormal(ro, rd, ird, f.lo, f.hi);
      }
      if (f.chi.y > f.hi.y) {
        b = slab(ro, ird, f.clo, f.chi);
        if (b.x < b.y && b.y > 0.0 && b.x < best) {
          best = max(b.x, 0.0);
          n = slabNormal(ro, rd, ird, f.clo, f.chi);
        }
      }
      if (f.spire > -1e2) {
        vec3 lo = vec3(f.centre.x - SPIRE_R, max(f.hi.y, f.chi.y) - 0.01, f.centre.y - SPIRE_R);
        vec3 hi = vec3(f.centre.x + SPIRE_R, f.spire, f.centre.y + SPIRE_R);
        b = slab(ro, ird, lo, hi);
        if (b.x < b.y && b.y > 0.0 && b.x < best) {
          best = max(b.x, 0.0);
          n = slabNormal(ro, rd, ird, lo, hi);
        }
      }
      if (best < h.t) {
        h.t = best;
        h.kind = K_FIELD;
        h.k = cellCode(c);
        h.n = n;
        return;
      }
    }
    if (min(tx, tz) >= tb) return;
    if (tx < tz) c.x += st.x; else c.y += st.y;
  }
}

// The fog's billowed top: marched through the billows' band, then refined.
// From inside the fog the camera sees nothing of it but its grey.
void traceFog(vec3 ro, vec3 rd, inout Hit h) {
  if (rd.y > -1e-4 || ro.y < FOG.x - BILLOW) return;
  float t0 = max((FOG.x + BILLOW - ro.y) / rd.y, 0.0);
  float t1 = (FOG.x - BILLOW - ro.y) / rd.y;
  if (t0 >= h.t) return;
  float t;
  if (t0 > 900.0) {
    // So far off the billows are below a pixel: the plane.
    t = (FOG.x - ro.y) / rd.y;
  } else {
    float a = t0, b = t1;
    bool found = false;
    for (int i = 1 + ZERO; i <= 8; i++) {
      float s = mix(t0, t1, float(i) / 8.0);
      vec3 p = ro + rd * s;
      if (p.y < fogHeight(p.xz)) {
        b = s;
        found = true;
        break;
      }
      a = s;
    }
    if (!found) b = t1;
    for (int i = 0 + ZERO; i < 4; i++) {
      float m = 0.5 * (a + b);
      vec3 p = ro + rd * m;
      if (p.y < fogHeight(p.xz)) b = m; else a = m;
    }
    t = 0.5 * (a + b);
  }
  if (t >= h.t) return;
  vec3 p = ro + rd * t;
  float e = max(0.5, 0.004 * t);
  vec3 n = vec3(fogHeight(p.xz - vec2(e, 0.0)) - fogHeight(p.xz + vec2(e, 0.0)), 2.0 * e,
                fogHeight(p.xz - vec2(0.0, e)) - fogHeight(p.xz + vec2(0.0, e)));
  h.t = t;
  h.kind = K_FOG;
  h.n = t0 > 900.0 ? vec3(0.0, 1.0, 0.0) : normalize(n);
}

// One line segment, r thick: kept when it is the nearest that covers any
// of the pixel in front of what the ray met; `amount` of it is there.
void lineSegment(vec3 ro, vec3 rd, vec3 a, vec3 b, float r, int kind, float amount, inout Hit h) {
  vec3 q;
  vec2 c = closest(ro, rd, a, b, q);
  if (c.x >= h.t || c.x >= h.lt || c.x < 0.05) return;
  float pw = pixelAt(c.x);
  float w = max(2.0 * r, pw);
  float cov = clamp((0.5 * w + 0.5 * pw - c.y) / pw, 0.0, 1.0) * (2.0 * r / w) * amount;
  if (cov < 0.004) return;
  vec3 e = (ro + rd * c.x - q) / max(c.y, 1e-6);
  float x = clamp(c.y / r, 0.0, 1.0);
  h.lt = c.x;
  h.lk = kind;
  h.cov = cov;
  h.ln = normalize(e * x - rd * sqrt(1.0 - x * x));
}
// Whether the ray passes the segment a–b within `reach` and a pixel.
bool near(vec3 ro, vec3 rd, vec3 a, vec3 b, float reach, float limit) {
  vec3 q;
  vec2 c = closest(ro, rd, a, b, q);
  return c.x < limit && c.y < reach + pixelAt(c.x);
}

// The flock: a loose V of birds along its heading, each with two wings of
// two bones that beat (in the world's time: frozen with it, mid-beat).
void traceBirds(vec3 ro, vec3 rd, inout Hit h) {
  if (BIRDS.w < 0.01) return;
  vec3 c = BIRDS.xyz;
  vec3 fwd = normalize(vec3(BIRDS2.x, 0.0, BIRDS2.y));
  vec3 side = vec3(-fwd.z, 0.0, fwd.x);
  float size = BIRDS2.z, spread = BIRDS2.w;
  vec3 tail = c - fwd * 5.0 * spread;
  if (!near(ro, rd, tail, c + fwd * spread, 4.0 * spread + size, h.t)) return;
  for (int i = 0 + ZERO; i < 9; i++) {
    float fi = float(i) - 4.0;
    float hb = hash1(i, 131u);
    vec3 p = c - fwd * (abs(fi) * spread * 0.75 + 0.3 * spread * hb)
           + side * fi * spread * (0.5 + 0.15 * hash1(i, 133u))
           + vec3(0.0, spread * 0.25 * sin(0.6 * WT + 2.0 * fi), 0.0);
    float beat = sin(WT * (7.5 + 1.5 * hb) + 2.3 * float(i));
    float s = size * (0.85 + 0.3 * hash1(i, 135u));
    for (int w = 0 + ZERO; w < 2; w++) {
      float sd = w == 0 ? 1.0 : -1.0;
      vec3 elbow = p + side * (sd * 0.5 * s) + vec3(0.0, 0.32 * s * beat, 0.0) - fwd * 0.06 * s;
      vec3 tip = elbow + side * (sd * 0.55 * s) + vec3(0.0, 0.5 * s * sin(WT * (7.5 + 1.5 * hb) + 2.3 * float(i) - 0.9), 0.0) - fwd * 0.22 * s;
      lineSegment(ro, rd, p, elbow, 0.07 * s, LINE_BIRD, BIRDS.w, h);
      lineSegment(ro, rd, elbow, tip, 0.04 * s, LINE_BIRD, BIRDS.w, h);
    }
    lineSegment(ro, rd, p + fwd * 0.18 * s, p - fwd * 0.3 * s, 0.07 * s, LINE_BIRD, BIRDS.w, h);
  }
}

// The rope from roof to roof, the span under him and a few on either
// side: his span bent at him, the others' plain sag; then the pole.
void traceLines(vec3 ro, vec3 rd, inout Hit h) {
  float kw = floor(ROPE.x / SPAN);
  float len = SPAN - 2.0 * TOWER_Z;
  for (int i = 0 + ZERO; i < 5; i++) {
    float k = kw - 1.0 + float(i);
    float z0 = k * SPAN + TOWER_Z;
    if (!near(ro, rd, vec3(0.0, -0.1, z0), vec3(0.0, -0.1, z0 + len), 0.45, h.t)) continue;
    bool his = k == kw;
    int n = his ? 24 : 8;
    float uw = clamp((ROPE.x - z0) / len, 0.02, 0.98);
    vec3 prev = ropeAt(z0);
    for (int j = 1 + ZERO; j <= 24; j++) {
      if (j > n) break;
      float u = his ? (j <= 12 ? uw * float(j) / 12.0 : mix(uw, 1.0, float(j - 12) / 12.0))
                    : float(j) / 8.0;
      vec3 cur = ropeAt(z0 + len * u);
      lineSegment(ro, rd, prev, cur, ROPE_R, LINE_ROPE, 1.0, h);
      prev = cur;
    }
  }
  if (POLE_C.w > 0.01 && near(ro, rd, poleAt(-1.0), poleAt(1.0), POLE_H.w + 0.2, h.t)) {
    vec3 prev = poleAt(-1.0);
    for (int j = 1 + ZERO; j <= 6; j++) {
      vec3 cur = poleAt(-1.0 + float(j) / 3.0);
      lineSegment(ro, rd, prev, cur, POLE_R, LINE_POLE, 1.0, h);
      prev = cur;
    }
  }
  traceBirds(ro, rd, h);
}

Hit trace(vec3 ro, vec3 rd) {
  Hit h = noHit();
  vec3 ird = safeInverse(rd);
  traceFog(ro, rd, h);
  traceField(ro, rd, ird, h);
  traceTowers(ro, rd, ird, h);
  traceFigure(ro, rd, ird, h);
  traceLines(ro, rd, h);
  return h;
}
#endif

// ---- the light ----

vec3 eyeRay() {
  vec2 ndc = gl_FragCoord.xy / u_res.xy * 2.0 - 1.0;
  return normalize(FWD.xyz + RIGHT.xyz * (ndc.x / VIEW.x) + UP.xyz * (ndc.y / VIEW.y));
}
vec3 sunDir() {
  return normalize(SUN.xyz);
}
// How much of the sun's disc shows over the cloud bank.
float sunShows() {
  vec3 s = sunDir();
  return SUN.w * clamp((sunRise() + 0.011 - bankTop(s)) / 0.022, 0.0, 1.0);
}
// What the haze and the fog add on the way to a hit t away and what they
// leave of it.
vec2 hazeOver(vec3 ro, vec3 rd, float t, out float T) {
  float th = exp(-hazeDepth(ro, rd, t));
  float tf = exp(-0.1 * inFog(ro, rd, min(t, 400.0)));
  T = th * tf;
  return (1.0 - th) * horizonSky(rd) * tf + (1.0 - tf) * CLOUD;
}

#if defined(PASS_FOG) || defined(PASS_ALL)

// The towers beyond the field, by direction alone (so they never move as
// he crosses): two rows of tops over the fog's horizon, both blue with
// distance.
vec2 skyline(vec3 rd, vec2 L) {
  float az = atan(rd.x, rd.z);
  float e = rd.y / max(length(rd.xz), 1e-3);
  if (e > 0.03 || e < -0.004) return L;
  vec3 s = sunDir();
  float lit = max(-dot(normalize(rd.xz), normalize(s.xz)), 0.0);
  for (int row = 0 + ZERO; row < 2; row++) {
    float density = row == 0 ? 70.0 : 30.0;
    float x = az * density;
    int cell = int(floor(x));
    uint salt = row == 0 ? 51u : 53u;
    if (hash1(cell, salt) > (row == 0 ? 0.62 : 0.45)) continue;
    float wide = mix(0.3, 0.8, hash1(cell, salt + 1u));
    float f = fract(x);
    float top = row == 0 ? mix(0.003, 0.012, hash1(cell, salt + 2u))
                         : mix(0.006, 0.026, pow(hash1(cell, salt + 2u), 1.5));
    float px = 2.0 / (VIEW.y * u_res.y);
    float inside = smoothstep(0.0, 0.08, f) * smoothstep(wide, wide - 0.08, f)
                 * smoothstep(top + px, top - px, e);
    float keep = row == 0 ? 0.1 : 0.25;
    vec2 own = vec2(0.035, 0.004) + SUN.w * lit * vec2(0.02, 0.16);
    L = mix(L, mix(horizonSky(rd), own, keep), inside);
  }
  return L;
}

// The sky in direction rd with the sun's disc behind the cloud bank and
// the far towers.
vec2 skyLight(vec3 rd) {
  vec2 L = sky(rd);
  vec3 s = sunDir();
  float e = rd.y / max(length(rd.xz), 1e-3);
  float a = acos(clamp(dot(rd, s), -1.0, 1.0));
  float px = 2.0 / (VIEW.y * u_res.y);
  float disc = smoothstep(0.011 + px, 0.011 - px, a) * smoothstep(bankTop(rd) - 0.002, bankTop(rd) + 0.002, e);
  L += disc * SUN.w * vec2(2.0, 8.0);
  return skyline(rd, L);
}

// IQ's distance to the 2D capsule from a (radius ra) to b (radius rb).
float unevenCapsule(vec2 p, vec2 a, vec2 b, float ra, float rb) {
  p -= a;
  b -= a;
  float h = dot(b, b);
  float d = ra - rb;
  if (h <= d * d + 1e-7) return min(length(p) - ra, length(p - b) - rb);
  vec2 q = vec2(dot(p, vec2(b.y, -b.x)), dot(p, b)) / h;
  q.x = abs(q.x);
  vec2 c = vec2(sqrt(h - d * d), d);
  float k = c.x * q.y - c.y * q.x;
  float m = dot(c, q);
  float n = dot(q, q);
  if (k < 0.0) return sqrt(h * n) - ra;
  if (k > c.x) return sqrt(h * (n + 1.0 - 2.0 * q.y)) - rb;
  return m - ra;
}

// His shadow on the fog at q (metres of him on the shadow's plane, his
// head at 0): its distance (below 0 inside).
float shadowDistance(vec2 q) {
  if (any(lessThan(q, SHADOW_BOX.xy)) || any(greaterThan(q, SHADOW_BOX.zw))) return 1.0;
  float d = 1e3;
  for (int i = 0 + ZERO; i < CONES; i++) {
    vec4 a = SHADOW_CONE(2 * i), b = SHADOW_CONE(2 * i + 1);
    if (max(a.z, b.z) < 0.002) continue;
    d = softmin(d, unevenCapsule(q, a.xy, b.xy, a.z, b.z), 0.04);
  }
  if (SHADOW.z > 0.01) {
    // Its pole, drooping like his.
    vec2 t0 = SHADOW_POLE.xy, t1 = SHADOW_POLE.zw;
    vec2 mid = 0.5 * (t0 + t1) + vec2(0.0, POLE_H.w);
    vec2 half_ = 0.5 * (t1 - t0);
    vec2 prev = t0;
    float dp = 1e3;
    for (int j = 1 + ZERO; j <= 8; j++) {
      float s = -1.0 + float(j) / 4.0;
      vec2 cur = mid + half_ * s - vec2(0.0, POLE_H.w * s * s);
      vec2 ba = cur - prev, pa = q - prev;
      float hh = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
      dp = min(dp, length(pa - ba * hh));
      prev = cur;
    }
    d = min(d, mix(1e3, dp - 0.035, SHADOW.z));
  }
  return d;
}

// His shadow on the fog at q: how dark, 0 … 1.
float shadowOf(vec2 q, float pxm) {
  return 1.0 - smoothstep(-0.03, 0.03 + 0.5 * pxm, shadowDistance(q));
}

// How much of the low sun the field's towers and the rope's keep off the
// fog at p: the sun's ray from p walked cell by cell toward it.
float boxShade(vec3 p, vec2 id, float slope, vec3 lo, vec3 hi) {
  vec2 a = (lo.xz - p.xz) * id, b = (hi.xz - p.xz) * id;
  vec2 n = min(a, b), f = max(a, b);
  float u0 = max(max(n.x, n.y), 0.0), u1 = min(f.x, f.y);
  if (u0 >= u1) return 0.0;
  float y = p.y + slope * u0;
  // The fog scatters the light: a shadow cast from far blurs out and
  // fades, so the towers lay soft breaths of shade on it, not stripes.
  float pen = 0.8 + 0.06 * u0;
  return smoothstep(y - pen, y + pen, hi.y) * smoothstep(0.0, 6.0, u1 - u0) * exp(-u0 / 140.0);
}
float towerShade(vec3 p) {
  vec3 s = sunDir();
  vec2 d = normalize(s.xz);
  float slope = s.y / length(s.xz);
  vec2 id = 1.0 / vec2(abs(d.x) < 1e-5 ? 1e-5 : d.x, abs(d.y) < 1e-5 ? 1e-5 : d.y);
  ivec2 c = ivec2(floor((p.xz + 0.5 * CELL) / CELL));
  ivec2 st = ivec2(d.x > 0.0 ? 1 : -1, d.y > 0.0 ? 1 : -1);
  float shade = 0.0;
  for (int i = 0 + ZERO; i < 12; i++) {
    vec2 edge = (vec2(c) + 0.5 * vec2(st)) * CELL;
    vec2 tt = (edge - p.xz) * id;
    Field f;
    if (c.x == 0) {
      // Only the towers of his crossing cast on the fog he looks at; the
      // rest of the rope's row is lost in the haze.
      float k0 = floor((float(c.y) - 0.5) * CELL / SPAN);
      for (int k = 0 + ZERO; k < 3; k++) {
        vec3 lo, hi;
        float kk = k0 + float(k);
        towerPart(kk, 0, lo, hi);
        float near = 1.0 - smoothstep(0.7, 1.6, abs(kk * SPAN - ROPE.x) / SPAN);
        if (near > 0.0) shade = max(shade, near * boxShade(p, id, slope, lo, hi));
      }
    } else if (fieldTower(c, f)) {
      shade = max(shade, boxShade(p, id, slope, f.lo, f.hi));
      if (f.chi.y > f.hi.y) shade = max(shade, boxShade(p, id, slope, f.clo, f.chi));
    }
    if (shade > 0.99 || min(tt.x, tt.y) > 520.0) break;
    if (tt.x < tt.y) c.x += st.x; else c.y += st.y;
  }
  return shade;
}

// The fog's top at p: the sky's cold light from above, the low sun warm on
// the billows' sides that face it (where the billows and the towers do not
// shade them), their edges silver against the light; his shadow and the
// glory round its head away from the sun; a little warm from the waking
// city through it. Its share of the pixel is `solid`; the city shows
// through the rest.
vec2 fogLight(vec3 p, vec3 n, vec3 rd, float t, out float solid, out float shade) {
  vec3 s = sunDir();
  solid = fogSolid(p.xz);
  float crest = clamp((p.y - FOG.x) / 9.0 + 0.5, 0.0, 1.0);
  float toward = max(dot(rd, s), 0.0);
  // The fog lets the light through: it wraps round the swells, softly.
  float sunOn = clamp((dot(n, s) + 0.7) / 1.7, 0.0, 1.0);
  float self_ = 0.0, towers = 0.0;
  if (SUN.w > 0.01) {
    vec2 sd = normalize(s.xz);
    float slope = s.y / length(s.xz);
    if (t < 700.0) {
      float h1 = fogHeight(p.xz + sd * 6.0) - (p.y + slope * 6.0);
      float h2 = fogHeight(p.xz + sd * 16.0) - (p.y + slope * 16.0);
      self_ = smoothstep(-0.4, 1.8, max(h1, h2));
    }
    towers = towerShade(p);
  }
  float lit = SUN.w * (1.0 - 0.8 * self_) * (1.0 - 0.6 * towers);
  // Streaks of mist drawn out along the wind in its top, fading out far
  // off where they are under a pixel.
  vec2 qw = fogWind(p.xz);
  float wisp = 1.0 + (fbm(qw / vec2(26.0, 2.6), 3, 49u) - 0.5) * 0.6 * smoothstep(320.0, 50.0, t);
  float bright = (0.62 + 0.4 * DAWN) * wisp;
  vec2 L = vec2((0.08 + 0.13 * crest * (0.6 + 0.4 * n.y)) * bright + 0.1 * toward * toward,
                0.006 + 0.04 * pow(toward, 3.0) * DAWN);
  L += lit * vec2(0.03 + 0.06 * crest, 0.03 + 0.6 * sunOn * crest);
  L += SUN.w * (1.0 - 0.6 * towers) * vec2(0.01, 0.6) * pow(toward, 6.0);
  // The silver lining: the swells' edges against the light.
  float edge = pow(1.0 - max(dot(n, -rd), 0.0), 3.0);
  L += lit * edge * pow(toward, 3.0) * vec2(0.05, 0.5);
  // The gold the risen sun leaves on it, and the towers' long shadows
  // across it.
  L.y += FOG.w * (0.04 + 0.08 * crest) * (1.0 - 0.7 * towers);
  L.x *= 1.0 - 0.25 * towers * SUN.w;
  // Where the fog thins it darkens toward the city's dusk under it.
  L *= mix(0.6, 1.0, solid);
  shade = 0.0;
  // The shadow and the glory, round the point away from the sun.
  vec3 a = -s;
  vec3 e1 = normalize(cross(a, vec3(0.0, 1.0, 0.0)));
  vec3 e2 = cross(e1, a);
  float ra = dot(rd, a);
  if (ra > 0.2 && SHADOW.x > 0.001) {
    vec2 uv = vec2(dot(rd, e1), dot(rd, e2)) / ra;
    vec2 q = uv / SHADOW.w;
    float pxm = 2.0 / (VIEW.y * u_res.y) / SHADOW.w;
    float sh = SHADOW.x * shadowOf(q, pxm);
    shade = sh * solid;
    L.y *= 1.0 - 0.92 * sh;
    L.x *= 1.0 - 0.78 * sh;
    // The glory, in metres of him round his shadow's head: rings of
    // colour, warm and cold by turns.
    float rho = length(uv) / SHADOW.w;
    float g = SUN.w * SHADOW.x;
    L += g * (vec2(0.07, 0.16) * exp(-rho / 0.13)
              + vec2(0.0, 0.34) * sline(rho - 0.2, 0.03)
              + vec2(0.24, 0.0) * sline(rho - 0.265, 0.032)
              + vec2(0.0, 0.22) * sline(rho - 0.34, 0.04)
              + vec2(0.14, 0.0) * sline(rho - 0.41, 0.045)
              + vec2(0.0, 0.1) * sline(rho - 0.5, 0.06));
  }
  L.y += FOG.z * 0.02 * (1.0 - 0.5 * solid);
  return L * solid;
}

// The sky, the fog and the haze over every hit (and the line's share).
vec2 passFog(Hit h, vec3 ro, vec3 rd) {
  float keep = 1.0 - h.cov;
  if (h.kind == K_SKY) {
    float tf = exp(-0.1 * inFog(ro, rd, 400.0));
    return (skyLight(rd) * tf + (1.0 - tf) * CLOUD) * keep;
  }
  float T;
  vec2 L = hazeOver(ro, rd, h.t, T);
  if (h.kind == K_FOG) {
    // His shadow darkens the haze over it as well.
    float solid, shade;
    vec2 fog = fogLight(ro + rd * h.t, h.n, rd, h.t, solid, shade);
    L = L * (1.0 - 0.5 * shade) + fog * T;
  }
  return L * keep;
}
#endif

#if defined(PASS_SET) || defined(PASS_ALL)

// Glass at p facing n: the sky (or the fog) and the sun in it.
vec2 reflected(vec3 rd, vec3 n, out float F) {
  vec3 s = sunDir();
  vec3 r = reflect(rd, n);
  float cosv = max(dot(-rd, n), 0.0);
  F = 0.04 + 0.96 * pow(1.0 - cosv, 5.0);
  vec2 seen = r.y > -0.02 ? sky(r) : vec2(0.17, 0.01) + SUN.w * vec2(0.02, 0.1) + FOG.w * vec2(0.0, 0.06);
  seen += SUN.w * sunShows() * vec2(2.0, 14.0) * pow(max(dot(r, s), 0.0), 700.0);
  return seen;
}

// A tower of the rope's at p: dark glass in fine mullions with the sky and
// the sun in it and a few windows lit; its wet roof with the dawn in its
// puddles and the edge lit; the housing, the mast and the posts; fading
// into the fog at its foot and, far off, into the haze.
vec2 towerLight(vec3 p, vec3 n, vec3 rd, float t, float code) {
  vec3 s = sunDir();
  float px = pixelAt(t);
  float sunOn = max(dot(n, s), 0.0);
  float k = floor(code + 0.05);
  int part = int(floor((code - k) * 10.0 + 0.5));
  vec2 L;
  if (part >= 2) {
    // Steel: the mast and the posts.
    float F;
    vec2 seen = reflected(rd, n, F);
    L = vec2(0.02, 0.002) + 0.3 * F * seen + SUN.w * vec2(0.01, 0.5) * sunOn;
    if (part >= 3) L += vec2(0.06, 0.0) * sline(p.y - 0.62, max(0.02, px));
  } else if (part == 1) {
    // The housing: concrete, a louvred door, its roof's edge lit.
    float louvre = band((p.y - 0.4) / 0.08, 0.4, px / 0.08) * step(p.y, 1.9) * step(0.4, p.y)
                 * step(abs(p.z - k * SPAN + 1.0), 0.45) * step(0.5, abs(n.x));
    L = 0.1 * (vec2(0.3 + 0.1 * n.y, 0.03) + SUN.w * vec2(0.08, 2.4) * sunOn) * (1.0 - 0.6 * louvre);
    if (n.y > 0.5) L += sline(min(min(p.x + 2.75, -1.15 - p.x), min(p.z - k * SPAN + 2.15, k * SPAN + 0.45 - p.z)), max(0.02, px)) * (vec2(0.04, 0.0) + SUN.w * vec2(0.01, 0.4));
  } else if (n.y > 0.5) {
    float edge = min(TOWER_X - abs(p.x), TOWER_Z - abs(p.z - k * SPAN));
    // Membrane seams, and puddles of last night's damp.
    float seam = max(band(p.x / 1.2 + 0.02, 0.04, px / 1.2), band(p.z / 1.2 + 0.02, 0.04, px / 1.2));
    vec2 roof = 0.1 * (vec2(0.3, 0.03) + SUN.w * vec2(0.05, 2.4) * max(s.y, 0.0) * 4.0) * (1.0 - 0.4 * seam);
    float wet = 0.45 * smoothstep(0.66, 0.69, fbm(p.xz * 0.55 + vec2(3.0 * k, 0.0), 3, 91u));
    float F;
    vec2 seen = reflected(rd, n, F);
    L = mix(roof, 0.85 * seen * (0.3 + 0.7 * F) + 0.1 * roof, wet);
    L += sline(edge, max(0.03, px)) * (vec2(0.05, 0.0) + SUN.w * vec2(0.02, 0.5));
  } else {
    // The face's own across (u) and up (y).
    float u = abs(n.x) > 0.5 ? p.z - k * SPAN : p.x;
    float fy = p.y / 3.6, fu = u / 1.07;
    float mullion = max(band(fu + 0.04, 0.08, px / 1.07), band(fy + 0.06, 0.12, px / 3.6));
    float F;
    vec2 seen = reflected(rd, n, F);
    // Behind the glass: dark, or lit before dawn.
    int face = abs(n.x) > 0.5 ? (n.x > 0.0 ? 0 : 1) : (n.z > 0.0 ? 2 : 3);
    int kk = int(k);
    float lit = step(hash3(int(floor(fu)) + 37 * kk, int(floor(fy)), face, 61u), 0.04 + 0.1 * (1.0 - DAWN));
    bool warm = hash3(int(floor(fu)), int(floor(fy)), face + 4 * kk, 63u) < 0.7;
    vec2 inside = vec2(0.005, 0.002) + lit * (warm ? vec2(0.01, 0.09) : vec2(0.08, 0.01));
    vec2 glass = 0.5 * F * seen + (1.0 - F) * inside;
    vec2 frame = 0.14 * (vec2(0.3 + 0.1 * n.y, 0.03) + SUN.w * vec2(0.08, 1.6) * sunOn);
    L = mix(glass, frame, mullion);
    // Its foot in the fog.
    float sunk = smoothstep(FOG.x + 7.0, FOG.x - 1.0, p.y);
    L = mix(L, CLOUD + SUN.w * vec2(0.02, 0.1), sunk);
  }
  return L;
}

// A tower of the field at p: a glass curtain in fine mullions or stone in
// rows of windows, roofs dark with their edges lit, the spire steel; the
// faces toward the low sun gold, the windows lit before the dawn going out.
vec2 fieldLight(vec3 p, vec3 n, vec3 rd, float t, ivec2 c) {
  Field f;
  fieldTower(c, f);
  vec3 s = sunDir();
  float px = pixelAt(t);
  // The low sun reaches the tops first; low down the fog's haze dims it.
  float high = mix(0.3, 1.0, smoothstep(FOG.x, FOG.x + 75.0, p.y));
  float sunOn = max(dot(n, s), 0.0) * high;
  float tone = 0.7 + 0.6 * hash2(c.x, c.y, 125u);
  float F;
  vec2 seen = reflected(rd, n, F);
  bool crown = p.y > f.hi.y + 0.01 && f.chi.y > f.hi.y;
  bool spire = length(p.xz - f.centre) < SPIRE_R * 1.6 && p.y > max(f.hi.y, f.chi.y) + 0.005;
  vec2 L;
  if (spire) {
    L = vec2(0.02, 0.002) + 0.3 * F * seen + SUN.w * vec2(0.01, 0.6) * sunOn;
  } else if (n.y > 0.5) {
    vec3 lo = crown ? f.clo : f.lo, hi = crown ? f.chi : f.hi;
    float edge = min(min(p.x - lo.x, hi.x - p.x), min(p.z - lo.z, hi.z - p.z));
    L = vec2(0.03, 0.003) + SUN.w * vec2(0.01, 0.12) + 0.15 * F * seen
      + sline(edge, max(0.1, px)) * (vec2(0.04, 0.0) + SUN.w * vec2(0.02, 0.4));
  } else {
    float u = abs(n.x) > 0.5 ? p.z : p.x;
    int face = abs(n.x) > 0.5 ? (n.x > 0.0 ? 0 : 1) : (n.z > 0.0 ? 2 : 3);
    int salt = pm(c.x * 31 + c.y * 17, 4096);
    if (f.look < 0.6) {
      float fy = p.y / 3.8, fu = u / 1.5;
      float mullion = max(band(fu + 0.03, 0.06, px / 1.5), band(fy + 0.05, 0.1, px / 3.8));
      int ci = int(floor(fu)), fi = int(floor(fy));
      float lit = step(hash3(ci + salt, fi, face, 141u), 0.03 + 0.12 * (1.0 - DAWN));
      bool warm = hash3(ci, fi + salt, face, 143u) < 0.7;
      vec2 inside = vec2(0.004, 0.002) + lit * (warm ? vec2(0.01, 0.1) : vec2(0.08, 0.01));
      float tint = 0.45 + 0.4 * f.look / 0.6;
      vec2 glass = tint * F * seen + (1.0 - F) * inside;
      vec2 frame = vec2(0.03, 0.003) + SUN.w * vec2(0.02, 0.45) * sunOn;
      L = mix(glass, frame, mullion);
      // The low sun on the glass facing it: a wash of gold.
      L.y += SUN.w * 0.25 * pow(sunOn, 2.0) * (1.0 - mullion);
    } else {
      float fy = p.y / 3.6, fu = u / 2.2;
      float pane = (1.0 - band(fu + 0.2, 0.42, px / 2.2)) * (1.0 - band(fy + 0.3, 0.46, px / 3.6));
      int ci = int(floor(fu)), fi = int(floor(fy));
      float lit = step(hash3(ci + salt, fi, face, 147u), 0.04 + 0.14 * (1.0 - DAWN));
      bool warm = hash3(ci, fi + salt, face, 149u) < 0.75;
      vec2 wall = 0.09 * tone * (vec2(0.28 + 0.12 * (f.look - 0.6), 0.03) + SUN.w * vec2(0.08, 2.6) * sunOn);
      // Its floors' slabs between the rows of windows.
      wall *= 1.0 - 0.25 * band(fy + 0.05, 0.08, px / 3.6);
      vec2 win = 0.4 * F * seen + lit * (warm ? vec2(0.01, 0.32) : vec2(0.22, 0.01)) + vec2(0.005, 0.0);
      L = mix(wall, win, pane);
    }
    float sunk = smoothstep(FOG.x + 8.0, FOG.x - 1.0, p.y);
    L = mix(L, CLOUD + SUN.w * vec2(0.02, 0.1), sunk);
  }
  return L;
}

// The rope, the pole and the birds at the line's point: dark against the
// sky, lit warm from behind where the eye looks toward the sun. Along the
// rope: the gold thread that runs to his soles and on, and the ripple each
// step sends out along it.
vec2 lineLight(vec3 p, vec3 n, vec3 rd, int kind) {
  vec3 s = sunDir();
  float toward = max(dot(rd, s), 0.0);
  float rim = pow(1.0 - max(dot(-rd, n), 0.0), 2.0);
  float albedo = kind == LINE_POLE ? 0.14 : (kind == LINE_BIRD ? 0.05 : 0.08);
  // The rope's sheen from the sky keeps it apart from the dark glass.
  float sheen = kind == LINE_ROPE ? 0.05 + 0.12 * max(n.y, 0.0) : 0.0;
  vec2 L = albedo * vec2(0.25 + 0.15 * n.y, 0.03) + vec2(sheen, 0.0)
         + SUN.w * vec2(0.01, albedo * 3.0 * max(dot(n, s), 0.0))
         + SUN.w * vec2(0.02, 0.9) * pow(toward, 8.0) * (0.3 + rim);
  if (kind == LINE_ROPE) {
    if (THREAD > 0.001) {
      float front = GLOW.w;
      float ahead = 40.0 * smoothstep(51.0, 58.0, TIME);
      float behind = 1.0 - smoothstep(front + ahead - 0.2, front + ahead + 0.6, p.z);
      float head = sline(p.z - front, 0.35) * (1.0 - smoothstep(46.8, 47.4, TIME));
      L.y += THREAD * (0.5 * behind + 3.0 * head);
    }
    float lit3 = RING3.z;
    if (lit3 > 0.004 && BEAT.x < 3.0) {
      float run = abs(p.z - BEAT.y) - 6.0 * BEAT.x;
      L.x += lit3 * (0.9 * exp(-BEAT.x / 0.7) * sline(run, 0.3 + 0.4 * BEAT.x)
                     + 2.0 * exp(-BEAT.x / 0.15) * sline(p.z - BEAT.y, 0.12));
    }
  }
  return L;
}

vec2 passSet(Hit h, vec3 ro, vec3 rd) {
  vec2 L = vec2(0.0);
  if (h.kind == K_TOWER || h.kind == K_FIELD) {
    float T = exp(-hazeDepth(ro, rd, h.t) - 0.1 * inFog(ro, rd, min(h.t, 400.0)));
    vec3 p = ro + rd * h.t;
    vec2 own = h.kind == K_TOWER ? towerLight(p, h.n, rd, h.t, h.k) : fieldLight(p, h.n, rd, h.t, cellOf(h.k));
    // Far off, the towers pale into the horizon's haze.
    own = mix(own, horizonSky(rd), 0.85 * smoothstep(220.0, 1300.0, h.t));
    L += own * T * (1.0 - h.cov);
  }
  if (h.lk > 0) {
    float T;
    vec2 haze = hazeOver(ro, rd, h.lt, T);
    L += h.cov * (lineLight(ro + rd * h.lt, h.ln, rd, h.lk) * T + haze);
  }
  return L;
}
#endif

#if defined(PASS_FIGURE) || defined(PASS_ALL)

// The normal from four samples round p, taken in a loop so the compiler
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
// What p is made of: 1 skin (the face and the hands), 0 his dark clothes.
int stuff(vec3 p, float d) {
  float near_ = d + 0.012;
  bool head = FIG_LO.w < 0.5;
  if ((head && (cone(CONE_HEAD, p) < near_ || cone(CONE_FACE, p) < near_))
      || cone(CONE_HAND_L, p) < near_ || cone(CONE_HAND_R, p) < near_) return 1;
  return 0;
}

// Him: matte, lit by the cold sky and the fog under him, the low sun warm
// on his back and round his outline; the second ring's light on his chest;
// the light that comes up the rope into his soles and rises to his crown.
vec2 figureLight(vec3 p, vec3 rd) {
  float d;
  vec3 n = figureNormal(p, d);
  vec3 s = sunDir();
  int m = stuff(p, d);
  float albedo = m == 1 ? 0.2 : 0.1;
  float nv = max(dot(n, -rd), 0.0);
  vec2 L = albedo * (vec2(0.42, 0.05) * (0.6 + 0.4 * n.y) * (0.75 + 0.35 * DAWN) + vec2(0.16, 0.04) * max(-n.y, 0.0)
                     + SUN.w * vec2(0.06, 2.6) * max(dot(n, s), 0.0)
                     + SUN.w * vec2(0.03, 0.4) * max(-n.y, 0.0));
  // Before the sun his outline holds the sky's cold light, so he reads
  // against the dark towers; the sun warms it after.
  float rim = pow(1.0 - nv, 2.5) * FIG_HI.w;
  L += rim * (vec2(0.7 - 0.56 * SUN.w, 0.01) + SUN.w * vec2(0.02, 0.5) * max(dot(n, s) + 0.3, 0.0));
  // The first ring at his eyes' height lights his head and shoulders.
  float r1 = RING1.z + BEAT.z;
  L.x += r1 * 0.12 * smoothstep(0.5, 0.0, abs(p.y - RING1.x)) * (0.4 + 0.6 * pow(1.0 - nv, 1.5));
  // The second ring scans him from his soles to his crown and back: where
  // it runs it cuts a bright line across him, what it has just passed
  // glows on behind it, and the rest of him waits a little dimmer.
  float lit2 = RING2B.x + BEAT.z;
  float scanning = min(lit2, 1.0);
  float level = p.y - RING2.y;
  float rate = RING2B.z;
  float behind = -level * sign(rate);
  float passed = behind > 0.0 ? sqrt(abs(rate)) * exp(-behind / SCAN_GLOW) : 0.0;
  float slice = max(SCAN_SLICE, 0.7 * pixelAt(length(p - EYE.xyz)));
  float cut = exp(-level * level / (slice * slice)) * SCAN_SLICE / slice;
  L *= mix(1.0, mix(SCAN_DIM, 1.0, passed), scanning);
  L.x += lit2 * (SCAN_LIGHT * (0.6 + 0.6 * RING2B.y) * cut * (0.55 + 0.45 * pow(1.0 - nv, 1.5)) + 0.1 * passed);
  float hy = p.y - GLOW.x;
  float inside = smoothstep(GLOW.y + 0.02, GLOW.y - 0.08, hy);
  L.y += GLOW.z * inside * (0.12 + 0.35 * pow(1.0 - nv, 2.0));
  L.y += GLOW.z * 0.6 * sline(hy - GLOW.y, 0.03) * (1.0 - smoothstep(1.7, 1.85, GLOW.y));
  return L;
}

vec2 passFigure(Hit h, vec3 ro, vec3 rd) {
  if (h.kind != K_FIGURE) return vec2(0.0);
  return figureLight(ro + rd * h.t, rd) * hazeLeft(ro, rd, h.t) * (1.0 - h.cov);
}
#endif

#if defined(PASS_CITY) || defined(PASS_ALL)

// Lot (i, j) under the fog: its building's box, false where it stands
// empty. Column 0 runs under the rope: the towers, and between them one
// low building a span.
bool lot(int i, int j, out vec3 lo, out vec3 hi) {
  float x0 = float(i) * LOT_X - 0.5 * LOT_X;
  float z0 = float(j) * LOT_Z;
  lo = vec3(0.0);
  hi = vec3(0.0);
  if (i == 0) {
    int m = pm(j, 3);
    if (m != 1) {
      float k = floor((z0 + 0.5 * LOT_Z) / SPAN + 0.5);
      lo = vec3(-TOWER_X, STREET, k * SPAN - TOWER_Z);
      hi = vec3(TOWER_X, 0.0, k * SPAN + TOWER_Z);
      return true;
    }
  }
  if (hash2(i, j, 71u) < 0.15) return false;
  float r = hash2(i, j, 73u);
  lo = vec3(x0 + 2.0, STREET, z0 + 1.2);
  hi = vec3(x0 + LOT_X - 2.0, -43.0 - 37.0 * r * r, z0 + LOT_Z - 1.2);
  return true;
}

// The tram along the street beside the rope's column.
void tramBox(out vec3 lo, out vec3 hi) {
  float z = 6.0 * (WT - 47.0);
  lo = vec3(-6.7, STREET, z - 9.0);
  hi = vec3(-4.5, STREET + 3.2, z + 9.0);
}

// The waking city's light at a facade, a roof or the street: lamps, the
// cars' lights running both ways, the tram's windows, lit rooms.
vec2 cityLight(vec3 p, vec3 n, float t, int kind) {
  vec2 L;
  float px = pixelAt(t);
  if (kind == 2) {
    // The street: its lamps' warm pools at the lots' corners.
    vec2 c = vec2(floor((p.x + 0.5 * LOT_X) / LOT_X) * LOT_X - 0.5 * LOT_X, floor(p.z / LOT_Z + 0.5) * LOT_Z);
    float d = length(p.xz - c);
    L = vec2(0.012, 0.002) + vec2(0.0, 0.22) * exp(-d * d / 10.0) + vec2(0.0, 2.0) * sline(d, max(0.3, px));
    // The cars in the streets along the rope: two lanes, two ways.
    float sx = floor((p.x + 0.5 * LOT_X) / LOT_X) * LOT_X - 0.5 * LOT_X;
    int si = int(floor((p.x + 0.5 * LOT_X) / LOT_X));
    float lane = p.x - sx;
    if (abs(lane) < 2.0) {
      float way = lane > 0.0 ? 1.0 : -1.0;
      float u = (p.z - way * 9.0 * WT) / 26.0 + hash1(si * 2 + (lane > 0.0 ? 1 : 0), 151u);
      float car = sline((fract(u) - 0.5) * 26.0, max(0.9, px)) * sline(abs(lane) - 1.0, max(0.35, px));
      float on = step(hash2(si, int(floor(u)) + (lane > 0.0 ? 7 : 0), 153u), 0.55);
      L += FOG.z * on * car * (lane > 0.0 ? vec2(0.05, 1.6) : vec2(0.9, 0.08));
    }
  } else if (kind == 3) {
    // The tram: its windows' warm band.
    L = vec2(0.02, 0.004) + vec2(0.0, 0.5) * band(p.y - STREET - 1.2, 1.0, px) * step(abs(n.y), 0.5);
  } else if (n.y > 0.5) {
    L = vec2(0.03, 0.004);
  } else {
    float u = abs(n.x) > 0.5 ? p.z : p.x;
    float fy = (p.y - STREET) / 3.4, fu = u / 2.0;
    int ci = int(floor(fu)), fi = int(floor(fy));
    int face = abs(n.x) > 0.5 ? (n.x > 0.0 ? 0 : 1) : (n.z > 0.0 ? 2 : 3);
    float lit = step(hash3(ci, fi, face, 81u), 0.06 + 0.25 * FOG.z);
    bool warm = hash3(ci, fi, face, 83u) < 0.7;
    float pane = 1.0 - max(band(fu + 0.1, 0.25, px / 2.0), band(fy + 0.15, 0.3, px / 3.4));
    L = vec2(0.016, 0.003) + lit * pane * (warm ? vec2(0.02, 0.5) : vec2(0.35, 0.02));
  }
  return L;
}

// Under the fog where it is open: a walk through the lots from just under
// its top down to the street, the field's towers going down through it.
vec2 passCity(Hit h, vec3 ro, vec3 rd) {
  if (h.kind != K_FOG || rd.y > -0.02 || FOG.y > 0.999) return vec2(0.0);
  vec3 pf = ro + rd * h.t;
  float open = 1.0 - fogSolid(pf.xz);
  if (open < 0.005) return vec2(0.0);
  float ts = (FOG.x - 4.0 - ro.y) / rd.y;
  float te = (STREET - ro.y) / rd.y;
  vec3 ird = safeInverse(rd);
  vec3 p = ro + rd * ts;
  float best = te;
  int kind = 2;
  vec3 nb = vec3(0.0, 1.0, 0.0);
  vec3 lo, hi;
  // The field's towers on their way down.
  ivec2 c = ivec2(floor((p.xz + 0.5 * CELL) / CELL));
  ivec2 st = ivec2(rd.x > 0.0 ? 1 : -1, rd.z > 0.0 ? 1 : -1);
  for (int s = 0 + ZERO; s < 4; s++) {
    Field f;
    if (fieldTower(c, f)) {
      lo = vec3(f.lo.x, STREET, f.lo.z);
      hi = vec3(f.hi.x, FOG.x, f.hi.z);
      vec2 b = slab(ro, ird, lo, hi);
      if (b.x < b.y && b.x < best && b.y > ts) {
        best = max(b.x, ts);
        kind = 1;
        nb = slabNormal(ro, rd, ird, lo, hi);
      }
    }
    vec2 edge = (vec2(c) + 0.5 * vec2(st)) * CELL;
    float tx = (edge.x - ro.x) * ird.x, tz = (edge.y - ro.z) * ird.z;
    if (min(tx, tz) >= best) break;
    if (tx < tz) c.x += st.x; else c.y += st.y;
  }
  int i = int(floor((p.x + 0.5 * LOT_X) / LOT_X));
  int j = int(floor(p.z / LOT_Z));
  int si = rd.x > 0.0 ? 1 : -1, sj = rd.z > 0.0 ? 1 : -1;
  float t = ts;
  tramBox(lo, hi);
  if (FOG.z > 0.0) {
    vec2 b = slab(ro, ird, lo, hi);
    if (b.x < b.y && b.x > ts && b.x < best) {
      best = b.x;
      kind = 3;
      nb = slabNormal(ro, rd, ird, lo, hi);
    }
  }
  for (int s = 0 + ZERO; s < 40; s++) {
    // Where the ray leaves this lot.
    float xe = float(i) * LOT_X + 0.5 * LOT_X * float(si);
    float ze = float(j + (sj > 0 ? 1 : 0)) * LOT_Z;
    float tx = (xe - ro.x) * ird.x, tz = (ze - ro.z) * ird.z;
    float tout = min(tx, tz);
    if (lot(i, j, lo, hi)) {
      vec2 b = slab(ro, ird, lo, hi);
      if (b.x < b.y && b.x < best && b.y > t) {
        best = max(b.x, t);
        kind = 1;
        nb = slabNormal(ro, rd, ird, lo, hi);
      }
    }
    if (tout >= best) break;
    t = tout;
    if (tx < tz) i += si; else j += sj;
  }
  vec3 q = ro + rd * best;
  vec2 L = cityLight(q, nb, best, kind);
  // The fog's own gloom between its top and what lies under it.
  float under = exp(-(best - ts) * 0.012);
  L = L * under + (1.0 - under) * vec2(0.05, 0.012);
  return L * open * hazeLeft(ro, rd, h.t) * (1.0 - h.cov);
}
#endif

#if defined(PASS_AIR) || defined(PASS_ALL)

// A small light's glare through the lens: constant in angle.
float glare(vec3 ro, vec3 rd, vec3 c, float T) {
  vec3 oc = c - ro;
  float b = dot(oc, rd);
  if (b <= 0.0 || b > T + 0.2) return 0.0;
  float a2 = max(dot(oc, oc) - b * b, 0.0) / (b * b);
  return (2e-5 / (a2 + 2e-5) + 0.12 * 4e-4 / (a2 + 4e-4)) * exp(-HAZE * b);
}

// The ray's nearest pass by the circle of radius r round c across `axis`,
// in front of T: how far from the circle (in its cross-section), where
// along the ray, and its point there in the circle's own frame (x along
// `zero`, y along the axis, z along cross(axis, zero)).
float ringPass(vec3 ro, vec3 rd, vec3 c, vec3 axis, vec3 zero, float r, float T, out float tb, out vec3 q) {
  vec3 side = cross(axis, zero);
  vec3 o = ro - c;
  vec3 lo = vec3(dot(o, zero), dot(o, axis), dot(o, side));
  vec3 ld = vec3(dot(rd, zero), dot(rd, axis), dot(rd, side));
  float best = 1e3;
  tb = -1.0;
  q = vec3(r, 0.0, 0.0);
  if (abs(ld.y) > 1e-4) {
    float t = -lo.y / ld.y;
    if (t > 0.05 && t < T) {
      vec3 p = lo + ld * t;
      float e = abs(length(p.xz) - r);
      if (e < best) {
        best = e;
        tb = t;
        q = p;
      }
    }
  }
  float a = dot(ld.xz, ld.xz), b = dot(lo.xz, ld.xz), cc = dot(lo.xz, lo.xz) - r * r;
  float dd = b * b - a * cc;
  if (dd > 0.0 && a > 1e-6) {
    float sq = sqrt(dd);
    for (int k = 0 + ZERO; k < 2; k++) {
      float t = (-b + (k == 0 ? -sq : sq)) / a;
      if (t <= 0.05 || t > T) continue;
      vec3 p = lo + ld * t;
      float e = abs(p.y);
      if (e < best) {
        best = e;
        tb = t;
        q = p;
      }
    }
  }
  return best;
}
// Where the ray crosses the plane through c across `axis`, in its frame as
// above; below 0 where it does not in front of T.
float planeCross(vec3 ro, vec3 rd, vec3 c, vec3 axis, vec3 zero, float T, out vec3 q) {
  vec3 side = cross(axis, zero);
  vec3 o = ro - c;
  float dy = dot(rd, axis);
  q = vec3(0.0);
  if (abs(dy) < 1e-4) return -1.0;
  float t = -dot(o, axis) / dy;
  if (t <= 0.05 || t > T) return -1.0;
  vec3 p = o + rd * t;
  q = vec3(dot(p, zero), 0.0, dot(p, side));
  return t;
}

// The first ring, the world round him: a wide orbit at the height of his
// eyes with beads that turn with the world and ticks round it. Where the
// world touches it (a sound, a wing, a light) it flares, two pulses run
// round it both ways and a ripple goes out over its plane.
float ringOne(vec3 ro, vec3 rd, float T) {
  float lit = RING1.z + BEAT.z;
  bool touched = RINGEV.y < 8.0 || RINGEV.w < 8.0;
  if (lit < 0.004 && !touched) return 0.0;
  vec3 c = vec3(SPHERE.x, RING1.x, SPHERE.z);
  vec3 axis = vec3(0.0, 1.0, 0.0), zero = vec3(0.0, 0.0, 1.0);
  float r = RING1.y;
  float tb;
  vec3 q;
  float e = ringPass(ro, rd, c, axis, zero, r, T, tb, q);
  float L = 0.0;
  float show = min(1.0, 0.25 + 1.5 * lit);
  if (tb > 0.0) {
    float px = pixelAt(tb);
    float ang = atan(q.z, q.x);
    float de = length(vec2(length(q.xz) - r, q.y));
    L += lit * 0.2 * lineK(de, 0.006, px);
    float cell = TAU / 36.0;
    float arc = (fract((ang - RING1.w) / cell) - 0.5) * cell * r;
    L += lit * 0.45 * lineK(length(vec2(arc, de)), 0.016, px);
    for (int i = 0 + ZERO; i < 2; i++) {
      vec2 ev = i == 0 ? RINGEV.xy : RINGEV.zw;
      if (ev.y > 8.0) continue;
      float flash = exp(-ev.y / 0.45);
      L += show * 1.3 * flash * lineK(length(vec2(angleTo(ang, ev.x) * r, de)), 0.02 + 0.05 * (1.0 - flash), px);
      float run = 1.4 * ev.y;
      float fade = exp(-ev.y / 2.0) * smoothstep(0.0, 0.1, ev.y);
      float w = 0.06 + 0.05 * ev.y;
      L += show * 0.8 * fade * (lineK(length(vec2(angleTo(ang, ev.x + run) * r, de)), w, px)
                               + lineK(length(vec2(angleTo(ang, ev.x - run) * r, de)), w, px));
    }
  }
  // In its plane: the ticks, and the ripples out from the touches.
  vec3 qp;
  float tp = planeCross(ro, rd, c, axis, zero, T, qp);
  if (tp > 0.0) {
    float px = pixelAt(tp);
    float rho = length(qp.xz);
    float ang = atan(qp.z, qp.x);
    float cell = TAU / 120.0;
    float arc = (fract((ang - RING1.w) / cell) - 0.5) * cell * rho;
    float major = step(fract((ang - RING1.w) / (cell * 5.0) + 0.1), 0.2);
    float len = major > 0.5 ? 0.14 : 0.07;
    L += lit * 0.25 * lineK(arc, 0.004, px) * smoothstep(r + 0.015, r + 0.03, rho) * smoothstep(r + len + px, r + len - px, rho);
    for (int i = 0 + ZERO; i < 2; i++) {
      vec2 ev = i == 0 ? RINGEV.xy : RINGEV.zw;
      if (ev.y > 4.0) continue;
      vec2 at = r * vec2(cos(ev.x), sin(ev.x));
      float d = abs(length(qp.xz - at) - 1.7 * ev.y);
      L += show * 0.5 * exp(-ev.y / 1.1) * lineK(d, 0.012 + 0.02 * ev.y, px);
    }
  }
  return L;
}

// The second ring, inside him: it scans him from his soles to his crown
// and back, hugging him, flaring with each beat of his heart, an echo going
// out from it with the beat; the heart's own glow; and round his head the
// sparks of his thoughts.
float ringTwo(vec3 ro, vec3 rd, float T) {
  float lit = RING2B.x + BEAT.z;
  float L = 0.0;
  if (lit > 0.004) {
    vec3 c = RING2.xyz;
    vec3 axis = vec3(0.0, 1.0, 0.0), zero = vec3(0.0, 0.0, 1.0);
    float r = RING2.w;
    float hb = RING2B.y;
    float tb;
    vec3 q;
    float e = ringPass(ro, rd, c, axis, zero, r, T, tb, q);
    if (tb > 0.0) {
      float de = length(vec2(length(q.xz) - r, q.y));
      L += lit * (0.3 + 1.1 * hb) * lineK(de, 0.005, pixelAt(tb));
    }
    vec3 qp;
    float tp = planeCross(ro, rd, c, axis, zero, T, qp);
    if (tp > 0.0) {
      float s = mod(TIME, HEART);
      float d = abs(length(qp.xz) - r - 0.7 * s);
      L += lit * 0.5 * exp(-s / 0.22) * lineK(d, 0.008, pixelAt(tp));
    }
    // The heart: its glow through him.
    L += lit * (0.15 + 0.6 * hb) * glare(ro, rd, HEART_AT.xyz, 1e5) * 0.5;
  }
  float a = BEAT.w;
  if (a > 0.01) {
    vec3 hc = vec3(HEART_AT.x, FIG_HI.y - 0.12, HEART_AT.z);
    vec3 prev = hc;
    float prevOn = 0.0;
    for (int i = 0 + ZERO; i < 16; i++) {
      float h1 = hash1(i, 201u), h2 = hash1(i, 203u), h3 = hash1(i, 205u);
      float th = TAU * h1 + 0.5 * TIME * (h3 - 0.5);
      float ph = acos(1.0 - 1.3 * h2);
      float rr = 0.2 + 0.22 * h3;
      vec3 p = hc + rr * vec3(sin(ph) * sin(th), cos(ph), sin(ph) * cos(th));
      float on = smoothstep(0.55, 1.0, sin(TIME * (2.5 + 4.0 * h1) + 40.0 * h2));
      vec3 v = p - ro;
      float b = dot(v, rd);
      if (b > 0.05 && b < T + 0.3) {
        L += a * on * 1.1 * lineK(length(v - rd * b), 0.006, pixelAt(b));
      }
      if (i > 0 && on * prevOn > 0.01) {
        vec3 qq;
        vec2 cl = closest(ro, rd, prev, p, qq);
        if (cl.x < T) L += a * on * prevOn * 0.3 * lineK(cl.y, 0.0015, pixelAt(cl.x));
      }
      prev = p;
      prevOn = on;
    }
  }
  return L;
}

// The third ring, his step: a wheel standing round him along the rope,
// rolling as he goes; it flares at each step where it meets the rope.
float ringThree(vec3 ro, vec3 rd, float T) {
  float lit = RING3.z + BEAT.z;
  if (lit < 0.004) return 0.0;
  vec3 c = SPHERE.xyz;
  vec3 axis = vec3(1.0, 0.0, 0.0), zero = vec3(0.0, -1.0, 0.0);
  float r = RING3.y;
  float step_ = exp(-BEAT.x / 0.3);
  float L = 0.0;
  float tb;
  vec3 q;
  float e = ringPass(ro, rd, c, axis, zero, r, T, tb, q);
  if (tb > 0.0) {
    float px = pixelAt(tb);
    float ang = atan(q.z, q.x);
    float de = length(vec2(length(q.xz) - r, q.y));
    L += lit * (0.22 + 0.5 * step_) * lineK(de, 0.006, px);
    float cell = TAU / 24.0;
    float arc = (fract((ang + RING3.w) / cell) - 0.5) * cell * r;
    L += lit * 0.4 * lineK(length(vec2(arc, de)), 0.012, px);
    L += lit * 2.0 * step_ * lineK(length(vec2(angleTo(ang, 0.0) * r, de)), 0.025 + 0.05 * (1.0 - step_), px);
  }
  vec3 qp;
  float tp = planeCross(ro, rd, c, axis, zero, T, qp);
  if (tp > 0.0) {
    float rho = length(qp.xz);
    if (rho < r) {
      float a = atan(qp.z, qp.x) + RING3.w;
      float sa = (fract(a / (TAU / 8.0)) - 0.5) * (TAU / 8.0);
      L += lit * (0.1 + 0.2 * step_) * lineK(rho * abs(sin(sa)), 0.0025, pixelAt(tp)) * smoothstep(0.08, 0.3, rho);
    }
  }
  return L;
}

// The sphere they lie on: its glass shows only where the eye grazes it,
// and its meridians and parallels while the three ring together.
float glassAir(vec3 ro, vec3 rd, float T) {
  float g = SPHERE.w;
  if (g < 0.004) return 0.0;
  vec3 C = SPHERE.xyz;
  float R = SPHERE_R;
  vec3 oc = ro - C;
  float b = dot(oc, rd);
  float disc = b * b - (dot(oc, oc) - R * R);
  if (disc <= 0.0) return 0.0;
  float sq = sqrt(disc);
  float L = 0.0;
  for (int k = 0 + ZERO; k < 2; k++) {
    float t = k == 0 ? -b - sq : -b + sq;
    if (t <= 0.05 || t > T) continue;
    vec3 nr = (ro + rd * t - C) / R;
    float px = pixelAt(t);
    float glass = 0.004 / max(abs(dot(rd, nr)), 0.06);
    float lat = asin(clamp(nr.y, -1.0, 1.0)), lon = atan(nr.x, nr.z) + 0.5 * RING1.w;
    float dl = abs(fract(lon / (TAU / 16.0)) - 0.5) * (TAU / 16.0) * R * cos(lat);
    float dp = abs(fract(lat / (PI / 10.0)) - 0.5) * (PI / 10.0) * R;
    float grid = lineK(min(dl, dp), 0.003, px);
    L += (glass + 0.25 * grid) * (k == 0 ? 1.0 : 0.6);
  }
  return g * L;
}

// The lamps: the rope's towers' corners all blinking at once, the masts'
// slow red, the field's spires near the eye each in its own time.
float beacons(vec3 ro, vec3 rd, float T) {
  float L = 0.0;
  float kw = floor(ROPE.x / SPAN);
  float on = step(fract(WT / 1.6), 0.16);
  if (on > 0.0) {
    for (int i = 0 + ZERO; i < 20; i++) {
      float k = kw - 1.0 + float(i / 4);
      int c = pm(i, 4);
      vec3 p = vec3((c & 1) == 0 ? -TOWER_X : TOWER_X, 0.35, k * SPAN + ((c & 2) == 0 ? -TOWER_Z : TOWER_Z));
      L += 0.5 * glare(ro, rd, p, T);
    }
  }
  for (int i = 0 + ZERO; i < 5; i++) {
    float k = kw - 1.0 + float(i);
    if (k == 1.0) continue;
    float ph = fract(WT / 2.4 + 0.37 * k);
    float blink = smoothstep(0.0, 0.06, ph) * (1.0 - smoothstep(0.3, 0.5, ph));
    L += 0.9 * blink * glare(ro, rd, vec3(-2.38, 6.95, k * SPAN + 1.66), T);
  }
  ivec2 c0 = ivec2(floor((ro.xz + 0.5 * CELL) / CELL));
  for (int i = 0 + ZERO; i < 49; i++) {
    ivec2 c = c0 + ivec2(pm(i, 7) - 3, i / 7 - 3);
    Field f;
    if (!fieldTower(c, f) || f.spire < -1e2) continue;
    float ph = fract(WT / 2.0 + hash2(c.x, c.y, 401u));
    float blink = smoothstep(0.0, 0.05, ph) * (1.0 - smoothstep(0.22, 0.4, ph));
    L += 1.2 * blink * glare(ro, rd, vec3(f.centre.x, f.spire + 0.3, f.centre.y), T);
  }
  return L;
}

// The air round him: the gust's streaks along the wind, and motes hanging
// in the light (frozen with the world when it stops).
vec2 airRound(vec3 ro, vec3 rd, float T) {
  vec2 L = vec2(0.0);
  vec3 s = sunDir();
  vec3 c = SPHERE.xyz + vec3(0.0, 0.6, 0.0);
  if (ROPE.w > 0.02) {
    vec3 wd = normalize(vec3(WIND_X, -0.04, WIND_Z));
    for (int i = 0 + ZERO; i < 18; i++) {
      vec3 h = vec3(hash1(i, 311u), hash1(i, 313u), hash1(i, 315u));
      vec3 at = c + (h - 0.5) * vec3(7.0, 3.5, 7.0);
      float ph = fract(WT * (0.7 + 0.4 * h.x) + h.y);
      vec3 a = at + wd * (ph - 0.5) * 12.0;
      vec3 q;
      vec2 cl = closest(ro, rd, a, a + wd * (1.0 + 1.5 * h.z), q);
      if (cl.x < T) L.x += ROPE.w * 0.22 * sin(PI * ph) * lineK(cl.y, 0.002, pixelAt(cl.x));
    }
  }
  vec3 box = vec3(9.0, 5.0, 9.0);
  vec3 drift = vec3(WIND_X, 0.06, WIND_Z) * 0.5;
  float toward = pow(max(dot(rd, s), 0.0), 2.0);
  for (int i = 0 + ZERO; i < 40; i++) {
    vec3 h = vec3(hash1(i, 321u), hash1(i, 323u), hash1(i, 325u));
    vec3 rel = mod(h * box * 7.0 + drift * WT - c, box) - 0.5 * box;
    vec3 f = abs(rel / box);
    float fade = smoothstep(0.5, 0.38, max(max(f.x, f.y), f.z));
    vec3 v = c + rel - ro;
    float b = dot(v, rd);
    if (b < 0.15 || b > T) continue;
    float tw = 0.5 + 0.5 * sin(WT * (1.3 + 2.0 * h.x) + 30.0 * h.y);
    float k = lineK(length(v - rd * b), 0.003, pixelAt(b)) * fade;
    L += k * (vec2(0.14, 0.0) * (0.4 + 0.6 * tw) + SUN.w * vec2(0.02, 0.9) * tw * (0.25 + toward));
  }
  return L;
}

// The low sun's glare, the lamps, the three rings, the sphere, the air.
vec2 air(vec3 ro, vec3 rd, float T, bool sky_) {
  vec2 L = vec2(0.0);
  vec3 s = sunDir();
  float a = acos(clamp(dot(rd, s), -1.0, 1.0));
  float g = sunShows() * (sky_ ? 1.0 : 0.4);
  L += g * (vec2(0.04, 0.5) * 3e-5 / (a * a + 3e-5) + vec2(0.01, 0.07) * exp(-a / 0.15));
  L.y += beacons(ro, rd, T);
  L.x += ringOne(ro, rd, T) + ringTwo(ro, rd, T) + ringThree(ro, rd, T) + glassAir(ro, rd, T);
  L += airRound(ro, rd, T);
  return L;
}
#endif

#if defined(PASS_GHOST) || defined(PASS_ALL)

// The double's own point for a world point p: him raised and wavering.
vec3 ghostAt(vec3 p) {
  vec3 q = p - vec3(0.0, DOUBLE.x, 0.0);
  q.x += DOUBLE.z * 0.035 * sin(q.y * 9.0 + TIME * 5.0);
  q.z += DOUBLE.z * 0.025 * sin(q.y * 6.0 - TIME * 3.7);
  return q;
}

// The double that rises out of him and is drawn back: pale, its outline
// lit, a haze round it, shimmering.
vec2 passGhost(Hit h, vec3 ro, vec3 rd) {
  if (DOUBLE.y < 0.005) return vec2(0.0);
  vec3 ird = safeInverse(rd);
  vec3 off = vec3(0.0, DOUBLE.x, 0.0);
  vec2 b = slab(ro, ird, FIG_LO.xyz + off - 0.12, FIG_HI.xyz + off + 0.12);
  float T = h.kind == K_SKY ? 1e5 : h.t;
  float t = max(b.x, 0.12), end = min(b.y, T);
  if (t >= end) return vec2(0.0);
  float dmin = 1e3;
  bool hit = false;
  for (int s = 0 + ZERO; s < 48; s++) {
    float d = figure(ghostAt(ro + rd * t));
    dmin = min(dmin, d);
    if (d < 0.001 * t + 0.0005) {
      hit = true;
      break;
    }
    t += max(d * 0.8, 0.004);
    if (t > end) break;
  }
  float L = 0.05 * exp(-max(dmin, 0.0) / 0.04);
  if (hit) {
    vec3 p = ghostAt(ro + rd * t);
    const float e = 0.002;
    vec3 n = vec3(0.0);
    for (int i = 0 + ZERO; i < 4; i++) {
      vec3 k = vec3(float(((i + 3) >> 1) & 1), float((i >> 1) & 1), float(i & 1)) * 2.0 - 1.0;
      n += k * figure(p + k * e);
    }
    n = normalize(n);
    float rim = pow(1.0 - abs(dot(n, rd)), 2.5);
    L += (0.03 + 0.45 * rim) * (0.8 + 0.2 * sin(p.y * 70.0 + TIME * 9.0));
  }
  return vec2(L * DOUBLE.y, 0.0);
}
#endif

// ---- the passes ----

// The world's frame from the light and the eye's own hit (or the line in
// front of it, where it covers most of the pixel): its depth and the
// lens's blur.
vec4 worldPixel(vec2 L, Hit h) {
  float t = h.cov > 0.3 ? h.lt : (h.kind == K_SKY ? 1e4 : h.t);
  float z = t * dot(eyeRay(), FWD.xyz);
  float blur = min(blurAt(z), BLUR_MAX) / BLUR_MAX;
  return vec4(max(L, 0.0) * u_res.z, z / (z + 8.0), blur);
}

#if defined(PASS_HITS)
// Records: what the ray met (how far, what, which tower), which line is in
// front and how much of the pixel it covers; its normal and the line's
// distance; the line's normal.
void main() {
  Hit h = trace(EYE.xyz, eyeRay());
  o0 = vec4(h.t, float(h.kind), h.k, float(h.lk) * 2.0 + h.cov);
  o1 = vec4(h.n, h.lt);
  o2 = vec4(h.ln, 0.0);
}

#elif defined(PASS_ALL)
void main() {
  vec3 ro = EYE.xyz, rd = eyeRay();
  Hit h = trace(ro, rd);
  vec2 L = passFog(h, ro, rd) + passSet(h, ro, rd) + passFigure(h, ro, rd) + passCity(h, ro, rd);
  L += air(ro, rd, h.kind == K_SKY ? 1e5 : h.t, h.kind == K_SKY) + passGhost(h, ro, rd);
  o = worldPixel(L, h);
}

#else
Hit fromRecords() {
  ivec2 px = ivec2(gl_FragCoord.xy);
  vec4 a = texelFetch(u_h0, px, 0);
  vec4 b = texelFetch(u_h1, px, 0);
  vec4 c = texelFetch(u_h2, px, 0);
  Hit h = noHit();
  h.t = a.x;
  h.kind = int(a.y + 0.5);
  h.k = a.z;
  h.lk = int(floor(a.w * 0.5));
  h.cov = a.w - 2.0 * float(h.lk);
  h.n = b.xyz;
  h.lt = b.w;
  h.ln = c.xyz;
  return h;
}

void main() {
  vec3 ro = EYE.xyz, rd = eyeRay();
  Hit h = fromRecords();
#if defined(PASS_FOG)
  o = worldPixel(passFog(h, ro, rd), h);
#elif defined(PASS_SET)
  o = vec4(max(passSet(h, ro, rd), 0.0) * u_res.z, 0.0, 0.0);
#elif defined(PASS_FIGURE)
  o = vec4(max(passFigure(h, ro, rd), 0.0) * u_res.z, 0.0, 0.0);
#elif defined(PASS_CITY)
  o = vec4(max(passCity(h, ro, rd), 0.0) * u_res.z, 0.0, 0.0);
#elif defined(PASS_AIR)
  float T = h.kind == K_SKY ? 1e5 : h.t;
  o = vec4(max(air(ro, rd, T, h.kind == K_SKY), 0.0) * u_res.z, 0.0, 0.0);
#elif defined(PASS_GHOST)
  o = vec4(max(passGhost(h, ro, rd), 0.0) * u_res.z, 0.0, 0.0);
#endif
}
#endif
