// «Сквозной путь»: the ring of places at night drawn as a living engraving,
// pale lines on the dark page. One ray per pixel finds the nearest thing
// (the places' boxes, the house's roof, the field and the pond, the trees,
// the crowd, the three figures, the far woods and hills), the moon and the
// lamps light it, and the light becomes lines: one hatch where it is dim, a
// cross hatch where it is bright, solid where it glows. Contours come from
// where the surface breaks. Over it: his sphere and its two rings, the
// overhead wire, the lamps' halos, his route in the finale, the warm memory
// of the places in him and the code the world melts into.

uniform highp sampler2D u_data;
uniform vec4 u_g[3 * GROUPS];  // per group: [lo, first texel], [hi, boxes], [cos, sin]
uniform vec4 u_fig[4 * FIGS];  // per figure: [low, base + accent], [high], [feet, r], [head, seen]
uniform vec4 u_out;            // soft edges, -, -, -
uniform vec3 u_backdrop;       // the page round the scene
uniform vec4 u_edges;          // left, right, top, bottom
uniform vec3 u_paper;
uniform vec3 u_ink;
uniform vec3 u_cold;
uniform vec3 u_warm;
uniform vec3 u_pale;
uniform vec3 u_code;

in vec2 v_uv;
out vec4 o;

const float BLEND[CONES] = float[CONES](BLEND_LIST);
const vec4 CROWD_P[CROWD_N] = vec4[CROWD_N](CROWD_LIST);
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
  vec3 ln;   // the normal in the box's frame
  vec3 lp;   // where, in the box's frame
  float top; // the box's top; a figure's cone
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

