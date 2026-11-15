// «Фонарь» in one pass, straight onto the page. Two worlds, mixed by how far
// the camera is inside (u_world.x).
// The room: each pixel's ray meets the floor (an exact plane) or, inside
// their box, the chair and the seated person (distance fields, the same as
// body.rs). They are dark and matte with a cold rim. Round them the cold
// outer ring, always on, its ticks slowly turning; hugging the body the warm
// inner ring, which lights a band on the body where it passes; inside the
// body, a warm column of light down the spine, seen through the back.
// Inside: a deep dark, a few far cold motes, the cold outer ring as a far
// level arc; the lantern, its rim the warm inner ring, and its beam, a cone
// of lit dust marched along the ray where it crosses the cone; the threads,
// sparks and the knot, which Rust has already placed in the frame.
// Light is added onto the page in the theme's cold, warm and pale. Rust puts
// the version line and the constants of lib.rs (#define) in front of it.
precision highp float;
precision highp int;

#define TAU 6.28318531

in vec2 v_uv;
out vec4 o;

uniform vec4 u_eye;    // the room camera: eye xyz, loop time
uniform vec4 u_right;
uniform vec4 u_up;
uniform vec4 u_fwd;    // forward, tangent of half the frame's height
uniform vec4 u_ieye;   // the camera inside: eye xyz
uniform vec4 u_iright;
uniform vec4 u_iup;
uniform vec4 u_ifwd;   // forward, tangent of half the frame's height
uniform vec4 u_view;   // frame scale x and y, canvas width and height in px
uniform vec4 u_world;  // how far inside, the column's front y, its light, the ticks' turn
uniform vec4 u_ring;   // the inner ring in the room: y, centre z, radius, light
uniform vec4 u_beamO;  // the lantern's mouth, the beam's spread (tangent)
uniform vec4 u_beamD;  // the way it points, its light
uniform vec4 u_tide;   // the warm tide: where along the beam, how wide, how strong; the jolts
uniform vec4 u_pull;   // the pull's way, how far it has carried the dust
uniform vec4 u_stir;   // the pull's strength, soft edges
uniform vec4 u_knot;   // the knot in the frame: x, y, size, light
uniform vec4 u_thr[THREADS * POINTS]; // thread points in the frame: x, y, half width, light
uniform vec4 u_box[THREADS];          // the box round each thread
uniform vec4 u_glint[GLINTS];         // sparks, brightest first: x, y, size, light
uniform vec4 u_tail[GLINTS];          // the streak behind each
uniform vec3 u_cold;
uniform vec3 u_warm;
uniform vec3 u_pale;
uniform vec3 u_backdrop; // the page
uniform vec4 u_edges;    // left, right, top, bottom

float time;

float sq(float x) {
  return x * x;
}

uint mixBits(uint x) {
  x ^= x >> 16;
  x *= 0x7feb352du;
  x ^= x >> 15;
  x *= 0x846ca68bu;
  x ^= x >> 16;
  return x;
}
float hash2(vec2 cell, uint k) {
  ivec2 c = ivec2(cell);
  return float(mixBits(uint(c.x) * 0x9e3779b9u ^ mixBits(uint(c.y) + 0x632be5abu + k * 0x27d4eb2du)) >> 8) / 16777215.0;
}
float vnoise2(vec2 p) {
  vec2 i = floor(p) + 4096.0;
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash2(i, 3u);
  float b = hash2(i + vec2(1.0, 0.0), 3u);
  float c = hash2(i + vec2(0.0, 1.0), 3u);
  float d = hash2(i + vec2(1.0, 1.0), 3u);
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
float fbm(vec2 p) {
  float s = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    s += a * vnoise2(p);
    p = p * 2.03 + vec2(1.7, 9.2);
    a *= 0.5;
  }
  return s / 0.9375;
}

