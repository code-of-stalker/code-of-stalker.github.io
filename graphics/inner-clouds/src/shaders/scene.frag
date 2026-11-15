// «Окно» in one pass, straight onto the page.
// Each pixel's ray meets the room: the floor, the walls and the window wall
// (exact planes) or, inside their box, the chair and the seated person
// (distance fields, the same as body.rs). The moon comes in through the
// glass: it lies on the floor in the shape of the window, with his and the
// chair's shadow in it, lights his front and stands in the air as faint
// beams. Through the panes his sky: far hills, stars, slow clouds silvered
// by the moon, low scud, and what Rust has placed in it (a warm cloud,
// lightning, falling stars); over it, faintly, his own reflection. Round
// him the cold outer ring, always turning, and the warm inner ring.
// Colours are absolute, built from the page colour and the theme's cold,
// warm and pale. Rust puts the version line and the constants of lib.rs
// (#define) in front of it.
// The person's distance field is long, and a shader compiler copies a
// function into every place that calls it: so the march, the normal with
// its occlusion and the soft shadow each call it from one place only (both
// rays go through one march, both lights through one shadow), in loops
// that start at zero(), which the compiler cannot unroll. That keeps the
// first link short (on Windows the shader goes through HLSL).
precision highp float;
precision highp int;

#define TAU 6.28318531

in vec2 v_uv;
out vec4 o;

uniform vec4 u_eye;   // eye xyz, loop time
uniform vec4 u_right;
uniform vec4 u_up;
uniform vec4 u_fwd;   // forward, tangent of half the frame's height
uniform vec4 u_view;  // frame scale x and y, canvas width and height in px
uniform vec4 u_world; // the outer ring's turn, the moonlight, the flash, soft edges
uniform vec4 u_sky;   // how far the slow clouds and the scud have gone, how much scud, the warm cloud's light
uniform vec4 u_glow;  // the warm cloud's way, the inner ring's light
uniform vec4 u_flash; // the lightning's way
uniform vec4 u_arm[3];            // the lifting arm: elbow, wrist, hand
uniform vec4 u_bolt[BOLT_POINTS]; // lightning in the sky: x, y, width (< 0 starts a strand), light
uniform vec4 u_star[STARS];       // falling stars in the sky: tail xy, head xy
uniform vec4 u_starL[STARS];      // their light, width
uniform vec3 u_cold;
uniform vec3 u_warm;
uniform vec3 u_pale;
uniform vec3 u_backdrop; // the page
uniform vec4 u_edges;    // left, right, top, bottom

float time;
vec3 bg;

