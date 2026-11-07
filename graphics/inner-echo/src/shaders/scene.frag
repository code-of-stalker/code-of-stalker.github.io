// The whole scene in one pass, straight onto the page. The room exists only
// as points of light where perception has touched it: each pixel's ray meets
// the floor and the two walls (exact planes), the table, the vase and the
// lamp, the chair and the seated person (distance fields marched inside
// their boxes), and the surface it meets lights a point of a lattice laid on
// it. The inside of the body is a second, warm lattice walked cell by cell
// through the person's box; which cells hold a point comes baked from Rust
// (u_body). The orbit and the inner ring are rings of points. Light is added
// onto the page in the theme's cold, warm and pale. Rust puts the version
// line and lib.rs's constants (#define) in front of it.
precision highp float;
precision highp int;
precision highp sampler3D;

#define TAU 6.28318531
#define PI 3.14159265

in vec2 v_uv;
out vec4 o;

uniform vec4 u_eye;    // camera position xyz, loop time
uniform vec4 u_right;  // camera axes
uniform vec4 u_up;
uniform vec4 u_fwd;
uniform vec4 u_view;   // lens scale x and y, canvas width and height in px
uniform vec4 u_wave;   // the three waves out: radii; the wave back in: radius
uniform vec4 u_front;  // and their fronts' light
uniform vec4 u_echo;   // the three echoes inside: radii; the wave through both
uniform vec4 u_echo_l; // and their fronts' light
uniform vec4 u_room;   // room, orbit, skin, outer sweep
uniform vec4 u_inner;  // inside, inner ring, inner sweep, sparks
uniform vec4 u_noise;  // sinking, grid, trembling, the double
uniform vec4 u_misc;   // sweep angle, -, -, -
uniform vec3 u_cold;
uniform vec3 u_warm;
uniform vec3 u_pale;
uniform vec3 u_backdrop; // the page
uniform vec4 u_edges;    // left, right, top, bottom
uniform vec4 u_out;      // soft edges, -, -, -
uniform sampler3D u_body; // which cells of the inside hold a point, by depth

const vec3 SPARK_AT[6] = SPARK_LIST;

// The tangent of one pixel; the sparks' flare now.
float pixel;
float flare[6];

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
float hash3(vec3 cell, uint k) {
  ivec3 c = ivec3(cell);
  return float(mixBits(uint(c.x) * 0x9e3779b9u ^ mixBits(uint(c.y) * 0x85ebca6bu ^ mixBits(uint(c.z) * 0xc2b2ae35u ^ k))) >> 8) / 16777215.0;
}

// ---------- shapes (body.rs holds the same figure)
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

// The person: sits upright on the chair, feet flat, hands on the thighs,
// facing +z.
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
// A plain chair with a straight back: seat, four legs, a back panel and a
// rail.
float chair(vec3 p) {
  vec3 q = vec3(abs(p.x), p.y, p.z);
  float d = sdBox(p - vec3(0.0, 0.445, 0.08), vec3(0.215, 0.018, 0.215)) - 0.006;
  d = min(d, sdBox(q - vec3(0.195, 0.215, 0.27), vec3(0.016, 0.215, 0.016)) - 0.003);
  d = min(d, sdBox(q - vec3(0.195, 0.5, -0.12), vec3(0.016, 0.5, 0.016)) - 0.003);
  d = min(d, sdBox(p - vec3(0.0, 0.83, -0.17), vec3(0.2, 0.13, 0.011)) - 0.004);
  d = min(d, sdBox(p - vec3(0.0, 0.58, -0.12), vec3(0.2, 0.02, 0.012)) - 0.003);
  return d;
}
// The table with a vase on it, and the floor lamp.
float things(vec3 p) {
  vec3 tq = p - TABLE;
  vec3 ta = vec3(abs(tq.x), tq.y, abs(tq.z));
  float d = min(sdBox(tq - vec3(0.0, 0.56, 0.0), vec3(0.32, 0.018, 0.32)) - 0.004,
                sdBox(ta - vec3(0.28, 0.28, 0.28), vec3(0.018, 0.28, 0.018)));
  d = min(d, sdCap(tq, vec3(0.1, 0.58, -0.05), vec3(0.1, 0.68, -0.05), 0.045));
  vec3 lq = p - LAMP;
  d = min(d, sdCap(lq, vec3(0.0), vec3(0.0, 1.5, 0.0), 0.015));
  return min(d, sdEll(lq - vec3(0.0, 1.58, 0.0), vec3(0.17, 0.12, 0.17)));
}
float person(vec3 p) {
  return min(figure(p), chair(p));
}
// id 3 the things, 4 the chair, 5 the skin.
float field(vec3 p, int id) {
  return id == 5 ? figure(p) : id == 4 ? chair(p) : things(p);
}
vec3 normalOf(vec3 p, int id) {
  const vec2 e = vec2(0.0007, -0.0007);
  return normalize(e.xyy * field(p + e.xyy, id) + e.yyx * field(p + e.yyx, id)
                 + e.yxy * field(p + e.yxy, id) + e.xxx * field(p + e.xxx, id));
}

