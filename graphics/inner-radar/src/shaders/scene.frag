// «Радар» in one pass, straight onto the page. Each pixel's ray meets the
// floor (an exact plane), the scope (an exact disc level with the chest) or,
// inside their box, the chair and the seated person (distance fields, the
// same as body.rs). The person and the chair are dark and matte with a cold
// rim. The scope is phosphor glass: what lies under it shows through and its
// light is added on top. On it: the range rings and spokes, the warm beam
// and its afterglow, the unlabelled marks, the bracket, the measure and the
// lines; round it the cold rim, always on, its ticks slowly turning. Light
// is added onto the page in the theme's cold, warm and pale. Rust puts the
// version line and the constants of lib.rs (#define) in front of it.
precision highp float;
precision highp int;

#define TAU 6.28318531

in vec2 v_uv;
out vec4 o;

uniform vec4 u_eye;     // camera position xyz, loop time
uniform vec4 u_right;   // camera axes
uniform vec4 u_up;
uniform vec4 u_fwd;
uniform vec4 u_view;    // lens scale x and y, canvas width and height in px
uniform vec4 u_scope;   // the beam's angle, its light, how far out it reaches, its afterglow (radians)
uniform vec4 u_grid;    // range rings and spokes, how far the rim's ticks have turned, (x, z) the lines start from
uniform vec4 u_blips[BLIPS]; // each lit mark, brightest first: (x, z) on the disc, size, light
uniform vec4 u_kinds[BLIPS]; // and its kind, age, seed
uniform vec4 u_lock;    // the bracket: (x, z) of its mark, half width, light
uniform vec4 u_measure; // the measure: (x, z) of its mark, how far it has run, light
uniform vec4 u_links[LINKS]; // the lines: (x, z) of each earlier mark, how far run, light
uniform vec3 u_cold;
uniform vec3 u_warm;
uniform vec3 u_pale;
uniform vec3 u_backdrop; // the page
uniform vec4 u_edges;    // left, right, top, bottom
uniform vec4 u_out;      // soft edges, -, -, -

// Loop time; the tangent of one pixel; one pixel on the disc.
float time;
float pixel;
float px;

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
float hash1(float x) {
  return float(mixBits(uint(int(x) + 4096) * 0x9e3779b9u) >> 8) / 16777215.0;
}
float vnoise(float x) {
  float i = floor(x);
  float f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(hash1(i), hash1(i + 1.0), f);
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
float segd(vec2 p, vec2 a, vec2 b, out float h) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-8), 0.0, 1.0);
  return length(pa - ba * h);
}
// A line `w` wide at distance d: kept to at least about a pixel on the disc
// and dimmed as it widens, so it never sparkles.
float stroke(float d, float w) {
  float s = max(w, px * 0.75);
  return w / s * exp(-sq(d / s));
}
// Dashes along a line, s along it; even grey once they are under a pixel.
float dash(float s, float period) {
  float d = abs(fract(s / period) - 0.5) * period;
  float on = 1.0 - smoothstep(0.28 * period - px, 0.28 * period + px, d);
  return mix(on, 0.56, smoothstep(0.3 * period, period, px));
}
// Between two radii on the disc, its edges a pixel soft.
float between(float r, float lo, float hi) {
  return smoothstep(lo - px, lo + px, r) * smoothstep(hi + px, hi - px, r);
}
// How far (radians, 0..TAU) the beam has gone past an angle, and the
// afterglow it left there.
float behindBeam(float th) {
  return mod(u_scope.x - th, TAU);
}
float glowAt(float th) {
  return exp(-behindBeam(th) / max(u_scope.w, 0.02));
}