// 0, but only at run time (time is never negative).
int zero() {
  return min(int(u_eye.w), 0);
}

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
// Value noise that repeats every `period` cells across x, and its fbm:
// each octave doubles both the scale and the period, so the whole repeats
// every `period` of p.x. The clouds drift whole repeats a loop.
float pnoise(vec2 p, float period) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float x0 = mod(i.x, period);
  float x1 = mod(i.x + 1.0, period);
  float y = i.y + 4096.0;
  float a = hash2(vec2(x0, y), 3u);
  float b = hash2(vec2(x1, y), 3u);
  float c = hash2(vec2(x0, y + 1.0), 3u);
  float d = hash2(vec2(x1, y + 1.0), 3u);
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
float pfbm(vec2 p, float period) {
  float s = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    s += a * pnoise(p, period);
    p = p * 2.0 + vec2(17.0, 9.2);
    period *= 2.0;
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
// One arm: upper arm, forearm, hand.
float limb(vec3 p, vec3 elbow, vec3 wrist, vec3 hand) {
  float a = sdRC(p, SHOULDER, elbow, 0.049, 0.04);
  a = smin(a, sdRC(p, elbow, wrist, 0.039, 0.031), 0.03);
  return smin(a, sdEll(p - hand, HAND), 0.02);
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
  float a = min(limb(vec3(-p.x, p.y, p.z), REST_ELBOW, REST_WRIST, REST_HAND),
                limb(p, u_arm[0].xyz, u_arm[1].xyz, u_arm[2].xyz));
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
// One of them by kind: 2 the person, 1 the chair, 3 both.
float shape(vec3 p, int kind) {
  float d = 1e9;
  if (kind != 1) d = figure(p);
  if (kind != 2) d = min(d, chair(p));
  return d;
}
// The normal at a hit on `kind` (four taps round it) and, when `open` is
// asked for, how open the place is to the room (two taps out along the
// normal against both shapes); otherwise `ao` is 1.
vec3 surface(vec3 p, int kind, bool open, out float ao) {
  vec3 n = vec3(0.0);
  float a = 0.0;
  int taps = open ? 6 : 4;
  for (int k = zero(); k < 6; k++) {
    if (k >= taps) break;
    if (k == 4) n = normalize(n);
    vec3 e = vec3(float(((k + 3) >> 1) & 1), float((k >> 1) & 1), float(k & 1)) * 2.0 - 1.0;
    float h = k == 4 ? 0.03 : 0.09;
    vec3 q = k < 4 ? p + e * 0.0006 : p + n * h;
    float d = shape(q, k < 4 ? kind : 3);
    if (k < 4) {
      n += e * d;
    } else {
      a += (k == 4 ? 1.0 : 0.5) * (h - d);
    }
  }
  if (!open) n = normalize(n);
  ao = clamp(1.0 - 7.0 * a, 0.0, 1.0);
  return n;
}
// What stands on the floor: the chair's legs and his shins and feet.
float onFloor(vec3 p) {
  vec3 q = vec3(abs(p.x), p.y, p.z);
  float l = sdRC(q, vec3(0.114, 0.51, 0.445), vec3(0.116, 0.095, 0.47), 0.053, 0.036);
  l = min(l, sdRC(q, vec3(0.116, 0.06, 0.455), vec3(0.126, 0.036, 0.615), 0.04, 0.03));
  l = min(l, sdBox(q - vec3(0.195, 0.222, 0.27), vec3(0.016, 0.222, 0.016)) - 0.003);
  return min(l, sdBox(q - vec3(0.195, 0.5, -0.12), vec3(0.016, 0.5, 0.016)) - 0.003);
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

// The person and the chair along a ray, inside their box: where it hits
// (-1 for nothing), which (2 the person, 1 the chair), and how near it
// passes the person.
float march(vec3 ro, vec3 rd, float far, int steps, out int id, out float closest, out float tClosest) {
  id = -1;
  closest = 1e9;
  tClosest = 1.0;
  vec2 b = box(ro, safeInv(rd), BOUNDS_FROM, BOUNDS_TO);
  if (b.x >= b.y) return -1.0;
  float t = b.x;
  float end = min(b.y, far);
  for (int i = 0; i < 110; i++) {
    if (i >= steps) break;
    vec3 p = ro + rd * t;
    float df = figure(p);
    float d = min(df, chair(p));
    if (df < closest) {
      closest = df;
      tClosest = t;
    }
    if (d < 0.0004) {
      id = d == df ? 2 : 1;
      return t;
    }
    t += d * 0.9;
    if (t > end) break;
  }
  return -1.0;
}
// A soft shadow of the person and the chair along the way l.
float shadow(vec3 p, vec3 l, int steps) {
  vec2 b = box(p, safeInv(l), BOUNDS_FROM, BOUNDS_TO);
  if (b.x >= b.y) return 1.0;
  float res = 1.0;
  float t = max(b.x, 0.006);
  for (int i = 0; i < 32; i++) {
    if (i >= steps) break;
    float h = solid(p + l * t);
    res = min(res, 9.0 * h / t);
    if (res < 0.02) return 0.0;
    t += clamp(h, 0.008, 0.12);
    if (t > b.y) break;
  }
  return clamp(res, 0.0, 1.0);
}

// ---------- the window
float boxIn(vec2 p, vec2 lo, vec2 hi, float w) {
  vec2 a = smoothstep(lo - w, lo + w, p) * (1.0 - smoothstep(hi - w, hi + w, p));
  return a.x * a.y;
}
// The panes on the window wall, soft by w: the opening less the two
// mullions and the transom.
float glass(vec2 xy, float w) {
  float g = boxIn(xy, GLASS.xz, GLASS.yw, w);
  g *= smoothstep(BAR - w, BAR + w, abs(abs(xy.x) - MULLION));
  g *= smoothstep(BAR - w, BAR + w, abs(xy.y - TRANSOM));
  return g;
}
// How much light coming the way l reaches p through the panes; the farther
// the glass, the softer the edge it casts.
float through(vec3 p, vec3 l) {
  if (l.z <= 0.0) return 0.0;
  float t = (WINDOW_Z - p.z) / l.z;
  if (t < 0.0) return 0.0;
  return glass(p.xy + l.xy * t, 0.003 + 0.012 * t);
}

// ---------- the rings
// The outer ring: cold, a fine line and a soft glow, ticks turning on its
// outside and three bright runners with tails going round with them, so the
// turning always shows. q is the point on its plane from its centre.
vec3 outerRing(vec2 q, float r, float px) {
  float rr = length(q);
  float d = rr - r;
  if (abs(d) > 0.25 * r + 40.0 * px) return vec3(0.0);
  float a = (atan(q.y, q.x) + u_world.x) / TAU;
  float minor = abs(fract(a * 72.0 + 0.5) - 0.5) / 72.0 * TAU * rr;
  float major = abs(fract(a * 8.0 + 0.5) - 0.5) / 8.0 * TAU * rr;
  float s = r / 1.35;
  float ticks = line(minor, 0.0022 * s, px) * between(d, 0.0, 0.035 * s, px)
              + line(major, 0.003 * s, px) * between(d, 0.0, 0.07 * s, px);
  float ph = fract(a * 3.0);
  float head = min(ph, 1.0 - ph) / 3.0 * TAU * rr;
  float hw = max(0.011 * s, px);
  float run = exp(-(sq(head) + sq(d)) / sq(hw)) * 1.3
            + exp(-ph / 0.07) * line(d, 0.0055 * s, px) * 0.85;
  return u_cold * (line(d, 0.0042 * s, px) * 0.95 + ticks * 0.5 + exp(-sq(d / (0.035 * s))) * 0.07)
       + mix(u_cold, u_pale, 0.45) * run;
}
// The inner ring: warm, a fine line and a softer glow.
vec3 innerRing(float d, float w, float px) {
  return u_warm * (line(d, w, px) + 0.14 * exp(-sq(d / (w * 8.0))));
}
float grazing(vec3 rd, vec3 n) {
  return mix(1.0, min(1.0 / max(abs(dot(rd, n)), 1e-3), 3.5), 0.5);
}

// ---------- the sky
// A way into the sky is also kept as its point s = (x / z, y / z): Rust
// places the lightning and the falling stars there.
vec3 starField(vec2 s, float px) {
  vec2 m = s * 70.0;
  vec2 cell = floor(m) + 4096.0;
  float h = hash2(cell, 7u);
  if (h < 0.95) return vec3(0.0);
  vec2 off = vec2(hash2(cell, 8u), hash2(cell, 9u)) - 0.5;
  float dpx = length(fract(m) - 0.5 - off * 0.6) / max(px * 70.0, 1e-5);
  float b = 0.08 + 0.2 * hash2(cell, 10u);
  float twinkle = 0.75 + 0.25 * sin(TAU * (6.0 + floor(h * 100.0)) * time / LOOP_SECONDS + h * 300.0);
  return mix(u_pale, u_cold, 0.3) * b * twinkle * exp(-sq(dpx / 0.8));
}
// Lightning: a bright core about a pixel wide and a soft halo round it.
vec3 bolt(vec2 s, float px) {
  float core = 0.0;
  float halo = 0.0;
  for (int i = 1; i < BOLT_POINTS; i++) {
    vec4 b = u_bolt[i];
    if (b.z == 0.0) break;
    if (b.z < 0.0 || b.w <= 0.0) continue;
    float h;
    float d = segd(s, u_bolt[i - 1].xy, b.xy, h);
    core += b.w * line(d, b.z, px);
    halo += b.w * exp(-d / (b.z * 14.0));
  }
  return u_pale * min(core, 1.4) + mix(u_pale, u_cold, 0.35) * 0.05 * halo;
}
// Falling stars: a bright head, a tail fading the way it has come.
vec3 falling(vec2 s, float px) {
  vec3 c = vec3(0.0);
  for (int i = 0; i < STARS; i++) {
    vec4 l = u_starL[i];
    if (l.x <= 0.0) break;
    vec4 seg = u_star[i];
    float h;
    float d = segd(s, seg.xy, seg.zw, h);
    float head = exp(-sq(length(s - seg.zw) / max(l.y * 2.2, px)));
    c += mix(u_pale, u_cold, 0.25) * l.x * (line(d, l.y, px) * h * h * 0.9 + head * 0.9);
  }
  return c;
}
vec3 sky(vec3 rd, vec2 s, float pxS, float pxA) {
  float moon = u_world.y;
  float flash = u_world.z;
  float y = rd.y + 0.1;
  vec3 c = mix(bg * 1.5 + u_cold * 0.09, bg * 0.9 + u_cold * 0.025, smoothstep(0.0, 0.5, y));
  c += u_pale * 0.05 * smoothstep(0.15, 0.6, y) * (0.5 + 0.5 * moon);
  // The far hills, dark, a little light along their ridge.
  float ridge = 0.01 + 0.035 * fbm(vec2(rd.x * 5.0 + 2.0, 0.5));
  float hk = smoothstep(ridge + pxA, ridge - pxA, y);
  vec3 hills = mix(bg * 0.42, bg * 1.15 + u_cold * 0.05, exp(-max(ridge - y, 0.0) / 0.05) * 0.6) + u_pale * flash * 0.04;
  if (hk >= 1.0) return hills;
  vec2 q = vec2(rd.x, 1.0) / (y + 0.035);
  // The stars, behind everything.
  c += starField(s, pxS) * smoothstep(0.03, 0.15, y);
  // The slow high clouds, silvered from above; while the quiet emotion
  // lasts one gathers round the warm light.
  vec2 qb = q * 0.42 + vec2(u_sky.x, 0.0);
  float dB = pfbm(qb, SLOW_PERIOD);
  float near = max(dot(rd, u_glow.xyz), 0.0);
  dB += 0.3 * min(u_sky.w, 1.0) * pow(near, 24.0);
  float cb = smoothstep(0.44, 0.66, dB) * smoothstep(0.0, 0.05, y);
  float lit = clamp((dB - pfbm(qb + vec2(0.05, -0.16), SLOW_PERIOD)) * 7.0 + 0.3, 0.0, 1.0);
  c = mix(c, bg * 1.15 + u_cold * 0.05 + u_pale * 0.32 * lit * moon, cb);
  // The warm light inside a cloud: the quiet emotion.
  c += u_warm * u_sky.w * pow(near, 80.0) * (0.04 + 0.45 * cb * dB);
  // The sharp one: the sky flashes round the lightning, the bolt itself
  // through the thin cloud.
  float fk = pow(max(dot(rd, u_flash.xyz), 0.0), 6.0);
  if (flash > 0.0) {
    c += u_pale * flash * (0.05 + 0.55 * fk * (0.25 + cb));
    c += bolt(s, pxS) * (1.0 - 0.5 * cb);
  }
  c += falling(s, pxS) * (1.0 - 0.7 * cb);
  // The low fast scud, dark, its tops caught by the moon.
  vec2 qa = vec2(q.x * 0.45 - u_sky.y, q.y * 1.1 + 4.0);
  float dA = pfbm(qa, SCUD_PERIOD);
  float ca = smoothstep(0.46, 0.66, dA) * smoothstep(0.0, 0.08, y) * u_sky.z;
  float litA = clamp((dA - pfbm(qa + vec2(0.02, -0.12), SCUD_PERIOD)) * 9.0 + 0.2, 0.0, 1.0);
  c = mix(c, bg * 0.72 + u_pale * 0.24 * litA * moon + u_pale * flash * 0.2 * fk, ca * 0.92);
  return mix(c, hills, hk);
}

// ---------- the room
vec3 figureColor(vec3 p, vec3 n, vec3 rd, float ao) {
  float fr = pow(1.0 - abs(dot(n, -rd)), 3.0);
  vec3 c = (bg * 0.47 * (0.6 + 0.4 * ao) + u_cold * 0.3 * fr + bg * 0.45 * max(n.y, 0.0) * ao) * 0.75;
  float lv = through(p + n * 0.01, MOON);
  c += u_pale * 0.34 * u_world.y * max(dot(n, MOON), 0.0) * lv;
  c += mix(u_cold, u_pale, 0.5) * 0.3 * fr * (0.3 + 0.7 * lv);
  if (u_world.z > 0.0) {
    c += u_pale * 0.9 * u_world.z * max(dot(n, u_flash.xyz), 0.0) * through(p + n * 0.01, u_flash.xyz);
  }
  // Where the inner ring passes, an even band of its light on him.
  c += u_warm * 0.12 * u_glow.w * exp(-sq((p.y - INNER.y) / 0.03));
  return c;
}
vec3 chairColor(vec3 p, vec3 n, vec3 rd, float ao) {
  float fr = pow(1.0 - abs(dot(n, -rd)), 3.0);
  vec3 c = bg * 0.3 * (0.6 + 0.4 * ao) + u_cold * 0.15 * fr + bg * 0.3 * max(n.y, 0.0) * ao;
  float lv = through(p + n * 0.01, MOON);
  c += u_pale * 0.22 * u_world.y * max(dot(n, MOON), 0.0) * lv;
  if (u_world.z > 0.0) {
    c += u_pale * 0.6 * u_world.z * max(dot(n, u_flash.xyz), 0.0) * through(p + n * 0.01, u_flash.xyz);
  }
  return c;
}
vec3 floorColor(vec3 p, float px) {
  // Boards along z, a seam between them that melts away with distance.
  float fw = px * 4.5;
  float seam = mix(smoothstep(0.46 - fw, 0.5, abs(fract(p.x * 4.5) - 0.5)), 0.06, smoothstep(0.03, 0.12, fw));
  float board = 0.9 + 0.1 * vnoise2(vec2(floor(p.x * 4.5) * 7.3, p.z * 0.7)) - 0.3 * seam;
  // The moon and the flash through the panes, each with his shadow in it.
  float lv = through(p, MOON);
  float lf = u_world.z > 0.0 ? through(p, u_flash.xyz) : 0.0;
  for (int k = zero(); k < 2; k++) {
    float w = k == 0 ? lv : lf;
    if (w > 0.01) {
      float sh = shadow(p, k == 0 ? MOON : u_flash.xyz, k == 0 ? 24 : 16);
      if (k == 0) {
        lv *= sh;
      } else {
        lf *= sh;
      }
    }
  }
  vec3 c = bg * 0.42 * board + u_pale * 0.3 * lv * u_world.y * board;
  c += u_pale * 0.5 * u_world.z * lf;
  // The outer ring's cold on the boards below it.
  float r = length(p.xz - OUTER.xz);
  c += u_cold * 0.014 * exp(-sq((r - OUTER.w) / 0.3));
  // Darker under him and the chair.
  vec2 u = p.xz - vec2(0.0, 0.2);
  c *= 1.0 - 0.35 * exp(-dot(u, u) / 0.3);
  if (abs(p.x) < 0.45 && p.z > -0.4 && p.z < 0.9) {
    float near = onFloor(vec3(p.x, 0.015, p.z));
    c *= 1.0 - 0.6 * exp(-max(near, 0.0) / 0.035);
  }
  return c;
}
// A wall the flash reaches through the window.
vec3 wallColor(vec3 p) {
  vec3 c = bg * 0.3 + u_cold * 0.008;
  if (u_world.z > 0.0) c += u_pale * 0.25 * u_world.z * through(p, u_flash.xyz);
  return c;
}

void main() {
  vec2 frag = gl_FragCoord.xy;
  // The frame: y -1..1 across its height, x -1.5..1.5 across its width.
  vec2 f = (frag / u_view.zw * 2.0 - 1.0) / u_view.xy;
  float pixel = 2.0 / (u_view.y * u_view.w);
  float pxA = pixel * u_fwd.w;
  time = u_eye.w;
  bg = u_backdrop;
  float moon = u_world.y;
  float flash = u_world.z;
  vec3 ro = u_eye.xyz;
  vec3 rd = normalize(u_fwd.xyz + (u_right.xyz * f.x + u_up.xyz * f.y) * u_fwd.w);
  // Every plane at every pixel, so a pixel's size on each comes from its
  // neighbours: the window wall, the sky, the floor, the rings.
  float zw = max(rd.z, 1e-3);
  vec2 xyW = ro.xy + rd.xy * (WINDOW_Z - ro.z) / zw;
  float pxW = clamp(length(fwidth(xyW)), 1e-5, 0.2);
  vec2 s = rd.xy / zw;
  float pxS = clamp(length(fwidth(s)), 1e-6, 0.1);
  float tF = rd.y < 0.0 ? -ro.y / rd.y : 1e9;
  vec2 xzF = ro.xz + rd.xz * min(tF, 40.0);
  float pxF = clamp(length(fwidth(xzF)), 1e-5, 1.0);
  float tsO = planeY(ro, rd, OUTER.y);
  vec2 qO = ro.xz + rd.xz * tsO - OUTER.xz;
  float pxO = clamp(length(fwidth(qO)), 1e-5, 1.0);
  float tsR = planeY(ro, rd, INNER.y);
  float dR = length(ro.xz + rd.xz * tsR - INNER.xz) - INNER.w;
  float pxR = clamp(fwidth(dR), 1e-5, 1.0);

  // The room's planes: the window wall, the back wall, a side wall, the
  // ceiling, the floor.
  float tWin = rd.z > 0.0 ? (WINDOW_Z - ro.z) / rd.z : 1e9;
  float tBack = rd.z < 0.0 ? (WALLS.z - ro.z) / rd.z : 1e9;
  float tSide = abs(rd.x) > 1e-6 ? ((rd.x > 0.0 ? WALLS.x : -WALLS.x) - ro.x) / rd.x : 1e9;
  float tCeil = rd.y > 0.0 ? (WALLS.y - ro.y) / rd.y : 1e9;
  float tWall = min(min(tWin, tBack), min(tSide, tCeil));
  float tS = min(tF, tWall);

  // The window's panes, when the way reaches the window wall first.
  vec3 pw = ro + rd * tWin;
  float g = tF >= tWall && tWin <= tWall ? glass(xyW, pxW) : 0.0;
  vec3 rr = vec3(rd.x, rd.y, -rd.z);
  // The person and the chair straight on and, where the way meets a pane
  // instead, mirrored in it.
  int id = -1;
  float closest = 1e9;
  float tClosest = 1.0;
  float tB = -1.0;
  int rid = -1;
  float tr = -1.0;
  for (int pass = zero(); pass < 2; pass++) {
    bool first = pass == 0;
    int k;
    float c;
    float tc;
    float t = march(first ? ro : pw, first ? rd : rr, first ? tS : 9.0, first ? 110 : 80, k, c, tc);
    if (first) {
      tB = t;
      id = k;
      closest = c;
      tClosest = tc;
      if (tB > 0.0 || g <= 0.001) break;
    } else {
      tr = t;
      rid = k;
    }
  }
  float tHit = tB > 0.0 ? tB : tS;
  // At most one of the two hits: its point, normal and openness.
  vec3 hp = tB > 0.0 ? ro + rd * tB : pw + rr * tr;
  float ao = 1.0;
  vec3 hn = vec3(0.0, 1.0, 0.0);
  if (tB > 0.0 || tr > 0.0) hn = surface(hp, tB > 0.0 ? id : rid, tB > 0.0, ao);

  vec3 col;
  if (tB > 0.0) {
    col = id == 2 ? figureColor(hp, hn, rd, ao) : chairColor(hp, hn, rd, ao);
  } else if (tF < tWall) {
    col = floorColor(ro + rd * tF, pxF);
  } else if (tWin <= tWall) {
    float op = boxIn(xyW, GLASS.xz - 0.045, GLASS.yw + 0.045, pxW);
    vec3 wall = bg * 0.36 + u_cold * 0.01 + u_pale * 0.04 * flash;
    vec3 frame = bg * 0.3 + u_cold * 0.02;
    col = mix(wall, frame, op);
    if (g > 0.001) {
      // His sky, and over it, faintly, his own front lit by the moon.
      vec3 refl = vec3(0.0);
      float rh = 0.0;
      if (tr > 0.0) {
        float lv = through(hp + hn * 0.01, MOON);
        refl = bg * 0.4 + u_pale * 0.5 * max(dot(hn, MOON), 0.0) * lv * moon
             + u_cold * 0.15 * pow(1.0 - abs(dot(hn, -rr)), 3.0);
        rh = 1.0;
      }
      vec3 gc = sky(rd, s, pxS, pxA) * (1.0 - 0.15 * rh) + refl * 0.22 * rh + bg * 0.03;
      col = mix(col, gc, g);
    }
  } else {
    col = wallColor(ro + rd * tWall);
  }
  // A thin cold edge round his silhouette.
  if (id != 2 && closest < 0.02) {
    float edge = max(closest, 0.0) / (pxA * tClosest);
    col += u_cold * 0.2 * exp(-edge * edge / 0.8);
  }
  // The moonlight standing in the air of the room.
  float tEnd = min(tHit, 9.0);
  float bm = 0.0;
  float bf = 0.0;
  float j = hash2(frag + 0.5, 5u);
  for (int i = 0; i < 12; i++) {
    vec3 sp = ro + rd * ((float(i) + j) / 12.0 * tEnd);
    bm += through(sp, MOON);
    if (flash > 0.0) bf += through(sp, u_flash.xyz);
  }
  col += mix(u_pale, u_cold, 0.4) * 0.03 * bm * tEnd / 12.0 * moon + u_pale * 0.06 * flash * bf * tEnd / 12.0;
  // The rings, faint where the person or the chair is in front.
  vec3 up = vec3(0.0, 1.0, 0.0);
  if (tsO > 0.0) {
    col += outerRing(qO, OUTER.w, pxO) * grazing(rd, up) * (tsO < tHit ? 1.0 : 0.15);
  }
  if (tsR > 0.0) {
    col += innerRing(dR, 0.005, pxR) * u_glow.w * grazing(rd, up) * (tsR < tHit ? 1.0 : 0.15);
  }
  // A soft shoulder where light piles up, then the edges melt into the page.
  vec3 over = 0.7 + 0.3 * (1.0 - exp(-(col - 0.7) / 0.3));
  col = mix(col, over, step(0.7, col));
  if (u_world.w > 0.5) {
    float e = smoothstep(0.0, u_edges.x, v_uv.x) * smoothstep(0.0, u_edges.y, 1.0 - v_uv.x)
            * smoothstep(0.0, u_edges.z, 1.0 - v_uv.y) * smoothstep(0.0, u_edges.w, v_uv.y);
    col = mix(bg, col, e);
  }
  col += (hash2(frag * 1.37 + 0.5, 0u) - 0.5) / 255.0;
  o = vec4(clamp(col, 0.0, 1.0), 1.0);
}