// ---------- rays
// 1/d with its sign kept and no zero.
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
// The nearest of the floor (id 0), the back wall (1) and the left wall (2).
float planes(vec3 ro, vec3 rd, out int id) {
  float best = 1e9;
  id = -1;
  if (rd.y < 0.0) {
    float t = -ro.y / rd.y;
    vec3 p = ro + rd * t;
    if (p.x > LEFT && p.z > BACK) {
      best = t;
      id = 0;
    }
  }
  if (rd.z < 0.0) {
    float t = (BACK - ro.z) / rd.z;
    vec3 p = ro + rd * t;
    if (p.x > LEFT && p.y > 0.0 && t < best) {
      best = t;
      id = 1;
    }
  }
  if (rd.x < 0.0) {
    float t = (LEFT - ro.x) / rd.x;
    vec3 p = ro + rd * t;
    if (p.z > BACK && p.y > 0.0 && t < best) {
      best = t;
      id = 2;
    }
  }
  return best;
}
float marchPerson(vec3 ro, vec3 rd, float t, float far) {
  for (int i = 0; i < 110; i++) {
    if (t > far) return -1.0;
    float d = person(ro + rd * t);
    if (d < 0.0004 * t) return t;
    t += d * 0.9;
  }
  return -1.0;
}
float marchThings(vec3 ro, vec3 rd, float t, float far) {
  for (int i = 0; i < 72; i++) {
    if (t > far) return -1.0;
    float d = things(ro + rd * t);
    if (d < 0.0004 * t) return t;
    t += d * 0.9;
  }
  return -1.0;
}
// A point of light at P seen along the ray: a pixel-wide core (or `size`
// wide) and a faint halo; nothing past tmax.
float glowAt(vec3 ro, vec3 rd, vec3 P, float size, float tmax) {
  vec3 w = P - ro;
  float t = dot(w, rd);
  if (t <= 0.001 || t > tmax) return 0.0;
  float s = max(pixel * t * 1.2, size);
  float q = sq(length(w - rd * t) / s);
  return exp(-q) + 0.12 * exp(-q / 20.0);
}

// ---------- light
// The fronts at distance r from the heart: the three waves out (each with a
// fainter ring behind it), the wave back in, the wave through both.
float fronts(float r) {
  float f = u_front.x * (1.4 * exp(-sq((r - u_wave.x) / 0.05)) + 0.4 * exp(-sq((r - u_wave.x + 0.8) / 0.04)));
  f += u_front.y * (1.4 * exp(-sq((r - u_wave.y) / 0.05)) + 0.4 * exp(-sq((r - u_wave.y + 0.8) / 0.04)));
  f += u_front.z * (1.4 * exp(-sq((r - u_wave.z) / 0.05)) + 0.4 * exp(-sq((r - u_wave.z + 0.8) / 0.04)));
  f += u_front.w * 1.2 * exp(-sq((r - u_wave.w) / 0.05));
  return f + u_echo_l.w * 1.4 * exp(-sq((r - u_echo.w) / 0.05));
}
// How much of the room the waves have left lit at distance r.
float seenAt(float r) {
  return LEVELS.x * smoothstep(u_wave.x + 0.03, u_wave.x - 0.03, r)
       + LEVELS.y * smoothstep(u_wave.y + 0.03, u_wave.y - 0.03, r)
       + LEVELS.z * smoothstep(u_wave.z + 0.03, u_wave.z - 0.03, r);
}
// The sweep's trail at angle a round the heart.
float trail(float a, float k) {
  return exp(-mod(u_misc.x - a, TAU) * k);
}