// ---------- the marks, none labelled
vec3 marks(vec2 q) {
  vec3 c = vec3(0.0);
  vec3 ink = mix(u_warm, u_pale, 0.3);
  for (int i = 0; i < BLIPS; i++) {
    vec4 b = u_blips[i];
    // Brightest first: the rest are dark.
    if (b.w < 0.002) break;
    vec2 d2 = q - b.xy;
    if (dot(d2, d2) > 0.16) continue;
    vec4 k = u_kinds[i];
    float age = k.y;
    float d = length(d2);
    float h;
    float g;
    if (k.x < 0.5) {
      // a thought: one dot of a small cluster
      g = stroke(d, b.z) + 0.22 * exp(-d / (b.z * 3.5));
    } else if (k.x < 1.5) {
      // an emotion: a soft patch that swells, its inside stirring
      float s = b.z * (0.6 + 0.4 * smoothstep(0.0, 1.5, age));
      g = 0.5 * exp(-sq(d / s)) * (0.75 + 0.5 * vnoise2(q * 28.0 + k.z * 37.0 + vec2(0.0, time * 0.6)));
    } else if (k.x < 2.5) {
      // a micro-feeling: a faint short tick across the radius
      vec2 t = normalize(vec2(-b.y, b.x));
      g = 0.55 * stroke(segd(q, b.xy - t * b.z, b.xy + t * b.z, h), 0.0028);
    } else if (k.x < 3.5) {
      // an impulse: a dash that jumps outward, a ghost where it was
      vec2 outward = normalize(b.xy);
      vec2 t = vec2(-outward.y, outward.x);
      vec2 at = b.xy + outward * 0.09 * smoothstep(0.05, 0.35, age);
      float dd = segd(q, at - t * b.z, at + t * b.z, h);
      g = stroke(dd, 0.006) + 0.2 * exp(-dd / 0.03);
      g += 0.3 * smoothstep(0.05, 0.3, age) * stroke(segd(q, b.xy - t * b.z, b.xy + t * b.z, h), 0.0035);
    } else {
      // an urge: a dot that sends out slow rings
      g = 0.6 * stroke(d, 0.011);
      for (int j = 0; j < 2; j++) {
        float ph = fract(age / 1.8 + float(j) * 0.5);
        g += (1.0 - ph) * 0.8 * stroke(d - b.z * ph, 0.004);
      }
    }
    c += ink * b.w * g;
  }
  return c;
}

// ---------- what the beam does when it holds a mark
// Four corners round the mark, square to its radius.
float bracket(vec2 q) {
  if (u_lock.w <= 0.0) return 0.0;
  vec2 at = u_lock.xy;
  vec2 outward = normalize(at);
  vec2 t = vec2(-outward.y, outward.x);
  vec2 l = abs(vec2(dot(q - at, outward), dot(q - at, t)));
  float s = u_lock.z;
  float arm = 0.35 * s;
  float h;
  float d = min(segd(l, vec2(s), vec2(s - arm, s), h), segd(l, vec2(s), vec2(s, s - arm), h));
  return u_lock.w * stroke(d, 0.0035);
}
// «Не объясняй»: a dashed line runs out from the chest to the mark, and an
// arc through the mark opens both ways, ticks at its ends.
float measure(vec2 q) {
  if (u_measure.w <= 0.0) return 0.0;
  vec2 m = u_measure.xy;
  float far = length(m);
  vec2 dir = m / far;
  float run = u_measure.z;
  vec2 a = dir * 0.32;
  float h;
  float d = segd(q, a, mix(a, m, run), h);
  float g = stroke(d, 0.003) * dash(h * (far - 0.32) * run, 0.045);
  float r = length(q);
  float th = atan(q.y, q.x);
  float th0 = atan(m.y, m.x);
  float off = abs(mod(th - th0 + 0.5 * TAU, TAU) - 0.5 * TAU);
  float span = 0.32 * smoothstep(0.3, 1.0, run);
  g += stroke(r - far, 0.003) * (1.0 - smoothstep(span - 0.01, span, off)) * dash(off * far, 0.03);
  for (int s = -1; s <= 1; s += 2) {
    float e = th0 + float(s) * span;
    vec2 u = vec2(cos(e), sin(e));
    g += stroke(segd(q, u * (far - 0.035), u * (far + 0.035), h), 0.003) * step(0.02, span);
  }
  return u_measure.w * g;
}
// «Не ищи причину»: dashed lines run from the held mark to earlier ones.
float links(vec2 q) {
  float g = 0.0;
  vec2 from = u_grid.zw;
  for (int k = 0; k < LINKS; k++) {
    vec4 l = u_links[k];
    if (l.w <= 0.0) break;
    vec2 to = mix(from, l.xy, l.z);
    float h;
    float d = segd(q, from, to, h);
    g += l.w * stroke(d, 0.0028) * dash(h * length(to - from), 0.04) * smoothstep(0.06, 0.1, length(q - from));
  }
  return g;
}