// ---------- shapes (body.rs holds the same ones)
float sdEll(vec3 p, vec3 r) {
  float k0 = length(p / r);
  float k1 = length(p / (r * r));
  return k0 * (k0 - 1.0) / k1;
}
float sdBox(vec3 p, vec3 b) {
  vec3 q = abs(p) - b;
  return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
}
float sdCap(vec3 p, vec3 a, vec3 b, float r) {
  vec3 pa = p - a;
  vec3 ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h) - r;
}
float sdRC(vec3 p, vec3 a, vec3 b, float r1, float r2) {
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
float smin(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}
float figure(vec3 p) {
  vec3 q = vec3(abs(p.x), p.y, p.z);
  float d = sdEll(p - vec3(0.0, 0.6, -0.035), vec3(0.165, 0.12, 0.128));
  d = smin(d, sdEll(p - vec3(0.0, 0.79, -0.045), vec3(0.142, 0.15, 0.094)), 0.07);
  d = smin(d, sdEll(p - vec3(0.0, 0.975, -0.04), vec3(0.172, 0.165, 0.118)), 0.07);
  d = smin(d, sdCap(p, vec3(-0.165, 1.09, -0.055), vec3(0.165, 1.09, -0.055), 0.056), 0.07);
  d = smin(d, sdCap(p, vec3(0.0, 1.1, -0.045), vec3(0.0, 1.21, -0.035), 0.046), 0.04);
  d = smin(d, sdEll(p - vec3(0.0, 1.31, -0.02), vec3(0.091, 0.117, 0.104)), 0.045);
  float l = sdRC(q, vec3(0.1, 0.565, -0.01), vec3(0.112, 0.535, 0.43), 0.085, 0.057);
  l = smin(l, sdRC(q, vec3(0.114, 0.51, 0.445), vec3(0.116, 0.095, 0.47), 0.053, 0.036), 0.045);
  l = smin(l, sdRC(q, vec3(0.116, 0.06, 0.455), vec3(0.126, 0.036, 0.615), 0.04, 0.03), 0.03);
  float a = sdRC(q, vec3(0.198, 1.065, -0.055), vec3(0.222, 0.81, 0.0), 0.049, 0.04);
  a = smin(a, sdRC(q, vec3(0.222, 0.81, 0.0), vec3(0.172, 0.64, 0.29), 0.039, 0.031), 0.03);
  a = smin(a, sdEll(q - vec3(0.166, 0.622, 0.335), vec3(0.042, 0.022, 0.062)), 0.02);
  d = smin(d, l, 0.05);
  return smin(d, a, 0.028);
}
float chair(vec3 p) {
  vec3 q = vec3(abs(p.x), p.y, p.z);
  float d = sdBox(p - vec3(0.0, 0.457, 0.08), vec3(0.215, 0.018, 0.215)) - 0.006;
  d = min(d, sdBox(q - vec3(0.195, 0.222, 0.27), vec3(0.016, 0.222, 0.016)) - 0.003);
  d = min(d, sdBox(q - vec3(0.195, 0.5, -0.12), vec3(0.016, 0.5, 0.016)) - 0.003);
  d = min(d, sdBox(p - vec3(0.0, 0.83, -0.17), vec3(0.2, 0.13, 0.011)) - 0.004);
  return min(d, sdBox(p - vec3(0.0, 0.58, -0.12), vec3(0.2, 0.02, 0.012)) - 0.003);
}
float solid(vec3 p) {
  return min(figure(p), chair(p));
}
vec3 figureNormal(vec3 p) {
  const vec2 e = vec2(0.0006, -0.0006);
  return normalize(e.xyy * figure(p + e.xyy) + e.yyx * figure(p + e.yyx) + e.yxy * figure(p + e.yxy) + e.xxx * figure(p + e.xxx));
}
vec3 chairNormal(vec3 p) {
  const vec2 e = vec2(0.0006, -0.0006);
  return normalize(e.xyy * chair(p + e.xyy) + e.yyx * chair(p + e.yyx) + e.yxy * chair(p + e.yxy) + e.xxx * chair(p + e.xxx));
}

vec3 safeInv(vec3 d) {
  vec3 s = vec3(greaterThanEqual(d, vec3(0.0))) * 2.0 - 1.0;
  return 1.0 / (s * max(abs(d), vec3(1e-6)));
}
// Where a ray enters and leaves a box (enter < leave when it meets it).
vec2 box(vec3 ro, vec3 inv, vec3 lo, vec3 hi) {
  vec3 a = (lo - ro) * inv;
  vec3 b = (hi - ro) * inv;
  vec3 n = min(a, b);
  vec3 f = max(a, b);
  return vec2(max(max(n.x, n.y), max(n.z, 0.0)), min(min(f.x, f.y), f.z));
}
float segd(vec2 p, vec2 a, vec2 b, out float h) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-10), 0.0, 1.0);
  return length(pa - ba * h);
}
// A line `w` wide at distance d, kept to at least about a pixel (`px` in
// the same units) and dimmed as it widens, so it never sparkles.
float line(float d, float w, float px) {
  float s = max(w, px * 0.75);
  return w / s * exp(-sq(d / s));
}
float between(float r, float lo, float hi, float px) {
  return smoothstep(lo - px, lo + px, r) * smoothstep(hi + px, hi - px, r);
}
float planeY(vec3 ro, vec3 rd, float y) {
  return (y - ro.y) / (abs(rd.y) > 1e-5 ? rd.y : 1e-5);
}