// Points on a surface: a jittered lattice `s` apart in the plane the normal
// faces most; the nearest point's glow, and a seed for its brightness.
float dots(vec3 p, vec3 n, float rad, float s, out float seed) {
  vec3 an = abs(n);
  bool up = an.y > max(an.x, an.z);
  bool side = !up && an.x > an.z;
  vec2 uv = up ? p.xz : side ? p.zy : p.xy;
  float axis = up ? n.y : side ? n.x : n.z;
  uint face = (up ? 0u : side ? 2u : 4u) + (axis > 0.0 ? 1u : 0u);
  vec2 base = floor(uv / s);
  float best = 0.0;
  seed = 0.0;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 id = base + vec2(float(i), float(j));
      vec2 c = (id + 0.5 + (vec2(hash2(id, face), hash2(id, face + 8u)) - 0.5) * 0.7) * s;
      float g = exp(-dot(uv - c, uv - c) / (rad * rad));
      if (g > best) {
        best = g;
        seed = hash2(id, face + 16u);
      }
    }
  }
  return best;
}

// The point the ray meets on surface `id`: 0 floor, 1 back wall, 2 left
// wall, 3 things, 4 chair, 5 skin.
vec3 surface(vec3 p, vec3 n, vec3 rd, float t, int id) {
  float pw = pixel * t;
  float s = id == 5 ? SPACING.x : id == 4 ? SPACING.y : id == 3 ? SPACING.z : SPACING.w;
  float facing = abs(dot(n, rd));
  float rad = max(pw * 1.05, s * 0.07);
  float seed;
  float dt = dots(p, n, rad, s, seed);
  // Points closer than a few px melt into their mean before they shimmer.
  float apart = s * max(facing, 0.1) / pw;
  dt = mix(PI * sq(rad / s) * 0.8, dt, smoothstep(1.8, 3.6, apart));

  // The window and the door are holes; their edges, and the window's cross,
  // are lines of light.
  float edge = 9.0;
  if (id == 1 || id == 2) {
    vec2 q = id == 1 ? p.xy - WINDOW.xy : p.zy - DOOR.xy;
    vec2 size = id == 1 ? WINDOW.zw : DOOR.zw;
    vec2 e = abs(q) - size;
    float sd = length(max(e, 0.0)) + min(max(e.x, e.y), 0.0);
    edge = abs(sd);
    if (sd < 0.0) {
      dt = 0.0;
      if (id == 1) edge = min(edge, min(abs(q.x), abs(q.y - 0.12)));
    }
  }

  float r = length(p - HEART);
  float reach = 1.0 - smoothstep(FADE_FROM, REACH, r);
  float graze = smoothstep(0.05, 0.35, facing);
  float fall = 1.0 / (1.0 + 0.12 * t);
  float sweep = u_room.w * trail(atan(p.z - HEART.z, p.x - HEART.x), 1.6);
  // The perceiver and the chair it sits on are there from the first frame.
  float seen = id == 5 ? 1.0 : seenAt(r) * u_room.x;
  if (id == 4) seen = max(seen, 0.6);
  float base = id == 5 ? u_room.z : id == 4 ? 1.0 : id == 3 ? 0.75 : 0.4;
  vec3 tint = id == 5 ? mix(u_cold, u_pale, 0.55) : id == 4 ? mix(u_cold, u_pale, 0.25) : u_cold;
  float orbit = id == 0 ? u_room.y * exp(-sq((length(p.xz - HEART.xz) - ORBIT) / 0.05)) : 0.0;
  float front = fronts(r);
  float light = seen * (base * (0.55 + 0.45 * seed) + 0.9 * sweep) + 1.3 * orbit + front;
  vec3 c = tint * dt * graze * fall * reach * light;
  if (edge < 1.0) c += u_cold * 0.35 * exp(-sq(edge / (pw * 1.3))) * fall * reach * (seen + front);
  return c;
}