// ---------- the scope
vec3 scope(vec2 q) {
  float r = length(q);
  if (r > SCOPE_R + 0.12) return vec3(0.0);
  float th = atan(q.y, q.x);
  float lit = u_scope.y;
  float behind = behindBeam(th);
  float off = min(behind, TAU - behind) * r;
  float reach = u_scope.z;
  float along = 1.0 - smoothstep(reach - 0.03, reach, r);
  vec3 c = vec3(0.0);
  // the faint glass and its grain, the range rings and the spokes
  float g = u_grid.x;
  c += u_warm * 0.012 * g;
  c += u_warm * 0.014 * (hash2(floor(q * 260.0) + 4096.0, 2u) - 0.5) * (1.0 - smoothstep(0.0025, 0.005, px));
  vec3 grid = mix(u_warm, u_pale, 0.5);
  for (int k = 1; k <= 4; k++) {
    c += grid * 0.085 * g * stroke(r - SCOPE_R * float(k) / 5.0, 0.0032);
  }
  float sp = TAU / 12.0;
  float ad = abs(mod(th + sp * 0.5, sp) - sp * 0.5) * r;
  c += u_pale * 0.045 * g * stroke(ad, 0.0028) * smoothstep(0.12, 0.2, r);
  // the beam: a fine line and a soft wake, a bright head while it grows
  float beam = stroke(off, 0.0055) + 0.35 * exp(-sq(off / 0.03));
  c += u_warm * lit * beam * smoothstep(0.02, 0.1, r) * along;
  float head = exp(-(sq(r - reach) + sq(off)) / sq(0.03)) * (1.0 - smoothstep(SCOPE_R - 0.15, SCOPE_R, reach));
  c += mix(u_warm, u_pale, 0.4) * lit * head * 0.8;
  // the afterglow it leaves
  c += u_warm * lit * 0.26 * glowAt(th) * (0.35 + 0.65 * smoothstep(0.0, 0.6, r)) * along;
  // where the disc cuts the person and the chair, a faint warm line
  if (r < 0.42) {
    float d = solid(vec3(SCOPE_C.x + q.x, SCOPE_Y, SCOPE_C.y + q.y));
    c += u_warm * 0.2 * g * (0.4 + 0.6 * lit * glowAt(th)) * stroke(d, 0.004);
  }
  c += marks(q);
  c += mix(u_warm, u_pale, 0.6) * (bracket(q) * 0.9 + measure(q) * 0.7 + links(q) * 0.6);
  c *= smoothstep(SCOPE_R + px, SCOPE_R - px, r);
  // the rim, the outer ring: cold, always on, its ticks slowly turning
  float a = (th + u_grid.y) / TAU;
  float minor = abs(fract(a * 72.0 + 0.5) - 0.5) / 72.0 * TAU * r;
  float major = abs(fract(a * 8.0 + 0.5) - 0.5) / 8.0 * TAU * r;
  float ticks = stroke(minor, 0.0022) * between(r, SCOPE_R - 0.045, SCOPE_R)
              + stroke(major, 0.003) * between(r, SCOPE_R - 0.09, SCOPE_R);
  c += u_cold * (stroke(r - SCOPE_R, 0.0042) * 0.95 + ticks * 0.55 + exp(-sq((r - SCOPE_R) / 0.035)) * 0.07);
  return c;
}