float crowdShown() {
  return 1.0 - window(TIME, CROWD_GONE.x, CROWD_GONE.y, CROWD_GONE.z, CROWD_GONE.w);
}
// A person of the crowd: the body from its hips to its shoulders, its head.
void crowdShape(int i, out vec3 a, out vec3 b, out vec3 head, out float r) {
  vec4 c = CROWD_P[i];
  float ph = c.w * TAU;
  vec2 sway = 0.03 * vec2(sin(TIME * 1.1 + ph), cos(TIME * 0.83 + 1.3 * ph));
  a = vec3(c.x + 0.3 * sway.x, PLATFORM + 0.26 * c.z, c.y + 0.3 * sway.y);
  b = vec3(c.x + sway.x, PLATFORM + (CROWD_SHOULDER - 0.14) * c.z, c.y + sway.y);
  head = vec3(b.x + 0.4 * sway.x, PLATFORM + CROWD_HEAD * c.z, b.z + 0.4 * sway.y);
  r = CROWD_R * c.z;
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
  // The trees: trunks, and the crowns where the ray comes near them.
  for (int k = 0 + ZERO; k < TREE_N; k++) {
    vec4 tr = TREE_P[k];
    float cy = tr.z - 1.2 * tr.w;
    vec3 n;
    float t = cylT(ro - vec3(tr.x, 0.5 * cy, tr.y), rd, 0.08 + 0.04 * tr.w, 0.5 * cy, n);
    if (t > 0.0 && t < h.t) {
      h.t = t;
      h.mat = M_TREE;
      h.id = ID_TREE + k;
      h.n = n;
      h.ln = n;
      h.lp = ro + rd * t;
      h.top = 1.0;
    }
    vec3 oc = ro - vec3(tr.x, cy, tr.y);
    float b = dot(oc, rd), c = dot(oc, oc) - 4.0 * tr.w * tr.w;
    if (b * b - c < 0.0 || -b + sqrt(max(b * b - c, 0.0)) < 0.0) continue;
    lobeHit(k, 0, ro, rd, h);
    lobeHit(k, 1, ro, rd, h);
    lobeHit(k, 2, ro, rd, h);
  }
  // The crowd on the platform, fading as a dither while they come and go.
  float dith = rand(uint(gl_FragCoord.x) * 7919u + uint(gl_FragCoord.y) * 104729u + 17u);
  float shown = crowdShown();
  if (shown > 0.02 && dith < shown) {
    for (int k = 0 + ZERO; k < CROWD_N; k++) {
      vec3 a, b, hd;
      float r;
      crowdShape(k, a, b, hd, r);
      float t = capsuleT(ro, rd, a, b, r);
      if (t > 0.0 && t < h.t) {
        vec3 p = ro + rd * t;
        h.t = t;
        h.mat = M_CROWD;
        h.id = ID_CROWD + k;
        h.n = capsuleN(p, a, b);
        h.ln = h.n;
        h.lp = p;
        h.top = 0.0;
      }
      vec3 n;
      t = ballT(ro - hd, rd, vec3(0.105, 0.125, 0.105) * CROWD_P[k].z, n);
      if (t > 0.0 && t < h.t) {
        h.t = t;
        h.mat = M_CROWD;
        h.id = ID_CROWD + k;
        h.n = n;
        h.ln = n;
        h.lp = ro + rd * t;
        h.top = 1.0;
      }
    }
  }
  // The woods and the hills.
  ringWall(ro, rd, 46.0, 3.0, 3.2, 9.0, 41u, M_TREE, ID_WOODS, h);
  ringWall(ro, rd, 130.0, 5.0, 15.0, 2.2, 43u, M_HILL, ID_HILLS, h);
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
      vec3 a, b, hd;
      float r;
      crowdShape(k, a, b, hd, r);
      if (capsuleT(ro, rd, a, hd, r) > 0.0) return true;
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

struct Surf {
  float v;      // the light the lines show
  float warm;   // how much of it is the lamps'
  float emit;   // glowing: solid
  vec3 glow;    // its colour
  float u1;     // the first hatch's coordinate (metres)
  float u2;     // the cross hatch's
  float cross;  // how readily the cross hatch comes in
  float boil;   // how much the lines tremble
};

float figureAlbedo(int part) {
  if (part == COLLAR || (part >= SCARF && part < SCARF + SCARF_LINKS)) return 0.95;
  if (part == FACE || part == HEAD || part == HAND_L || part == HAND_R) return 0.9;
  if (part == CAP) return 0.55;
  if (part == FOOT_L || part == FOOT_R || part == TOE_L || part == TOE_R) return 0.32;
  if (part == 0 || (part >= LEG_FIRST && part <= LEG_LAST)) return 0.45;
  return 0.66;
}

Surf surfaceOf(Hit h, vec3 ro, vec3 rd, vec3 p) {
  Surf s;
  s.warm = 0.0;
  s.emit = 0.0;
  s.glow = u_warm;
  s.cross = 0.7;
  s.boil = 0.18;
  vec3 n = h.n;
  vec3 ln = h.ln, lp = h.lp;
  // The faces of a box: lines along its height and along its length.
  vec3 an = abs(ln);
  s.u1 = an.y > 0.5 ? lp.x : lp.y;
  s.u2 = an.x > 0.5 ? lp.z : (an.z > 0.5 ? lp.x : lp.z);

  if (h.id == ID_SKY) {
    float el = asin(clamp(rd.y, -1.0, 1.0));
    float az = atan(rd.z, rd.x);
    float ang = acos(clamp(dot(rd, MOON.xyz), -1.0, 1.0));
    float band = smoothstep(0.55, 0.85, noise2(vec2(az * 3.0, el * 26.0), 61u)) * window(el, 0.03, 0.08, 0.3, 0.45);
    s.v = 0.13 * exp(-max(el, 0.0) / 0.1) + 0.42 * exp(-ang / 0.12) + 0.22 * band * (0.4 + exp(-ang / 0.5));
    s.u1 = el * 14.0;
    s.u2 = az * 14.0;
    s.cross = 0.0;
    return s;
  }

  // The moon (in shadow or not), the night sky, the lamps.
  float moon = max(dot(n, MOON.xyz), 0.0);
  if (moon > 0.0 && h.id < ID_WOODS && h.mat != M_WATER && occluded(p + n * 0.012 + MOON.xyz * 0.004, MOON.xyz, h.id)) moon = 0.0;
  bool indoor = inHouse(p) || inCar(p) >= 0;
  float amb = (0.085 + 0.045 * n.y) * (indoor ? 0.45 : 1.0);
  float lamp = h.id >= ID_WOODS ? 0.0 : lampLight(p, n);
  float light = 0.95 * moon + amb + lamp;
  s.warm = 0.8 * lamp / max(light, 1e-4) * smoothstep(0.06, 0.45, lamp);
  float albedo = 0.6;

  if (h.mat == M_GROUND) {
    float r = length(p.xz);
    float th = atan(p.z, p.x);
    albedo = 0.5 * (0.75 + 0.5 * noise2(p.xz * 0.3, 7u));
    vec2 fd = vec2(0.8, 0.6);
    s.u1 = dot(p.xz, fd) + 0.9 * noise2(p.xz * 0.09, 9u) + 0.08 * noise2(p.xz * 0.9, 11u);
    s.u2 = dot(p.xz, vec2(-fd.y, fd.x)) + 0.6 * noise2(p.xz * 0.11, 13u);
    float bed = abs(r - TRACK);
    if (bed < 1.25) {
      albedo = 0.58;
      bool sleeper = bed < 1.05 && fract(th * TRACK / 0.65) < 0.32;
      if (sleeper) {
        albedo = 0.72;
        s.u1 = th * r;
        s.u2 = r;
      }
    }
    s.cross = 0.55;
  } else if (h.mat == M_WATER) {
    // Dark water: the moon's path and the lamps in it.
    vec2 q = p.xz;
    float tt = TIME;
    vec2 slope = 0.035 * vec2(cos(dot(q, vec2(1.7, 0.6)) + tt * 0.7), cos(dot(q, vec2(-0.5, 2.3)) - tt * 0.55))
               + 0.02 * vec2(cos(dot(q, vec2(4.1, -2.9)) + tt * 1.3), cos(dot(q, vec2(3.3, 5.1)) - tt * 1.1));
    vec3 nw = normalize(vec3(-slope.x, 1.0, -slope.y));
    vec3 rr = reflect(rd, nw);
    float m = max(dot(rr, MOON.xyz), 0.0);
    float v = 2.4 * pow(m, 160.0) + 0.35 * pow(m, 14.0) + 0.035;
    float w = 0.0;
    for (int i = 0 + ZERO; i < LAMP_N; i++) {
      vec3 L = normalize(LAMP_P[i].xyz - p);
      w += 1.4 * pow(max(dot(rr, L), 0.0), 220.0) * exp(-length(LAMP_P[i].xyz - p) / 18.0);
    }
    // Him and her on the pier, upside down in it: the moon's path broken.
    for (int f = 0 + ZERO; f < FIGS; f++) {
      vec4 feet = u_fig[4 * f + 2], head = u_fig[4 * f + 3];
      if (head.w < 0.5) continue;
      if (capsuleT(p, rr, feet.xyz, head.xyz, feet.w * 1.2) > 0.0) v = mix(v, 0.16, 0.9);
    }
    s.v = v + w;
    s.warm = w / max(v + w, 1e-4);
    vec2 f = normalize(FWD.xz + 1e-5);
    s.u1 = dot(q, f) + 0.025 * sin(dot(q, vec2(-f.y, f.x)) * 2.1 + tt * 0.8);
    s.u2 = dot(q, vec2(-f.y, f.x));
    s.cross = 0.0;
    s.boil = 0.1;
    return s;
  } else if (h.mat == M_FIG) {
    int fi = h.id - ID_FIG;
    int part = int(h.top + 0.5);
    float accent = fract(u_fig[4 * fi].w) / 0.9;
    albedo = figureAlbedo(part) * (fi == 0 ? 1.0 : 0.82);
    if (fi == 0 && (part == COLLAR || (part >= SCARF && part < SCARF + SCARF_LINKS))) s.warm = max(s.warm, 0.8);
    float rim = smoothstep(0.62, 0.9, 1.0 - abs(dot(n, rd)));
    light += 0.55 * rim * accent;
    s.warm = mix(s.warm, 1.0, 0.8 * rim * accent);
    s.u1 = p.y;
    s.u2 = dot(p.xz, normalize(RIGHT.xz + 1e-5));
    s.cross = 0.8;
    if (fi == 0) {
      float tremble = MEM.y * (0.55 + 0.25 * sin(MEM2.x * TAU * 3.0) + 0.2 * sin(MEM2.y * TAU * 2.0) + 0.3 * MEM2.w);
      s.boil = 0.18 + 0.7 * tremble;
      // While the body remembers it is lit warm up to where the light has
      // climbed.
      float lit = MEM.y * (1.0 - smoothstep(MEM.x - 0.03, MEM.x + 0.03, p.y));
      light += 0.3 * lit;
      s.warm = mix(s.warm, 0.75, lit);
    }
  } else if (h.mat == M_CROWD) {
    albedo = 0.5 + 0.2 * hash1(h.id, 5u);
    s.u1 = p.y;
    s.u2 = dot(p.xz, normalize(RIGHT.xz + 1e-5));
  } else if (h.mat == M_TREE) {
    albedo = h.id == ID_WOODS ? 0.5 : 0.48;
    s.u1 = p.y + 0.16 * noise3(p * 1.3, 13u) + 0.05 * noise3(p * 4.3, 17u);
    s.u2 = dot(p.xz, normalize(RIGHT.xz + 1e-5)) + 0.12 * noise3(p * 1.9, 19u);
    s.cross = 0.45;
    if (h.id == ID_WOODS) {
      s.u1 = lp.y + 0.25 * noise2(vec2(lp.x * 0.7, lp.y * 0.9), 23u);
      s.u2 = lp.x;
      moon = 0.0;
      light = amb + 0.45 * max(dot(n, MOON.xyz), 0.0);
    }
  } else if (h.mat == M_HILL) {
    albedo = 0.42;
    s.u1 = lp.y;
    s.u2 = lp.x;
    light = amb + 0.6 * max(dot(n, MOON.xyz), 0.0);
    s.cross = 0.0;
  } else if (h.mat == M_ROOF) {
    albedo = 0.55;
    s.u1 = lp.y;
    s.u2 = lp.z;
  } else if (h.mat == M_LAMP) {
    s.emit = 1.0;
    s.glow = mix(u_warm, u_pale, 0.5);
    albedo = 1.0;
  } else if (h.mat == M_GLASS) {
    // The car's lit inside through its pane, brighter toward its lamp.
    s.emit = 0.42 + 0.22 * smoothstep(1.2, 2.3, lp.y);
    s.glow = mix(u_warm, u_pale, 0.25);
    albedo = 0.0;
  } else if (h.mat == M_DARK) {
    albedo = 0.08;
  } else if (h.mat == M_WALL) {
    albedo = 0.62;
  } else if (h.mat == M_WOOD) {
    albedo = 0.6;
  } else if (h.mat == M_STONE) {
    albedo = 0.62;
    if (an.y > 0.5) {
      s.u1 = length(p.xz);
      s.u2 = atan(p.z, p.x) * length(p.xz);
    }
  } else if (h.mat == M_CAR) {
    albedo = 0.56;
  } else if (h.mat == M_POLE) {
    albedo = 0.7;
  } else if (h.mat == M_FACADE) {
    albedo = 0.5;
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
          albedo = 0.5;
        } else if (lit > 0.5) {
          s.emit = 0.85;
          s.glow = u_warm;
        } else {
          albedo = 0.06;
        }
      }
      float th = atan(p.z, p.x) / DEG;
      float r = length(p.xz);
      // The café's big window and her lit door.
      float cafe = abs(wrapDeg(th - CAFE)) * DEG * r;
      if (cafe < 1.25 && lp.y > 0.35 && lp.y < 2.3 && ln.x < 0.0) {
        bool mullion = abs(cafe - 0.62) < 0.035 || lp.y < 0.42;
        s.emit = mullion ? 0.0 : 0.9;
        s.glow = mix(u_warm, u_pale, 0.2);
        albedo = mullion ? 0.5 : albedo;
      }
      float door = abs(wrapDeg(th - FRIEND_DOOR)) * DEG * r;
      if (door < 0.46 && lp.y < 2.15 && ln.x < 0.0) {
        s.emit = 0.75;
        s.glow = u_warm;
      }
    }
  }
  s.v = albedo * light;
  return s;
}

