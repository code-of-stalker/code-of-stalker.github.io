// The whole scene in one pass, straight onto the page: each pixel's ray
// meets the floor (the outer ring, its sweep and the world's signals, the
// orbit waves), the seated figure in its height lines, and the slice: the
// cut face with its growth rings and the inner ring, the slice's rim, the
// disturbances over the cut. Light is added onto the page in the theme's
// three colors. Rust puts the version line and lib.rs's constants
// (#define) in front of it.
precision highp float;
precision highp int;

#define TAU 6.28318531
#define PI 3.14159265

in vec2 v_uv;
out vec4 o;

uniform vec4 u_eye;    // camera position xyz, loop time
uniform vec4 u_right;  // camera axes
uniform vec4 u_up;
uniform vec4 u_fwd;
uniform vec4 u_view;   // lens scale x and y, canvas width and height in px
uniform vec4 u_scan;   // sweep angle (whole loop), slice height, rim light, outer ring light
uniform vec4 u_wave_r; // the orbit waves' radii
uniform vec4 u_wave_l; // and their light
uniform vec4 u_inner;  // inner ring light, clarity, open, signals
uniform vec4 u_noise;  // sinking, measuring, pushing about, images of the self
uniform vec4 u_misc;   // both rings flashing, how far the rings drained, -, -
uniform vec3 u_cold;
uniform vec3 u_warm;
uniform vec3 u_pale;
uniform vec3 u_backdrop; // the page
uniform vec4 u_edges;    // left, right, top, bottom
uniform vec4 u_out;      // soft edges, -, -, -

// A line's Gaussian width in px, and the tangent of one pixel.
float sigma;
float pixel;
// Where the ray meets a level plane at height y: eye.xz + (eye.y - y) * m,
// and how m moves from pixel to pixel.
vec2 m;
vec2 dmx;
vec2 dmy;

float sq(float x) {
  return x * x;
}
// A line `d` px away: a Gaussian core and a wide faint halo.
float line(float d) {
  float q = sq(d / sigma);
  return exp(-0.5 * q) + HALO * exp(-0.5 * q / (HALO_SPREAD * HALO_SPREAD));
}
// The same line seen through a blur `b` times its width: wider and dimmer.
float blurred(float d, float b) {
  float q = sq(d / (sigma * b));
  return (exp(-0.5 * q) + HALO * exp(-0.5 * q / (HALO_SPREAD * HALO_SPREAD))) / sqrt(b);
}
// Lines `spacing` px apart melt into their mean before they can alias.
float lines(float d, float spacing) {
  float mean = min(2.5066 * sigma * (1.0 + HALO * HALO_SPREAD) / max(spacing, 1e-3), 1.0);
  return mix(mean, line(d), smoothstep(3.0, 6.0, spacing));
}

uint mixBits(uint x) {
  x ^= x >> 16;
  x *= 0x7feb352du;
  x ^= x >> 15;
  x *= 0x846ca68bu;
  x ^= x >> 16;
  return x;
}
float hash(vec2 cell) {
  ivec2 c = ivec2(cell);
  return float(mixBits(uint(c.x) * 0x9e3779b9u ^ mixBits(uint(c.y) + 0x632be5abu)) >> 8) / 16777215.0;
}
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 s = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), s.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), s.x), s.y);
}

// A plane at height y: where the ray meets it.
vec2 onPlane(float y) {
  return u_eye.xz + (u_eye.y - y) * m;
}
// How many px a step `f` along the unit direction `g` on the plane at
// height y covers: the field's distance in px.
float px(float f, vec2 g, float y) {
  float k = max(u_eye.y - y, 1e-3);
  return f / max(k * length(vec2(dot(g, dmx), dot(g, dmy))), 1e-6);
}
// Lines `world` apart on the plane at height y, in px at the least.
float apart(float world, float y) {
  return world / max(max(u_eye.y - y, 1e-3) * max(length(dmx), length(dmy)), 1e-6);
}
vec2 unit(vec2 v, vec2 fallback) {
  float l = length(v);
  return l > 1e-6 ? v / l : fallback;
}