// One warm point of the inside, in lattice cell `cell` (`depth` how deep
// inside the skin). The body's rest shape is squashed toward the floor by
// `squash` and moved by `shift`; `movers` draws the points that went to the
// double, otherwise those that stay.
vec3 point(vec3 cell, float depth, vec3 ro, vec3 rd, float tmax, float squash, vec3 shift, bool movers) {
  float twin = u_noise.w;
  bool mover = hash3(cell, 6u) < MOVERS;
  if (movers != mover && (movers || twin > 0.0)) return vec3(0.0);
  float h = hash3(cell, 5u);
  float grid = u_noise.y;
  // The grid fills every cell; the points it adds come in softly.
  float show = smoothstep(0.0, 0.08, h - 0.3 * (1.0 - grid));
  if (show <= 0.0) return vec3(0.0);
  vec3 j = (vec3(hash3(cell, 1u), hash3(cell, 2u), hash3(cell, 3u)) - 0.5) * 0.8 * (1.0 - grid);
  if (u_noise.z > 0.0) {
    float f = u_eye.w * 9.0;
    uint a = uint(floor(f)) * 3u + 40u;
    vec3 ja = vec3(hash3(cell, a), hash3(cell, a + 1u), hash3(cell, a + 2u));
    vec3 jb = vec3(hash3(cell, a + 3u), hash3(cell, a + 4u), hash3(cell, a + 5u));
    j += (mix(ja, jb, smoothstep(0.0, 1.0, fract(f))) - 0.5) * 0.5 * u_noise.z;
  }
  vec3 c = (cell + 0.5 + clamp(j, -0.46, 0.46)) * INSIDE;
  vec3 w = vec3(c.x, c.y * squash, c.z) + shift - ro;
  float tp = dot(w, rd);
  if (tp <= 0.0 || tp > tmax) return vec3(0.0);
  float rad = pixel * tp * 1.05;
  float g = exp(-dot(w - rd * tp, w - rd * tp) / (rad * rad));
  if (g < 0.003) return vec3(0.0);

  // Lit where the wave back in has passed, brighter with every echo; the
  // fronts flash as they go through.
  float r = length(c - HEART);
  float level = INNER_BASE * smoothstep(u_wave.w - 0.03, u_wave.w + 0.03, r)
              + ECHO_LEVELS.x * smoothstep(u_echo.x + 0.03, u_echo.x - 0.03, r)
              + ECHO_LEVELS.y * smoothstep(u_echo.y + 0.03, u_echo.y - 0.03, r)
              + ECHO_LEVELS.z * smoothstep(u_echo.z + 0.03, u_echo.z - 0.03, r);
  float front = u_front.w * 1.3 * exp(-sq((r - u_wave.w) / 0.04))
              + u_echo_l.x * 1.2 * exp(-sq((r - u_echo.x) / 0.04))
              + u_echo_l.y * 1.2 * exp(-sq((r - u_echo.y) / 0.04))
              + u_echo_l.z * 1.2 * exp(-sq((r - u_echo.z) / 0.04))
              + u_echo_l.w * 1.3 * exp(-sq((r - u_echo.w) / 0.05));
  float sweep = u_inner.z * trail(atan(c.z - HEART.z, c.x - HEART.x), 1.2);
  float spark = 0.0;
  if (u_inner.w > 0.0) {
    for (int k = 0; k < 6; k++) spark += flare[k] * exp(-sq(length(c - SPARK_AT[k]) / 0.05));
  }
  float b = (level * (0.5 + 0.5 * h) * (0.8 + 0.9 * sweep) + front + 2.5 * spark) * (0.75 + 0.25 * depth);
  b *= u_inner.x * show * (1.0 - 0.45 * u_noise.x);
  vec3 tint = mix(u_warm, u_pale, 0.25 * h);
  tint = mix(tint, mix(u_cold, u_pale, 0.5), 0.45 * grid);
  if (movers) {
    tint = mix(tint, u_pale, 0.2 * twin);
    b *= 0.85;
  } else {
    b *= 1.0 - 0.45 * twin;
  }
  return tint * g * b;
}

// The inside along the ray up to tmax: walk the lattice cell by cell in the
// body's rest shape.
vec3 inside(vec3 ro, vec3 rd, float tmax, bool movers, float squash, vec3 shift) {
  vec3 scale = vec3(1.0, 1.0 / squash, 1.0);
  vec3 from = (ro - shift) * scale;
  vec3 d = rd * scale;
  vec3 inv = safeInv(d);
  vec3 lo = vec3(CELL_FROM) * INSIDE;
  vec3 hi = vec3(CELL_FROM + CELLS) * INSIDE;
  vec2 span = box(from, inv, lo, hi);
  span.y = min(span.y, tmax);
  if (span.x >= span.y) return vec3(0.0);
  vec3 st = sign(inv);
  vec3 cell = clamp(floor((from + d * (span.x + 1e-4)) / INSIDE), vec3(CELL_FROM), vec3(CELL_FROM + CELLS - 1));
  vec3 td = abs(INSIDE * inv);
  vec3 tm = ((cell + max(st, 0.0)) * INSIDE - from) * inv;
  vec3 acc = vec3(0.0);
  for (int i = 0; i < 128; i++) {
    ivec3 at = ivec3(cell) - CELL_FROM;
    if (any(lessThan(at, ivec3(0))) || any(greaterThanEqual(at, CELLS))) break;
    float v = texelFetch(u_body, at, 0).r;
    if (v > 0.0) acc += point(cell, v, ro, rd, tmax, squash, shift, movers);
    float tn = min(tm.x, min(tm.y, tm.z));
    if (tn > span.y) break;
    vec3 m = step(tm, vec3(tn));
    cell += st * m;
    tm += td * m;
  }
  return acc;
}