// ---- the engraving ----

float spacingPx() {
  return max(4.5, u_res.y / 160.0);
}
// Lines along u every p metres covering c of the period, seen with pixels
// w metres wide: never thinner than a pixel, dimmer where they would be.
float lineAA(float u, float p, float c, float w) {
  float d = abs(fract(u / p + 0.5) - 0.5) * p;
  float hw = 0.5 * c * p;
  float wide = max(hw, 0.5 * w);
  return clamp((wide - d) / max(w, 1e-6) + 0.5, 0.0, 1.0) * (hw / wide);
}
// The same, spaced by the pixel so the lines stay as dense on the page as
// the surface turns away: two octaves blended.
float hatch(float u, float w, float c) {
  float lv = log2(max(spacingPx() * w, 1e-6));
  float p0 = exp2(floor(lv));
  return mix(lineAA(u, p0, c, w), lineAA(u, 2.0 * p0, c, w), fract(lv));
}
float engrave(float v, vec2 u, vec2 w, float cross) {
  float a = hatch(u.x, w.x, 0.56 * smoothstep(0.006, 0.85, v));
  float b = hatch(u.y, w.y, 0.4 * cross * smoothstep(0.42, 1.05, v));
  float fill = smoothstep(1.4, 2.4, v);
  return max(1.0 - (1.0 - a) * (1.0 - b), fill);
}

