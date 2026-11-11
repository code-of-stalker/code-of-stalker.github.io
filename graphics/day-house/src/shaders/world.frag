// The house cut open on its black lacquer table, one ray a pixel: the
// rooms and the street as primitives in cells (house.rs), the people as
// cones blended into bodies (body.rs), the painted sky behind. Lit by the
// sun through the open front, the sky, one lamp a room, the street's lamps
// and the tram's; and in the air the three rings round him, the line of his
// day with its beads, the tram's horn, the coin's glint, the tea's steam,
// the deadlines' sparks. Writes cold light, warm light, depth (z / (z + 8))
// and the lens's blur.
//
// It is drawn in passes (browser.rs puts one PASS_ define in front), so
// D3D's shader compiler (Chrome on Windows) builds each in a second or two,
// side by side: PASS_HITS traces the eye's ray and writes what it met (one
// float frame: Chrome would build a pass writing several frames a second
// time at its first draw); PASS_SHADOW traces the sun's ray from there;
// PASS_LIGHT lights it (it writes the depth and the blur); PASS_FX adds the
// rings, the line and the rest of the light in the air. The table's
// reflection is the hits, the light and the air drawn first from the eye
// mirrored under the table (u_res.w = MIRROR), at half size and without
// shadows; the lacquer reads it from u_refl. PASS_ALL is all of it in one
// program (no reflection), for a GPU that cannot draw into float frames.
//
// That compiler also takes seconds for every loop nested in another, so
// the trace walks cells, groups and primitives in one loop, and no shape
// has a loop of its own.

out vec4 o;
#if !defined(PASS_HITS) && !defined(PASS_ALL)
uniform highp sampler2D u_h0;
#endif
#ifdef PASS_LIGHT
uniform highp sampler2D u_refl;
uniform highp sampler2D u_shadow;
#endif

uniform highp sampler2D u_data;
uniform vec4 u_c[2 * CELLS];
uniform vec4 u_fig[4 * FIGS];

const float BLEND[CONES] = float[CONES](BLENDS);
const vec3 LAMP_POS[CELLS] = vec3[CELLS](LAMP_LIST);

#define K_VOID 0
#define K_PRIM 1
#define K_FIG 2
#define K_TABLE 3

struct Hit {
  float t;
  int kind;
  int mat;
  float tone;
  vec3 n;
  int id;      // the cell, or the person
  vec3 lp;     // where, in the primitive's own frame
  int flags;
  float part;  // the person's cone; a primitive's first texel
};

Hit noHit(float tmax) {
  Hit h;
  h.t = tmax;
  h.kind = K_VOID;
  h.mat = 0;
  h.tone = 0.0;
  h.n = vec3(0.0, 1.0, 0.0);
  h.id = 0;
  h.lp = vec3(0.0);
  h.flags = 0;
  h.part = 0.0;
  return h;
}

vec4 tx(int i) {
  return texelFetch(u_data, ivec2(i % DATA_W, i / DATA_W), 0);
}