void main() {
  vec2 frag = gl_FragCoord.xy;
  pixel = 2.0 / (u_view.y * u_view.w);
  vec2 lens = (frag / u_view.zw * 2.0 - 1.0) / u_view.xy;
  vec3 rd = normalize(u_fwd.xyz + u_right.xyz * lens.x + u_up.xyz * lens.y);
  vec3 ro = u_eye.xyz;
  vec3 inv = safeInv(rd);
  float time = u_eye.w;

  // The nearest surface: the planes, then the things and the person inside
  // their boxes. The inside's points are seen through the skin (it is only
  // points), so they stop at the first thing that is not skin.
  int id;
  float tHit = planes(ro, rd, id);
  vec2 b0 = box(ro, inv, TABLE + vec3(-0.36, 0.0, -0.36), TABLE + vec3(0.36, 0.76, 0.36));
  vec2 b1 = box(ro, inv, LAMP + vec3(-0.19, 0.0, -0.19), LAMP + vec3(0.19, 1.72, 0.19));
  float tin = 1e9;
  float tout = -1.0;
  if (b0.x < b0.y) {
    tin = b0.x;
    tout = b0.y;
  }
  if (b1.x < b1.y) {
    tin = min(tin, b1.x);
    tout = max(tout, b1.y);
  }
  if (tin < min(tout, tHit)) {
    float t = marchThings(ro, rd, tin, min(tout, tHit));
    if (t > 0.0) {
      tHit = t;
      id = 3;
    }
  }
  float tStop = tHit;
  vec2 bp = box(ro, inv, PERSON_FROM, PERSON_TO);
  if (bp.x < min(bp.y, tHit)) {
    float t = marchPerson(ro, rd, bp.x, min(bp.y, tHit));
    if (t > 0.0) {
      vec3 p = ro + rd * t;
      bool seat = chair(p) < figure(p);
      tHit = t;
      id = seat ? 4 : 5;
      if (seat) tStop = t;
    }
  }

  vec3 light = vec3(0.0);
  if (id >= 0) {
    vec3 p = ro + rd * tHit;
    vec3 n = id == 0 ? vec3(0.0, 1.0, 0.0) : id == 1 ? vec3(0.0, 0.0, 1.0) : id == 2 ? vec3(1.0, 0.0, 0.0) : normalOf(p, id);
    light = surface(p, n, rd, tHit, id);
  } else {
    tHit = 1e9;
  }

  // The inside, its ring and its sparks, moved as the pulls move it.
  float squash = 1.0 - SINK * u_noise.x;
  vec3 wobble = u_noise.z * 0.004 * vec3(sin(time * 31.0), sin(time * 27.0 + 1.0), sin(time * 23.0 + 2.0));
  vec3 away = DOUBLE * u_noise.w;
  for (int k = 0; k < 6; k++) {
    vec3 s = SPARK_AT[k];
    flare[k] = u_inner.w * trail(atan(s.z - HEART.z, s.x - HEART.x), 2.2);
  }
  if (u_inner.x > 0.001 && u_wave.w < 1.25) {
    light += inside(ro, rd, tStop, false, squash, wobble);
    if (u_noise.w > 0.001) light += inside(ro, rd, tHit, true, squash, wobble + away);
  }
  if (u_inner.y > 0.001) {
    vec3 c = vec3(HEART.x, HEART.y * squash, HEART.z) + wobble + away;
    for (int k = 0; k < int(INNER_POINTS); k++) {
      float a = float(k) / INNER_POINTS * TAU;
      float lit = 0.5 + 0.9 * u_inner.z * trail(a, 1.4);
      light += u_warm * 0.6 * u_inner.y * lit * glowAt(ro, rd, c + INNER_RING * vec3(cos(a), 0.0, sin(a)), 0.0, tStop);
    }
  }
  if (u_inner.w > 0.001) {
    for (int k = 0; k < 6; k++) {
      light += mix(u_warm, u_pale, 0.5) * flare[k] * 1.6 * glowAt(ro, rd, SPARK_AT[k], 0.011, tStop);
    }
  }
  // The orbit in the air at chest height.
  if (u_room.y > 0.001) {
    for (int k = 0; k < int(ORBIT_POINTS); k++) {
      float a = float(k) / ORBIT_POINTS * TAU;
      float lit = 0.35 + 0.9 * u_room.w * trail(a, 1.4);
      light += u_cold * 0.5 * u_room.y * lit * glowAt(ro, rd, HEART + ORBIT * vec3(cos(a), 0.0, sin(a)), 0.0, tHit);
    }
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