// ---- the things over the world ----

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

// The nearest the ray comes to a level circle (centre c, radius rho), in
// pixels, before tmax; and how far along.
vec2 ringNear(vec3 ro, vec3 rd, vec3 c, float rho, float tmax) {
  float t = 0.03, best = 1e5, bt = 0.0;
  for (int k = 0 + ZERO; k < 48; k++) {
    vec3 q = ro + rd * t - c;
    float d = length(vec2(length(q.xz) - rho, q.y));
    float px = d / pixelAt(t);
    if (px < best) {
      best = px;
      bt = t;
    }
    t += max(0.8 * d, 0.002 + 0.002 * t);
    if (t > tmax) break;
  }
  return vec2(best, bt);
}
float ringGlow(float px) {
  return exp(-px * px / 1.8) + 0.22 * exp(-px / 9.0);
}

// His sphere: its lines of latitude and longitude and its rim, front and
// (fainter) back.
float shell(vec3 p, vec3 c, float R, float t, vec3 rd) {
  vec3 n = (p - c) / R;
  float lat = asin(clamp(n.y, -1.0, 1.0)), lon = atan(n.z, n.x);
  float px = pixelAt(t) / R;
  float g = PI / 12.0;
  float face = max(abs(dot(n, rd)), 0.2);
  float dLat = abs(fract(lat / g + 0.5) - 0.5) * g * face;
  float dLon = abs(fract(lon / g + 0.5) - 0.5) * g * cos(lat) * face;
  float lines = max(1.0 - smoothstep(0.0, 1.4 * px, dLat), 1.0 - smoothstep(0.0, 1.4 * px, dLon));
  float rim = pow(1.0 - abs(dot(n, rd)), 5.0);
  return 0.3 * lines + 0.6 * rim + 0.02;
}
vec3 sphereLight(vec3 ro, vec3 rd, float T) {
  vec3 c = SPHERE.xyz;
  float R = SPHERE.w;
  vec3 oc = ro - c;
  float b = dot(oc, rd), cc = dot(oc, oc) - R * R;
  float disc = b * b - cc;
  if (disc <= 0.0) return vec3(0.0);
  float sq = sqrt(disc);
  float t0 = -b - sq, t1 = -b + sq;
  float outside = smoothstep(0.85 * R, 1.25 * R, length(oc));
  float L = 0.0;
  if (t0 > 0.0 && t0 < T) L += shell(ro + rd * t0, c, R, t0, rd) * outside;
  if (t1 > 0.0 && t1 < T) L += 0.4 * shell(ro + rd * t1, c, R, t1, rd) * max(outside, 0.3);
  return u_cold * L * (1.0 - 0.9 * HEROP.w);
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

// The lamps' halos: a soft glow and two engraved rings round each.
vec3 halos(vec3 ro, vec3 rd, float T) {
  float sum = 0.0;
  for (int i = 0 + ZERO; i < LAMP_N; i++) {
    if (LAMP_P[i].w > 1000.0) continue;
    vec3 lp = LAMP_P[i].xyz;
    float tc = dot(lp - ro, rd);
    if (tc <= 0.05 || tc > T + 0.35) continue;
    float px = length(ro + rd * tc - lp) / pixelAt(tc);
    float far = exp(-tc / (1.6 * FX.x));
    sum += far * (0.55 * exp(-px / 4.5) + 0.12 * exp(-px / 22.0)
                  + 0.16 * (1.0 - smoothstep(0.0, 1.2, abs(px - 11.0))) + 0.08 * (1.0 - smoothstep(0.0, 1.2, abs(px - 19.0))));
  }
  return u_warm * sum;
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

  // The lines tremble a little, eight times a second; more in him while
  // he remembers.
  float frameNo = floor(TIME * 8.0);
  float pxm = pixelAt(sky ? 1.0 : h.t);
  float S = spacingPx();
  vec3 bq = (sky ? rd : p) / (3.0 * S * pxm) + vec3(frameNo * 1.7, frameNo * 0.3, 0.0);
  s.u1 += s.boil * S * pxm * (noise3(bq, 29u) - 0.5);
  s.u2 += s.boil * S * pxm * (noise3(bq + 11.0, 31u) - 0.5);

  // Derivatives at the top level only.
  vec2 w = vec2(fwidth(s.u1), fwidth(s.u2));
  float rG = length(p.xz);
  float rW = fwidth(rG);
  float idW = fwidth(float(h.id));
  vec3 nW = fwidth(h.n);
  float tW = fwidth(h.t);

  float ink = engrave(s.v, vec2(s.u1, s.u2), w, s.cross);
  // The rails catch the moon.
  if (h.id == ID_GROUND) {
    float rail = max(lineAA(rG - TRACK + 0.72, 1e3, 0.07e-3, rW), lineAA(rG - TRACK - 0.72, 1e3, 0.07e-3, rW));
    ink = max(ink, rail * (0.55 + 0.4 * max(dot(h.n, MOON.xyz), 0.0)));
  }
  float fog = sky ? 1.0 : exp(-h.t / FX.x);
  float fogE = sky ? 1.0 : exp(-h.t / (2.2 * FX.x));
  vec3 inkCol = mix(u_ink, u_warm, clamp(s.warm, 0.0, 1.0));

  vec3 col = u_paper;
  col = mix(col, inkCol, ink * fog);
  col = mix(col, s.glow, s.emit * fogE);
  if (!sky) col += u_ink * 0.03 * (1.0 - fog);

  // The contours: where the surface breaks or ends.
  float edge = 0.0;
  if (idW > 0.01) edge = 1.0;
  edge = max(edge, smoothstep(0.4, 0.9, nW.x + nW.y + nW.z));
  if (tW > 0.07 * h.t && abs(dot(h.n, rd)) > 0.3) edge = max(edge, 1.0);
  col = mix(col, u_ink, 0.62 * edge * fog);

  // The memory of the places, warm in him.
  if (h.id == ID_FIG && MEM.y > 0.001) col = mix(col, mix(u_warm, u_pale, 0.35), 0.6 * memory(p, w));

  // The world melting into code round him.
  if (!sky && FX.w > 0.001 && h.id != ID_FIG) {
    float m = 1.0 - smoothstep(FX.w - 2.0, FX.w, rG);
    float front = exp(-abs(rG - FX.w) / 0.7) * step(0.5, FX.w) * (1.0 - step(MELT - 0.5, FX.w));
    float code = codeOn(vec2(s.u1, s.u2), w);
    vec3 melted = u_paper + u_code * (0.05 + code * (0.35 + 0.8 * min(s.v, 1.0) + 0.4 * s.emit));
    col = mix(col, melted, m);
    col += u_code * front * (0.35 + 0.65 * code) * fog;
  }

  // The night sky: the moon, its halo, the stars.
  if (sky) {
    float apx = 2.0 / (LENS * u_res.y);
    float ang = acos(clamp(dot(rd, MOON.xyz), -1.0, 1.0));
    float disc = 1.0 - smoothstep(0.03 - apx, 0.03 + apx, ang);
    vec3 mx = normalize(cross(MOON.xyz, vec3(0.0, 1.0, 0.0)));
    vec3 my = cross(mx, MOON.xyz);
    vec2 mq = vec2(dot(rd, mx), dot(rd, my)) / 0.03;
    float maria = smoothstep(0.45, 0.7, noise2(mq * 2.2 + 3.0, 53u));
    col = mix(col, u_pale * (0.95 - 0.3 * maria), disc);
    for (int i = 0 + ZERO; i < 3; i++) {
      float rr = 0.055 + 0.032 * float(i) + 0.008 * float(i * i);
      col += u_pale * (0.22 / float(i + 1)) * (1.0 - smoothstep(0.0, 1.3 * apx, abs(ang - rr)));
    }
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
      col += u_pale * tw * (1.0 - smoothstep(0.4 * apx, 1.4 * apx, d)) * smoothstep(0.04, 0.16, el) * smoothstep(0.12, 0.3, ang)
           * (0.4 + 0.6 * step(0.993, hs));
    }
  }

  // Light over the world: the lamps, the wire, his sphere and its rings,
  // his route.
  float T = h.t;
  col += halos(ro, rd, T);
  vec2 wire = ringNear(ro, rd, vec3(0.0, WIRE_Y, 0.0), TRACK, T);
  col = mix(col, u_ink, 0.5 * exp(-wire.x * wire.x / 0.6) * exp(-wire.y / FX.x));
  col += sphereLight(ro, rd, T);
  float povFade = 1.0 - 0.85 * HEROP.w;
  vec3 c = SPHERE.xyz;
  float R = SPHERE.w;
  float rho = sqrt(max(R * R - (RINGS.x - c.y) * (RINGS.x - c.y), 1e-4));
  vec2 cold = ringNear(ro, rd, vec3(c.x, RINGS.x, c.z), rho, T);
  col += mix(u_cold, u_pale, 0.35 * exp(-cold.x)) * 1.1 * ringGlow(cold.x) * povFade;
  vec2 wc = mix(SPHERE.xz, HEROP.xz, RINGFX.w);
  vec2 warm = ringNear(ro, rd, vec3(wc.x, RINGS.y, wc.y), RINGS.z, T);
  col += mix(u_warm, u_pale, 0.35 * exp(-warm.x)) * 1.1 * ringGlow(warm.x) * povFade;
  col += routeLight(ro, rd, T);

  // Dither against banding in the glows.
  col += (rand(uint(gl_FragCoord.x) * 1973u + uint(gl_FragCoord.y) * 9277u + 5u) - 0.5) / 255.0;
  if (u_out.x > 0.5) {
    float m = smoothstep(0.0, u_edges.x, v_uv.x) * smoothstep(0.0, u_edges.y, 1.0 - v_uv.x)
            * smoothstep(0.0, u_edges.z, 1.0 - v_uv.y) * smoothstep(0.0, u_edges.w, v_uv.y);
    col = mix(u_backdrop, col, m);
  }
  o = vec4(clamp(col, 0.0, 1.0), 1.0);
}