// ---------- the rings
// The outer ring: cold, a fine line and a soft glow, ticks slowly turning
// on its outside. q is the point on its plane from its centre.
vec3 outerRing(vec2 q, float r, float px) {
  float rr = length(q);
  float d = rr - r;
  if (abs(d) > 0.25 * r + 40.0 * px) return vec3(0.0);
  float a = (atan(q.y, q.x) + u_world.w) / TAU;
  float minor = abs(fract(a * 72.0 + 0.5) - 0.5) / 72.0 * TAU * rr;
  float major = abs(fract(a * 8.0 + 0.5) - 0.5) / 8.0 * TAU * rr;
  float s = r / 1.35;
  float ticks = line(minor, 0.0022 * s, px) * between(d, 0.0, 0.035 * s, px)
              + line(major, 0.003 * s, px) * between(d, 0.0, 0.07 * s, px);
  return u_cold * (line(d, 0.0042 * s, px) * 0.95 + ticks * 0.5 + exp(-sq(d / (0.035 * s))) * 0.07);
}
// The inner ring: warm, a fine line and a softer glow.
vec3 innerRing(float d, float w, float px) {
  return u_warm * (line(d, w, px) + 0.14 * exp(-sq(d / (w * 8.0))));
}
float grazing(vec3 rd, vec3 n) {
  return mix(1.0, min(1.0 / max(abs(dot(rd, n)), 1e-3), 3.5), 0.5);
}

