// «Сквозной путь»: the ring of places at night, lit and shaded. One ray per
// pixel finds the nearest thing (the places' boxes, the house's roof, the
// field and the pond, the trees, the crowd, the three figures, the far
// woods and hills); the moon (with its shadows), the night sky and the lamps
// light it; the fog takes the distance. Over it: the lamps' glow, the
// overhead wire, his two rings, his route in the finale, the warm memory of
// the places in him and the code the world melts into. Writes the colour
// and the depth (t / (t + 8)) for the lens.

uniform highp sampler2D u_data;
uniform vec4 u_g[3 * GROUPS];     // per group: [lo, first texel], [hi, boxes], [cos, sin]
uniform vec4 u_fig[4 * FIGS];     // per figure: [low, base + accent], [high], [feet, r], [head, seen]
uniform vec4 u_crowd[2 * CROWD_N]; // per person: [x, z, size, kind], [facing x, z, swing, -]
uniform vec3 u_paper;
uniform vec3 u_ink;
uniform vec3 u_cold;
uniform vec3 u_warm;
uniform vec3 u_pale;
uniform vec3 u_code;

in vec2 v_uv;
out vec4 o;

const float BLEND[CONES] = float[CONES](BLEND_LIST);
const vec4 TREE_P[TREE_N] = vec4[TREE_N](TREE_LIST);
const vec4 LAMP_P[LAMP_N] = vec4[LAMP_N](LAMP_LIST);

#define ID_TREE 20
#define ID_CROWD 40
#define ID_FIG 60
#define ID_GROUND 80
#define ID_WATER 81
#define ID_ROOF 82
#define ID_WOODS 83
#define ID_HILLS 84
#define ID_SKY 90
#define FAR 900.0

struct Hit {
  float t;
  int mat;
  int id;
  vec3 n;    // world normal
  vec3 ln;   // the normal in the box's (a person's) frame
  vec3 lp;   // where, in the box's (a person's) frame
  float top; // the box's top; a figure's or a person's part
  vec3 size; // the box's half size
};

Hit noHit(float t) {
  Hit h;
  h.t = t;
  h.mat = M_SKY;
  h.id = ID_SKY;
  h.n = vec3(0.0, 1.0, 0.0);
  h.ln = h.n;
  h.lp = vec3(0.0);
  h.top = 0.0;
  h.size = vec3(0.0);
  return h;
}

vec4 tx(int i) {
  return texelFetch(u_data, ivec2(i % DATA_W, i / DATA_W), 0);
}

// ---- frames: x out from the field, z along the ring ----