// ---------- the floor, the chair, the person
vec3 floorLight(vec2 xz) {
  vec2 q = xz - SCOPE_C;
  float r = length(q);
  float th = atan(q.y, q.x);
  vec3 c = vec3(0.0);
  // The scope's light falls on the floor under it, warm under the
  // afterglow, as far as the beam reaches.
  float under = smoothstep(SCOPE_R * 1.05, SCOPE_R * 0.55, r) * smoothstep(0.05, 0.35, r);
  float trail = exp(-behindBeam(th) / max(u_scope.w * 1.4, 0.12));
  c += u_warm * 0.045 * u_scope.y * trail * under * smoothstep(0.0, 0.1, u_scope.z - r * 0.9);
  c += u_cold * 0.014 * exp(-sq((r - SCOPE_R) / 0.3));
  // Darker under the person and the chair.
  c -= u_backdrop * 0.2 * exp(-dot(xz - vec2(0.0, 0.2), xz - vec2(0.0, 0.2)) / 0.3);
  if (abs(xz.x) < 0.45 && xz.y > -0.4 && xz.y < 0.9) {
    float near = solid(vec3(xz.x, 0.015, xz.y));
    c -= u_backdrop * 0.4 * exp(-max(near, 0.0) / 0.035);
  }
  return c;
}
float occlusion(vec3 p, vec3 n) {
  float a = (0.03 - solid(p + n * 0.03)) + 0.5 * (0.09 - solid(p + n * 0.09));
  return clamp(1.0 - 7.0 * a, 0.0, 1.0);
}
// The person and the chair: darker than the page, a cold rim, a cold sheen
// on what faces up; and near the scope, the warm of the beam's afterglow.
vec3 dark(vec3 p, vec3 n, vec3 rd, float depth, float rimLight) {
  float fres = pow(1.0 - abs(dot(n, -rd)), 3.0);
  float ao = occlusion(p, n);
  vec3 c = -u_backdrop * depth * (1.0 - 0.25 * ao);
  c += u_cold * (rimLight * fres + 0.03 * max(n.y, 0.0) * ao);
  vec2 q = p.xz - SCOPE_C;
  float band = exp(-abs(p.y - SCOPE_Y) / 0.1);
  float reached = smoothstep(0.0, 0.1, u_scope.z - length(q));
  c += u_warm * 0.12 * band * u_scope.y * glowAt(atan(q.y, q.x)) * reached * (0.5 + 0.5 * ao);
  return c;
}

void main() {
  vec2 frag = gl_FragCoord.xy;
  pixel = 2.0 / (u_view.y * u_view.w);
  vec2 lens = (frag / u_view.zw * 2.0 - 1.0) / u_view.xy;
  vec3 rd = normalize(u_fwd.xyz + u_right.xyz * lens.x + u_up.xyz * lens.y);
  vec3 ro = u_eye.xyz;
  time = u_eye.w;

  // The disc's plane at every pixel, so a pixel's size on it comes from its
  // neighbours.
  float ts = (SCOPE_Y - ro.y) / (abs(rd.y) > 1e-5 ? rd.y : 1e-5);
  vec2 q = ro.xz + rd.xz * ts - SCOPE_C;
  px = clamp(length(fwidth(q)), 1e-5, 0.2);

  // The nearest surface: the person or the chair inside their box, else
  // the floor. A ray that just misses the person still catches their rim.
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
  }
  if (id != 2 && closest < 0.02) {
    float edge = max(closest, 0.0) / (pixel * tClosest);
    light += u_cold * 0.35 * exp(-edge * edge / 0.8);
  }
  // The scope over whatever lies under it, brighter where it is seen
  // edge-on.
  if (ts > 0.0 && ts < tHit) {
    float grazing = mix(1.0, min(1.0 / max(abs(rd.y), 1e-3), 3.5), 0.5);
    light += scope(q) * grazing;
  }

  // A soft shoulder where light piles up, then onto the page.
  vec3 over = 0.7 + 0.3 * (1.0 - exp(-(light - 0.7) / 0.3));
  vec3 c = mix(light, over, step(0.7, light));
  if (u_out.x > 0.5) {
    c *= smoothstep(0.0, u_edges.x, v_uv.x) * smoothstep(0.0, u_edges.y, 1.0 - v_uv.x)
       * smoothstep(0.0, u_edges.z, 1.0 - v_uv.y) * smoothstep(0.0, u_edges.w, v_uv.y);
  }
  c = u_backdrop + c + (hash2(frag * 1.37 + 0.5, 0u) - 0.5) / 255.0;
  o = vec4(clamp(c, 0.0, 1.0), 1.0);
}