// ---------- the room
float occlusion(vec3 p, vec3 n) {
  float a = (0.03 - solid(p + n * 0.03)) + 0.5 * (0.09 - solid(p + n * 0.09));
  return clamp(1.0 - 7.0 * a, 0.0, 1.0);
}
// The person and the chair: darker than the page, a cold rim, a cold sheen
// on what faces up.
vec3 dark(vec3 p, vec3 n, vec3 rd, float depth, float rimLight) {
  float fres = pow(1.0 - abs(dot(n, -rd)), 3.0);
  float ao = occlusion(p, n);
  vec3 c = -u_backdrop * depth * (1.0 - 0.25 * ao);
  c += u_cold * (rimLight * fres + 0.03 * max(n.y, 0.0) * ao);
  return c;
}
vec3 floorLight(vec2 xz) {
  vec3 c = vec3(0.0);
  float r = length(xz - OUTER.xz);
  c += u_cold * 0.014 * exp(-sq((r - OUTER.w) / 0.3));
  // Darker under the person and the chair.
  c -= u_backdrop * 0.2 * exp(-dot(xz - vec2(0.0, 0.2), xz - vec2(0.0, 0.2)) / 0.3);
  if (abs(xz.x) < 0.45 && xz.y > -0.4 && xz.y < 0.9) {
    float near = solid(vec3(xz.x, 0.015, xz.y));
    c -= u_backdrop * 0.4 * exp(-max(near, 0.0) / 0.035);
  }
  return c;
}
// The column of light inside the body, crown down to where its front has
// run: even along its length, seen through the body.
vec3 column(vec3 ro, vec3 rd) {
  if (u_world.z <= 0.0) return vec3(0.0);
  float run = clamp((COLUMN_TOP.y - u_world.y) / (COLUMN_TOP.y - COLUMN_LOW.y), 0.0, 1.0);
  vec3 a = COLUMN_TOP;
  vec3 ba = (COLUMN_LOW - COLUMN_TOP) * run;
  vec3 oa = ro - a;
  float bb = dot(ba, ba);
  float bd = dot(ba, rd);
  float ob = dot(oa, ba);
  float od = dot(oa, rd);
  float h = bb > 1e-8 ? clamp((ob - bd * od) / max(bb - bd * bd, 1e-8), 0.0, 1.0) : 0.0;
  float s = max(bd * h - od, 0.0);
  float d = length(ro + rd * s - a - ba * h);
  float near = smoothstep(0.18, 0.6, s);
  return u_warm * u_world.z * near * (0.85 * exp(-sq(d / 0.022)) + 0.22 * exp(-d / 0.07));
}
vec3 roomLight(vec3 ro, vec3 rd, float pixel, float tsO, vec2 qO, float pxO, float tsR, float dR, float pxR) {
  float tFloor = rd.y < 0.0 ? -ro.y / rd.y : 1e9;
  int id = -1;
  float tHit = 1e9;
  float closest = 1e9;
  float tClosest = 1.0;
  vec2 b = box(ro, safeInv(rd), BOUNDS_FROM, BOUNDS_TO);
  if (b.x < b.y) {
    float t = b.x;
    float end = min(b.y, tFloor);
    for (int i = 0; i < 110; i++) {
      vec3 p = ro + rd * t;
      float df = figure(p);
      float d = min(df, chair(p));
      if (df < closest) {
        closest = df;
        tClosest = t;
      }
      if (d < 0.0004) {
        tHit = t;
        id = d == df ? 2 : 1;
        break;
      }
      t += d * 0.9;
      if (t > end) break;
    }
  }
  if (id < 0 && tFloor < 1e8) {
    tHit = tFloor;
    id = 0;
  }
  vec3 light = vec3(0.0);
  vec3 p = ro + rd * tHit;
  if (id == 0) {
    light = floorLight(p.xz);
  } else if (id == 1) {
    light = dark(p, chairNormal(p), rd, 0.35, 0.16);
  } else if (id == 2) {
    light = dark(p, figureNormal(p), rd, 0.55, 0.3);
    // where the inner ring passes, an even band of its light on the body
    light += u_warm * 0.2 * u_ring.w * exp(-sq((p.y - u_ring.x) / 0.03));
    light += column(ro, rd);
  }
  if (id != 2 && closest < 0.02) {
    float edge = max(closest, 0.0) / (pixel * tClosest);
    light += u_cold * 0.35 * exp(-edge * edge / 0.8);
  }
  // The rings, faint where the person, the chair or the floor is in front.
  if (tsO > 0.0) {
    light += outerRing(qO, OUTER.w, pxO) * grazing(rd, vec3(0.0, 1.0, 0.0)) * (tsO < tHit ? 1.0 : 0.15);
  }
  if (tsR > 0.0 && u_ring.w > 0.0) {
    light += innerRing(dR, 0.005, pxR) * u_ring.w * grazing(rd, vec3(0.0, 1.0, 0.0)) * (tsR < tHit ? 1.0 : 0.15);
  }
  return light;
}