vec2 csOf(float deg) {
  float a = deg * DEG;
  return vec2(cos(a), sin(a));
}
vec3 toFrame(vec3 v, vec2 c) {
  return vec3(v.x * c.x + v.z * c.y, v.y, -v.x * c.y + v.z * c.x);
}
vec3 fromFrame(vec3 v, vec2 c) {
  return vec3(v.x * c.x - v.z * c.y, v.y, v.x * c.y + v.z * c.x);
}
float wrapDeg(float d) {
  return mod(d + 180.0, 360.0) - 180.0;
}
bool inHouse(vec3 p) {
  vec3 q = toFrame(p, csOf(HOUSE));
  return q.x > 11.0 && q.x < 17.0 && q.z > -5.5 && q.z < 6.0 && q.y < WALL_H + 0.01;
}
vec2 carCs(int k) {
  float phi = TRAIN.x + float(k - 1) * CAR_SPACING;
  return vec2(cos(phi), sin(phi));
}
// Which car p is inside (-1 for none).
int inCar(vec3 p) {
  int at = -1;
  for (int k = 0 + ZERO; k < 3; k++) {
    vec3 q = toFrame(p, carCs(k));
    q.x -= TRACK;
    if (abs(q.x) < CAR.x + 0.01 && abs(q.z) < CAR.z + 0.01 && q.y > CAR_FLOOR - 0.1 && q.y < 3.21) at = k;
  }
  return at;
}
float inPond(vec2 q) {
  vec2 c = POND.x * csOf(POND.y);
  vec2 d = q - c;
  float a = atan(d.y, d.x);
  float edge = POND.z + 0.45 * sin(3.0 * a + 0.7) + 0.25 * sin(5.0 * a + 2.1);
  return edge - length(d);
}
float ringNoise(float th, float f, uint salt) {
  vec2 q = vec2(cos(th), sin(th)) * f;
  return (0.5 * noise2(q, salt) + 0.25 * noise2(q * 2.03 + 7.1, salt) + 0.125 * noise2(q * 4.07 + 3.3, salt)) / 0.875;
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
vec2 boxT(vec3 o, vec3 d, vec3 h, out vec3 n) {
  vec3 m = safeInverse(d);
  vec3 k = abs(m) * h;
  vec3 a = -m * o - k, b = -m * o + k;
  float tn = max(max(a.x, a.y), a.z), tf = min(min(b.x, b.y), b.z);
  n = -sign(d) * step(a.yzx, a.xyz) * step(a.zxy, a.xyz);
  return vec2(tn, tf);
}
float cylT(vec3 o, vec3 d, float r, float hh, out vec3 n) {
  float t = 1e9;
  n = vec3(0.0, 1.0, 0.0);
  float a = dot(d.xz, d.xz);
  if (a > 1e-9) {
    float b = dot(o.xz, d.xz), c = dot(o.xz, o.xz) - r * r;
    float disc = b * b - a * c;
    if (disc >= 0.0) {
      float s = (-b - sqrt(disc)) / a;
      if (s > 0.0 && abs(o.y + d.y * s) <= hh) {
        t = s;
        n = vec3(o.x + d.x * s, 0.0, o.z + d.z * s) / r;
      }
    }
  }
  return t < 1e8 ? t : -1.0;
}
float ballT(vec3 o, vec3 d, vec3 hs, out vec3 n) {
  vec3 oc = o / hs, dc = d / hs;
  float a = dot(dc, dc), b = dot(oc, dc), c = dot(oc, oc) - 1.0;
  float disc = b * b - a * c;
  n = vec3(0.0, 1.0, 0.0);
  if (disc < 0.0) return -1.0;
  float t = (-b - sqrt(disc)) / a;
  if (t <= 0.0) return -1.0;
  n = normalize((o + d * t) / (hs * hs));
  return t;
}
float capsuleT(vec3 ro, vec3 rd, vec3 pa, vec3 pb, float r) {
  vec3 ba = pb - pa, oa = ro - pa;
  float baba = dot(ba, ba), bard = dot(ba, rd), baoa = dot(ba, oa);
  float rdoa = dot(rd, oa), oaoa = dot(oa, oa);
  float a = baba - bard * bard;
  float b = baba * rdoa - baoa * bard;
  float c = baba * oaoa - baoa * baoa - r * r * baba;
  float h = b * b - a * c;
  if (h >= 0.0) {
    float t = (-b - sqrt(h)) / a;
    float y = baoa + t * bard;
    if (y > 0.0 && y < baba) return t;
    vec3 oc = (y <= 0.0) ? oa : ro - pb;
    b = dot(rd, oc);
    c = dot(oc, oc) - r * r;
    h = b * b - c;
    if (h > 0.0) return -b - sqrt(h);
  }
  return -1.0;
}
vec3 capsuleN(vec3 p, vec3 a, vec3 b) {
  vec3 ba = b - a;
  float s = clamp(dot(p - a, ba) / dot(ba, ba), 0.0, 1.0);
  return normalize(p - a - ba * s);
}

// ---- the places' boxes ----

// Whether the eye is in a car: its lit panes are then not drawn, so it
// sees out.
bool g_eyeInCar = false;

// Box `at` (three texels) seen from a group in the frame gc.
void boxHit(int at, vec2 gc, int gid, vec3 ro, vec3 rd, inout Hit h) {
  vec4 a = tx(at), b = tx(at + 1), r = tx(at + 2);
  vec2 c = vec2(gc.x * r.x - gc.y * r.y, gc.y * r.x + gc.x * r.y);
  vec3 lo = a.xyz, hi = b.xyz;
  int flags = int(b.w + 0.5);
  float slide = DOOR_SLIDE * TRAIN.y;
  if (flags == LEAF_L) {
    lo.z -= slide;
    hi.z -= slide;
  }
  if (flags == LEAF_R) {
    lo.z += slide;
    hi.z += slide;
  }
  int mat = int(a.w + 0.5);
  if (mat == M_GLASS && g_eyeInCar) return;
  vec3 o = toFrame(ro, c), d = toFrame(rd, c);
  vec3 m = 0.5 * (lo + hi), hs = 0.5 * (hi - lo);
  vec3 n;
  vec2 s = boxT(o - m, d, hs, n);
  if (s.x <= s.y && s.x > 0.0 && s.x < h.t) {
    h.t = s.x;
    h.mat = mat;
    h.id = gid;
    h.n = fromFrame(n, c);
    h.ln = n;
    h.lp = o + d * s.x;
    h.top = hi.y;
    h.size = hs;
  }
}
bool boxAny(int at, vec2 gc, vec3 ro, vec3 rd, float tmax) {
  vec4 a = tx(at), b = tx(at + 1), r = tx(at + 2);
  int mat = int(a.w + 0.5);
  if (mat == M_LAMP || mat == M_GLASS) return false;
  vec2 c = vec2(gc.x * r.x - gc.y * r.y, gc.y * r.x + gc.x * r.y);
  vec3 o = toFrame(ro, c), d = toFrame(rd, c);
  vec2 s = slab(o, safeInverse(d), a.xyz, b.xyz);
  return s.x <= s.y && s.y > 0.0 && s.x < tmax;
}

// The house's roof: a prism over its walls, cut by five planes.
void clipPlane(vec3 nrm, float dist, vec3 o, vec3 d, inout float tn, inout float tf, inout vec3 nn) {
  float den = dot(nrm, d), num = dist - dot(nrm, o);
  if (abs(den) < 1e-7) {
    if (num < 0.0) tf = -1e9;
    return;
  }
  float t = num / den;
  if (den < 0.0) {
    if (t > tn) {
      tn = t;
      nn = nrm;
    }
  } else {
    tf = min(tf, t);
  }
}
vec3 roofT(vec3 ro, vec3 rd, out vec3 ln) {
  vec2 c = csOf(HOUSE);
  vec3 o = toFrame(ro, c), d = toFrame(rd, c);
  float tn = -1e9, tf = 1e9;
  ln = vec3(0.0, 1.0, 0.0);
  clipPlane(vec3(0.0, -1.0, 0.0), -WALL_H, o, d, tn, tf, ln);
  clipPlane(vec3(ROOF_SLOPE, 1.0, 0.0), RIDGE_Y + ROOF_SLOPE * RIDGE_X, o, d, tn, tf, ln);
  clipPlane(vec3(-ROOF_SLOPE, 1.0, 0.0), RIDGE_Y - ROOF_SLOPE * RIDGE_X, o, d, tn, tf, ln);
  clipPlane(vec3(0.0, 0.0, 1.0), 6.2, o, d, tn, tf, ln);
  clipPlane(vec3(0.0, 0.0, -1.0), 5.7, o, d, tn, tf, ln);
  ln = normalize(ln);
  return vec3(tn, tf, 0.0);
}

// ---- the people: CONES cones blended into one body each (body.rs) ----

float roundCone(vec3 p, vec3 a, vec3 b, float r1, float r2) {
  vec3 ba = b - a;
  float l2 = dot(ba, ba);
  if (l2 < 1e-8) return length(p - a) - max(r1, r2);
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
float cutCone(vec3 p, vec3 a, vec3 b, float ra, float rb) {
  float baba = dot(b - a, b - a);
  if (baba < 1e-8) return length(p - a) - max(ra, rb);
  float rba = rb - ra;
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
float cone(int base, int c, vec3 p) {
  vec4 a = tx(base + 3 * c);
  vec4 b = tx(base + 3 * c + 1);
  vec4 s = tx(base + 3 * c + 2);
  float keep = max(abs(s.w), 0.05);
  vec3 m = 0.5 * (a.xyz + b.xyz);
  vec3 q = p + s.xyz * dot(p - m, s.xyz) * (1.0 / keep - 1.0);
  float d = s.w < 0.0 ? cutCone(q, a.xyz, b.xyz, a.w - CUT_ROUND, b.w - CUT_ROUND) - CUT_ROUND
                      : roundCone(q, a.xyz, b.xyz, a.w, b.w);
  return d * keep;
}
// The surface's normal from four soft-min samples and the nearest cone, in
// one flat loop.
void figureSurface(int base, vec3 p, out vec3 n, out float part) {
  n = vec3(0.0);
  part = 0.0;
  float d = 0.0, best = 1e5;
  vec3 e = vec3(0.0);
  for (int k = 0 + ZERO; k < 5 * CONES; k++) {
    int i = k / CONES, c = k - i * CONES;
    if (c == 0) e = i < 4 ? 0.5773 * (2.0 * vec3(float(((i + 3) >> 1) & 1), float((i >> 1) & 1), float(i & 1)) - 1.0) : vec3(0.0);
    float dc = cone(base, c, p + 0.0015 * e);
    if (i < 4) {
      d = c == 0 ? dc : softmin(d, dc, BLEND[c]);
      if (c == CONES - 1) n += e * d;
    } else if (dc < best) {
      best = dc;
      part = float(c);
    }
  }
  n = normalize(n);
}

// ---- the crowd: people of capsules and ellipsoids, each its own ----

float crowdShown() {
  return 1.0 - window(TIME, CROWD_GONE.x, CROWD_GONE.y, CROWD_GONE.z, CROWD_GONE.w);
}
bool has(float kind, int bit) {
  return (int(kind + 0.5) & bit) != 0;
}
// A person's parts in its own frame (size 1, feet at the origin, facing
// +z). Capsules: [a, sway of a.z], [b, sway of b.z], [radius, part, the
// kinds it needs, the kinds it is not drawn with].
#define PERSON_CAPS 9
const vec4 PERSON_CAP[3 * PERSON_CAPS] = vec4[3 * PERSON_CAPS](
  vec4(0.09, 0.86, 0.0, 0.0), vec4(0.1, 0.1, 0.0, 0.22), vec4(0.062, 0.0, 0.0, 0.0),
  vec4(-0.09, 0.86, 0.0, 0.0), vec4(-0.1, 0.1, 0.0, -0.22), vec4(0.062, 0.0, 0.0, 0.0),
  vec4(-0.15, 1.36, 0.0, 0.0), vec4(0.15, 1.36, 0.0, 0.0), vec4(0.075, 2.0, 0.0, 0.0),
  vec4(0.0, 1.38, 0.0, 0.0), vec4(0.0, 1.5, 0.01, 0.0), vec4(0.05, 3.0, 0.0, 0.0),
  vec4(-0.2, 1.35, 0.0, 0.0), vec4(-0.235, 0.91, 0.0, 0.2), vec4(0.047, 2.0, 0.0, 0.0),
  vec4(0.2, 1.35, 0.0, 0.0), vec4(0.235, 0.91, 0.0, -0.2), vec4(0.047, 2.0, 0.0, float(K_PHONE)),
  vec4(0.2, 1.35, 0.0, 0.0), vec4(0.18, 1.06, 0.06, 0.0), vec4(0.047, 2.0, float(K_PHONE), 0.0),
  vec4(0.18, 1.06, 0.06, 0.0), vec4(0.07, 1.19, 0.25, 0.0), vec4(0.042, 2.0, float(K_PHONE), 0.0),
  vec4(-0.15, 1.37, 0.0, 0.0), vec4(-0.27, 1.08, 0.02, 0.0), vec4(0.015, 5.0, float(K_BAG), 0.0));
// Ellipsoids: [centre, sway of its z], [half size, 1 where it moves with
// the head], [part, needs, not with, -].
#define PERSON_ELLS 14
const vec4 PERSON_ELL[3 * PERSON_ELLS] = vec4[3 * PERSON_ELLS](
  vec4(0.1, 0.05, 0.05, 0.22), vec4(0.05, 0.05, 0.12, 0.0), vec4(1.0, 0.0, 0.0, 0.0),
  vec4(-0.1, 0.05, 0.05, -0.22), vec4(0.05, 0.05, 0.12, 0.0), vec4(1.0, 0.0, 0.0, 0.0),
  vec4(0.0, 0.8, 0.0, 0.0), vec4(0.2, 0.33, 0.15, 0.0), vec4(2.0, float(K_COAT), 0.0, 0.0),
  vec4(0.0, 0.92, 0.0, 0.0), vec4(0.17, 0.12, 0.12, 0.0), vec4(0.0, 0.0, float(K_COAT), 0.0),
  vec4(0.0, 1.17, 0.0, 0.0), vec4(0.19, 0.25, 0.125, 0.0), vec4(2.0, 0.0, 0.0, 0.0),
  vec4(0.0, 1.6, 0.01, 0.0), vec4(0.085, 0.112, 0.098, 1.0), vec4(8.0, 0.0, 0.0, 0.0),
  vec4(-0.235, 0.84, 0.0, 0.2), vec4(0.038, 0.05, 0.034, 0.0), vec4(3.0, 0.0, 0.0, 0.0),
  vec4(0.235, 0.84, 0.0, -0.2), vec4(0.038, 0.05, 0.034, 0.0), vec4(3.0, 0.0, float(K_PHONE), 0.0),
  vec4(0.05, 1.23, 0.29, 0.0), vec4(0.036, 0.07, 0.012, 0.0), vec4(6.0, float(K_PHONE), 0.0, 0.0),
  vec4(0.0, 1.69, 0.01, 0.0), vec4(0.15, 0.022, 0.15, 1.0), vec4(4.0, float(K_HAT), 0.0, 0.0),
  vec4(0.0, 1.73, 0.0, 0.0), vec4(0.09, 0.07, 0.1, 1.0), vec4(4.0, float(K_HAT), 0.0, 0.0),
  vec4(0.0, 1.64, 0.0, 0.0), vec4(0.093, 0.085, 0.103, 1.0), vec4(4.0, float(K_BEANIE), 0.0, 0.0),
  vec4(-0.29, 0.95, 0.02, 0.0), vec4(0.055, 0.15, 0.17, 0.0), vec4(5.0, float(K_BAG), 0.0, 0.0),
  vec4(0.0, 1.17, -0.19, 0.0), vec4(0.16, 0.21, 0.09, 0.0), vec4(5.0, float(K_PACK), 0.0, 0.0));
bool wears(int kind, vec2 rule) {
  int need = int(rule.x + 0.5), ban = int(rule.y + 0.5);
  return (kind & need) == need && (kind & ban) == 0;
}
// Part j of a person of this kind in its own frame (o, d), its sway sw and
// its head's lean: the ray's t (or 1e9), the normal, the part (0 trousers,
// 1 shoes, 2 coat, 3 skin, 4 hat, 5 bag, 6 phone, 8 head).
float personPart(int j, int kind, float sw, vec3 head, vec3 o, vec3 d, out vec3 n, out float part) {
  n = vec3(0.0, 1.0, 0.0);
  part = 0.0;
  float t = -1.0;
  if (j < PERSON_CAPS) {
    vec4 a = PERSON_CAP[3 * j], b = PERSON_CAP[3 * j + 1], c = PERSON_CAP[3 * j + 2];
    if (!wears(kind, c.zw)) return 1e9;
    vec3 pa = a.xyz + vec3(0.0, 0.0, a.w * sw), pb = b.xyz + vec3(0.0, 0.0, b.w * sw);
    t = capsuleT(o, d, pa, pb, c.x);
    if (t > 0.0) n = capsuleN(o + d * t, pa, pb);
    part = c.y;
  } else {
    int e = j - PERSON_CAPS;
    vec4 a = PERSON_ELL[3 * e], b = PERSON_ELL[3 * e + 1], c = PERSON_ELL[3 * e + 2];
    if (!wears(kind, c.yz)) return 1e9;
    vec3 at = a.xyz + vec3(0.0, 0.0, a.w * sw) + b.w * head;
    t = ballT(o - at, d, b.xyz, n);
    part = c.x;
  }
  return t > 0.0 ? t : 1e9;
}
#define PERSON_PARTS (PERSON_CAPS + PERSON_ELLS)
// Person k's frame: its feet, its right and its facing.
void personFrame(int k, out vec3 at, out vec3 R, out vec3 F) {
  vec4 a = u_crowd[2 * k], b = u_crowd[2 * k + 1];
  at = vec3(a.x, PLATFORM, a.y);
  F = vec3(b.x, 0.0, b.y);
  R = vec3(-b.y, 0.0, b.x);
}

// A tree's crown: three lobes round its middle.
vec4 lobe(int i, int j) {
  vec4 tr = TREE_P[i];
  float cr = tr.w;
  vec3 c = vec3(tr.x, tr.z - 1.2 * cr, tr.y);
  c.x += 0.05 * sin(TIME * 0.9 + float(i));
  float a = TAU * hash1(i, 31u);
  if (j == 1) return vec4(c + vec3(0.55 * cr * cos(a), 0.35 * cr, 0.55 * cr * sin(a)), 0.72 * cr);
  if (j == 2) return vec4(c + vec3(-0.5 * cr * cos(a + 0.9), -0.25 * cr, -0.5 * cr * sin(a + 0.9)), 0.66 * cr);
  return vec4(c, cr);
}
void lobeHit(int i, int j, vec3 ro, vec3 rd, inout Hit h) {
  vec4 l = lobe(i, j);
  vec3 n;
  float t = ballT(ro - l.xyz, rd, vec3(l.w, 1.25 * l.w, l.w), n);
  if (t > 0.0 && t < h.t) {
    h.t = t;
    h.mat = M_TREE;
    h.id = ID_TREE + i;
    h.n = n;
    h.ln = n;
    h.lp = ro + rd * t;
    h.top = 0.0;
  }
}

// The woods round the field and the hills behind them: walls of a cylinder
// as high as the noise lets them be.
void ringWall(vec3 ro, vec3 rd, float R, float base, float amp, float f, uint salt, int mat, int id, inout Hit h) {
  float a = dot(rd.xz, rd.xz);
  if (a < 1e-8) return;
  float b = dot(ro.xz, rd.xz), c = dot(ro.xz, ro.xz) - R * R;
  float disc = b * b - a * c;
  if (disc < 0.0) return;
  float sq = sqrt(disc);
  float t = c > 0.0 ? (-b - sq) / a : (-b + sq) / a;
  if (t <= 0.0 || t >= h.t) return;
  vec3 p = ro + rd * t;
  float th = atan(p.z, p.x);
  float top = base + amp * ringNoise(th, f, salt);
  if (p.y < 0.0 || p.y > top) return;
  h.t = t;
  h.mat = mat;
  h.id = id;
  h.n = -normalize(vec3(p.x, 0.0, p.z));
  h.ln = h.n;
  h.lp = vec3(th * R, p.y, 0.0);
  h.top = top;
}

// ---- the trace ----

Hit trace(vec3 ro, vec3 rd) {
  Hit h = noHit(FAR);
  // The places: a group the ray misses skips its boxes.
  int g = 0, i = 0, iEnd = 0, gid = 0;
  vec2 gc = vec2(1.0, 0.0);
  for (int k = 0 + ZERO; k < 2048; k++) {
    if (i < iEnd) {
      boxHit(i, gc, gid, ro, rd, h);
      i += 3;
    } else if (g < GROUPS) {
      vec4 a = u_g[3 * g], b = u_g[3 * g + 1], r = u_g[3 * g + 2];
      vec3 o = toFrame(ro, r.xy), d = toFrame(rd, r.xy);
      vec2 s = slab(o, safeInverse(d), a.xyz - 0.02, b.xyz + 0.02);
      if (s.x <= s.y && s.y >= 0.0 && s.x <= h.t) {
        i = int(a.w + 0.5);
        iEnd = i + 3 * int(b.w + 0.5);
        gc = r.xy;
        gid = g;
      }
      g++;
    } else {
      break;
    }
  }
  // The house's roof.
  vec3 ln;
  vec3 rt = roofT(ro, rd, ln);
  if (rt.x <= rt.y && rt.x > 0.0 && rt.x < h.t) {
    h.t = rt.x;
    h.mat = M_ROOF;
    h.id = ID_ROOF;
    h.ln = ln;
    h.n = fromFrame(ln, csOf(HOUSE));
    h.lp = toFrame(ro + rd * rt.x, csOf(HOUSE));
    h.top = 0.0;
  }
  // The field and the pond.
  if (rd.y < -1e-5) {
    float t = -ro.y / rd.y;
    if (t > 0.0 && t < h.t) {
      vec3 p = ro + rd * t;
      if (inPond(p.xz) > 0.0) {
        float tw = (WATER_Y - ro.y) / rd.y;
        if (tw < h.t) {
          h.t = tw;
          h.mat = M_WATER;
          h.id = ID_WATER;
          h.n = vec3(0.0, 1.0, 0.0);
          h.ln = h.n;
          h.lp = ro + rd * tw;
          h.top = 0.0;
        }
      } else {
        h.t = t;
        h.mat = M_GROUND;
        h.id = ID_GROUND;
        h.n = vec3(0.0, 1.0, 0.0);
        h.ln = h.n;
        h.lp = p;
        h.top = 0.0;
      }
    }
  }
  // The trees: trunks, and the crowns where the ray comes near them (one
  // loop: each tree's trunk and bounds, then its three lobes).
  bool nearTree = false;
  for (int k = 0 + ZERO; k < 3 * TREE_N; k++) {
    int ti = k / 3, j = k - 3 * ti;
    if (j == 0) {
      vec4 tr = TREE_P[ti];
      float cy = tr.z - 1.2 * tr.w;
      vec3 n;
      float t = cylT(ro - vec3(tr.x, 0.5 * cy, tr.y), rd, 0.08 + 0.04 * tr.w, 0.5 * cy, n);
      if (t > 0.0 && t < h.t) {
        h.t = t;
        h.mat = M_TREE;
        h.id = ID_TREE + ti;
        h.n = n;
        h.ln = n;
        h.lp = ro + rd * t;
        h.top = 1.0;
      }
      vec3 oc = ro - vec3(tr.x, cy, tr.y);
      float b = dot(oc, rd), c = dot(oc, oc) - 4.0 * tr.w * tr.w;
      nearTree = b * b - c >= 0.0 && -b + sqrt(max(b * b - c, 0.0)) >= 0.0;
    }
    if (nearTree) lobeHit(ti, j, ro, rd, h);
  }
  // The crowd on the platform, fading as a dither while they come and go;
  // each person is looked at only where the ray meets the capsule round it.
  float dith = rand(uint(gl_FragCoord.x) * 7919u + uint(gl_FragCoord.y) * 104729u + 17u);
  float shown = crowdShown();
  if (shown > 0.02 && dith < shown) {
    // One loop: a person's bounds, then its parts one per turn.
    int k = -1, j = PERSON_PARTS, kind = 0;
    float sz = 1.0, sw = 0.0, bt = 1e9, bp = 0.0;
    vec3 at = vec3(0.0), R = vec3(1.0, 0.0, 0.0), F = vec3(0.0, 0.0, 1.0);
    vec3 o = vec3(0.0), d = vec3(0.0), head = vec3(0.0), bn = vec3(0.0, 1.0, 0.0);
    for (int it = 0 + ZERO; it < CROWD_N * (PERSON_PARTS + 1); it++) {
      if (j >= PERSON_PARTS) {
        k++;
        if (k >= CROWD_N) break;
        personFrame(k, at, R, F);
        sz = u_crowd[2 * k].z;
        vec3 q = (ro - at) / sz;
        bool inside = dot(q.xz, q.xz) < 0.2 && q.y > -0.2 && q.y < 2.0;
        float tb = capsuleT(ro, rd, at + vec3(0.0, 0.3 * sz, 0.0), at + vec3(0.0, 1.5 * sz, 0.0), 0.45 * sz);
        if (!inside && (tb < 0.0 || tb > h.t)) continue;
        o = vec3(dot(q, R), q.y, dot(q, F));
        d = vec3(dot(rd, R), rd.y, dot(rd, F));
        kind = int(u_crowd[2 * k].w + 0.5);
        sw = u_crowd[2 * k + 1].z;
        // With a phone the head bends to it.
        head = (kind & K_PHONE) != 0 ? vec3(0.0, -0.015, 0.035) : vec3(0.0);
        bt = 1e9;
        j = 0;
        continue;
      }
      vec3 pn;
      float part;
      float tl = personPart(j, kind, sw, head, o, d, pn, part);
      if (tl < bt) {
        bt = tl;
        bn = pn;
        bp = part;
      }
      j++;
      float t = bt * sz;
      if (j == PERSON_PARTS && bt < 1e8 && t < h.t) {
        h.t = t;
        h.mat = M_CROWD;
        h.id = ID_CROWD + k;
        h.n = normalize(R * bn.x + vec3(0.0, bn.y, 0.0) + F * bn.z);
        h.ln = bn;
        h.lp = o + d * bt;
        h.top = bp;
      }
    }
  }
  // The woods and the hills.
  for (int k = 0 + ZERO; k < 2; k++) {
    bool woods = k == 0;
    vec4 w = woods ? vec4(46.0, 3.0, 3.2, 9.0) : vec4(130.0, 5.0, 15.0, 2.2);
    ringWall(ro, rd, w.x, w.y, w.z, w.w, woods ? 41u : 43u, woods ? M_TREE : M_HILL, woods ? ID_WOODS : ID_HILLS, h);
  }
  // The figures, one after another in one loop, each marched through its
  // box; each turn adds one cone to the soft-min at the current step.
  vec3 ird = safeInverse(rd);
  int fi = -1, base = 0, fig = -1, steps = 0, j = 0;
  float t = 1.0, end = 0.0, d = 0.0;
  vec3 q = vec3(0.0);
  for (int k = 0 + ZERO; k < 400 * CONES; k++) {
    if (j == 0 && (t > end || steps > 80)) {
      fi++;
      if (fi >= FIGS) break;
      t = 1.0;
      end = 0.0;
      steps = 0;
      vec4 lo = u_fig[4 * fi], hi = u_fig[4 * fi + 1], head = u_fig[4 * fi + 3];
      if (head.w < 0.02 || dith > head.w) continue;
      vec2 s = slab(ro, ird, lo.xyz - 0.02, hi.xyz + 0.02);
      if (s.x > s.y || s.y < 0.0 || s.x > h.t) continue;
      base = int(lo.w);
      t = max(s.x, 0.0);
      end = min(s.y, h.t);
      continue;
    }
    if (j == 0) q = ro + rd * t;
    float dc = cone(base, j, q);
    d = j == 0 ? dc : softmin(d, dc, BLEND[j]);
    if (++j < CONES) continue;
    j = 0;
    steps++;
    // Through his own eyes his head is not there (his hands and body are).
    bool own = fi == 0 && HEROP.w > 0.01 && dot(ro - HEROP.xyz, ro - HEROP.xyz) < 0.2
        && dot(q - HEROP.xyz, q - HEROP.xyz) < 0.045;
    if (d < 0.0012 && !own) {
      h.t = t;
      h.id = ID_FIG + fi;
      h.mat = M_FIG;
      fig = base;
      t = 1.0;
      end = 0.0;
      continue;
    }
    t += own ? max(abs(d), 0.02) : max(d, 0.0008);
  }
  if (fig >= 0) {
    vec3 p = ro + rd * h.t;
    figureSurface(fig, p, h.n, h.top);
    h.ln = h.n;
    h.lp = p;
  }
  return h;
}

// Whether anything stands between p and the moon (`skip` is the hit's id:
// a person does not shadow itself with the capsule round it).
bool occluded(vec3 ro, vec3 rd, int skip) {
  float tmax = 120.0;
  int g = 0, i = 0, iEnd = 0;
  vec2 gc = vec2(1.0, 0.0);
  for (int k = 0 + ZERO; k < 2048; k++) {
    if (i < iEnd) {
      if (boxAny(i, gc, ro, rd, tmax)) return true;
      i += 3;
    } else if (g < GROUPS) {
      vec4 a = u_g[3 * g], b = u_g[3 * g + 1], r = u_g[3 * g + 2];
      vec3 o = toFrame(ro, r.xy), d = toFrame(rd, r.xy);
      vec2 s = slab(o, safeInverse(d), a.xyz - 0.02, b.xyz + 0.02);
      if (s.x <= s.y && s.y >= 0.0 && s.x <= tmax) {
        i = int(a.w + 0.5);
        iEnd = i + 3 * int(b.w + 0.5);
        gc = r.xy;
      }
      g++;
    } else {
      break;
    }
  }
  vec3 ln;
  vec3 rt = roofT(ro, rd, ln);
  if (rt.x <= rt.y && rt.y > 0.0) return true;
  for (int k = 0 + ZERO; k < TREE_N; k++) {
    vec4 tr = TREE_P[k];
    vec3 n;
    vec4 l = lobe(k, 0);
    if (ballT(ro - l.xyz, rd, vec3(1.15, 1.35, 1.15) * l.w, n) > 0.0) return true;
    float cy = tr.z - 1.2 * tr.w;
    if (cylT(ro - vec3(tr.x, 0.5 * cy, tr.y), rd, 0.08 + 0.04 * tr.w, 0.5 * cy, n) > 0.0) return true;
  }
  if (crowdShown() > 0.5) {
    for (int k = 0 + ZERO; k < CROWD_N; k++) {
      if (ID_CROWD + k == skip) continue;
      vec4 a = u_crowd[2 * k];
      vec3 at = vec3(a.x, PLATFORM, a.y);
      if (capsuleT(ro, rd, at + vec3(0.0, 0.15 * a.z, 0.0), at + vec3(0.0, 1.55 * a.z, 0.0), 0.17 * a.z) > 0.0) return true;
    }
  }
  for (int f = 0 + ZERO; f < FIGS; f++) {
    vec4 feet = u_fig[4 * f + 2], head = u_fig[4 * f + 3];
    if (head.w < 0.5 || ID_FIG + f == skip) continue;
    float t = capsuleT(ro, rd, feet.xyz, head.xyz, feet.w);
    if (t > 0.0 && t < tmax) return true;
  }
  return false;
}

// ---- the light ----

// The lamps' warm light at p (no shadows: each lamp lights only its side
// of the house's walls, a car's only its inside).
float lampLight(vec3 p, vec3 n) {
  float sum = 0.0;
  bool house = inHouse(p);
  for (int i = 0 + ZERO; i < LAMP_N; i++) {
    vec4 L = LAMP_P[i];
    // w: the reach, + 100 × the side it lights, + 1000 without a halo.
    float w = mod(L.w, 1000.0);
    float side = floor(w / 100.0);
    float R = w - 100.0 * side;
    if ((side == 1.0 && !house) || (side == 2.0 && house)) continue;
    vec3 d = L.xyz - p;
    float dist = length(d);
    float lam = max(dot(n, d) / max(dist, 1e-4), 0.0) * 0.85 + 0.15;
    float q = dist / R;
    sum += 0.8 * lam / (1.0 + q * q * q * q);
  }
  int car = inCar(p);
  if (car >= 0) {
    vec2 c = carCs(car);
    vec3 q = toFrame(p, c);
    vec3 l = fromFrame(vec3(TRACK, 3.05, clamp(q.z, -CAR.z + 0.5, CAR.z - 0.5)), c);
    vec3 d = l - p;
    float dist = length(d);
    float qc = dist / 2.2;
    sum += 0.75 * (max(dot(n, d) / max(dist, 1e-4), 0.0) * 0.8 + 0.2) / (1.0 + qc * qc * qc * qc);
  }
  return sum;
}
// The lamps in a shiny surface: their highlights.
float lampSheen(vec3 p, vec3 r) {
  float sum = 0.0;
  for (int i = 0 + ZERO; i < LAMP_N; i++) {
    vec3 d = LAMP_P[i].xyz - p;
    float dist = length(d);
    sum += pow(max(dot(r, d / max(dist, 1e-4)), 0.0), 60.0) * exp(-dist / 9.0);
  }
  return sum;
}
// The soft dark under the people standing on a floor.
float contact(vec3 p, vec3 n) {
  if (n.y < 0.5) return 1.0;
  float k = 1.0;
  if (abs(p.y - PLATFORM) < 0.05 && crowdShown() > 0.5) {
    for (int i = 0 + ZERO; i < CROWD_N; i++) {
      vec4 a = u_crowd[2 * i];
      vec2 d = p.xz - a.xy;
      k *= 1.0 - 0.6 * exp(-dot(d, d) / (0.07 * a.z * a.z));
    }
  }
  for (int f = 0 + ZERO; f < FIGS; f++) {
    vec4 lo = u_fig[4 * f], feet = u_fig[4 * f + 2], head = u_fig[4 * f + 3];
    if (head.w < 0.5) continue;
    vec2 d = p.xz - feet.xz;
    k *= 1.0 - 0.55 * exp(-dot(d, d) / 0.08) * exp(-abs(p.y - lo.y) / 0.12);
  }
  return k;
}

// A colour of the theme: how much light it sends back, leaning warm (> 0)
// or cold (< 0).
vec3 tone(float a, float tint) {
  return a * mix(u_ink, tint > 0.0 ? u_warm : u_cold, 0.7 * abs(tint));
}
vec3 moonColor() {
  return mix(u_ink, u_cold, 0.4);
}
vec3 fogColor(vec3 rd) {
  float toMoon = max(dot(rd, MOON.xyz), 0.0);
  return u_paper + 0.055 * mix(u_ink, u_cold, 0.6) + 0.05 * u_pale * pow(toMoon, 6.0);
}
// The night sky without its stars: the glow along the horizon (the fog's
// own colour there), the moon's halo, the moon.
vec3 skyBase(vec3 rd) {
  float el = asin(clamp(rd.y, -1.0, 1.0));
  float az = atan(rd.z, rd.x);
  float ang = acos(clamp(dot(rd, MOON.xyz), -1.0, 1.0));
  vec3 col = mix(fogColor(rd), u_paper * 0.85, smoothstep(0.0, 0.6, el));
  float band = smoothstep(0.5, 0.85, noise2(vec2(az * 3.0, el * 22.0), 61u)) * window(el, 0.03, 0.08, 0.3, 0.45);
  col += band * mix(u_ink, u_cold, 0.5) * (0.025 + 0.1 * exp(-ang / 0.4));
  col += u_pale * (0.16 * exp(-ang / 0.06) + 0.06 * exp(-ang / 0.3));
  return col;
}

vec3 figureTone(int fi, int part) {
  bool scarf = part == COLLAR || (part >= SCARF && part < SCARF + SCARF_LINKS);
  bool skin = part == FACE || part == HEAD || part == HAND_L || part == HAND_R;
  bool feet = part == FOOT_L || part == FOOT_R || part == TOE_L || part == TOE_R;
  bool legs = part == 0 || (part >= LEG_FIRST && part <= LEG_LAST);
  if (skin) return tone(0.62, 0.45);
  if (feet) return tone(0.1, 0.0);
  if (fi == 0) {
    if (scarf) return tone(0.8, 0.95);
    if (part == CAP) return tone(0.3, -0.2);
    if (legs) return tone(0.26, -0.3);
    return tone(0.55, -0.15);
  }
  if (fi == 1) {
    if (scarf) return tone(0.6, -0.5);
    if (legs) return tone(0.22, 0.0);
    return tone(0.5, 0.55);
  }
  if (scarf) return tone(0.55, 0.3);
  if (legs) return tone(0.2, -0.2);
  return tone(0.38, -0.45);
}

struct Surf {
  vec3 col;     // the light it sends back, over the page
  float emit;   // how much it glows
  vec3 glow;    // its glow's colour
  float moon;   // how much the moon reaches it
  vec2 u;       // its texture's coordinates (metres)
  vec2 period;  // its joints' spacing along u
  vec2 joint;   // how dark the joints across u.x and across u.y are
  float stagger; // each row shifted half a period
};

Surf surfaceOf(Hit h, vec3 ro, vec3 rd, vec3 p) {
  Surf s;
  s.col = vec3(0.0);
  s.emit = 0.0;
  s.glow = u_warm;
  s.moon = 0.0;
  s.period = vec2(1.0);
  s.joint = vec2(0.0);
  s.stagger = 0.0;
  vec3 n = h.n;
  vec3 ln = h.ln, lp = h.lp;
  vec3 an = abs(ln);
  s.u = an.y > 0.5 ? lp.xz : (an.x > 0.5 ? vec2(lp.z, lp.y) : vec2(lp.x, lp.y));
  if (h.id == ID_SKY) {
    s.u = vec2(atan(rd.z, rd.x), asin(clamp(rd.y, -1.0, 1.0))) * 14.0;
    return s;
  }
  vec3 moonC = moonColor();

  if (h.mat == M_WATER) {
    // Dark water: the sky and the moon's path in it, the lamps.
    vec2 q = p.xz;
    float tt = TIME;
    vec2 slope = 0.035 * vec2(cos(dot(q, vec2(1.7, 0.6)) + tt * 0.7), cos(dot(q, vec2(-0.5, 2.3)) - tt * 0.55))
               + 0.02 * vec2(cos(dot(q, vec2(4.1, -2.9)) + tt * 1.3), cos(dot(q, vec2(3.3, 5.1)) - tt * 1.1));
    vec3 nw = normalize(vec3(-slope.x, 1.0, -slope.y));
    vec3 rr = reflect(rd, nw);
    float m = max(dot(rr, MOON.xyz), 0.0);
    float v = 1.6 * pow(m, 160.0) + 0.25 * pow(m, 14.0);
    float ang = acos(clamp(m, -1.0, 1.0));
    vec3 skyR = mix(fogColor(rr), u_paper * 0.85, smoothstep(0.0, 0.6, rr.y)) + u_pale * (0.16 * exp(-ang / 0.06) + 0.06 * exp(-ang / 0.3));
    vec3 refl = 0.5 * (skyR - u_paper) + moonC * v;
    // Him and her on the pier, upside down in it.
    for (int f = 0 + ZERO; f < FIGS; f++) {
      vec4 feet = u_fig[4 * f + 2], head = u_fig[4 * f + 3];
      if (head.w < 0.5) continue;
      if (capsuleT(p, rr, feet.xyz, head.xyz, feet.w * 1.2) > 0.0) refl *= 0.12;
    }
    float w = 0.0;
    for (int i = 0 + ZERO; i < LAMP_N; i++) {
      vec3 L = normalize(LAMP_P[i].xyz - p);
      w += 1.2 * pow(max(dot(rr, L), 0.0), 220.0) * exp(-length(LAMP_P[i].xyz - p) / 18.0);
    }
    s.col = refl + u_warm * w;
    s.u = q;
    return s;
  }

  vec3 alb = tone(0.42, 0.0);
  float shine = 0.0;   // how glossy (the moon and the lamps in it)
  float rimK = 0.0;    // a cold edge on the people against the dark
  float accent = 0.0;  // a warm edge where the story points
  vec3 extra = vec3(0.0);
  bool far = h.id >= ID_WOODS;
  float floorY = 0.0;

  if (h.mat == M_GROUND) {
    float r = length(p.xz), th = atan(p.z, p.x);
    float thd = th / DEG;
    s.u = p.xz;
    if (inHouse(p)) {
      vec3 q = toFrame(p, csOf(HOUSE));
      s.u = vec2(q.z, q.x);
      s.period = vec2(2.1, 0.17);
      s.joint = vec2(0.45, 0.6);
      s.stagger = 1.0;
      alb = tone(0.34 * (0.8 + 0.4 * noise2(vec2(q.z * 0.7, q.x * 11.0), 3u)), 0.6);
      shine = 0.15;
    } else if (abs(wrapDeg(thd - 0.5 * (CAFE + FRIEND_DOOR))) < 34.0 && r > 15.0 && r < FACADE) {
      // The street: wet cobbles.
      s.u = vec2(th * r, r);
      s.period = vec2(0.3, 0.21);
      s.joint = vec2(0.55, 0.55);
      s.stagger = 1.0;
      alb = tone(0.26 * (0.75 + 0.5 * noise2(p.xz * 3.3, 5u)), -0.1);
      shine = 0.55;
    } else {
      float fade = smoothstep(6.0, 40.0, h.t);
      float gr = (0.75 + 0.5 * noise2(p.xz * 0.3, 7u)) * mix(0.75 + 0.5 * noise2(p.xz * 5.0, 9u), 1.0, fade);
      alb = tone(0.2 * gr, -0.3);
      float bed = abs(r - TRACK);
      if (bed < 1.25) {
        alb = tone(0.3 * (0.75 + 0.5 * mix(noise2(p.xz * 9.0, 11u), 0.5, fade)), 0.0);
        if (bed < 1.05 && fract(th * TRACK / 0.65) < 0.32) alb = tone(0.32, 0.5);
      }
    }
  } else if (h.mat == M_FIG) {
    int fi = h.id - ID_FIG;
    int part = int(h.top + 0.5);
    alb = figureTone(fi, part);
    rimK = 1.0;
    accent = fract(u_fig[4 * fi].w) / 0.9;
    floorY = u_fig[4 * fi].y;
    if (fi == 0) {
      // While the body remembers it is lit warm up to where the light has
      // climbed.
      float lit = MEM.y * (1.0 - smoothstep(MEM.x - 0.03, MEM.x + 0.03, p.y));
      extra += 0.3 * lit * mix(u_warm, u_pale, 0.2);
    }
  } else if (h.mat == M_CROWD) {
    int k = h.id - ID_CROWD;
    int part = int(h.top + 0.5);
    float kind = u_crowd[2 * k].w;
    float c1 = hash1(k, 5u), c2 = hash1(k, 7u), c3 = hash1(k, 11u);
    float lean = c3 < 0.25 ? 0.7 : (c3 > 0.78 ? -0.6 : 0.0);
    if (part == 0) alb = tone(0.12 + 0.2 * c2, -0.3);
    else if (part == 1) alb = tone(0.08, 0.0);
    else if (part == 2) alb = tone(0.2 + 0.45 * c1, lean);
    else if (part == 3) alb = tone(0.6, 0.45);
    else if (part == 4) alb = tone(0.14 + 0.3 * fract(c1 + c3), -0.4 * lean);
    else if (part == 5) alb = tone(0.16 + 0.25 * c2, 0.5);
    else if (part == 6) {
      alb = tone(0.05, 0.0);
      if (h.ln.z < 0.0) {
        s.emit = 1.1;
        s.glow = mix(u_pale, u_cold, 0.3);
      }
    } else {
      bool hair = h.ln.y > 0.35 || h.ln.z < -0.25;
      alb = hair ? tone(0.12 + 0.35 * c2, 0.4) : tone(0.6, 0.45);
    }
    if (has(kind, K_PHONE) && (part == 3 || part == 8)) {
      vec3 at, R, F;
      personFrame(k, at, R, F);
      float sz = u_crowd[2 * k].z;
      vec3 ph = at + (R * 0.05 + vec3(0.0, 1.23, 0.0) + F * 0.29) * sz;
      vec3 d = ph - p;
      float dist = length(d);
      extra += 0.7 * mix(u_pale, u_cold, 0.3) * max(dot(n, d / max(dist, 1e-4)), 0.0) * exp(-dist / 0.18);
    }
    rimK = 0.8;
    floorY = PLATFORM;
  } else if (h.mat == M_TREE) {
    if (far) {
      alb = tone(0.16 * (0.7 + 0.6 * noise2(vec2(lp.x * 0.6, lp.y * 0.8), 23u)), -0.4);
    } else if (h.top > 0.5) {
      alb = tone(0.22, 0.4);
    } else {
      // The crown: leaves as a broken surface, light and dark.
      vec3 q = p * 3.1;
      vec3 nz = 0.5 * sin(1.7 * q.yzx + 2.3 * sin(1.3 * q.zxy));
      n = normalize(n + 0.9 * nz);
      alb = tone(0.24 * (0.45 + 1.1 * noise3(p * 5.3, 29u)), -0.35);
    }
  } else if (h.mat == M_HILL) {
    alb = tone(0.14, -0.4);
  } else if (h.mat == M_ROOF) {
    if (h.id == ID_ROOF) {
      s.u = vec2(lp.z, lp.y / 0.479);
      s.period = vec2(0.28, 0.24);
      s.joint = vec2(0.35, 0.7);
      s.stagger = 1.0;
      alb = tone(0.26 * (0.8 + 0.4 * noise2(s.u * vec2(3.6, 4.2), 37u)), 0.35);
    } else {
      alb = tone(0.24, -0.1);
      if (an.y > 0.5) {
        s.u = vec2(lp.z, lp.x);
        s.period = vec2(0.9, 1.0);
        s.joint = vec2(0.4, 0.0);
      }
    }
    shine = 0.2;
  } else if (h.mat == M_LAMP) {
    s.emit = 1.7;
    s.glow = mix(u_warm, u_pale, 0.55);
    alb = vec3(0.0);
  } else if (h.mat == M_GLASS) {
    // The car's lit inside through its pane, brighter toward its lamp.
    s.emit = 0.5 + 0.25 * smoothstep(1.2, 2.3, lp.y);
    s.glow = mix(u_warm, u_pale, 0.25);
    alb = vec3(0.0);
  } else if (h.mat == M_DARK) {
    alb = tone(0.03, 0.0);
  } else if (h.mat == M_WALL) {
    alb = tone(0.44 * (0.9 + 0.2 * noise2(s.u * 1.7, 41u)), 0.3);
    if (lp.y < 0.12) alb = tone(0.22, 0.5);
  } else if (h.mat == M_WOOD) {
    vec3 sz = h.size;
    bool alongX = sz.x > sz.z;
    vec2 u = an.y > 0.5 ? (alongX ? lp.xz : lp.zx) : (an.x > 0.5 ? vec2(lp.y, lp.z) : vec2(lp.y, lp.x));
    if (an.y > 0.5 && max(sz.x, sz.z) > 0.7) {
      s.u = u;
      s.period = vec2(0.16, 1.0);
      s.joint = vec2(0.6, 0.0);
    }
    alb = tone(0.36 * (0.8 + 0.35 * noise2(vec2(u.x * 26.0, u.y * 0.9), 43u)), 0.6);
    shine = 0.1;
  } else if (h.mat == M_STONE) {
    alb = tone(0.34 * (0.85 + 0.3 * noise2(p.xz * 1.9, 47u)), 0.05);
    if (an.y > 0.5) {
      float r = length(p.xz);
      s.u = vec2(atan(p.z, p.x) * r, r);
      s.period = vec2(0.9, 0.6);
      s.joint = vec2(0.5, 0.5);
      s.stagger = 1.0;
    }
    shine = 0.25;
  } else if (h.mat == M_CAR) {
    alb = tone(0.36, -0.35);
    if (an.x > 0.5) {
      s.u = vec2(lp.z, lp.y);
      s.period = vec2(1.83, 1.0);
      s.joint = vec2(0.45, 0.0);
      if (lp.y < BAND.x - 0.05 && lp.y > BAND.x - 0.2) alb = tone(0.5, 0.6);
    }
    if (an.y > 0.5 && lp.y < CAR_FLOOR + 0.05) alb = tone(0.2, 0.2);
    shine = 0.35;
    floorY = CAR_FLOOR;
  } else if (h.mat == M_POLE) {
    alb = tone(0.3, -0.2);
    shine = 0.6;
  } else if (h.mat == M_FACADE) {
    alb = tone(0.36 * (0.88 + 0.24 * noise2(s.u * vec2(2.3, 1.7), 53u)), 0.2);
    if (lp.y < 0.55) alb *= 0.6;
    if (an.x > 0.5) {
      // The windows: lit ones glow, the dark ones are panes of night.
      float along = lp.z / 1.7;
      float fz = fract(along);
      float y = lp.y - 0.75;
      float fl = floor(y / 2.5), fy = y - 2.5 * fl;
      bool pane = fz > 0.28 && fz < 0.72 && fy > 0.0 && fy < 1.35 && y > 0.0 && 0.75 + 2.5 * fl + 1.35 < h.top - 0.4;
      if (pane) {
        float lit = step(0.48, hash3(int(floor(along)) + 17 * h.id, int(fl), int(h.top * 10.0), 5u));
        bool bar = abs(fz - 0.5) < 0.025 || abs(fy - 0.78) < 0.05;
        if (bar) {
          alb = tone(0.3, 0.3);
        } else if (lit > 0.5) {
          s.emit = 0.8 + 0.25 * hash1(int(floor(along)) + 31 * int(fl), 9u);
          s.glow = mix(u_warm, u_pale, 0.15);
          alb = vec3(0.0);
        } else {
          alb = tone(0.04, -0.3);
          shine = 0.8;
        }
      }
      float th = atan(p.z, p.x) / DEG;
      float r = length(p.xz);
      // The café's big window and her lit door.
      float cafe = abs(wrapDeg(th - CAFE)) * DEG * r;
      if (cafe < 1.25 && lp.y > 0.35 && lp.y < 2.3 && ln.x < 0.0) {
        bool mullion = abs(cafe - 0.62) < 0.035 || lp.y < 0.42;
        s.emit = mullion ? 0.0 : 0.95;
        s.glow = mix(u_warm, u_pale, 0.25);
        alb = mullion ? tone(0.3, 0.3) : vec3(0.0);
      }
      float door = abs(wrapDeg(th - FRIEND_DOOR)) * DEG * r;
      if (door < 0.46 && lp.y < 2.15 && ln.x < 0.0) {
        s.emit = 0.8;
        s.glow = u_warm;
        alb = vec3(0.0);
      }
    }
  }

  // The moon (in shadow or not), the night sky, the lamps.
  float moon = max(dot(n, MOON.xyz), 0.0);
  if (moon > 0.0 && !far && occluded(p + n * 0.012 + MOON.xyz * 0.004, MOON.xyz, h.id)) moon = 0.0;
  s.moon = moon;
  bool indoor = inHouse(p) || inCar(p) >= 0;
  float ao = 1.0;
  if (abs(n.y) < 0.6) ao = mix(0.45, 1.0, smoothstep(0.0, 0.7, p.y - floorY));
  ao *= contact(p, n);
  float sky = (0.55 + 0.45 * n.y) * (indoor ? 0.3 : 1.0) * ao;
  float lamp = far ? 0.0 : lampLight(p, n) * mix(0.6, 1.0, ao);
  vec3 skyC = mix(u_cold, u_ink, 0.3);
  vec3 col = alb * (0.62 * moon * moonC + 0.16 * sky * skyC + 0.95 * lamp * u_warm) + 1.5 * alb * extra;
  if (shine > 0.0) {
    vec3 r = reflect(rd, n);
    col += shine * (0.3 * moonC * moon * pow(max(dot(r, MOON.xyz), 0.0), 30.0) + 0.5 * u_warm * lampSheen(p, r));
  }
  if (rimK > 0.0) {
    float rim = pow(1.0 - max(dot(n, -rd), 0.0), 3.0);
    col += rimK * rim * (0.07 * moonC * (0.4 + moon) + 0.35 * accent * mix(u_warm, u_pale, 0.3));
  }
  s.col = col;
  return s;
}

// ---- the things over the world ----

// Lines along u every p metres covering c of the period, seen with pixels
// w metres wide: never thinner than a pixel, dimmer where they would be.
float lineAA(float u, float p, float c, float w) {
  float d = abs(fract(u / p + 0.5) - 0.5) * p;
  float hw = 0.5 * c * p;
  float wide = max(hw, 0.5 * w);
  return clamp((wide - d) / max(w, 1e-6) + 0.5, 0.0, 1.0) * (hw / wide);
}
// A surface's joints, gone where they would be finer than the pixels.
float joints(Surf s, vec2 w) {
  float ux = s.u.x + s.stagger * 0.5 * s.period.x * mod(floor(s.u.y / s.period.y), 2.0);
  float jx = lineAA(ux, s.period.x, 0.014 / s.period.x, w.x) * (1.0 - smoothstep(0.06, 0.3, w.x / s.period.x));
  float jy = lineAA(s.u.y, s.period.y, 0.014 / s.period.y, w.y) * (1.0 - smoothstep(0.06, 0.3, w.y / s.period.y));
  return max(s.joint.x * jx, s.joint.y * jy);
}

// A glyph of the code: 5 × 7 bits from a hash, in a cell f (0..1).
float glyph(vec2 f, ivec2 cell, int k) {
  int gx = int(f.x * 6.0), gy = int(f.y * 8.0);
  if (gx > 4 || gy > 6) return 0.0;
  return step(0.52, hash3(cell.x, cell.y, gx + 6 * gy + 64 * k, 71u));
}
// The code over a surface: glyphs in columns along u.y, raining along u.x.
float codeOn(vec2 u, vec2 w) {
  float cell = exp2(floor(log2(max(19.0 * max(w.x, w.y), 1e-5))));
  vec2 g = vec2(u.y, u.x) / cell;
  ivec2 ci = ivec2(floor(g));
  vec2 f = fract(g);
  float col = hash1(ci.x, 3u);
  float k = floor(TIME * (3.0 + 4.0 * col) + col * 9.0);
  float on = glyph(f, ci, int(k));
  float trail = fract(float(ci.y) * 0.061 - TIME * (0.35 + 0.5 * col) + col);
  return on * (0.18 + 0.82 * trail * trail * trail);
}

// The nearest the ray comes to three level circles (centres c[i], radii
// rho[i]) before tmax, in pixels, and how far along: one march stepping by
// the nearest of them.
void ringsNear(vec3 ro, vec3 rd, vec3 c0, vec3 c1, vec3 c2, vec3 rho, float tmax, out vec3 best, out vec3 bt) {
  float t = 0.03;
  best = vec3(1e5);
  bt = vec3(0.0);
  for (int k = 0 + ZERO; k < 72; k++) {
    vec3 p = ro + rd * t;
    vec3 q0 = p - c0, q1 = p - c1, q2 = p - c2;
    vec3 d = vec3(length(vec2(length(q0.xz) - rho.x, q0.y)), length(vec2(length(q1.xz) - rho.y, q1.y)),
                  length(vec2(length(q2.xz) - rho.z, q2.y)));
    vec3 px = d / pixelAt(t);
    bvec3 nearer = lessThan(px, best);
    best = mix(best, px, vec3(nearer));
    bt = mix(bt, vec3(t), vec3(nearer));
    t += max(0.8 * min(d.x, min(d.y, d.z)), 0.002 + 0.002 * t);
    if (t > tmax) break;
  }
}
float ringGlow(float px) {
  return exp(-px * px / 1.8) + 0.22 * exp(-px / 9.0);
}

// The nearest the ray comes to a segment: (distance, along the ray).
vec2 raySeg(vec3 ro, vec3 rd, vec3 a, vec3 b) {
  vec3 ba = b - a, oa = ro - a;
  float bb = dot(rd, ba), cc = dot(ba, ba), dd = dot(rd, oa), ee = dot(ba, oa);
  float den = max(cc - bb * bb, 1e-8);
  float s = clamp((ee - bb * dd) / den, 0.0, 1.0);
  vec3 q = a + ba * s;
  float t = max(dot(q - ro, rd), 0.0);
  return vec2(length(ro + rd * t - q), t);
}
// His route in the finale: one warm line from the field round the ring and
// home, drawn up to FX.y of its length, with a spark where it is drawing.
vec3 routeLight(vec3 ro, vec3 rd, float T) {
  if (FX.y < 0.001 || FX.z < 0.001) return vec3(0.0);
  float best = 1e5, spark = 1e5;
  for (int i = 0 + ZERO; i < ROUTE_N - 1; i++) {
    vec4 a = ROUTE_AT(i), b = ROUTE_AT(i + 1);
    if (a.w >= FX.y) break;
    vec3 bb = b.w > FX.y ? mix(a.xyz, b.xyz, (FX.y - a.w) / max(b.w - a.w, 1e-5)) : b.xyz;
    vec2 q = raySeg(ro, rd, a.xyz, bb);
    if (q.y > 0.0 && q.y < T + 0.4) best = min(best, q.x / pixelAt(q.y));
    if (b.w > FX.y || i == ROUTE_N - 2) {
      vec3 e = bb - ro;
      float te = dot(e, rd);
      if (te > 0.0 && te < T + 0.4) spark = length(ro + rd * te - bb) / pixelAt(te);
    }
  }
  float drawing = FX.y < 0.999 ? 1.0 : 0.0;
  return FX.z * (u_warm * ringGlow(best * 0.8) + u_pale * drawing * (exp(-spark / 2.5) + 0.3 * exp(-spark / 14.0)));
}

// The lamps' glow in the night air, in metres round each, never smaller
// than a pixel or two far off.
vec3 lampGlow(vec3 ro, vec3 rd, float T) {
  float sum = 0.0;
  for (int i = 0 + ZERO; i < LAMP_N; i++) {
    if (LAMP_P[i].w > 1000.0) continue;
    vec3 lp = LAMP_P[i].xyz;
    float tc = dot(lp - ro, rd);
    if (tc <= 0.05 || tc > T + 0.35) continue;
    float d = length(ro + rd * tc - lp);
    float px = pixelAt(tc);
    float core = max(0.012, 2.2 * px * px);
    float fade = exp(-tc / (1.6 * FX.x));
    sum += fade * (0.6 * exp(-d * d / core) + 0.2 * exp(-d / 0.35) + 0.05 * exp(-d / 1.6));
  }
  return mix(u_warm, u_pale, 0.3) * sum;
}

// The memory of the places in him, by height: the grass at his feet, the
// window's bars, the table's planks, the crowd's ticks, the train's
// streaks, the water's ripples, the street's waves at his crown.
float memory(vec3 p, vec2 w) {
  float hq = clamp((p.y - MEM.z) / max(MEM.w - MEM.z, 0.1), 0.0, 0.999);
  int band = int(hq * 7.0);
  float x = dot(p.xz, normalize(RIGHT.xz + 1e-5));
  float y = p.y;
  float wind = MEM2.y * TAU, clack = MEM2.x;
  float k = 0.0;
  float pw = max(w.x, w.y);
  if (band == 0) k = lineAA(x + 0.012 * sin(y * 50.0 + wind), 0.035, 0.28, pw) * step(0.35, fract(y / 0.05 + hash1(int(floor(x / 0.035)), 2u)));
  else if (band == 1) k = max(lineAA(x, 0.11, 0.18, pw), lineAA(y, 0.11, 0.18, pw));
  else if (band == 2) k = lineAA(y, 0.045, 0.3, pw) * step(0.12, fract(x / 0.3 + floor(y / 0.045) * 0.37));
  else if (band == 3) k = lineAA(x, 0.05, 0.3, pw) * step(0.62, hash2(int(floor(x / 0.05)), int(floor(y / 0.06)), 4u));
  else if (band == 4) k = lineAA(y, 0.035, 0.32, pw) * step(0.45, fract((x + clack * 1.6) / 0.28));
  else if (band == 5) k = lineAA(y + 0.008 * sin(x * 30.0 + wind), 0.03, 0.24, pw) * step(0.4, hash2(int(floor(x / 0.09 + floor(y / 0.03) * 0.5)), int(floor(y / 0.03)), 6u));
  else k = lineAA(y + 0.018 * sin(x * 38.0 + wind), 0.045, 0.3, pw);
  // A place shows just under the climbing ring and fades into the light
  // it leaves, so he is never striped from foot to crown.
  float under = 1.0 - smoothstep(MEM.x - 0.02, MEM.x + 0.02, p.y);
  float trail = smoothstep(MEM.x - 0.42, MEM.x - 0.06, p.y);
  return k * under * trail * MEM.y;
}

void main() {
  vec3 ro = EYE.xyz;
  vec3 rd = eyeRay();
  g_eyeInCar = inCar(ro) >= 0;
  Hit h = trace(ro, rd);
  vec3 p = ro + rd * h.t;
  bool sky = h.id == ID_SKY;
  Surf s = surfaceOf(h, ro, rd, p);

  // Derivatives at the top level only.
  vec2 w = vec2(fwidth(s.u.x), fwidth(s.u.y));
  float rG = length(p.xz);
  float rW = fwidth(rG);
  vec2 wf = vec2(fwidth(p.y), fwidth(dot(p.xz, normalize(RIGHT.xz + 1e-5))));

  vec3 col = u_paper + s.col;
  if (s.joint.x + s.joint.y > 0.0) col = u_paper + (col - u_paper) * (1.0 - joints(s, w));
  // The rails catch the moon.
  if (h.id == ID_GROUND && !inHouse(p)) {
    float rail = max(lineAA(rG - TRACK + 0.72, 1e3, 0.07e-3, rW), lineAA(rG - TRACK - 0.72, 1e3, 0.07e-3, rW));
    col = mix(col, u_paper + moonColor() * (0.1 + 0.4 * s.moon), rail);
  }
  // The memory of the places, warm in him.
  if (h.id == ID_FIG && MEM.y > 0.001) col = mix(col, mix(u_warm, u_pale, 0.35), 0.6 * memory(p, wf));

  float fog = sky ? 1.0 : exp(-h.t / FX.x);
  float fogE = sky ? 1.0 : exp(-h.t / (2.2 * FX.x));
  if (!sky) col = mix(fogColor(rd), col, fog);
  col += s.glow * s.emit * fogE;

  // The world melting into code round him.
  if (!sky && FX.w > 0.001 && h.id != ID_FIG) {
    float m = 1.0 - smoothstep(FX.w - 2.0, FX.w, rG);
    float front = exp(-abs(rG - FX.w) / 0.7) * step(0.5, FX.w) * (1.0 - step(MELT - 0.5, FX.w));
    float code = codeOn(s.u, w);
    float v = 4.0 * dot(max(col - u_paper, 0.0), vec3(0.3, 0.5, 0.2));
    vec3 melted = u_paper + u_code * (0.04 + code * (0.3 + 0.8 * min(v, 1.0) + 0.4 * s.emit));
    col = mix(col, melted, m);
    col += u_code * front * (0.35 + 0.65 * code) * fog;
  }

  // The night sky: the horizon's glow, the moon and its halo, the stars.
  if (sky) {
    col = skyBase(rd);
    float apx = 2.0 / (LENS * u_res.y);
    float ang = acos(clamp(dot(rd, MOON.xyz), -1.0, 1.0));
    float disc = 1.0 - smoothstep(0.03 - apx, 0.03 + apx, ang);
    vec3 mx = normalize(cross(MOON.xyz, vec3(0.0, 1.0, 0.0)));
    vec3 my = cross(mx, MOON.xyz);
    vec2 mq = vec2(dot(rd, mx), dot(rd, my)) / 0.03;
    float maria = smoothstep(0.45, 0.7, noise2(mq * 2.2 + 3.0, 53u));
    col = mix(col, u_pale * (1.5 - 0.45 * maria), disc);
    float el = asin(clamp(rd.y, -1.0, 1.0)), az = atan(rd.z, rd.x);
    vec2 g = vec2(az, el) / 0.016;
    vec2 gi = floor(g);
    float hs = hash2(int(gi.x), int(gi.y), 59u);
    if (hs > 0.982) {
      vec2 at = gi + 0.25 + 0.5 * vec2(hash2(int(gi.x), int(gi.y), 61u), hash2(int(gi.x), int(gi.y), 67u));
      vec2 dd = (g - at) * 0.016;
      dd.x *= cos(el);
      float d = length(dd);
      float tw = 0.65 + 0.35 * sin(TIME * (1.5 + 3.0 * hs) + hs * 40.0);
      col += u_pale * 0.8 * tw * (1.0 - smoothstep(0.4 * apx, 1.4 * apx, d)) * smoothstep(0.04, 0.16, el) * smoothstep(0.12, 0.3, ang)
           * (0.4 + 0.6 * step(0.993, hs));
    }
  }

  // Light over the world: the lamps, the wire, his two rings, his route.
  float T = h.t;
  col += lampGlow(ro, rd, T);
  float povFade = 1.0 - 0.85 * HEROP.w;
  vec3 c = SPHERE.xyz;
  float R = SPHERE.w;
  float rho = sqrt(max(R * R - (RINGS.x - c.y) * (RINGS.x - c.y), 1e-4));
  vec2 wc = mix(SPHERE.xz, HEROP.xz, RINGFX.w);
  vec3 near, along;
  vec3 c1 = vec3(c.x, RINGS.x, c.z), c2 = vec3(wc.x, RINGS.y, wc.y);
  ringsNear(ro, rd, vec3(0.0, WIRE_Y, 0.0), c1, c2, vec3(TRACK, rho, RINGS.z), T, near, along);
  // A ring seen edge-on is a hard line across the frame: it dims to a trace
  // while the eye is level with it.
  vec2 lift = vec2(abs(ro.y - c1.y) / max(length(ro.xz - c1.xz), rho), abs(ro.y - c2.y) / max(length(ro.xz - c2.xz), RINGS.z));
  vec2 side = mix(vec2(0.12), vec2(1.0), smoothstep(vec2(0.03), vec2(0.2), lift)) * povFade;
  col = mix(col, u_paper * 0.6, 0.55 * exp(-near.x * near.x / 0.6) * exp(-along.x / FX.x));
  col += mix(u_cold, u_pale, 0.35 * exp(-near.y)) * 1.1 * ringGlow(near.y) * side.x;
  col += mix(u_warm, u_pale, 0.35 * exp(-near.z)) * 1.1 * ringGlow(near.z) * side.y;
  col += routeLight(ro, rd, T);

  o = vec4(max(col, 0.0), h.t / (h.t + 8.0));
}