// ---- the figure, seated with crossed legs, facing +z
float sdEll(vec3 p, vec3 r) {
  float k0 = length(p / r);
  float k1 = length(p / (r * r));
  return k0 * (k0 - 1.0) / k1;
}
float sdCap(vec3 p, vec3 a, vec3 b, float r) {
  vec3 pa = p - a;
  vec3 ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h) - r;
}
// A cone from radius r1 at a to r2 at b, rounded at both ends.
float sdCone(vec3 p, vec3 a, vec3 b, float r1, float r2) {
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
// Pelvis, belly, ribs, shoulders: the trunk alone.
float trunk(vec3 p) {
  float d = sdEll(p - vec3(0.0, 0.13, 0.0), vec3(0.165, 0.1, 0.13));
  d = smin(d, sdEll(p - vec3(0.0, 0.3, 0.005), vec3(0.148, 0.16, 0.105)), 0.06);
  d = smin(d, sdEll(p - vec3(0.0, 0.465, 0.0), vec3(0.172, 0.15, 0.115)), 0.06);
  return smin(d, sdCap(p, vec3(-0.165, 0.585, -0.01), vec3(0.165, 0.585, -0.01), 0.06), 0.06);
}
float seat(vec3 p) {
  float d = trunk(p);
  for (int s = 0; s < 2; s++) {
    float sx = s == 0 ? -1.0 : 1.0;
    float lift = 0.02 * float(s);
    // Thigh out to the knee, the shin folded back close in front of the
    // pelvis, the foot tucked under the other shin: a full lap, no gap.
    d = smin(d, sdCone(p, vec3(0.1 * sx, 0.11, 0.0), vec3(0.33 * sx, 0.085, 0.16), 0.08, 0.056), 0.05);
    d = smin(d, sdCone(p, vec3(0.33 * sx, 0.075 + lift, 0.16), vec3(-0.1 * sx, 0.055 + lift, 0.22), 0.054, 0.038), 0.035);
    d = smin(d, sdCone(p, vec3(-0.1 * sx, 0.05 + lift, 0.22), vec3(-0.22 * sx, 0.04 + lift, 0.14), 0.036, 0.026), 0.025);
    // Upper arm, forearm, the hand resting on the knee.
    d = smin(d, sdCone(p, vec3(0.2 * sx, 0.57, -0.01), vec3(0.27 * sx, 0.36, 0.04), 0.048, 0.037), 0.03);
    d = smin(d, sdCone(p, vec3(0.27 * sx, 0.36, 0.04), vec3(0.3 * sx, 0.18, 0.135), 0.036, 0.027), 0.02);
    d = smin(d, sdEll(p - vec3(0.3 * sx, 0.155, 0.165), vec3(0.034, 0.022, 0.05)), 0.02);
  }
  // Calves and feet fill the lap between the shins and the pelvis.
  d = smin(d, sdEll(p - vec3(0.0, 0.065, 0.12), vec3(0.2, 0.05, 0.1)), 0.04);
  // Neck and head.
  d = smin(d, sdCone(p, vec3(0.0, 0.6, -0.005), vec3(0.0, 0.73, 0.0), 0.05, 0.042), 0.04);
  return smin(d, sdEll(p - vec3(0.0, 0.852, 0.012), vec3(0.094, 0.12, 0.108)), 0.035);
}
vec3 normal(vec3 p) {
  const vec2 k = vec2(1.0, -1.0);
  const float e = 0.0008;
  return normalize(k.xyy * seat(p + k.xyy * e) + k.yyx * seat(p + k.yyx * e)
                 + k.yxy * seat(p + k.yxy * e) + k.xxx * seat(p + k.xxx * e));
}

// ---- the floor: the outer ring, its sweep, the world's signals, the waves
vec3 ground(vec2 q) {
  float r = length(q);
  vec2 rad = unit(q, vec2(1.0, 0.0));
  vec2 tang = vec2(-rad.y, rad.x);
  float a = atan(q.y, q.x);
  float outer = u_scan.w;
  vec3 c = vec3(0.0);

  // A grid of faint points, gone toward the horizon.
  vec2 off = (fract(q / 0.1 + 0.5) - 0.5) * 0.1;
  float od = length(off);
  float grid = smoothstep(4.0, 9.0, apart(0.1, 0.0)) * smoothstep(1.75, 0.95, r);
  c += u_cold * 0.1 * grid * line(px(od, unit(off, rad), 0.0));
  // Two faint circles inside the ring.
  c += u_cold * 0.09 * (line(px(r - 0.35, rad, 0.0)) + line(px(r - 0.7, rad, 0.0)));

  // The ring and its ticks.
  c += u_cold * outer * (line(px(r - RING, rad, 0.0)) + 0.15 * exp(-sq((r - RING) / 0.03)));
  float f = a / TAU * TICKS;
  float along = (fract(f + 0.5) - 0.5) * TAU / TICKS * r;
  float mid = 0.5 * (TICK_IN + TICK_OUT);
  float across = max(abs(r - mid) - 0.5 * (TICK_OUT - TICK_IN), 0.0);
  float tick = length(vec2(px(along, tang, 0.0), px(across, rad, 0.0)));
  c += u_cold * 0.55 * outer * lines(tick, apart(TAU * r / TICKS, 0.0));

  // The sweep, the light it leaves behind, the signals it wakes.
  float turn = floor(u_scan.x / TAU);
  float sweep = u_scan.x - turn * TAU;
  vec2 dir = vec2(cos(sweep), sin(sweep));
  float da = mod(sweep - a, TAU);
  c += u_cold * 0.16 * exp(-da * 2.6) * smoothstep(RING + 0.01, RING - 0.04, r) * smoothstep(0.05, 0.3, r);
  float ahead = dot(q, dir);
  float side = dot(q, vec2(-dir.y, dir.x));
  float sd = ahead > 0.0 && ahead < RING ? abs(side) : length(q - dir * clamp(ahead, 0.0, RING));
  c += u_cold * 0.75 * line(px(sd, vec2(-dir.y, dir.x), 0.0)) * smoothstep(0.03, 0.12, r);

  float omega = TAU * SWEEP_TURNS / LOOP_SECONDS;
  for (int s = 0; s < 2; s++) {
    float n = mod(turn - float(s) + SWEEP_TURNS, SWEEP_TURNS);
    for (int k = 0; k < BLIPS; k++) {
      float b = TAU * hash(vec2(n, float(k) * 7.0 + 1.0));
      float age = (sweep - b + float(s) * TAU) / omega;
      if (age < 0.0 || age * omega > TAU) continue;
      float rb = mix(BLIP_IN, BLIP_OUT, hash(vec2(n, float(k) * 7.0 + 3.0)));
      vec2 dq = q - rb * vec2(cos(b), sin(b));
      float dl = length(dq);
      vec2 g = unit(dq, rad);
      float fade = smoothstep(0.0, 0.08, age) * exp(-3.0 * age / BLIP_SECONDS);
      c += u_pale * 0.95 * fade * line(px(dl, g, 0.0) / 1.7);
      float ring = 0.012 + 0.05 * (1.0 - exp(-age * 1.2));
      c += u_cold * 0.3 * fade * line(px(dl - ring, g, 0.0));
    }
  }

  // The orbit waves: a front with a faint wake inside it.
  for (int i = 0; i < 3; i++) {
    float l = u_wave_l[i];
    if (l <= 0.0) continue;
    float w = u_wave_r[i];
    vec3 tone = mix(u_cold, u_pale, 0.35);
    c += tone * l * (line(px(r - w, rad, 0.0)) + 0.25 * exp(-sq((r - w) / 0.04)));
    c += tone * 0.07 * l * exp(-max(w - r, 0.0) / 0.08) * step(r, w);
  }

  // The figure sits on the floor: the light dims under it.
  if (r < 0.75) c *= mix(0.3, 1.0, smoothstep(0.0, 0.12, seat(vec3(q.x, 0.03, q.y))));
  return c;
}

// ---- the body below the slice, in its height lines
vec3 body(vec3 p, vec3 n, vec3 rd, float t, float cut) {
  const vec3 lamp = vec3(-0.39, 0.88, 0.29);
  float lam = 0.35 + 0.65 * max(dot(n, lamp), 0.0);
  float ao = 0.5 + 0.5 * clamp((seat(p + n * 0.025) + seat(p + n * 0.07)) / 0.095, 0.0, 1.0);
  // Height lines of one width in px wherever they run.
  vec3 e = vec3(0.0, 1.0, 0.0) - n * n.y;
  float el = length(e);
  vec3 eh = el > 1e-4 ? e / el : vec3(0.0);
  float proj = sqrt(max(1.0 - sq(dot(eh, rd)), 0.0));
  float scale = proj / max(el * pixel * t, 1e-7);
  float k = abs(fract(p.y / ISOLINE + 0.5) - 0.5) * ISOLINE;
  float iso = lines(k * scale, ISOLINE * scale);
  float rim = pow(1.0 - abs(dot(n, rd)), 3.0);
  vec3 c = u_cold * (0.045 * lam * ao + 0.6 * iso * lam * mix(0.55, 1.0, ao)) + u_pale * 0.12 * rim;
  return c * mix(1.0, 0.75, cut);
}

// ---- the cut face at the slice, and the inner ring on it
vec3 cutFace(vec2 p, float s, vec2 g, float h) {
  float r = length(p);
  vec2 rad = unit(p, vec2(1.0, 0.0));
  float a = atan(p.y, p.x);
  float time = u_eye.w;
  float inner = u_inner.x;
  float clarity = u_inner.y;
  float open = u_inner.z;
  float sink = u_noise.x;
  float fixing = u_noise.z;
  float flash = u_misc.x;

  // The face and its growth rings; while it sinks they drain inward and
  // a dark hole opens in the middle.
  float hole = 1.0 - 0.85 * sink * exp(-sq(r / 0.05));
  vec3 c = u_warm * 0.06 * hole;
  float rings = -s / CONTOUR - u_misc.y;
  float dc = (fract(rings + 0.5) - 0.5) * CONTOUR;
  c += u_warm * 0.16 * hole * lines(px(dc, g, h), apart(CONTOUR, h));

  if (inner <= 0.0) return c;
  // The inner ring: shrunk while it sinks, pushed out of round while one
  // tries to fix it, murky until it is clear.
  float hop = time / 0.4;
  float e = smoothstep(0.0, 0.45, fract(hop));
  float n = floor(hop);
  float p1 = TAU * mix(hash(vec2(n, 11.0)), hash(vec2(n + 1.0, 11.0)), e);
  float p2 = TAU * mix(hash(vec2(n, 12.0)), hash(vec2(n + 1.0, 12.0)), e);
  float base = INNER * (1.0 - 0.3 * sink);
  float R = base * (1.0 + fixing * (0.2 * sin(3.0 * a + p1) + 0.12 * sin(5.0 * a + p2)));
  float dR = base * fixing * (0.6 * cos(3.0 * a + p1) + 0.6 * cos(5.0 * a + p2));
  float dr = (r - R) / sqrt(1.0 + sq(dR / max(r, 1e-3)));
  float blur = mix(4.5, 1.0, clarity) + 1.5 * sink;
  float murk = 1.0 - (1.0 - clarity) * 0.65 * noise(vec2(a * 4.0 + 20.0, time * 2.3));
  float light = inner * (mix(0.45, 1.15, clarity) * murk + 0.8 * flash);
  float d = px(dr, rad, h);
  c += u_warm * light * (1.2 * blurred(d, blur) + 0.28 * exp(-sq(dr / (0.02 * blur))));
  // Pale beads on it, once it is clear enough to hold them.
  float step24 = TAU / 24.0;
  float ab = (floor(a / step24) + 0.5) * step24;
  vec2 bead = p - R * vec2(cos(ab), sin(ab));
  c += u_pale * 0.5 * inner * sq(clarity) * line(px(length(bead), unit(bead, rad), h) / 1.2);

  // Open: ticks of its own and a sweep turning with the outer one.
  if (open > 0.0) {
    float f = a / TAU * INNER_TICKS;
    float along = (fract(f + 0.5) - 0.5) * TAU / INNER_TICKS * r;
    float lo = INNER * 1.1;
    float hi = INNER * 1.225;
    float across = max(abs(r - 0.5 * (lo + hi)) - 0.5 * (hi - lo), 0.0);
    float tick = length(vec2(px(along, vec2(-rad.y, rad.x), h), px(across, rad, h)));
    c += u_warm * 0.7 * open * lines(tick, apart(TAU * r / INNER_TICKS, h));
    float sweep = mod(u_scan.x, TAU);
    vec2 dir = vec2(cos(sweep), sin(sweep));
    float da = mod(sweep - a, TAU);
    c += u_warm * 0.2 * open * exp(-da * 2.6) * smoothstep(R + 0.004, R - 0.004, r);
    float ahead = dot(p, dir);
    float side = abs(dot(p, vec2(-dir.y, dir.x)));
    float sd = ahead > 0.0 && ahead < R ? side : length(p - dir * clamp(ahead, 0.0, R));
    c += u_warm * 0.8 * open * line(px(sd, vec2(-dir.y, dir.x), h));

    // Signals of its own, woken as its sweep passes.
    float signals = u_inner.w;
    if (signals > 0.0) {
      float turn = floor(u_scan.x / TAU);
      float omega = TAU * SWEEP_TURNS / LOOP_SECONDS;
      for (int s2 = 0; s2 < 2; s2++) {
        float tn = mod(turn - float(s2) + SWEEP_TURNS, SWEEP_TURNS);
        for (int k = 0; k < INNER_SIGNALS; k++) {
          float b = TAU * hash(vec2(tn, float(k) * 5.0 + 41.0));
          float age = (sweep - b + float(s2) * TAU) / omega;
          if (age < 0.0 || age * omega > TAU) continue;
          float rb = INNER * mix(0.4, 0.82, hash(vec2(tn, float(k) * 5.0 + 43.0)));
          vec2 dq = p - rb * vec2(cos(b), sin(b));
          float dl = length(dq);
          float fade = signals * smoothstep(0.0, 0.08, age) * exp(-3.0 * age / 2.5);
          c += mix(u_warm, u_pale, 0.5) * 1.1 * fade * line(px(dl, unit(dq, rad), h) / 1.5);
          c += u_warm * 0.35 * fade * line(px(dl - (0.004 + 0.012 * (1.0 - exp(-age * 1.2))), unit(dq, rad), h));
        }
      }
    }
  }
  return c;
}

// ---- over the cut: the measuring that comes with analysis
vec3 measuring(vec2 p, float h) {
  float an = u_noise.y;
  if (an <= 0.0) return vec3(0.0);
  float r = length(p);
  vec2 rad = unit(p, vec2(1.0, 0.0));
  float a = atan(p.y, p.x);
  float time = u_eye.w;
  vec3 tone = mix(u_pale, u_cold, 0.5);
  float c = 0.0;
  // A cross through the middle with ticks along it.
  float reach = smoothstep(0.3, 0.24, r);
  c += 0.45 * reach * (line(px(abs(p.x), vec2(1.0, 0.0), h)) + line(px(abs(p.y), vec2(0.0, 1.0), h)));
  for (int axis = 0; axis < 2; axis++) {
    vec2 q = axis == 0 ? p : p.yx;
    float along = (fract(q.y / 0.02 + 0.5) - 0.5) * 0.02;
    float across = max(abs(q.x) - 0.006, 0.0);
    vec2 ga = axis == 0 ? vec2(0.0, 1.0) : vec2(1.0, 0.0);
    vec2 gc = axis == 0 ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    c += 0.4 * reach * line(length(vec2(px(along, ga, h), px(across, gc, h))));
  }
  // A dashed circle.
  float dash = smoothstep(0.35, 0.45, abs(fract(a / TAU * 48.0) - 0.5));
  c += 0.4 * dash * line(px(r - 0.12, rad, h));
  // An arm that swings to a new angle, stops, measures, swings on.
  float hop = time / 0.9;
  float e = smoothstep(0.0, 0.35, fract(hop));
  float n = floor(hop);
  float arm = TAU * mix(hash(vec2(n, 21.0)), hash(vec2(n + 1.0, 21.0)), e);
  vec2 dir = vec2(cos(arm), sin(arm));
  float ahead = dot(p, dir);
  float sd = ahead > 0.0 && ahead < 0.16 ? abs(dot(p, vec2(-dir.y, dir.x))) : length(p - dir * clamp(ahead, 0.0, 0.16));
  c += 0.6 * line(px(sd, vec2(-dir.y, dir.x), h));
  vec2 tip = p - dir * 0.16;
  c += 0.5 * line(px(length(tip) - 0.008, unit(tip, rad), h));
  return tone * an * c;
}

// ---- above the cut: images of the self lifting off it
vec3 images(float h) {
  float im = u_noise.w;
  if (im <= 0.0) return vec3(0.0);
  vec3 c = vec3(0.0);
  for (int k = 0; k < 3; k++) {
    float f = fract(u_eye.w / 3.0 + float(k) / 3.0);
    float y = h + 0.03 + 0.25 * f;
    float scale = 1.0 + 0.35 * f;
    vec2 drift = vec2(sin(float(k) * 2.1 + 1.0) * 0.07, cos(float(k) * 1.7) * 0.05) * f;
    vec2 local = (onPlane(y) - drift) / scale;
    if (length(local) > 0.3) continue;
    // The trunk's section only, its edge measured along its own gradient.
    vec3 at = vec3(local.x, h, local.y);
    float s0 = trunk(at);
    const float e = 0.0015;
    vec2 grad = vec2(trunk(at + vec3(e, 0.0, 0.0)) - s0, trunk(at + vec3(0.0, 0.0, e)) - s0);
    vec2 g = unit(grad, unit(local, vec2(1.0, 0.0)));
    float s = s0 / clamp(length(grad) / e, 0.4, 1.0) * scale;
    float light = im * sq(sin(PI * f));
    c += mix(u_warm, u_pale, 0.5) * 0.55 * light * line(px(s, g, y));
    c += u_warm * 0.35 * light * line(px((length(local) - INNER) * scale, g, y));
  }
  return c;
}

void main() {
  vec2 frag = gl_FragCoord.xy;
  sigma = LINE_WIDTH * u_view.w;
  pixel = 2.0 / (u_view.y * u_view.w);
  vec2 lens = (frag / u_view.zw * 2.0 - 1.0) / u_view.xy;
  vec3 d = normalize(u_fwd.xyz + u_right.xyz * lens.x + u_up.xyz * lens.y);
  vec3 eye = u_eye.xyz;
  float down = max(-d.y, 1e-3);
  m = d.xz / down;
  dmx = dFdx(m);
  dmy = dFdy(m);

  float h = u_scan.y;
  float cut = 1.0 - smoothstep(CHEST + 0.02, CROWN, h);
  vec3 light = d.y < 0.0 ? ground(onPlane(0.0)) : vec3(0.0);

  // Where the ray crosses the slice; above it nothing is left.
  float tc = (eye.y - h) / down;
  vec2 pc = onPlane(h);
  float s = 1.0;
  vec2 g = unit(pc, vec2(1.0, 0.0));
  if (d.y < 0.0 && length(pc) < 0.62) {
    s = seat(vec3(pc.x, h, pc.y));
    const float e = 0.0015;
    vec2 grad = vec2(seat(vec3(pc.x + e, h, pc.y)) - s, seat(vec3(pc.x, h, pc.y + e)) - s);
    g = unit(grad, g);
    // Where two sections nearly touch the field flattens: measure along
    // its real slope so the edge does not swell into a star there.
    s /= clamp(length(grad) / e, 0.4, 1.0);
  }

  // The body below the slice: march inside a sphere round the figure; a
  // near miss lights the silhouette's edge by how close it came.
  vec3 oc = eye - BOUND.xyz;
  float b = dot(oc, d);
  float disc = b * b - dot(oc, oc) + BOUND.w * BOUND.w;
  if (disc > 0.0) {
    float root = sqrt(disc);
    float t = max(max(-b - root, 0.0), tc);
    float far = -b + root;
    float best = 1e9;
    float bestT = t;
    bool hit = false;
    for (int i = 0; i < 96; i++) {
      if (t > far) break;
      vec3 p = eye + d * t;
      float sd = max(seat(p), p.y - h);
      float ratio = sd / (pixel * t);
      if (ratio < best) {
        best = ratio;
        bestT = t;
      }
      if (sd < 0.0004 * t) {
        hit = true;
        break;
      }
      t += sd * 0.9;
    }
    float cover = hit ? 1.0 : 1.0 - smoothstep(0.0, 1.0, best);
    if (cover > 0.0) {
      float at = hit ? t : bestT;
      vec3 p = eye + d * at;
      light = mix(light, body(p, normal(p), d, at, cut), cover);
    }
  }

  // The cut face over it, its edge as soft as a pixel.
  float face = 1.0 - smoothstep(-0.5, 0.5, px(s, g, h));
  if (face > 0.0) light = mix(light, cutFace(pc, s, g, h), face);
  if (s < 0.05) light += mix(u_cold, u_pale, 0.25) * (0.55 * line(px(s, g, h)) + 0.05 * exp(-sq(s / 0.012)));

  // The slice's own rim and a breath of glass while it moves.
  float rim = u_scan.z;
  if (rim > 0.0 && d.y < 0.0) {
    float rc = length(pc);
    light += u_pale * rim * (0.35 * line(px(rc - RIM, unit(pc, vec2(1.0, 0.0)), h)) + 0.025 * smoothstep(RIM, RIM - 0.03, rc));
  }
  if (d.y < 0.0) light += measuring(pc, h) + images(h);

  // A soft shoulder where light piles up, then onto the page.
  vec3 over = 0.7 + 0.3 * (1.0 - exp(-(light - 0.7) / 0.3));
  vec3 c = mix(light, over, step(0.7, light));
  if (u_out.x > 0.5) {
    c *= smoothstep(0.0, u_edges.x, v_uv.x) * smoothstep(0.0, u_edges.y, 1.0 - v_uv.x)
       * smoothstep(0.0, u_edges.z, 1.0 - v_uv.y) * smoothstep(0.0, u_edges.w, v_uv.y);
  }
  c = u_backdrop + c + (hash(frag * 1.37 + 0.5) - 0.5) / 255.0;
  o = vec4(clamp(c, 0.0, 1.0), 1.0);
}