// ---------- inside
// How much of the beam is at p: 1 on its axis, fading to its edge; `al`
// is how far along it p is, `r` its radius there.
float coneAt(vec3 p, out float al, out float pr, out float r) {
  vec3 v = p - u_beamO.xyz;
  al = dot(v, u_beamD.xyz);
  pr = length(v - u_beamD.xyz * al);
  r = 0.04 + max(al, 0.0) * u_beamO.w;
  return exp(-sq(pr / r) * 2.2) * smoothstep(-0.1, 0.3, al);
}
// The beam: where the ray crosses the cone, lit dust, and the warm tide of
// an emotion rolling along it; a soft glow round its axis.
vec3 beam(vec3 ro, vec3 rd, float jit) {
  vec3 O = u_beamO.xyz;
  vec3 D = u_beamD.xyz;
  float spread = u_beamO.w;
  vec3 w0 = ro - O;
  float bb = dot(rd, D);
  float dd = dot(rd, w0);
  float ee = dot(D, w0);
  float den = max(1.0 - bb * bb, 1e-4);
  float s = (bb * ee - dd) / den;
  float u = ee + bb * s;
  float axis = length(w0 + rd * s - D * u);
  vec3 c = mix(u_warm, u_pale, 0.25) * 0.035 * exp(-axis / 0.45) * smoothstep(-0.3, 0.4, u) * smoothstep(9.0, 5.0, u) / (1.0 + max(u, 0.0) * 0.25);
  float rad = 0.04 + max(u, 0.0) * spread;
  if (axis < 3.5 * rad + 0.2) {
    float span = min(3.0 * rad / sqrt(den) + 0.3, 3.5);
    float s0 = max(s - span, 0.0);
    float s1 = max(s + span, s0 + 0.01);
    float dt = (s1 - s0) / 40.0;
    vec3 acc = vec3(0.0);
    for (int i = 0; i < 40; i++) {
      float t = s0 + (float(i) + jit) * dt;
      vec3 p = ro + rd * t;
      float al, pr, r;
      float cone = coneAt(p, al, pr, r);
      if (cone < 0.004) continue;
      float att = exp(-al / 8.0) * 2.2 / (r + 0.05) * smoothstep(8.5, 5.0, al);
      // the dust, carried and drawn out the way the urge pulls
      vec3 q = p - u_pull.xyz * u_pull.w;
      q -= u_pull.xyz * dot(q, u_pull.xyz) * 0.6 * u_stir.x;
      float n = fbm(q.xy * 1.7 + vec2(q.z * 0.9, -q.z * 0.5) + 0.25 * vec2(sin(TAU * time / LOOP_SECONDS), cos(TAU * time / LOOP_SECONDS)));
      float dust = (0.03 + 0.15 * smoothstep(0.3, 0.85, n)) * (1.0 + 0.8 * u_tide.w);
      float tide = u_tide.z * exp(-sq((al - u_tide.x) / u_tide.y)) * smoothstep(0.35, 0.75, n + 0.25 * (pr / r)) * 0.9;
      acc += (mix(u_warm, u_pale, 0.15) * dust + u_warm * tide) * cone * att * dt;
    }
    c += acc;
  }
  return c * u_beamD.w;
}
// Dust everywhere inside, on ten fixed depths: faint and cold in the dark,
// warm where the beam crosses it; the urge carries it, a jolt shakes it.
vec3 motes(vec3 ro, vec3 rd, float pixel) {
  vec3 c = vec3(0.0);
  if (rd.z > -0.05) return c;
  float wob = TAU * time / LOOP_SECONDS;
  for (int k = 0; k < 10; k++) {
    float fk = float(k);
    float t = (-0.9 - fk * 0.5 - ro.z) / rd.z;
    if (t < 0.2) continue;
    vec3 p = ro + rd * t;
    vec3 q = p - u_pull.xyz * u_pull.w * (0.7 + 0.06 * fk);
    q.xy += 0.06 * vec2(sin(wob + fk * 1.3), cos(2.0 * wob + fk * 0.7));
    q.xy += u_tide.w * 0.012 * vec2(sin(fk * 4.1 + time * 40.0), cos(fk * 3.3 + time * 37.0));
    vec2 g = q.xy / 0.17;
    vec2 cell = floor(g) + vec2(4096.0 + fk * 97.0, 4096.0);
    float h = hash2(cell, 11u);
    if (h > 0.5) continue;
    vec2 at = vec2(hash2(cell, 12u), hash2(cell, 13u)) * 0.7 + 0.15;
    float d = length(fract(g) - at) * 0.17;
    float pw = pixel * u_ifwd.w * t;
    float size = 0.0035 + 0.004 * hash2(cell, 14u);
    float sz = max(size, pw * 0.8);
    float spot = size / sz * exp(-sq(d / sz));
    if (spot < 0.002) continue;
    float al, pr, r;
    float cone = coneAt(p, al, pr, r) * u_beamD.w;
    float att = exp(-max(al, 0.0) / 6.0);
    float tide = u_tide.z * exp(-sq((al - u_tide.x) / u_tide.y));
    c += spot * (u_pale * (0.05 + 0.08 * h) + mix(u_warm, u_pale, 0.3) * cone * att * (1.6 + 1.2 * tide + 0.8 * u_tide.w));
  }
  return c;
}
// The lantern's rim, the inner ring inside: warm, and a faint glass inside it.
vec3 mouth(vec3 q, float px) {
  float r = length(q);
  float d = r - MOUTH_R;
  return innerRing(d, 0.006, px) + u_warm * 0.06 * smoothstep(MOUTH_R, MOUTH_R * 0.5, r);
}
vec3 threads(vec2 f, float px) {
  vec3 c = vec3(0.0);
  vec3 ink = mix(u_warm, u_pale, 0.35);
  for (int k = 0; k < THREADS; k++) {
    vec4 b = u_box[k];
    if (f.x < b.x || f.x > b.z || f.y < b.y || f.y > b.w) continue;
    float g = 0.0;
    for (int i = 0; i < POINTS - 1; i++) {
      vec4 a = u_thr[k * POINTS + i];
      vec4 e = u_thr[k * POINTS + i + 1];
      if (a.z <= 0.0 || e.z <= 0.0 || a.w + e.w <= 0.0) continue;
      float h;
      float d = segd(f, a.xy, e.xy, h);
      float w = mix(a.z, e.z, h);
      float l = mix(a.w, e.w, h);
      g = max(g, l * (line(d, w, px) + 0.16 * exp(-sq(d / (w * 5.0 + px * 2.0)))));
    }
    c += ink * g;
  }
  return c;
}
vec3 glints(vec2 f, float px) {
  vec3 c = vec3(0.0);
  vec3 ink = mix(u_pale, u_warm, 0.3);
  for (int i = 0; i < GLINTS; i++) {
    vec4 g = u_glint[i];
    // Brightest first: the rest are dark.
    if (g.w < 0.002) break;
    vec2 d = f - g.xy;
    if (dot(d, d) > 0.09) continue;
    float s = max(g.z, px);
    float core = exp(-dot(d, d) / sq(s)) * g.z / s;
    float flare = exp(-abs(d.x) / (s * 0.3)) * exp(-sq(d.y / (s * 5.0)))
                + exp(-abs(d.y) / (s * 0.3)) * exp(-sq(d.x / (s * 5.0)));
    float h;
    float st = segd(f, g.xy, g.xy + u_tail[i].xy, h);
    float streak = line(st, s * 0.3, px) * (1.0 - h) * 0.6;
    c += ink * g.w * (core + 0.25 * flare * g.z / s + streak);
  }
  return c;
}
// The dark knot: a hole darker than the dark, faint warm loops turning in it.
vec3 knot(vec2 f, float px) {
  if (u_knot.w <= 0.0) return vec3(0.0);
  vec2 d = f - u_knot.xy;
  float r = length(d);
  float s = u_knot.z;
  if (r > s * 2.0) return vec3(0.0);
  vec3 c = -u_backdrop * 0.5 * u_knot.w * smoothstep(s, s * 0.4, r);
  c += u_warm * 0.1 * u_knot.w * exp(-sq((r - s) / (s * 0.18)));
  for (int k = 0; k < 5; k++) {
    float fk = float(k);
    float a = fk * 1.2566 + time * (0.15 + 0.05 * fk);
    vec2 ax = vec2(cos(a), sin(a));
    vec2 q = vec2(dot(d, ax), dot(d, vec2(-ax.y, ax.x)));
    vec2 e = vec2(s * (0.5 + 0.08 * fk), s * (0.2 + 0.05 * fk));
    float off = (length(q / e) - 1.0) * e.y;
    c += u_warm * 0.26 * u_knot.w * line(off, 0.003, px);
  }
  return c;
}
vec3 withinLight(vec3 ro, vec3 rd, vec2 f, float pixel, float tsI, vec2 qI, float pxI, float tsM, vec3 qM, float pxM, float jit) {
  // the deep dark, a faint slow haze in it
  vec3 c = -u_backdrop * (0.55 - 0.15 * fbm(rd.xy * 2.4 + rd.z + vec2(0.0, time * 0.01)));
  // far cold motes
  vec2 m = rd.xy / max(-rd.z, 0.25) * 140.0;
  vec2 cell = floor(m) + 4096.0;
  float h = hash2(cell, 7u);
  if (h > 0.986) {
    vec2 off = vec2(hash2(cell, 8u), hash2(cell, 9u)) - 0.5;
    float cellPx = 1.0 / (140.0 * pixel * u_ifwd.w);
    float dpx = length(fract(m) - 0.5 - off * 0.6) * cellPx;
    c += u_cold * (0.12 + 0.2 * hash2(cell, 10u)) * exp(-sq(dpx / 0.9)) * (0.7 + 0.3 * sin(time * 0.7 + h * 300.0));
  }
  // the outer ring, far and low
  if (tsI > 0.0) c += outerRing(qI, OUTER_IN.w, pxI) * grazing(rd, vec3(0.0, 1.0, 0.0));
  c += motes(ro, rd, pixel);
  c += beam(ro, rd, jit);
  if (tsM > 0.0) c += mouth(qM, pxM) * u_beamD.w * grazing(rd, u_beamD.xyz);
  c += threads(f, pixel);
  c += glints(f, pixel);
  c += knot(f, pixel);
  return c;
}

