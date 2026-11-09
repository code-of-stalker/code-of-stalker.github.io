// Dawn over the fog, one ray a pixel: the sky with its cloud bank and the
// low sun, the far towers by direction, the sea of fog with his shadow and
// the glory on it, the towers and the rope from roof to roof, the pole, the
// walker, the city waking under the fog through its holes, and in the air
// the sphere round him with its three rings, the sun's glare, the roofs'
// lamps and the birds. Writes cold light, warm light, depth (z / (z + 8))
// and the lens's blur.
//
// It is drawn in passes (browser.rs puts one PASS_ define in front), so
// D3D's shader compiler (Chrome on Windows) builds each in seconds:
// PASS_HITS traces the eye's ray and writes what it met and the nearest
// line in front of it (three float frames); PASS_FOG (the sky, the fog, the
// haze; it writes the depth and the blur), PASS_SET (the towers, the rope,
// the pole), PASS_FIGURE (him), PASS_CITY (under the fog) and PASS_AIR add
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
#define LINE_ROPE 1
#define LINE_POLE 2

// How deep the towers go into the fog before the fog hides them.
#define TOWER_FOOT (FOG.x - 10.0)
// The billows' reach over and under the fog's top.
#define BILLOW 4.6

struct Hit {
  float t;
  int kind;
  vec3 n;
  float k;     // the tower's index along the rope
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

float window(float t, float a, float b, float c, float d) {
  return smoothstep(a, b, t) * (1.0 - smoothstep(c, d, t));
}
// A line w wide at distance e from it.
float sline(float e, float w) {
  float x = e / w;
  return exp(-x * x);
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
// Tower k's box: one stands every SPAN along the rope.
void towerBox(float k, out vec3 lo, out vec3 hi) {
  lo = vec3(-TOWER_X, TOWER_FOOT, k * SPAN - TOWER_Z);
  hi = vec3(TOWER_X, 0.0, k * SPAN + TOWER_Z);
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

// The towers in the ray's order along the rope, the first it meets.
void traceTowers(vec3 ro, vec3 rd, vec3 ird, inout Hit h) {
  // The prism they all stand in.
  vec2 tx = (vec2(-TOWER_X, TOWER_X) - ro.x) * ird.x;
  vec2 ty = (vec2(TOWER_FOOT, 0.0) - ro.y) * ird.y;
  float ta = max(max(min(tx.x, tx.y), min(ty.x, ty.y)), 0.0);
  float tb = min(min(max(tx.x, tx.y), max(ty.x, ty.y)), h.t);
  if (ta >= tb) return;
  float ka = floor((ro.z + rd.z * ta) / SPAN + 0.5);
  float kb = floor((ro.z + rd.z * tb) / SPAN + 0.5);
  float dir = kb >= ka ? 1.0 : -1.0;
  for (int i = 0 + ZERO; i < 12; i++) {
    float k = ka + dir * float(i);
    if ((k - kb) * dir > 0.0) return;
    vec3 lo, hi;
    towerBox(k, lo, hi);
    vec2 b = slab(ro, ird, lo, hi);
    if (b.x < b.y && b.y > 0.0 && b.x < h.t) {
      h.t = max(b.x, 0.0);
      h.kind = K_TOWER;
      h.k = k;
      h.n = slabNormal(ro, rd, ird, lo, hi);
      return;
    }
  }
}

// The fog's billowed top: marched through the billows' band, then refined.
void traceFog(vec3 ro, vec3 rd, inout Hit h) {
  if (rd.y > -1e-4) return;
  float t0 = (FOG.x + BILLOW - ro.y) / rd.y;
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
// of the pixel in front of what the ray met.
void lineSegment(vec3 ro, vec3 rd, vec3 a, vec3 b, float r, int kind, inout Hit h) {
  vec3 q;
  vec2 c = closest(ro, rd, a, b, q);
  if (c.x >= h.t || c.x >= h.lt || c.x < 0.05) return;
  float pw = pixelAt(c.x);
  float w = max(2.0 * r, pw);
  float cov = clamp((0.5 * w + 0.5 * pw - c.y) / pw, 0.0, 1.0) * (2.0 * r / w);
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
      lineSegment(ro, rd, prev, cur, ROPE_R, LINE_ROPE, h);
      prev = cur;
    }
  }
  if (POLE_C.w > 0.01 && near(ro, rd, poleAt(-1.0), poleAt(1.0), POLE_H.w + 0.2, h.t)) {
    vec3 prev = poleAt(-1.0);
    for (int j = 1 + ZERO; j <= 6; j++) {
      vec3 cur = poleAt(-1.0 + float(j) / 3.0);
      lineSegment(ro, rd, prev, cur, POLE_R, LINE_POLE, h);
      prev = cur;
    }
  }
}

Hit trace(vec3 ro, vec3 rd) {
  Hit h = noHit();
  vec3 ird = safeInverse(rd);
  traceFog(ro, rd, h);
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
// What the haze adds on the way to a hit t away and what it leaves of it.
vec2 hazeOver(vec3 ro, vec3 rd, float t, out float T) {
  T = hazeLeft(ro, rd, t);
  return (1.0 - T) * horizonSky(rd);
}

#if defined(PASS_FOG) || defined(PASS_ALL)

// The towers far off across the fog, by direction alone (so they never
// move as he crosses): two rows of tops over the fog's horizon, the
// nearer taller, both blue with distance.
vec2 skyline(vec3 rd, vec2 L) {
  float az = atan(rd.x, rd.z);
  float e = rd.y / max(length(rd.xz), 1e-3);
  if (e > 0.045 || e < -0.004) return L;
  vec3 s = sunDir();
  float lit = max(-dot(normalize(rd.xz), normalize(s.xz)), 0.0);
  for (int row = 0 + ZERO; row < 2; row++) {
    float density = row == 0 ? 60.0 : 23.0;
    float x = az * density;
    int cell = int(floor(x));
    uint salt = row == 0 ? 51u : 53u;
    if (hash1(cell, salt) > (row == 0 ? 0.62 : 0.4)) continue;
    float wide = mix(0.3, 0.8, hash1(cell, salt + 1u));
    float f = fract(x);
    float top = row == 0 ? mix(0.004, 0.016, hash1(cell, salt + 2u))
                         : mix(0.008, 0.034, pow(hash1(cell, salt + 2u), 1.5));
    float px = 2.0 / (VIEW.y * u_res.y);
    float inside = smoothstep(0.0, 0.08, f) * smoothstep(wide, wide - 0.08, f)
                 * smoothstep(top + px, top - px, e);
    float keep = row == 0 ? 0.12 : 0.3;
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

// His shadow on the fog, the persona, at q (metres of him on the shadow's
// plane, his head at 0): how dark, 0 … 1; soft as it comes apart.
float persona(vec2 q) {
  if (any(lessThan(q, SHADOW_BOX.xy)) || any(greaterThan(q, SHADOW_BOX.zw))) return 0.0;
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
  float soft = 0.06 + 0.5 * SHADOW.y;
  return 1.0 - smoothstep(-soft, soft, d);
}

// The fog's top at p: the sky's cold light from above, the low sun warm on
// the billows' sides that face it and bright where the eye looks toward
// it, his shadow and the glory round its head away from the sun, a little
// warm from the waking city through it. Its share of the pixel is
// `solid`; the city shows through the rest.
vec2 fogLight(vec3 p, vec3 n, vec3 rd, out float solid, out float shade) {
  vec3 s = sunDir();
  solid = fogSolid(p.xz);
  // The billows' crests catch the light, their troughs keep the night.
  float crest = clamp((p.y - FOG.x) / 7.0 + 0.5, 0.0, 1.0);
  float toward = max(dot(rd, s), 0.0);
  vec2 L = vec2(0.09 + 0.12 * crest * (0.6 + 0.4 * n.y) + 0.1 * toward * toward,
                0.008 + 0.03 * pow(toward, 3.0))
         + SUN.w * vec2(0.05 + 0.08 * crest, 0.05 + 0.5 * max(dot(n, s), 0.0) * crest + 0.6 * pow(toward, 6.0));
  // Where the fog thins it darkens toward the city's dusk under it.
  L *= mix(0.6, 1.0, solid);
  shade = 0.0;
  // The shadow and the glory, round the point away from the sun.
  vec3 a = -s;
  vec3 e1 = normalize(cross(a, vec3(0.0, 1.0, 0.0)));
  vec3 e2 = cross(e1, a);
  float ra = dot(rd, a);
  if (ra > 0.2) {
    vec2 uv = vec2(dot(rd, e1), dot(rd, e2)) / ra;
    float sh = SHADOW.x * (1.0 - SHADOW.y) * persona(uv / SHADOW.w);
    shade = sh * solid;
    L.y *= 1.0 - 0.9 * sh;
    L.x *= 1.0 - 0.75 * sh;
    // The glory, in metres of him round his shadow's head.
    float rho = length(uv) / SHADOW.w;
    float g = SUN.w * window(TIME, 30.0, 34.0, 64.0, 69.0) * (0.6 + 0.4 * SHADOW.y);
    L += g * (vec2(0.06, 0.12) * exp(-rho / 0.14)
              + vec2(0.0, 0.25) * sline(rho - 0.22, 0.036)
              + vec2(0.2, 0.0) * sline(rho - 0.29, 0.04)
              + vec2(0.0, 0.15) * sline(rho - 0.36, 0.046));
  }
  L.y += FOG.z * 0.02 * (1.0 - 0.5 * solid);
  return L * solid;
}

// The sky, the fog and the haze over every hit (and the line's share).
vec2 passFog(Hit h, vec3 ro, vec3 rd) {
  float keep = 1.0 - h.cov;
  if (h.kind == K_SKY) return skyLight(rd) * keep;
  float T;
  vec2 L = hazeOver(ro, rd, h.t, T);
  if (h.kind == K_FOG) {
    // His shadow darkens the haze over it as well.
    float solid, shade;
    vec2 fog = fogLight(ro + rd * h.t, h.n, rd, solid, shade);
    L = L * (1.0 - 0.5 * shade) + fog * T;
  }
  return L * keep;
}
#endif

#if defined(PASS_SET) || defined(PASS_ALL)

// A tower at p: dark glass in fine mullions floor by floor with the sky
// and the sun in it and a few windows lit as the city wakes; its roof with
// the edge lit; fading into the fog at its foot and, far off, into the
// haze of the horizon.
vec2 towerLight(vec3 p, vec3 n, vec3 rd, float t, float k) {
  vec3 s = sunDir();
  float px = pixelAt(t);
  float sunOn = max(dot(n, s), 0.0);
  vec2 L;
  if (n.y > 0.5) {
    float edge = min(TOWER_X - abs(p.x), TOWER_Z - abs(p.z - k * SPAN));
    L = 0.1 * (vec2(0.32, 0.03) + SUN.w * vec2(0.05, 2.4) * max(s.y, 0.0) * 4.0)
      + sline(edge, max(0.03, px)) * (vec2(0.05, 0.0) + SUN.w * vec2(0.02, 0.5));
  } else {
    // The face's own across (u) and up (y).
    float u = abs(n.x) > 0.5 ? p.z - k * SPAN : p.x;
    float fy = p.y / 3.6, fu = u / 1.07;
    float mullion = max(band(fu + 0.04, 0.08, px / 1.07), band(fy + 0.06, 0.12, px / 3.6));
    vec3 r = reflect(rd, n);
    float cosv = max(dot(-rd, n), 0.0);
    float F = 0.04 + 0.96 * pow(1.0 - cosv, 5.0);
    vec2 seen = r.y > -0.02 ? sky(r) : vec2(0.22, 0.01) + SUN.w * vec2(0.02, 0.12);
    seen += SUN.w * sunShows() * vec2(2.0, 12.0) * pow(max(dot(r, s), 0.0), 900.0);
    // Behind the glass: dark, or lit as the city wakes.
    int face = abs(n.x) > 0.5 ? (n.x > 0.0 ? 0 : 1) : (n.z > 0.0 ? 2 : 3);
    float lit = step(hash3(int(floor(fu)), int(floor(fy)), face, 61u), 0.03 + 0.1 * FOG.z);
    bool warm = hash3(int(floor(fu)), int(floor(fy)), face, 63u) < 0.7;
    vec2 inside = vec2(0.005, 0.002) + lit * (warm ? vec2(0.01, 0.08) : vec2(0.07, 0.01));
    vec2 glass = 0.5 * F * seen + (1.0 - F) * inside;
    vec2 frame = 0.14 * (vec2(0.3 + 0.1 * n.y, 0.03) + SUN.w * vec2(0.08, 1.6) * sunOn);
    L = mix(glass, frame, mullion);
    // Its foot in the fog.
    float sunk = smoothstep(FOG.x + 7.0, FOG.x - 1.0, p.y);
    L = mix(L, vec2(0.2, 0.01) + SUN.w * vec2(0.02, 0.1), sunk);
  }
  // Far off, the towers pale into the horizon's haze.
  return mix(L, horizonSky(rd), 0.9 * smoothstep(40.0, 140.0, t));
}

// The rope and the pole at the line's point: dark against the sky, lit
// warm from behind where the eye looks toward the sun.
vec2 lineLight(vec3 n, vec3 rd, int kind) {
  vec3 s = sunDir();
  float toward = max(dot(rd, s), 0.0);
  float rim = pow(1.0 - max(dot(-rd, n), 0.0), 2.0);
  float albedo = kind == LINE_POLE ? 0.14 : 0.08;
  // The rope's sheen from the sky keeps it apart from the dark glass.
  float sheen = kind == LINE_ROPE ? 0.05 + 0.12 * max(n.y, 0.0) : 0.0;
  vec2 L = albedo * vec2(0.25 + 0.15 * n.y, 0.03) + vec2(sheen, 0.0)
         + SUN.w * vec2(0.01, albedo * 3.0 * max(dot(n, s), 0.0))
         + SUN.w * vec2(0.02, 0.9) * pow(toward, 8.0) * (0.3 + rim);
  return L;
}

vec2 passSet(Hit h, vec3 ro, vec3 rd) {
  vec2 L = vec2(0.0);
  if (h.kind == K_TOWER) {
    float T = hazeLeft(ro, rd, h.t);
    L += towerLight(ro + rd * h.t, h.n, rd, h.t, h.k) * T * (1.0 - h.cov);
  }
  if (h.lk > 0) {
    float T;
    vec2 haze = hazeOver(ro, rd, h.lt, T);
    L += h.cov * (lineLight(h.ln, rd, h.lk) * T + haze);
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
// Whether p is skin: the head and the hands.
bool skin(vec3 p, float d) {
  float near_ = d + 0.012;
  return (FIG_LO.w < 0.5 && cone(CONE_HEAD, p) < near_) || cone(CONE_HAND_L, p) < near_ || cone(CONE_HAND_R, p) < near_;
}

// Him: matte, lit by the cold sky and the fog under him, the low sun warm
// on his back and round his outline; the second ring round his body; the
// light that wakes in his soles and rises to his crown.
vec2 figureLight(vec3 p, vec3 rd) {
  float d;
  vec3 n = figureNormal(p, d);
  vec3 s = sunDir();
  float albedo = skin(p, d) ? 0.2 : 0.08;
  float nv = max(dot(n, -rd), 0.0);
  vec2 L = albedo * (vec2(0.42, 0.05) * (0.6 + 0.4 * n.y) + vec2(0.16, 0.04) * max(-n.y, 0.0)
                     + SUN.w * vec2(0.06, 2.6) * max(dot(n, s), 0.0)
                     + SUN.w * vec2(0.03, 0.4) * max(-n.y, 0.0));
  float rim = pow(1.0 - nv, 3.0) * FIG_HI.w;
  L += rim * (vec2(0.05, 0.01) + SUN.w * vec2(0.02, 0.45) * max(dot(n, s) + 0.3, 0.0));
  L.x += RINGS.w * RINGLIT.y * 0.3 * sline(p.y - RINGS.y, 0.008);
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
  float z = ROPE.x + 40.0 + 5.0 * (TIME - 40.0);
  lo = vec3(-6.7, STREET, z - 9.0);
  hi = vec3(-4.5, STREET + 3.2, z + 9.0);
}

// The waking city's light at a facade, a roof or the street.
vec2 cityLight(vec3 p, vec3 n, float t, int kind) {
  vec2 L;
  float px = pixelAt(t);
  if (kind == 2) {
    // The street: its lamps' warm pools at the lots' corners.
    vec2 c = vec2(floor((p.x + 0.5 * LOT_X) / LOT_X) * LOT_X - 0.5 * LOT_X, floor(p.z / LOT_Z + 0.5) * LOT_Z);
    float d = length(p.xz - c);
    L = vec2(0.012, 0.002) + vec2(0.0, 0.22) * exp(-d * d / 10.0) + vec2(0.0, 2.0) * sline(d, max(0.3, px));
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
    float lit = step(hash3(ci, fi, face, 81u), 0.05 + 0.25 * FOG.z);
    bool warm = hash3(ci, fi, face, 83u) < 0.7;
    float pane = 1.0 - max(band(fu + 0.1, 0.25, px / 2.0), band(fy + 0.15, 0.3, px / 3.4));
    L = vec2(0.016, 0.003) + lit * pane * (warm ? vec2(0.02, 0.5) : vec2(0.35, 0.02));
  }
  return L;
}

// Under the fog where it is open: a walk through the lots from just under
// its top down to the street.
vec2 passCity(Hit h, vec3 ro, vec3 rd) {
  if (h.kind != K_FOG || rd.y > -0.02 || FOG.y > 0.999) return vec2(0.0);
  vec3 pf = ro + rd * h.t;
  float open = 1.0 - fogSolid(pf.xz);
  if (open < 0.005) return vec2(0.0);
  float ts = (FOG.x - 4.0 - ro.y) / rd.y;
  float te = (STREET - ro.y) / rd.y;
  vec3 ird = safeInverse(rd);
  vec3 p = ro + rd * ts;
  int i = int(floor((p.x + 0.5 * LOT_X) / LOT_X));
  int j = int(floor(p.z / LOT_Z));
  int si = rd.x > 0.0 ? 1 : -1, sj = rd.z > 0.0 ? 1 : -1;
  float t = ts;
  float best = te;
  int kind = 2;
  vec3 nb = vec3(0.0, 1.0, 0.0);
  vec3 lo, hi;
  tramBox(lo, hi);
  float tram = window(TIME, 38.0, 41.0, 63.0, 66.0);
  if (tram > 0.0) {
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

// The second ring's radius round his body.
const float SECOND_RING_R = 0.42;

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
      vec3 nr = (q - C) / R;
      float w = max(0.006, 1.2 * pixelAt(t));
      float glass = 0.002 / max(abs(dot(rd, nr)), 0.15);
      float dy = q.y - RINGS.x;
      float first = sline(abs(dy) - 0.02, w);
      float phi = atan(nr.z, nr.x);
      float rr = length(q.xz - C.xz);
      float arc = abs(fract((phi + TAU * TIME / 18.0) * (24.0 / TAU)) - 0.5) * (TAU / 24.0) * rr;
      float bead = sline(length(vec2(arc, dy)), max(0.011, w));
      float third = sline(dot(q - C, mer), w);
      float lag = fract((RINGS.z + 0.5 * PI - phi) / PI);
      float trail = 0.015 * exp(-6.0 * lag);
      float fade = k == 0 ? 1.0 : 0.7;
      L += (glass + RINGLIT.x * (0.15 * first + 0.3 * bead) + RINGLIT.z * (0.12 * third + trail)) * fade;
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
  if (tb > 0.0) L += RINGLIT.y * 0.18 * sline(best, max(0.005, 1.2 * pixelAt(tb)));
  return L * RINGS.w;
}

// The low sun's glare, the towers' corner lamps blinking, and the birds
// over the fog below him lit warm from behind.
vec2 air(vec3 ro, vec3 rd, float T, bool sky_) {
  vec2 L = vec2(0.0);
  vec3 s = sunDir();
  float a = acos(clamp(dot(rd, s), -1.0, 1.0));
  float g = sunShows() * (sky_ ? 1.0 : 0.4);
  L += g * (vec2(0.04, 0.5) * 3e-5 / (a * a + 3e-5) + vec2(0.01, 0.07) * exp(-a / 0.15));
  float kw = floor(ROPE.x / SPAN);
  float on = step(fract(TIME / 1.5), 0.2 / 1.5);
  if (on > 0.0) {
    for (int i = 0 + ZERO; i < 20; i++) {
      float k = kw - 1.0 + float(i / 4);
      int c = pm(i, 4);
      vec3 p = vec3((c & 1) == 0 ? -TOWER_X : TOWER_X, 0.35, k * SPAN + ((c & 2) == 0 ? -TOWER_Z : TOWER_Z));
      L.y += 0.5 * glare(ro, rd, p, T);
    }
  }
  if (FOG.w > 0.0) {
    float px = 2.0 / (VIEW.y * u_res.y);
    for (int i = 0 + ZERO; i < 7; i++) {
      float f = float(i);
      vec3 p = vec3(-14.0 + 3.0 * f + 6.0 * sin(0.3 * TIME + 1.7 * f),
                    FOG.x + 9.0 + 1.5 * sin(0.5 * TIME + f),
                    ROPE.x + 20.0 + 4.0 * f + 3.0 * (TIME - 42.0));
      vec3 v = p - ro;
      float dist = length(v);
      float b = dot(v, rd);
      if (b <= 0.0 || b > T) continue;
      float ang = length(v - rd * b) / dist;
      float flap = 0.55 + 0.45 * sin(TIME * 9.0 + 2.3 * f);
      L.y += FOG.w * 0.5 * flap * sline(ang, max(0.18 / dist, 0.8 * px)) * hazeLeft(ro, rd, dist);
    }
  }
  L.x += sphereAir(ro, rd, T);
  return L;
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
// Records: what the ray met (how far, what, which tower) and how much of
// the pixel the line covers; its normal and the line's distance; the
// line's normal and which line.
void main() {
  Hit h = trace(EYE.xyz, eyeRay());
  o0 = vec4(h.t, float(h.kind), h.k, h.cov);
  o1 = vec4(h.n, h.lt);
  o2 = vec4(h.ln, float(h.lk));
}

#elif defined(PASS_ALL)
void main() {
  vec3 ro = EYE.xyz, rd = eyeRay();
  Hit h = trace(ro, rd);
  vec2 L = passFog(h, ro, rd) + passSet(h, ro, rd) + passFigure(h, ro, rd) + passCity(h, ro, rd);
  L += air(ro, rd, h.kind == K_SKY ? 1e5 : h.t, h.kind == K_SKY);
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
  h.cov = a.w;
  h.n = b.xyz;
  h.lt = b.w;
  h.ln = c.xyz;
  h.lk = int(c.w + 0.5);
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
#endif
}
#endif