// A line `width` thick at distance e, seen with pixels px wide: never
// thinner than a pixel, dimmer where it is thinner than one.
float lineK(float e, float width, float px) {
  float w = max(width, px);
  return sline(e, w) * width / w;
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
// A primitive's frame: r = (cos yaw, sin yaw, cos pitch, sin pitch), as
// house.rs Prim::axes turns it (pitch about its own x, then yaw).
vec3 toLocal(vec3 v, vec4 r) {
  vec3 a = vec3(r.x * v.x - r.y * v.z, v.y, r.y * v.x + r.x * v.z);
  return vec3(a.x, r.z * a.y + r.w * a.z, -r.w * a.y + r.z * a.z);
}
vec3 toWorld(vec3 v, vec4 r) {
  vec3 a = vec3(v.x, r.z * v.y - r.w * v.z, r.w * v.y + r.z * v.z);
  return vec3(r.x * a.x + r.y * a.z, a.y, -r.y * a.x + r.x * a.z);
}
// A box of half size h round the origin: where the ray enters and leaves,
// and the entry face's normal.
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
  if (abs(d.y) > 1e-9) {
    float cy = d.y > 0.0 ? -hh : hh;
    float s = (cy - o.y) / d.y;
    vec2 q = o.xz + d.xz * s;
    if (s > 0.0 && s < t && dot(q, q) <= r * r) {
      t = s;
      n = vec3(0.0, sign(cy), 0.0);
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
// A ring in its own xy plane, radius hs.x to the tube's outside, tube a:
// drawn flat, its normal bent as a tube's across it.
float ringT(vec3 o, vec3 d, vec3 hs, float a, out vec3 n) {
  n = vec3(0.0, 0.0, 1.0);
  if (abs(d.z) < 1e-6) return -1.0;
  float s = -o.z / d.z;
  if (s <= 0.0) return -1.0;
  vec2 q = o.xy + d.xy * s;
  float R = max(hs.x - a, a);
  float e = length(q) - R;
  if (abs(e) > a) return -1.0;
  float k = e / a;
  n = normalize(vec3(normalize(q + 1e-6) * k, (d.z > 0.0 ? -1.0 : 1.0) * sqrt(max(1.0 - k * k, 0.0))));
  return s;
}
// A tyre or a wheel: the flat ring, and its tread (the band round the
// outside), so it does not vanish edge on.
float wheelT(vec3 o, vec3 d, vec3 hs, float a, out vec3 n) {
  float t = ringT(o, d, hs, a, n);
  if (t < 0.0) t = 1e9;
  float A = dot(d.xy, d.xy), B = dot(o.xy, d.xy), C = dot(o.xy, o.xy) - hs.x * hs.x;
  float disc = B * B - A * C;
  if (A > 1e-9 && disc >= 0.0) {
    float s = (-B - sqrt(disc)) / A;
    vec3 p = o + d * s;
    if (s > 0.0 && s < t && abs(p.z) < 0.8 * a) {
      t = s;
      n = normalize(vec3(p.xy, 0.0));
    }
  }
  return t < 1e8 ? t : -1.0;
}
// One root of the cone's side: kept when it is ahead, nearer, and between
// the ends.
void coneSide(float s, vec3 o, vec3 d, float hh, float m, float q, inout float t, inout vec3 n) {
  vec3 p = o + d * s;
  float r = m * p.y + q;
  if (s > 0.0 && s < t && abs(p.y) <= hh && r >= 0.0) {
    t = s;
    n = normalize(vec3(p.x, -m * r, p.z));
  }
}
void coneCap(vec3 o, vec3 d, float y, float r, inout float t, inout vec3 n) {
  if (abs(d.y) < 1e-7) return;
  float s = (y - o.y) / d.y;
  vec2 q = o.xz + d.xz * s;
  if (s > 0.0 && s < t && dot(q, q) <= r * r) {
    t = s;
    n = vec3(0.0, sign(y), 0.0);
  }
}
// A cone cut square at both ends, upright: bottom radius rb, top rb·top.
float coneT(vec3 o, vec3 d, vec3 hs, float top, out vec3 n) {
  float rb = top > 1.0 ? hs.x / top : hs.x;
  float rt = rb * top;
  float hh = hs.y;
  float m = (rt - rb) / (2.0 * hh), q = 0.5 * (rb + rt);
  float t = 1e9;
  n = vec3(0.0, 1.0, 0.0);
  float ry = m * o.y + q;
  float a = d.x * d.x + d.z * d.z - m * m * d.y * d.y;
  float b = o.x * d.x + o.z * d.z - m * d.y * ry;
  float c = o.x * o.x + o.z * o.z - ry * ry;
  float disc = b * b - a * c;
  if (abs(a) > 1e-7 && disc >= 0.0) {
    float sq = sqrt(disc);
    coneSide((-b - sq) / a, o, d, hh, m, q, t, n);
    coneSide((-b + sq) / a, o, d, hh, m, q, t, n);
  }
  coneCap(o, d, -hh, rb, t, n);
  coneCap(o, d, hh, rt, t, n);
  return t < 1e8 ? t : -1.0;
}

// The finale's dissolve: one level sweeps down the house from over its
// roof to the table (and back up at dawn), its line wavering a little.
// Walls, floors, the street and the plinth above it are gone; what he
// lived among stays in the air. Positive under the level, negative over.
float meltFront() {
  return mix(ROOF_Y + 3.4, TABLE_Y - 0.3, MELT.x);
}
float meltLevel(vec3 p) {
  return meltFront() + 0.3 * (noise3(p * vec3(0.4, 0.15, 0.4), 7u) - 0.5) - p.y;
}
bool melted(vec3 p, int flags) {
  if (MELT.x < 0.001 || (flags & (F_WALL | F_SLAB)) == 0) return false;
  return meltLevel(p) < 0.0;
}

// Primitive `at` (its three texels) against the ray; a nearer hit wins.
void primHit(int at, vec3 ro, vec3 rd, int cell, inout Hit h, bool shadow) {
  vec4 A = tx(at), B = tx(at + 1), C = tx(at + 2);
  int code = int(A.w + 0.5);
  int mat = code / 64;
  int kind = code - 64 * mat;
  float fl = floor(C.w + 1e-4);
  int flags = int(fl);
  if (shadow && (flags & F_FLAT) != 0) return;
  vec4 r = vec4(cos(B.w), sin(B.w), cos(C.x), sin(C.x));
  vec3 o = toLocal(ro - A.xyz, r), d = toLocal(rd, r);
  vec3 hs = B.xyz;
  vec3 n = vec3(0.0, 1.0, 0.0);
  float t = -1.0;
  if (kind == KIND_CYL) {
    t = cylT(o, d, hs.x, hs.y, n);
  } else if (kind == KIND_BALL) {
    t = ballT(o, d, hs, n);
  } else if (kind == KIND_TORUS) {
    t = wheelT(o, d, hs, C.y, n);
  } else if (kind == KIND_CONE) {
    t = coneT(o, d, hs, C.y, n);
  } else {
    vec2 b = boxT(o, d, hs, n);
    t = b.x <= b.y ? b.x : -1.0;
  }
  if (t <= 1e-4 || t >= h.t) return;
  if (!shadow && (flags & F_NEAR) != 0 && t < 3.5) return;
  vec3 lp = o + d * t;
  if (kind == KIND_WINDOW) {
    // The glass lets the eye and the sun through; the frame and its
    // cross stop them.
    vec2 q = abs(lp.xy);
    bool pane = q.x < hs.x - 0.07 && q.y < hs.y - 0.07 && q.x > 0.025 && abs(lp.y - 0.2 * hs.y) > 0.025;
    if (pane) return;
  }
  if (melted(ro + rd * t, flags)) return;
  h.t = t;
  h.kind = K_PRIM;
  h.mat = mat;
  h.tone = C.w - fl;
  h.n = toWorld(n, r);
  h.id = cell;
  h.lp = lp;
  h.flags = flags;
  h.part = float(at);
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
// A cone cut square at both ends (Inigo Quilez's exact distance).
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
// Cone c of the person whose cones start at texel `base`: squashed along
// its axis to |s.w| of its width, flat-ended where s.w is below zero.
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
// The person's surface at p: its normal from four soft-min samples on a
// tetrahedron, and the cone nearest to it. One flat loop over the four
// samples' cones and then the cones once more (the D3D compiler takes a
// loop inside a loop very slowly).
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
// A capsule (for the people's shadows).
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

// ---- the trace ----

// The nearest thing on the ray before tmax. The cells (u_c), their groups
// and the groups' primitives are walked in one loop: a cell the ray misses
// skips its groups, a group it misses skips its primitives.
Hit trace(vec3 ro, vec3 rd, float tmax) {
  Hit h = noHit(tmax);
  vec3 ird = safeInverse(rd);
  int c = 0, cur = 0, g = 0, gEnd = 0, i = 0, iEnd = 0;
  for (int k = 0 + ZERO; k < 8192; k++) {
    if (i < iEnd) {
      primHit(i, ro, rd, cur, h, false);
      i += 3;
    } else if (g < gEnd) {
      vec4 ga = tx(g), gb = tx(g + 1);
      g += 2;
      vec2 s = slab(ro, ird, ga.xyz - 0.004, gb.xyz + 0.004);
      if (s.x <= s.y && s.y >= 0.0 && s.x <= h.t) {
        i = int(ga.w + 0.5);
        iEnd = i + 3 * int(gb.w + 0.5);
      }
    } else if (c < CELLS) {
      vec4 a = u_c[2 * c], b = u_c[2 * c + 1];
      int gn = int(b.w + 0.5);
      vec2 s = slab(ro, ird, a.xyz - 0.01, b.xyz + 0.01);
      if (gn > 0 && s.x <= s.y && s.y >= 0.0 && s.x <= h.t) {
        g = int(a.w + 0.5);
        gEnd = g + 2 * gn;
        cur = c;
      }
      c++;
    } else {
      break;
    }
  }
  // The people, one after another in one loop too, each marched through
  // its box: seen fading in and out as a dither.
  float dith = rand(uint(gl_FragCoord.x) * 7919u + uint(gl_FragCoord.y) * 104729u + 17u);
  // Each turn adds one cone (j) to the soft-min at the current step, so
  // no loop runs inside another.
  int fi = -1, base = 0, fig = -1, steps = 0, j = 0;
  float t = 1.0, end = 0.0, d = 0.0;
  vec3 q = vec3(0.0);
  for (int k = 0 + ZERO; k < 400 * CONES; k++) {
    if (j == 0 && (t > end || steps > 72)) {
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
    if (d < 0.0012) {
      h.t = t;
      h.kind = K_FIG;
      h.id = fi;
      fig = base;
      t = 1.0;
      end = 0.0;
      continue;
    }
    t += max(d, 0.0008);
  }
  if (fig >= 0) {
    vec3 p = ro + rd * h.t;
    figureSurface(fig, p, h.n, h.part);
    h.mat = 0;
    h.flags = 0;
  }
  // The table under it all.
  if (rd.y < -1e-4) {
    float tt = (TABLE_Y - ro.y) / rd.y;
    if (tt > 0.0 && tt < h.t) {
      h = noHit(tt);
      h.kind = K_TABLE;
    }
  }
  return h;
}

// Whether anything stands on the ray before tmax (the sun's shadow): the
// same walk, done at the first hit; the people as capsules.
bool occluded(vec3 ro, vec3 rd, float tmax) {
  Hit h = noHit(tmax);
  vec3 ird = safeInverse(rd);
  int c = 0, cur = 0, g = 0, gEnd = 0, i = 0, iEnd = 0;
  for (int k = 0 + ZERO; k < 8192; k++) {
    if (i < iEnd) {
      primHit(i, ro, rd, cur, h, true);
      if (h.kind != K_VOID) return true;
      i += 3;
    } else if (g < gEnd) {
      vec4 ga = tx(g), gb = tx(g + 1);
      g += 2;
      vec2 s = slab(ro, ird, ga.xyz - 0.004, gb.xyz + 0.004);
      if (s.x <= s.y && s.y >= 0.0 && s.x <= tmax) {
        i = int(ga.w + 0.5);
        iEnd = i + 3 * int(gb.w + 0.5);
      }
    } else if (c < CELLS) {
      vec4 a = u_c[2 * c], b = u_c[2 * c + 1];
      int gn = int(b.w + 0.5);
      vec2 s = slab(ro, ird, a.xyz - 0.01, b.xyz + 0.01);
      if (gn > 0 && s.x <= s.y && s.y >= 0.0 && s.x <= tmax) {
        g = int(a.w + 0.5);
        gEnd = g + 2 * gn;
        cur = c;
      }
      c++;
    } else {
      break;
    }
  }
  for (int f = 0 + ZERO; f < FIGS; f++) {
    vec4 feet = u_fig[4 * f + 2], head = u_fig[4 * f + 3];
    if (head.w < 0.02) continue;
    float t = capsuleT(ro, rd, feet.xyz, head.xyz, feet.w);
    if (t > 0.0 && t < tmax) return true;
  }
  return false;
}

// ---- the light ----

// The cell a point is in, for its lamp.
int cellAt(vec3 p) {
  if (p.y > -0.3 && p.y < ROOF_Y && p.x > -SIDE_X && p.x < SIDE_X && p.z > BACK_Z - 0.3 && p.z < 0.6) {
    int col = p.x < COL_1 ? 0 : (p.x < COL_2 ? 1 : 2);
    int k = clamp(int(floor(max(p.y, 0.0) / STOREY)), 0, FLOORS - 1);
    return col + 3 * k;
  }
  if (p.y >= ROOF_Y - 0.2 && p.x > -SIDE_X - 0.5 && p.x < SIDE_X + 0.5 && p.z < 0.6) return CELL_ROOF;
  if (p.z > 2.9 && p.z < 5.7 && p.y < 3.2 && abs(p.x - TRAM.x) < 4.8) return CELL_TRAM;
  return p.x < -6.0 ? CELL_STREET_L : (p.x < 5.5 ? CELL_STREET_M : CELL_STREET_R);
}
int lampCell(Hit h, vec3 p) {
  if (h.kind == K_PRIM && h.id < CELL_LIFT) return h.id;
  if (h.kind == K_PRIM && h.id >= CELL_STREET_L && h.id <= CELL_STREET_R) return h.id;
  if (h.kind == K_PRIM && h.id == CELL_TRAM) return CELL_TRAM;
  return cellAt(p);
}
vec3 lampPos(int c) {
  return c == CELL_TRAM ? vec3(TRAM.x, 2.3, TRACK_Z) : LAMP_POS[c];
}
vec2 lampLight(int c, vec3 p, vec3 n) {
  float k = lampOf(c);
  if (k < 0.002) return vec2(0.0);
  vec3 v = lampPos(c) - p;
  float d2 = max(dot(v, v), 1e-4);
  float ndl = max(dot(n, v * inversesqrt(d2)), 0.0) * 0.75 + 0.25;
  return vec2(0.2, 1.0) * k * 1.5 * ndl / (1.0 + 0.5 * d2);
}
// The rooms of his day, which flash when the rings strike together.
bool hisRoom(int c) {
  return c == 0 || c == 1 || c == 3 || c == 6 || c == 9 || c == 10 || c == 11 || c == 12 || c == 14
      || c == CELL_ROOF || c == CELL_LIFT || c == CELL_TRAM;
}

struct Surf {
  float a;      // how much light it gives back
  float warm;   // how much of the cold light it turns warm
  vec2 emit;
  float gloss;
};

// Goods on shelves, books, loaves: rows of things of hashed size.
float shelfItems(vec3 lp, float width, float rowH, uint salt, out float tone) {
  float row = floor(lp.y / rowH);
  float y = fract(lp.y / rowH);
  float i = floor(lp.x / width);
  float h = 0.5 + 0.45 * hash2(int(i), int(row), salt);
  tone = hash2(int(i), int(row), salt + 1u);
  float gap = abs(fract(lp.x / width) - 0.5) > 0.44 ? 0.4 : 1.0;
  if (y < 0.07) return 0.6;  // the shelf's board
  return y < 0.07 + h * 0.9 ? gap : 0.08;
}

Surf surface(Hit h, vec3 p, vec3 n, int cell) {
  Surf s;
  s.a = 0.4;
  s.warm = 0.1;
  s.emit = vec2(0.0);
  s.gloss = (h.flags & F_GLOSS) != 0 ? 0.4 : 0.0;
  float tone = h.tone;
  vec2 tc = abs(n.y) > 0.6 ? p.xz : (abs(n.x) > 0.6 ? p.zy : p.xy);
  int m = h.mat;
  float it;
  if (m == M_PLASTER) {
    s.a = 0.4 + 0.3 * (tone - 0.5) + 0.04 * (noise2(tc * 2.5, 3u) - 0.5);
    s.warm = 0.12;
  } else if (m == M_TILE) {
    // Every tile its own glaze, a little worn where feet go.
    vec2 g = abs(fract(tc / 0.2) - 0.5);
    vec2 c = floor(tc / 0.2);
    float v = hash1(int(c.x) * 73 + int(c.y) * 151, 7u);
    float glaze = (0.34 + 0.13 * v) * (0.93 + 0.1 * noise2(tc * 2.5, 13u));
    s.a = (max(g.x, g.y) > 0.46 ? 0.16 : glaze) * (0.8 + 0.4 * tone);
    s.gloss = 0.25;
  } else if (m == M_BOARDS) {
    // Planks of a metre or so, their ends staggered row by row, each its
    // own tone and grain.
    float row = floor(tc.y / 0.16);
    float run = tc.x + 0.9 * hash1(int(row), 9u);
    float plank = floor(run / 0.9);
    float seam = abs(fract(tc.y / 0.16) - 0.5) > 0.46 ? 0.45 : 1.0;
    seam *= abs(fract(run / 0.9) - 0.5) > 0.493 ? 0.55 : 1.0;
    float pv = hash1(int(row) * 31 + int(plank), 5u);
    float grain = 0.03 * sin(tc.x * (24.0 + 14.0 * pv) + row + 4.0 * noise2(vec2(tc.x * 3.0, row), 17u));
    s.a = (0.19 + 0.14 * pv + grain) * seam * (0.8 + 0.5 * tone);
    s.warm = 0.75;
  } else if (m == M_WOOD) {
    s.a = 0.16 + 0.35 * tone + 0.03 * sin(tc.x * 40.0 + 6.0 * noise2(tc * 4.0, 11u))
      + 0.04 * (noise2(tc * vec2(1.2, 9.0), 19u) - 0.5);
    s.warm = 0.7;
  } else if (m == M_FABRIC) {
    s.a = 0.12 + 0.5 * tone;
    s.warm = 0.15 + 0.5 * fract(tone * 3.7);
  } else if (m == M_METAL) {
    s.a = 0.18 + 0.4 * tone;
    s.gloss = max(s.gloss, 0.3);
    s.warm = 0.0;
  } else if (m == M_BRASS) {
    s.a = 0.45;
    s.warm = 0.9;
    s.gloss = 0.5;
  } else if (m == M_LAMP || m == M_STREETLAMP) {
    s.a = 0.5;
    float k = lampOf(cell);
    if (h.id == CELL_MOVE) k = max(k, 0.6);
    s.emit = k * vec2(0.5, 2.6) + vec2(0.01, 0.02);
  } else if (m == M_SCREEN) {
    s.a = 0.04;
    s.gloss = 0.4;
    float on = cell == 14 ? DESK.x : (h.id == CELL_MOVE ? 0.6 : 0.25);
    s.emit = on * vec2(0.9, 0.06) * (0.8 + 0.2 * step(0.5, fract(h.lp.y * 30.0)));
  } else if (m == M_PAPER) {
    s.a = 0.72;
    s.warm = 0.1;
  } else if (m == M_CERAMIC) {
    s.a = 0.55 + 0.3 * tone;
    s.gloss = max(s.gloss, 0.35);
  } else if (m == M_PLANT) {
    s.a = 0.1 + 0.14 * tone + 0.05 * noise2(tc * 12.0, 13u);
    s.warm = 0.05;
  } else if (m == M_BREAD) {
    s.a = 0.45;
    s.warm = 0.95;
    if (h.kind == K_PRIM && abs(h.lp.y) < 0.9 && length(h.lp) > 0.25) {
      float k = shelfItems(h.lp + 2.0, 0.3, 0.45, 31u, it);
      s.a = 0.18 + 0.4 * k;
    }
  } else if (m == M_GOODS) {
    float k = shelfItems(h.lp + 2.0, 0.13, 0.42, 33u, it);
    s.a = 0.12 + 0.55 * k * (0.4 + 0.6 * it);
    s.warm = 0.2 + 0.7 * fract(it * 5.3);
  } else if (m == M_BOOKS) {
    float k = shelfItems(h.lp + 2.0, 0.05, 0.38, 37u, it);
    s.a = 0.08 + 0.5 * k * (0.3 + 0.7 * it);
    s.warm = 0.3 + 0.6 * fract(it * 7.1);
  } else if (m == M_BRICK) {
    float row = floor(tc.y / 0.085);
    float x = tc.x / 0.26 + 0.5 * mod(row, 2.0);
    float mortar = (fract(tc.y / 0.085) < 0.12 || fract(x) < 0.05) ? 0.55 : 1.0;
    s.a = (0.2 + 0.1 * hash2(int(floor(x)), int(row), 41u)) * mortar;
    s.warm = 0.65;
  } else if (m == M_PAVING) {
    vec2 g = abs(fract(tc / 0.45) - 0.5);
    s.a = (max(g.x, g.y) > 0.47 ? 0.14 : 0.27) * (0.85 + 0.3 * noise2(tc * 1.3, 43u));
  } else if (m == M_RAIL) {
    s.a = 0.45;
    s.gloss = 0.5;
  } else if (m == M_TRAM) {
    s.a = 0.18 + 0.55 * tone;
    s.warm = 0.55;
  } else if (m == M_PLINTH) {
    s.a = 0.05;
    s.gloss = 0.25;
  } else if (m == M_ROOF) {
    s.a = 0.2 + 0.06 * noise2(tc * 1.5, 47u);
  } else if (m == M_GRASS) {
    s.a = 0.12 + 0.08 * noise2(tc * 5.0, 53u);
    s.warm = 0.1;
  } else if (m == M_RUG) {
    vec2 q = abs(fract(h.lp.xz * 1.5) - 0.5);
    s.a = 0.18 + 0.2 * tone + 0.08 * step(0.35, max(q.x, q.y));
    s.warm = 0.75;
  } else if (m == M_CANVAS) {
    float k = noise2(h.lp.xy * 3.0 + 7.0, 59u);
    s.a = 0.3 + 0.45 * k;
    s.warm = smoothstep(0.4, 0.7, noise2(h.lp.xy * 2.0, 61u));
  } else if (m == M_FRAME) {
    s.a = 0.25;
    s.warm = 0.6;
  } else if (m == M_CLOTH) {
    s.a = 0.5 + 0.3 * tone;
    s.warm = 0.2;
  } else if (m == M_CALENDAR) {
    vec2 g = fract(h.lp.xy * vec2(8.75, 7.6));
    bool line = g.x < 0.08 || g.y < 0.08;
    s.a = line ? 0.35 : 0.75;
    // The deadline: a square circled warm, and the sparks over it.
    if (abs(h.lp.x - 0.15) < 0.05 && abs(h.lp.y + 0.12) < 0.05) {
      s.warm = 1.0;
      s.emit = vec2(0.0, 0.6 * SPARKS.x);
    }
  } else if (m == M_SIGN) {
    s.a = 0.15;
    s.warm = 0.5;
    float letters = step(0.5, noise2(h.lp.xy * vec2(9.0, 14.0), 67u));
    s.emit = vec2(0.05, 0.9) * letters * max(lampOf(cell), 0.15);
  } else if (m == M_DARK) {
    s.a = 0.03;
  } else if (m == M_GLASS) {
    s.a = 0.05;
    s.gloss = 0.8;
  } else if (m == M_BARK) {
    s.a = 0.13;
    s.warm = 0.4;
  } else if (m == M_TOY) {
    s.a = 0.35 + 0.35 * tone;
    s.warm = tone;
  } else if (m == M_FUR) {
    s.a = 0.3 + 0.3 * tone;
    s.warm = 0.6;
  } else if (m == M_STONE) {
    s.a = 0.32 + 0.15 * tone;
  } else if (m == M_FRIDGE) {
    s.a = 0.68;
    s.gloss = 0.3;
  }
  return s;
}

// A person's surface: skin and a face, the hair, shoes, a top and
// trousers; his outline warm.
Surf personSurface(Hit h, vec3 p, vec3 n, vec3 rd) {
  Surf s;
  s.gloss = 0.0;
  s.emit = vec2(0.0);
  int part = int(h.part + 0.5);
  vec4 lo = u_fig[4 * h.id], hi = u_fig[4 * h.id + 1];
  int base = int(lo.w);
  float accent = fract(lo.w) / 0.9;
  float clothes = fract(hi.w) / 0.9;
  int code = int(hi.w);
  int cut = code / 8;
  float hairA = 0.035 + 0.06 * float(code - cut * 8);
  if (part == CONE_NECK || part == CONE_HEAD || part == CONE_FACE || part == CONE_CAP) {
    // The head's own frame from its skull cone (chin to crown, tilted
    // back): x to its left, y up, z where it looks; the eyes at 0.
    vec4 a = tx(base + 3 * CONE_HEAD), b = tx(base + 3 * CONE_HEAD + 1);
    vec3 l = normalize(tx(base + 3 * CONE_HEAD + 2).xyz);
    vec3 v = b.xyz - a.xyz, w = cross(l, v);
    vec3 up = normalize(0.08 * v + 0.03 * w), fwd = normalize(0.08 * w - 0.03 * v);
    float k = max(b.w / 0.088, 0.3);
    vec3 q = (p - a.xyz) / k - up * 0.039 + fwd * 0.025;
    float x = dot(q, l), y = dot(q, up), z = dot(q, fwd);
    s.a = 0.48;
    s.warm = 0.6;
    // The hair, its line soft over a pixel.
    float px = pixelAt(h.t) / k;
    float hm = part == CONE_CAP ? 1.0 : 0.0;
    if (cut == 4) {
      hm = max(hm, step(z, -0.02) * smoothstep(-0.06 - px, -0.06 + px, y) * smoothstep(0.02 + px, 0.02 - px, y));
    } else if (part != CONE_FACE && part != CONE_NECK) {
      hm = max(hm, smoothstep(-px, px, y - 0.06 + 1.2 * max(0.03 - z, 0.0)));
    }
    if (cut == 2 && z < 0.0 && y > -0.14) hm = 1.0;
    if (hm < 1.0 && part != CONE_NECK) {
      // The eyes, the brows and the mouth, where the pixels can hold them.
      float vis = smoothstep(0.02, 0.006, px) * smoothstep(0.015, 0.04, z);
      float eye = length(vec2(abs(x) - 0.03, y)) - 0.0085;
      float brow = max(abs(y - 0.021) - 0.0035, abs(abs(x) - 0.032) - 0.016);
      float mouth = max(abs(y + 0.044) - 0.003, abs(x) - 0.017);
      float dark = 0.8 * smoothstep(px, -px, eye) + 0.5 * smoothstep(px, -px, brow) + 0.35 * smoothstep(px, -px, mouth);
      s.a *= 1.0 - min(dark, 0.85) * vis;
    }
    s.a = mix(s.a, hairA, hm);
    s.warm = mix(s.warm, 0.35, hm);
  } else if (part == HAND_L || part == HAND_R) {
    s.a = 0.48;
    s.warm = 0.6;
  } else if (part >= FOOT_L && part <= TOE_R) {
    s.a = 0.05;
    s.warm = 0.3;
  } else if (part == 0 || (part >= LEG_A && part <= LEG_B)) {
    // Trousers: darker than the top.
    s.a = 0.06 + 0.2 * fract(clothes * 2.7 + 0.3);
    s.warm = 0.15 + 0.3 * fract(clothes * 5.1);
  } else {
    s.a = 0.12 + 0.45 * clothes;
    s.warm = 0.1 + 0.6 * fract(clothes * 4.3);
  }
  float rim = pow(1.0 - abs(dot(n, rd)), 3.0);
  s.emit = accent * vec2(0.05, 0.3) * rim;
  return s;
}

// The painted backdrop: the sky (the day's light, the clouds, the sun
// crossing it, the stars and the moon at night) and in front of it a town,
// two rows of roofs, the nearer darker, their windows lit while the sky is
// dark.
vec2 backdrop(vec3 p) {
  float hgt = clamp(p.y / 21.0, 0.0, 1.0);
  // The golden hour takes the sky's cold away and fills its foot warm.
  vec2 L = vec2(DAY.x * mix(0.25, 0.16, hgt) * (1.0 - 0.5 * DAY.y), DAY.y * (0.32 * (1.0 - hgt) * (1.0 - hgt) + 0.2 * (1.0 - hgt) + 0.04));
  float cl = fbm(vec2(p.x * 0.11 + 0.015 * STORY, p.y * 0.22), 3, 21u);
  L += vec2(DAY.x * 0.07, DAY.y * 0.12) * smoothstep(0.55, 0.72, cl);
  vec2 sp = vec2(SUN.x * 12.0, 2.0 + max(SUN.y, -0.3) * 18.0);
  float d = length(p.xy - sp);
  float disc = smoothstep(1.05, 0.95, d);
  L += SUN.w * (vec2(0.4 * (1.0 - DAY.y), 0.4 + 1.2 * DAY.y) * disc + vec2(0.05, 0.1 + 0.2 * DAY.y) * exp(-d / 3.0));
  float lit = clamp(1.25 - 1.4 * DAY.x, 0.0, 0.75);
  // The far row, pale in the air.
  float x = p.x + 40.0;
  float i1 = floor(x / 1.9);
  float h1 = 7.0 + 6.0 * hash1(int(i1), 91u);
  // The near row: flat roofs and gables, a chimney here and there.
  float x2 = x + 1.1;
  float i2 = floor(x2 / 2.7);
  float r2 = hash1(int(i2), 93u);
  float fx = fract(x2 / 2.7) - 0.5;
  float h2 = 3.4 + 4.2 * r2 + (r2 > 0.55 ? 1.1 * (1.0 - 2.0 * abs(fx)) : 0.0);
  if (hash1(int(i2), 95u) > 0.6 && abs(fx - 0.22) < 0.05) h2 += 0.7;
  if (p.y < h2) {
    L = vec2(0.02 + 0.05 * DAY.x, 0.015 * DAY.y);
    vec2 cell = vec2(x2 / 0.55, (p.y - 0.5) / 0.75);
    vec2 g = fract(cell);
    if (p.y > 0.5 && p.y < h2 - 0.5 && abs(fx) < 0.42 && g.x > 0.3 && g.x < 0.7 && g.y > 0.25 && g.y < 0.75) {
      float on = step(hash2(int(floor(cell.x)), int(floor(cell.y)), 97u), lit);
      L = mix(L * 0.6, vec2(0.02, 0.42), on);
    }
  } else if (p.y < h1) {
    L = mix(L, vec2(0.03 + 0.07 * DAY.x, 0.08 * DAY.y), 0.55);
    vec2 cell = vec2(x / 0.4, p.y / 0.55);
    vec2 g = fract(cell);
    if (g.x > 0.35 && g.x < 0.65 && g.y > 0.3 && g.y < 0.7 && hash2(int(floor(cell.x)), int(floor(cell.y)), 99u) < 0.6 * lit) L += vec2(0.0, 0.18);
  } else {
    // Night over the roofs: stars, and the moon high over the left.
    vec2 gs = floor(p.xy * 2.2);
    float star = hash2(int(gs.x), int(gs.y), 71u);
    vec2 f = fract(p.xy * 2.2) - 0.5;
    L.x += DAY.z * step(0.965, star) * exp(-dot(f, f) * 60.0) * 0.6 * (0.6 + 0.4 * sin(TIME * 2.0 + star * 40.0));
    float md = length(p.xy - vec2(-13.5, 18.5));
    L += DAY.z * (vec2(0.55, 0.06) * smoothstep(0.85, 0.78, md) + vec2(0.04, 0.0) * exp(-md / 2.5));
  }
  // Painted only round the house: toward its sides and top the backdrop
  // goes into the dark of the room.
  float edge = (1.0 - smoothstep(17.0, BACKDROP_HALF - 1.0, abs(p.x))) * (1.0 - smoothstep(22.0, BACKDROP_TOP - 1.0, p.y));
  return L * edge;
}

// What the light of the sun and the sky is at this moment.
vec2 sunLight() {
  return vec2(1.0 - 0.6 * DAY.y, 0.1 + 0.95 * DAY.y) * SUN.w * 0.9;
}

vec2 shadeSurface(Hit h, vec3 ro, vec3 rd, bool full) {
  vec3 p = ro + rd * h.t;
  vec3 n = h.n;
  if (dot(n, rd) > 0.0) n = -n;
  int cell = lampCell(h, p);
  if (h.kind == K_PRIM && h.mat == M_BACKDROP) return backdrop(p);
  Surf s;
  if (h.kind == K_FIG) {
    s = personSurface(h, p, n, rd);
  } else {
    s = surface(h, p, n, cell);
    // The walls' cut faces, dimmer than the rooms they open.
    if ((h.flags & F_WALL) != 0 && n.z > 0.7 && p.z > -0.25 && p.y < ROOF_Y - 0.05) s.a *= 0.6;
  }
  // The sun through the open front.
  vec3 sd = normalize(SUN.xyz);
  float ndl = dot(n, sd);
  float vis = 0.0;
  if (ndl > 0.0 && SUN.w > 0.004) {
    vis = 1.0;
#if defined(PASS_LIGHT)
    if (full) vis = texelFetch(u_shadow, ivec2(gl_FragCoord.xy), 0).x;
#elif defined(PASS_ALL)
    if (full && occluded(p + n * 0.006, sd, 60.0)) vis = 0.0;
#endif
  }
  vec2 sun = sunLight();
  // The sky's light, less of it deep in the rooms.
  float ao = 1.0;
  if (p.x > -SIDE_X && p.x < SIDE_X && p.y > -0.2 && p.y < ROOF_Y && p.z < 0.3) {
    ao = mix(0.45, 1.0, smoothstep(BACK_Z, 0.4, p.z));
  }
  vec2 sky = vec2(DAY.x * (0.2 + 0.07 * n.y + 0.07 * n.z) + 0.016, 0.05 * DAY.y) * ao;
  vec2 lamp = lampLight(cell, p, n);
  vec2 L = s.a * (sun * max(ndl, 0.0) * vis + sky + lamp);
  L = vec2(L.x * (1.0 - 0.45 * s.warm), L.y + L.x * 0.45 * s.warm);
  if (s.gloss > 0.0) {
    vec3 rf = reflect(rd, n);
    L += s.gloss * sun * pow(max(dot(rf, sd), 0.0), 60.0) * vis * 3.0;
    vec3 lv = normalize(lampPos(cell) - p);
    L += s.gloss * lampOf(cell) * vec2(0.2, 1.0) * pow(max(dot(rf, lv), 0.0), 40.0) * 1.5;
  }
  L += s.emit;
  // When the rings strike together, the rooms of his day flash.
  if (CHORD.x > 0.001 && hisRoom(cell)) L += s.a * CHORD.x * vec2(0.05, 0.3);
  // Where the level cuts the walls and floors: a line of light, and a
  // glow fading down from it.
  if (MELT.x > 0.001 && (h.flags & (F_WALL | F_SLAB)) != 0) {
    float e = meltLevel(p);
    L += vec2(0.2, 1.4) * (smoothstep(0.045, 0.0, e) + 0.18 * exp(-e / 0.6));
  }
  return L;
}

vec2 voidLight(vec3 rd) {
  return vec2(0.004 + 0.004 * max(rd.y, 0.0), 0.0);
}

// The black lacquer: dark, and the house in its gloss (more of it in the
// finale, when the house and its reflection join), from the mirrored eye's
// frame.
vec2 shadeTable(Hit h, vec3 ro, vec3 rd) {
  vec3 p = ro + rd * h.t;
  float far = exp(-max(length(p.xz) - 22.0, 0.0) / 14.0);
  vec2 sky = vec2(DAY.x * 0.2 + 0.012, 0.0);
  vec2 L = 0.03 * (sky + sunLight() * max(normalize(SUN.xyz).y, 0.0));
#ifdef PASS_LIGHT
  float fres = 0.04 + 0.96 * pow(1.0 - abs(rd.y), 5.0);
  float g = (fres * 0.7 + 0.08 + 0.8 * MELT.y) * far;
  if (u_res.w < MIRROR - 0.5) L += g * texture(u_refl, gl_FragCoord.xy / u_res.xy).xy;
#endif
  return L * far;
}

vec2 shade(Hit h, vec3 ro, vec3 rd) {
  if (h.kind == K_VOID) return voidLight(rd);
  if (h.kind == K_TABLE) return shadeTable(h, ro, rd);
  // From the mirrored eye, no shadows: the reflection is dim and soft.
  return shadeSurface(h, ro, rd, u_res.w < MIRROR - 0.5);
}

// ---- the light in the air ----

// The eye's ray and point c: how near it passes, and how far along.
vec2 rayPoint(vec3 ro, vec3 rd, vec3 c) {
  vec3 v = c - ro;
  float t = dot(v, rd);
  return vec2(length(v - rd * t), t);
}
// The eye's ray and segment ab: how near they pass, how far along the
// ray, and where on the segment (0 at a, 1 at b).
vec3 raySegment(vec3 ro, vec3 rd, vec3 a, vec3 b) {
  vec3 ab = b - a, ao = ro - a;
  float abab = max(dot(ab, ab), 1e-8), abrd = dot(ab, rd), abao = dot(ab, ao), rdao = dot(rd, ao);
  float den = abab - abrd * abrd;
  float s = den > 1e-7 ? clamp((abao - abrd * rdao) / den, 0.0, 1.0) : 0.0;
  float t = max(dot(a + ab * s - ro, rd), 0.0);
  s = clamp(dot(ro + rd * t - a, ab) / abab, 0.0, 1.0);
  return vec3(length(ro + rd * t - a - ab * s), t, s);
}
// Where the ray crosses the level y round c: offset there and how far.
bool level(vec3 ro, vec3 rd, float T, vec3 c, out vec2 q, out float t) {
  q = vec2(1e3);
  t = 0.0;
  if (abs(rd.y) < 1e-4) return false;
  t = (c.y - ro.y) / rd.y;
  if (t <= 0.0 || t > T + 0.03) return false;
  q = ro.xz + rd.xz * t - c.xz;
  return true;
}
// A ring's line and its halo, its pixels as wide as the level's slant.
float ringGlow(float e, float t, vec3 rd, float w, float halo) {
  float px = pixelAt(t) / max(abs(rd.y), 0.12);
  return lineK(e, w, px) + 0.22 * sline(e, halo);
}

vec2 rings(vec3 ro, vec3 rd, float T) {
  if (HERO.w < 0.01) return vec2(0.0);
  vec2 L = vec2(0.0);
  vec3 c = HERO.xyz;
  vec2 q;
  float t;
  // The outer ring: the world round him, its dashes slowly turning.
  float r1 = RING1.x * (1.0 + 0.08 * RING1B.x);
  if (level(ro, rd, T, c + vec3(0.0, RING1.y, 0.0), q, t)) {
    float a = atan(q.y, q.x) + RING1B.y;
    float dash = 0.45 + 0.55 * smoothstep(0.1, 0.3, abs(fract(a * 18.0 / TAU) - 0.5));
    float g = ringGlow(abs(length(q) - r1), t, rd, 0.012, 0.09 + 0.12 * RING1B.x);
    L += (vec2(RING1.z, 0.06) + vec2(0.5, 1.4) * RING1B.x) * g * dash;
  }
  // The inner ring at his chest: it breathes, trembles, beats with his heart.
  if (level(ro, rd, T, c + vec3(0.0, RING2.y, 0.0), q, t)) {
    float a = atan(q.y, q.x);
    float r2 = RING2.x + RING2.w * 0.035 * sin(a * 7.0 + TIME * 23.0) * sin(a * 3.0 - TIME * 17.0);
    float g = ringGlow(abs(length(q) - r2), t, rd, 0.008, 0.06 + 0.06 * RING2B.x);
    L += (vec2(RING2.z, 0.1) + vec2(0.4, 1.2) * RING2B.x) * g;
  }
  // The step's ring at his feet, its ticks rolling as he walks.
  if (level(ro, rd, T, c + vec3(0.0, RING3.y, 0.0), q, t)) {
    float a = atan(q.y, q.x) + RING3B.y;
    float r = length(q);
    float tick = smoothstep(0.42, 0.47, abs(fract(a * 12.0 / TAU) - 0.5)) * step(RING3.x, r) * step(r, RING3.x + 0.08);
    float g = ringGlow(abs(r - RING3.x), t, rd, 0.01, 0.07 + 0.1 * RING3B.x) + 0.6 * tick;
    L += (vec2(RING3.z, 0.06) + vec2(0.5, 1.4) * RING3B.x) * g;
  }
  // The newest touches run out from the ring they touched.
  for (int k = 0 + ZERO; k < 2; k++) {
    float which = k == 0 ? RINGEV.x : RINGEV.z;
    float age = k == 0 ? RINGEV.y : RINGEV.w;
    if (which < 0.5 || age > 3.0) continue;
    float y = which < 1.5 ? RING1.y : (which < 2.5 ? RING2.y : RING3.y);
    float r0 = which < 1.5 ? RING1.x : (which < 2.5 ? RING2.x : RING3.x);
    if (level(ro, rd, T, c + vec3(0.0, y, 0.0), q, t)) {
      float g = ringGlow(abs(length(q) - (r0 + 1.3 * age)), t, rd, 0.01, 0.08);
      L += vec2(0.3, 0.7) * exp(-1.8 * age) * g;
    }
  }
  return L * HERO.w;
}

vec2 route(vec3 ro, vec3 rd, float T) {
  vec2 L = vec2(0.0);
  if (PATHS.x > 0.001) {
    // A thin line with a soft halo; light runs along it the way he went,
    // and while it is being drawn its head burns like a comet.
    float g = 0.0;
    float drawing = 1.0 - smoothstep(0.96, 1.0, PATHS.x);
    for (int i = 0 + ZERO; i < ROUTE - 1; i++) {
      vec4 a = ROUTE_AT(i), b = ROUTE_AT(i + 1);
      if (a.w >= PATHS.x) break;
      float bw = min(b.w, PATHS.x);
      vec3 bb = b.w > PATHS.x ? mix(a.xyz, b.xyz, (PATHS.x - a.w) / max(b.w - a.w, 1e-5)) : b.xyz;
      vec3 d = raySegment(ro, rd, a.xyz, bb);
      float f = mix(a.w, bw, d.z);
      float head = exp(-(PATHS.x - f) * 45.0) * drawing;
      float flow = 0.75 + 0.25 * sin(f * 90.0 - STORY * 2.2);
      float px = pixelAt(d.y);
      float k = lineK(d.x, 0.018 + 0.03 * head, px) * flow + (0.14 + 0.5 * head) * sline(d.x, 0.14 + 0.2 * head);
      g = max(g, k * (1.0 + 2.0 * head) * (d.y > T + 0.05 ? 0.25 : 1.0));
    }
    L += vec2(0.35, 1.0) * g * PATHS.y;
  }
  if (PATHS.z > 0.001) {
    for (int b = 0 + ZERO; b < BEADS; b++) {
      vec4 c = ROUTE_AT(ROUTE + b);
      float on = smoothstep(c.w, c.w + 0.02, PATHS.x) * PATHS.z;
      if (on < 0.001) continue;
      vec2 dt = rayPoint(ro, rd, c.xyz);
      if (dt.y < 0.0) continue;
      if (dt.y > T + 0.15) on *= 0.3;
      L += on * vec2(0.5, 1.3) * (lineK(dt.x, 0.07, pixelAt(dt.y)) + 0.25 * sline(dt.x, 0.3)) * (1.0 + CHORD.x);
    }
  }
  return L;
}

vec2 moments(vec3 ro, vec3 rd, float T) {
  vec2 L = vec2(0.0);
  // The tram's horn: rings running out from its front.
  if (HONK.w > 0.002) {
    vec2 dt = rayPoint(ro, rd, HONK.xyz);
    if (dt.y > 0.0 && dt.y < T + 0.5) {
      float px = pixelAt(dt.y);
      for (int k = 0 + ZERO; k < 3; k++) {
        float f = fract(STORY * 1.4 + float(k) / 3.0);
        L += HONK.w * (1.0 - f) * vec2(0.5, 0.6) * lineK(abs(dt.x - 0.2 - 2.6 * f), 0.02, px);
      }
    }
  }
  // The dissolve's level: one wide ring round the house, sweeping it.
  if (MELT.x > 0.001 && MELT.x < 0.999) {
    vec2 q;
    float t;
    if (level(ro, rd, T, vec3(0.0, meltFront(), -2.3), q, t)) {
      float r = length(q / vec2(12.5, 7.5));
      float g = ringGlow(abs(r - 1.0) * 7.5, t, rd, 0.02, 0.3);
      L += vec2(0.25, 1.1) * g * smoothstep(0.0, 0.06, MELT.x) * smoothstep(1.0, 0.94, MELT.x);
    }
  }
  // The coin's glint: a star.
  if (COIN.w > 0.002) {
    vec3 v = COIN.xyz - ro;
    float tc = dot(v, rd);
    if (tc > 0.0 && tc < T + 0.1) {
      vec3 perp = v - rd * tc;
      float px = pixelAt(tc);
      vec2 d = vec2(dot(perp, RIGHT.xyz), dot(perp, UP.xyz)) / px;
      float star = exp(-dot(d, d) / 6.0) + 0.5 * exp(-abs(d.x) / 1.5 - abs(d.y) / 16.0) + 0.5 * exp(-abs(d.y) / 1.5 - abs(d.x) / 16.0);
      L += COIN.w * vec2(0.4, 1.4) * star;
    }
  }
  // The tea's steam.
  if (STEAM.w > 0.002) {
    float den = dot(rd, FWD.xyz);
    float t0 = dot(STEAM.xyz - ro, FWD.xyz) / max(den, 1e-3);
    if (t0 > 0.0 && t0 < T + 0.1) {
      vec3 q = ro + rd * t0 - STEAM.xyz;
      float u = dot(q, RIGHT.xyz), v = dot(q, UP.xyz);
      float puff = 0.0;
      for (int k = 0 + ZERO; k < 3; k++) {
        float cx = 0.025 * sin(v * 22.0 - STORY * 2.6 + float(k) * 2.1) + 0.012 * float(k - 1);
        float w = 0.006 + 0.03 * max(v, 0.0);
        puff += exp(-pow((u - cx) / w, 2.0)) * smoothstep(0.0, 0.04, v) * (1.0 - smoothstep(0.1, 0.35, v));
      }
      L += STEAM.w * vec2(0.18, 0.04) * puff;
    }
  }
  // The deadlines' sparks over the calendar.
  if (SPARKS.x > 0.002) {
    for (int k = 0 + ZERO; k < 20; k++) {
      float h1 = hash1(k, 81u), h2 = hash1(k, 83u), h3 = hash1(k, 85u);
      float age = fract(STORY * (0.5 + 0.4 * h3) + h1);
      vec3 c = SPARK_TO.xyz + vec3((h2 - 0.5) * 0.9 + 0.15 * sin(age * 9.0 + h1 * 20.0), age * 1.1 - 0.2, 0.08 + 0.3 * h3);
      vec2 dt = rayPoint(ro, rd, c);
      if (dt.y <= 0.0 || dt.y > T + 0.05) continue;
      L += SPARKS.x * (1.0 - age) * vec2(0.3, 1.2) * (lineK(dt.x, 0.008, pixelAt(dt.y)) + 0.15 * sline(dt.x, 0.04));
    }
  }
  // The child's cup, slowed: time rings round it.
  if (CUP.w > 0.01) {
    vec2 dt = rayPoint(ro, rd, CUP.xyz);
    if (dt.y > 0.0 && dt.y < T + 0.2) {
      float px = pixelAt(dt.y);
      float f = fract(STORY * 0.6);
      L += CUP.w * vec2(0.4, 0.5) * (lineK(abs(dt.x - 0.08 - 0.25 * f), 0.004, px) * (1.0 - f) + 0.2 * sline(dt.x, 0.12));
    }
  }
  return L;
}

vec2 air(vec3 ro, vec3 rd, float T) {
  return rings(ro, rd, T) + route(ro, rd, T) + moments(ro, rd, T);
}

// ---- the passes ----

// The world's frame from the light and the eye's own hit: its depth and
// the lens's blur.
vec4 worldPixel(vec2 L, Hit h) {
  float t = h.kind == K_VOID ? 1e4 : h.t;
  float z = t * dot(eyeRay(), FWD.xyz);
  float blur = min(blurAt(z), BLUR_MAX) / BLUR_MAX;
  return vec4(max(L, 0.0) * u_res.z, z / (z + 8.0), blur);
}

// One float holds a normal: its octahedral map, 12 bits a side.
float packNormal(vec3 n) {
  n /= max(abs(n.x) + abs(n.y) + abs(n.z), 1e-6);
  vec2 e = n.xy;
  if (n.z < 0.0) e = (1.0 - abs(n.yx)) * vec2(n.x >= 0.0 ? 1.0 : -1.0, n.y >= 0.0 ? 1.0 : -1.0);
  vec2 q = floor(clamp(e * 0.5 + 0.5, 0.0, 1.0) * 4095.0 + 0.5);
  return q.x + 4096.0 * q.y;
}
vec3 unpackNormal(float f) {
  float y = floor(f / 4096.0);
  vec2 e = vec2(f - 4096.0 * y, y) / 4095.0 * 2.0 - 1.0;
  vec3 n = vec3(e, 1.0 - abs(e.x) - abs(e.y));
  float k = max(-n.z, 0.0);
  n.x += n.x >= 0.0 ? -k : k;
  n.y += n.y >= 0.0 ? -k : k;
  return normalize(n);
}

#if defined(PASS_HITS)
// The record: the distance; the kind, the cell or person and the
// primitive's texel or the person's cone, as one whole number; the normal.
void main() {
  vec3 ro = EYE.xyz, rd = eyeRay();
  float t0 = 0.0;
  if (u_res.w > MIRROR - 0.5) {
    // From the mirrored eye only what rises off the table counts: the
    // ray starts there, nothing stands under it.
    if (rd.y < 1e-4) {
      o = vec4(1e4, float(K_VOID), 0.0, 0.0);
      return;
    }
    t0 = max((TABLE_Y - ro.y) / rd.y, 0.0);
  }
  Hit h = trace(ro + rd * t0, rd, 1e4);
  h.t += t0;
  float code = float(h.kind) + 8.0 * float(h.id) + 256.0 * floor(h.part + 0.5);
  o = vec4(h.t, code, packNormal(h.n), 0.0);
}

#elif defined(PASS_ALL)
void main() {
  vec3 ro = EYE.xyz, rd = eyeRay();
  Hit h = trace(ro, rd, 1e4);
  vec2 L = shade(h, ro, rd) + air(ro, rd, h.kind == K_VOID ? 1e5 : h.t);
  o = worldPixel(L, h);
}

#else
// The hit back from its record; a primitive's material, flags and the
// point in its own frame from its texels.
Hit fromRecords(vec3 ro, vec3 rd) {
  vec4 a = texelFetch(u_h0, ivec2(gl_FragCoord.xy), 0);
  Hit h = noHit(a.x);
  float at = floor(a.y / 256.0);
  float rest = a.y - 256.0 * at;
  float id = floor(rest / 8.0);
  h.kind = int(rest - 8.0 * id + 0.5);
  h.id = int(id + 0.5);
  h.part = at;
  if (h.kind == K_VOID || h.kind == K_TABLE) return h;
  h.n = unpackNormal(a.z);
  if (h.kind == K_PRIM) {
    int i = int(at + 0.5);
    vec4 A = tx(i), B = tx(i + 1), C = tx(i + 2);
    h.mat = int(A.w + 0.5) / 64;
    float fl = floor(C.w + 1e-4);
    h.flags = int(fl);
    h.tone = C.w - fl;
    vec4 r = vec4(cos(B.w), sin(B.w), cos(C.x), sin(C.x));
    h.lp = toLocal(ro + rd * h.t - A.xyz, r);
  }
  return h;
}

void main() {
  vec3 ro = EYE.xyz, rd = eyeRay();
  Hit h = fromRecords(ro, rd);
#if defined(PASS_SHADOW)
  // Whether the sun reaches what the eye met (as shadeSurface asks).
  float vis = 1.0;
  if ((h.kind == K_PRIM && h.mat != M_BACKDROP) || h.kind == K_FIG) {
    vec3 p = ro + rd * h.t;
    vec3 n = dot(h.n, rd) > 0.0 ? -h.n : h.n;
    vec3 sd = normalize(SUN.xyz);
    if (dot(n, sd) > 0.0 && SUN.w > 0.004 && occluded(p + n * 0.006, sd, 60.0)) vis = 0.0;
  }
  o = vec4(vis, 0.0, 0.0, 1.0);
#elif defined(PASS_LIGHT)
  o = worldPixel(shade(h, ro, rd), h);
#elif defined(PASS_FX)
  o = vec4(max(air(ro, rd, h.kind == K_VOID ? 1e5 : h.t), 0.0) * u_res.z, 0.0, 0.0);
#endif
}
#endif