void main() {
  vec2 frag = gl_FragCoord.xy;
  // The frame: y -1..1 across its height, x -1.5..1.5 across its width.
  vec2 f = (frag / u_view.zw * 2.0 - 1.0) / u_view.xy;
  float pixel = 2.0 / (u_view.y * u_view.w);
  time = u_eye.w;
  float inside = u_world.x;
  vec3 ro = u_eye.xyz;
  vec3 rd = normalize(u_fwd.xyz + (u_right.xyz * f.x + u_up.xyz * f.y) * u_fwd.w);
  vec3 ri = u_ieye.xyz;
  vec3 rdi = normalize(u_ifwd.xyz + (u_iright.xyz * f.x + u_iup.xyz * f.y) * u_ifwd.w);
  // The rings' planes at every pixel, so a pixel's size on them comes from
  // its neighbours.
  float tsO = planeY(ro, rd, OUTER.y);
  vec2 qO = ro.xz + rd.xz * tsO - OUTER.xz;
  float pxO = clamp(length(fwidth(qO)), 1e-5, 1.0);
  float tsR = planeY(ro, rd, u_ring.x);
  float dR = length(ro.xz + rd.xz * tsR - vec2(0.0, u_ring.y)) - u_ring.z;
  float pxR = clamp(fwidth(dR), 1e-5, 1.0);
  float tsI = planeY(ri, rdi, OUTER_IN.y);
  vec2 qI = ri.xz + rdi.xz * tsI - OUTER_IN.xz;
  float pxI = clamp(length(fwidth(qI)), 1e-5, 4.0);
  vec3 D = u_beamD.xyz;
  float dn = dot(rdi, D);
  float tsM = dot(u_beamO.xyz - ri, D) / (abs(dn) > 1e-5 ? dn : 1e-5);
  vec3 qM = ri + rdi * tsM - u_beamO.xyz;
  float pxM = clamp(length(fwidth(qM)), 1e-5, 1.0);
  float jit = hash2(frag + 0.5, 5u);

  vec3 light = vec3(0.0);
  if (inside < 1.0) light += (1.0 - inside) * roomLight(ro, rd, pixel, tsO, qO, pxO, tsR, dR, pxR);
  if (inside > 0.0) light += inside * withinLight(ri, rdi, f, pixel, tsI, qI, pxI, tsM, qM, pxM, jit);
  // A soft shoulder where light piles up, then onto the page.
  vec3 over = 0.7 + 0.3 * (1.0 - exp(-(light - 0.7) / 0.3));
  vec3 c = mix(light, over, step(0.7, light));
  if (u_stir.y > 0.5) {
    c *= smoothstep(0.0, u_edges.x, v_uv.x) * smoothstep(0.0, u_edges.y, 1.0 - v_uv.x)
       * smoothstep(0.0, u_edges.z, 1.0 - v_uv.y) * smoothstep(0.0, u_edges.w, v_uv.y);
  }
  c = u_backdrop + c + (hash2(frag * 1.37 + 0.5, 0u) - 0.5) / 255.0;
  o = vec4(clamp(c, 0.0, 1.0), 1.0);
}
