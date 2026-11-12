// «Всплытие» in one pass, straight onto the page. The lens sits half in the
// water: above the waterline each pixel's ray leaves the air eye, below it
// the water eye, through water that magnifies and wavers. The water's level
// L moves (lib.rs lowers it as she speaks, and after the last word drains it
// away), and the waterline on the lens with it; every test of "above or under
// the water" is against L. Rays meet the woman (a distance field: soft skin,
// her hair drawn up apart from it, brows, lips, her eyes open, her lips
// parting as she speaks), the surface of the water, which mirrors her and the
// words and shivers with waves, the
// strokes of the knots and words (segments placed by lib.rs every frame), the
// voice as a ray from her lips down to the knot, and under the water a slow
// fall of matrix code and light shafts. Light is added onto the page in the
// theme's cold, warm and pale. Rust puts the version line and lib.rs's
// constants (#define) in front of it.
precision highp float;
precision highp int;

#define TAU 6.28318531
#define MURK 0.55

in vec2 v_uv;
out vec4 o;

uniform vec4 u_eye;    // air eye xyz, loop time
uniform vec4 u_right;  // camera axes
uniform vec4 u_up;
uniform vec4 u_fwd;
uniform vec4 u_view;   // lens scale x and y, canvas width and height in px
uniform vec4 u_body;   // her feet xyz, how she is turned
uniform vec4 u_head;   // head yaw, pitch; how busy the sea is; -
uniform vec4 u_voice;  // her lips in the world, the voice's light
uniform vec4 u_water;  // the level, the waterline on the lens, how open her mouth is, -
uniform vec4 u_lamp;   // what lights her face, how strongly
uniform vec4 u_beam;   // the knot: x, z, height; the voice's light
uniform vec4 u_rings[RINGS];        // x, z, age, strength
uniform vec4 u_seg[SEGMENTS * 2];   // from xyz + light, to xyz + warmth
uniform vec4 u_words[WORDS];        // bounding sphere of each word
uniform vec3 u_cold;
uniform vec3 u_warm;
uniform vec3 u_pale;
uniform vec3 u_backdrop; // the page
uniform vec4 u_edges;    // left, right, top, bottom
uniform vec4 u_out;      // soft edges, -, -, -

const int STARTS[WORDS + 1] = WORD_STARTS;
const vec3 BOX_FROM = vec3(-0.27, 0.74, -0.2);
const vec3 BOX_TO = vec3(0.27, 1.68, 0.2);

float time;   // loop time
float pixel;  // the tangent of one pixel
float L;      // the water's level (world y)
float speak;  // how open her mouth is, 0..1
float wet;    // how far a water ray runs through the air before it enters the water
// A zero the compiler cannot see through (the loop time is never negative).
// Loops counted from it stay loops: unrolled, ANGLE's D3D11 compiler took two
// minutes over this shader and the page froze.
#define ZERO min(int(u_eye.w), 0)
float bc;     // how she is turned
float bs;
vec3 hr;      // her head's axes in her frame
vec3 hu;
vec3 hf;

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
// Light lost in the water over a ray's length t (only the part in the water).
float murk(float t) {
  return exp(-max(t - wet, 0.0) * MURK);
}

// ---------- shapes
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
float smax(float a, float b, float k) {
  return -smin(-a, -b, k);
}

// ---------- her
vec3 toLocal(vec3 p) {
  vec3 v = p - u_body.xyz;
  return vec3(v.x * bc - v.z * bs, v.y, v.x * bs + v.z * bc);
}
vec3 dirLocal(vec3 d) {
  return vec3(d.x * bc - d.z * bs, d.y, d.x * bs + d.z * bc);
}
// Her frame to her head's own upright frame.
vec3 headLocal(vec3 q) {
  vec3 v = q - NECK;
  return NECK + vec3(dot(v, hr), dot(v, hu), dot(v, hf));
}
float skull(vec3 h) {
  vec3 m = vec3(abs(h.x), h.y, h.z);
  float d = sdEll(h - vec3(0.0, 1.565, -0.02), vec3(0.069, 0.088, 0.092));
  // Hair drawn up into a knot high at the back.
  d = smin(d, sdEll(h - vec3(0.0, 1.612, -0.116), vec3(0.04, 0.038, 0.036)), 0.024);
  d = smin(d, sdEll(h - vec3(0.0, 1.505, 0.03), vec3(0.053, 0.078, 0.072)), 0.03);
  // As she speaks the jaw and the lower lip drop and the mouth opens.
  float drop = 0.0075 * speak;
  d = smin(d, sdEll(h - vec3(0.0, 1.447 - 0.8 * drop, 0.053 - 0.3 * drop), vec3(0.02, 0.02, 0.027)), 0.022);
  d = smin(d, sdCap(m, vec3(0.05, 1.474, -0.006), vec3(0.014, 1.436, 0.062), 0.008), 0.022);
  d = smin(d, sdEll(m - vec3(0.04, 1.515, 0.062), vec3(0.018, 0.012, 0.016)), 0.016);
  d = smin(d, sdCap(m, vec3(0.012, 1.556, 0.086), vec3(0.042, 1.557, 0.075), 0.0045), 0.018);
  // The almond opening of the lids over each eye.
  d = smax(d, -sdEll(m - vec3(0.031, 1.535, 0.09), vec3(0.0145, 0.0062, 0.012)), 0.003);
  d = smin(d, sdRC(h, vec3(0.0, 1.536, 0.094), vec3(0.0, 1.502, 0.106), 0.004, 0.0062), 0.008);
  d = smin(d, sdEll(m - vec3(0.0085, 1.4985, 0.097), vec3(0.0048, 0.004, 0.005)), 0.006);
  d = smin(d, sdEll(h - vec3(0.0, 1.474, 0.091), vec3(0.015, 0.0055, 0.008)), 0.006);
  d = smin(d, sdEll(h - vec3(0.0, 1.463 - drop, 0.087 - 0.25 * drop), vec3(0.014, 0.0062, 0.008)), 0.006);
  if (speak > 0.02) {
    d = smax(d, -sdEll(h - vec3(0.0, 1.4685 - 0.5 * drop, 0.1), vec3(0.0115, 0.0005 + 0.45 * drop, 0.014)), 0.002);
  }
  return smin(d, sdEll(m - vec3(0.068, 1.523, -0.02), vec3(0.006, 0.021, 0.012)), 0.012);
}
float eyeballs(vec3 h) {
  return length(vec3(abs(h.x), h.y, h.z) - vec3(0.031, EYES.y, EYES.z)) - 0.0122;
}
float torso(vec3 q) {
  vec3 m = vec3(abs(q.x), q.y, q.z);
  float d = sdCap(q, vec3(0.0, 1.35, -0.02), vec3(0.0, 1.47, -0.01), 0.034);
  d = smin(d, sdCap(m, vec3(0.03, 1.402, -0.03), vec3(0.158, 1.356, -0.03), 0.044), 0.05);
  d = smin(d, sdEll(q - vec3(0.0, 1.235, -0.005), vec3(0.148, 0.165, 0.09)), 0.05);
  d = smin(d, sdEll(m - vec3(0.06, 1.215, 0.055), vec3(0.058, 0.052, 0.048)), 0.035);
  d = smin(d, sdEll(q - vec3(0.0, 1.03, -0.002), vec3(0.118, 0.14, 0.082)), 0.06);
  d = smin(d, sdEll(q - vec3(0.0, 0.88, -0.008), vec3(0.158, 0.115, 0.098)), 0.06);
  d = smin(d, sdCap(m, vec3(0.014, 1.371, 0.045), vec3(0.135, 1.392, 0.0), 0.006), 0.022);
  float a = sdRC(m, vec3(0.172, 1.342, -0.03), vec3(0.203, 1.1, -0.035), 0.042, 0.032);
  a = smin(a, sdRC(m, vec3(0.205, 1.1, -0.035), vec3(0.205, 0.875, 0.03), 0.031, 0.024), 0.02);
  a = smin(a, sdEll(m - vec3(0.2, 0.815, 0.045), vec3(0.018, 0.052, 0.032)), 0.02);
  return smin(d, a, 0.03);
}
// Her distance at q, and how much nearer the eyeball is than the skull.
vec2 figure(vec3 q) {
  vec3 h = headLocal(q);
  float s = skull(h);
  float e = eyeballs(h);
  return vec2(smin(torso(q), min(s, e), 0.016), e - s);
}

vec3 safeInv(vec3 d) {
  vec3 s = vec3(greaterThanEqual(d, vec3(0.0))) * 2.0 - 1.0;
  return 1.0 / (s * max(abs(d), vec3(1e-6)));
}
vec2 box(vec3 ro, vec3 inv, vec3 lo, vec3 hi) {
  vec3 a = (lo - ro) * inv;
  vec3 b = (hi - ro) * inv;
  vec3 n = min(a, b);
  vec3 f = max(a, b);
  return vec2(max(max(n.x, n.y), max(n.z, 0.0)), min(min(f.x, f.y), f.z));
}
// The nearest point of her along the ray before tMax (-1 if none), and how
// near the ray passes her, for the rim of light round her outline. One walk:
// up to 110 steps to her surface, then four probes round the hit for its
// normal n (her frame), so her distance field is compiled in only once.
// eye: the eyeball, not the skull, is the surface hit.
float march(vec3 ro, vec3 rd, float tMax, out float closest, out float tClosest, out vec3 n, out bool eye) {
  vec3 lo = toLocal(ro);
  vec3 ld = dirLocal(rd);
  closest = 1e9;
  tClosest = 1.0;
  n = vec3(0.0, 1.0, 0.0);
  eye = false;
  vec2 b = box(lo, safeInv(ld), BOX_FROM, BOX_TO);
  if (b.x >= b.y) return -1.0;
  float t = b.x;
  float end = min(b.y, tMax);
  float hit = -1.0;
  vec3 sum = vec3(0.0);
  int probe = 0;
  for (int i = ZERO; i < 114; i++) {
    // The probes sit on a tetrahedron round the hit.
    int j = probe - 1;
    vec3 k = probe > 0 ? 2.0 * vec3(float(((j + 3) >> 1) & 1), float((j >> 1) & 1), float(j & 1)) - 1.0 : vec3(0.0);
    vec2 f = figure(lo + ld * t + 0.0005 * k);
    if (probe == 0) {
      if (f.x < closest) {
        closest = f.x;
        tClosest = t;
      }
      if (f.x < 0.0003 * (1.0 + t)) {
        hit = t;
        eye = f.y < 0.0002;
        probe = 1;
        continue;
      }
      t += f.x * 0.9;
      if (t > end || i >= 109) break;
    } else {
      sum += k * f.x;
      probe++;
      if (probe > 4) break;
    }
  }
  if (hit > 0.0) n = normalize(sum);
  return hit;
}

// ---------- the water
// The surface at xz: its height and slope (d/dx, d/dz), and how bright the
// ring crests are there. A light swell crosses it, every wave a whole number
// of times per loop; waves finer than the footprint fp of a pixel are left out.
vec3 waves(vec2 xz, float fp, out float crest) {
  float ph = TAU * time / LOOP_SECONDS;
  vec3 h = vec3(0.0);
  for (int k = ZERO; k < 5; k++) {
    float fk = float(k);
    float a = fk * 2.39996 + 0.4;
    vec2 dir = vec2(cos(a), sin(a));
    float freq = 7.0 * pow(1.65, fk);
    float amp = 0.026 / freq * (1.0 - smoothstep(0.25, 0.6, fp * freq));
    float w = dot(xz, dir) * freq + ph * float(2 + 3 * k) + fk * 1.7;
    h += amp * vec3(sin(w), freq * cos(w) * dir);
  }
  crest = 0.0;
  float keep = 1.0 - smoothstep(0.25, 0.6, fp * 90.0);
  for (int k = ZERO; k < RINGS; k++) {
    vec4 r = u_rings[k];
    if (r.w < 0.001) continue;
    vec2 v = xz - r.xy;
    float d = length(v);
    float x = d - r.z * RING_SPEED;
    float env = exp(-x * x / 0.006) * r.w * exp(-r.z * 0.3) / (1.0 + d * 3.0);
    h.x += 0.006 * env * sin(x * 90.0);
    h.yz += 0.54 * env * keep * cos(x * 90.0) * v / max(d, 1e-4);
    crest += env * pow(max(0.5 + 0.5 * sin(x * 90.0 + 1.2), 0.0), 6.0);
  }
  return h;
}
// Where the waterline crosses the lens at x, bobbing as the waves pass.
float splitAt(float x) {
  float crest;
  float h = waves(vec2(u_eye.x + x * 0.4, u_eye.z - 0.4), 0.0, crest).x;
  return u_water.y + h * 1.2 + 0.0024 * sin(x * 7.0 + TAU * 9.0 * time / LOOP_SECONDS) + 0.0011 * sin(x * 19.0 - TAU * 14.0 * time / LOOP_SECONDS);
}
// The night over the water: a faint glow low on the horizon.
vec3 sky(vec3 d) {
  return u_cold * 0.055 * exp(-max(d.y, 0.0) * 14.0);
}

// ---------- strokes of light
// Closest approach of the ray to segment a-b: distance, ray t, segment s.
vec3 raySeg(vec3 ro, vec3 rd, vec3 a, vec3 b) {
  vec3 ba = b - a;
  vec3 w0 = ro - a;
  float c = max(dot(ba, ba), 1e-10);
  float bb = dot(rd, ba);
  float d = dot(rd, w0);
  float e = dot(ba, w0);
  float den = c - bb * bb;
  float s = den > 1e-10 ? clamp((e - bb * d) / den, 0.0, 1.0) : 0.0;
  float t = bb * s - d;
  s = clamp((e + bb * t) / c, 0.0, 1.0);
  t = max(bb * s - d, 0.0);
  return vec3(length(w0 + rd * t - ba * s), t, s);
}
// The knots and the words. Each half sees only its own side of the water;
// under it they blur and fade in the murk; mirrored they spread by blur.
vec3 strokes(vec3 ro, vec3 rd, float tMax, bool under, float blur) {
  vec3 c = vec3(0.0);
  for (int w = ZERO; w < WORDS; w++) {
    vec4 b = u_words[w];
    if (b.w <= 0.0) continue;
    // The sphere grown by the reach of the glow, so the glow is never cut.
    b.w += under ? 0.08 : 0.03;
    vec3 oc = b.xyz - ro;
    float tc = dot(oc, rd);
    if (tc < -b.w || dot(oc, oc) - tc * tc > b.w * b.w) continue;
    for (int i = STARTS[w]; i < STARTS[w + 1]; i++) {
      vec4 a = u_seg[2 * i];
      vec4 e = u_seg[2 * i + 1];
      if (a.w < 0.002) continue;
      vec3 r = raySeg(ro, rd, a.xyz, e.xyz);
      if (r.y <= 0.0 || r.y > tMax) continue;
      float y = mix(a.y, e.y, r.z);
      if (under ? y > L : y < L) continue;
      float core = max(0.0011, pixel * r.y * 0.75);
      float width = core + (under ? 0.0012 + 0.0018 * r.y : 0.0) + blur * r.y;
      float glow = core / width * exp(-sq(r.x / width)) + (under ? 0.05 : 0.12) * exp(-r.x / (width * 4.0 + 0.003));
      float fade = under ? 2.6 * murk(r.y) : 1.0;
      c += mix(u_pale, u_warm, e.w) * a.w * glow * fade;
    }
    if (under) {
      // The heart of the knot while it rises.
      float lit = u_seg[2 * STARTS[w]].w * smoothstep(L + 0.02, L - 0.03, b.y);
      float th = max(tc, 0.0);
      float d = length(oc - rd * th);
      c += u_warm * lit * (0.5 * exp(-sq(d / 0.022)) + 0.12 * exp(-d / 0.05)) * murk(th) * step(th, tMax);
    }
  }
  return c;
}
// The voice: a warm point at her lips.
vec3 lips(vec3 ro, vec3 rd, float tMax, float size) {
  vec3 v = u_voice.xyz - ro;
  float t = dot(v, rd);
  if (t <= 0.0 || t > tMax + 0.02) return vec3(0.0);
  float d = length(v - rd * t);
  float s = max(pixel * t * 1.3, 0.0022) * size;
  return u_warm * u_voice.w * (0.9 * exp(-sq(d / s)) + 0.3 * exp(-d / (s * 5.0)));
}
// The voice: a ray from her lips down to the knot, with light running down
// it. It grows out of her mouth as she starts to speak. Each half of the
// lens draws only its own side of the water.
vec3 beam(vec3 ro, vec3 rd, float tMax, bool under) {
  if (u_beam.w < 0.001) return vec3(0.0);
  vec3 a = u_voice.xyz;
  vec3 b = vec3(u_beam.x, u_beam.z, u_beam.y);
  vec3 r = raySeg(ro, rd, a, b);
  if (r.y <= 0.0 || r.y > tMax + 0.01) return vec3(0.0);
  float y = mix(a.y, b.y, r.z);
  float side = under ? smoothstep(L + 0.004, L - 0.004, y) : smoothstep(L - 0.004, L + 0.004, y);
  float reach = 1.0 - smoothstep(u_beam.w * 1.1 - 0.1, u_beam.w * 1.1, r.z);
  if (side * reach <= 0.0) return vec3(0.0);
  float width = max(0.0009, pixel * r.y * 0.8) + (under ? 0.0015 + 0.003 * r.y : 0.0);
  // Pulses run from her lips down to the knot, a whole number per loop.
  float run = pow(0.5 + 0.5 * sin(TAU * (r.z * 3.0 - 110.0 * time / LOOP_SECONDS)), 3.0);
  float glow = 0.55 * exp(-sq(r.x / width)) + 0.1 * exp(-r.x / (width * 6.0));
  return u_warm * u_beam.w * side * reach * glow * (0.4 + 0.6 * run) * (under ? murk(r.y) * 1.4 : 1.0);
}

// ---------- her light
// An open eye looking at `target` (head frame): a dim white, a ring of iris
// lit cold, a dark pupil, and the glints of the sky and the word.
vec3 eye(vec3 h, vec3 n, vec3 rd, vec3 lamp, vec3 target) {
  vec3 centre = vec3(sign(h.x) * 0.031, EYES.y, EYES.z);
  vec3 aim = normalize(normalize(target - centre) + vec3(0.0, 0.0, 0.4));
  float k = dot(normalize(h - centre), aim);
  float iris = smoothstep(0.85, 0.87, k);
  float pupil = smoothstep(0.962, 0.972, k);
  vec3 c = mix(mix(u_cold, u_pale, 0.5) * 0.14, u_cold * 0.07, iris) * (1.0 - pupil);
  vec3 rf = reflect(rd, n);
  c += u_pale * pow(max(dot(rf, normalize(vec3(-0.4, 0.7, 0.6))), 0.0), 300.0) * 1.4;
  c += mix(u_pale, u_warm, 0.3) * pow(max(dot(rf, lamp), 0.0), 160.0) * u_lamp.w * 1.2;
  return c;
}
// Her skin in soft light; her hair, drawn up into the knot, darker, with a
// sheen along its strands; her brows; her lips. Lit by the word she looks at,
// by her own voice and the sky; a cold rim; a line where she meets the water.
vec3 shade(vec3 p, vec3 rd, float t, bool under, vec3 n, bool isEye) {
  vec3 q = toLocal(p);
  vec3 rl = dirLocal(rd);
  vec3 lq = toLocal(u_lamp.xyz);
  vec3 lamp = normalize(lq - q);
  vec3 h = headLocal(q);
  vec3 nh = vec3(dot(n, hr), dot(n, hu), dot(n, hf));
  vec3 rh = vec3(dot(rl, hr), dot(rl, hu), dot(rl, hf));
  vec3 lh = vec3(dot(lamp, hr), dot(lamp, hu), dot(lamp, hf));
  vec3 c;
  if (isEye) {
    c = eye(h, nh, rh, lh, headLocal(lq));
  } else {
    float facing = max(dot(n, -rl), 0.0);
    float rim = pow(1.0 - facing, 3.0);
    float wrap = max(dot(n, lamp) * 0.75 + 0.25, 0.0);
    float key = wrap * wrap * u_lamp.w / (1.0 + 0.6 * dot(lq - q, lq - q));
    float sky = 0.5 + 0.5 * dot(n, normalize(vec3(-0.3, 0.8, 0.5)));
    // The voice lights her lips, chin and cheek from the mouth.
    vec3 toLips = toLocal(u_voice.xyz) - q;
    float voice = u_voice.w * exp(-length(toLips) / 0.035) * (0.4 + 0.6 * max(dot(n, normalize(toLips + vec3(0.0, 0.0, 0.03))), 0.0));
    float gloss = pow(max(dot(reflect(rl, n), lamp), 0.0), 18.0) * u_lamp.w;
    vec3 skin = mix(u_cold, u_pale, 0.5) * (0.012 + 0.045 * sky)
      + mix(u_pale, u_warm, 0.3) * 0.55 * key
      + u_pale * 0.07 * gloss
      + u_cold * 0.32 * rim;
    // Her head's parts, in its own frame: the hair above a hairline that is
    // high on the forehead and low at the nape.
    vec3 m = vec3(abs(h.x), h.y, h.z);
    vec3 v = h - vec3(0.0, 1.565, -0.02);
    float hairline = -0.062 + 0.1 * smoothstep(-0.07, 0.085, v.z);
    float hair = smoothstep(-0.003, 0.003, v.y - hairline);
    // Strands run to the knot: a sheen across them, fine lines along them
    // where a pixel can hold them.
    vec3 knot = vec3(0.0, 1.612, -0.116);
    vec3 toKnot = knot - h;
    vec3 tang = normalize(toKnot - nh * dot(toKnot, nh) + vec3(0.0, 1e-4, 0.0));
    float th = dot(tang, normalize(lh - rh));
    float sheen = pow(max(1.0 - th * th, 0.0), 24.0);
    vec3 ax = normalize(knot - vec3(0.0, 1.565, -0.02));
    vec3 e1 = normalize(cross(ax, vec3(1.0, 0.0, 0.0)));
    vec3 e2 = cross(ax, e1);
    vec3 wk = h - knot;
    float spacing = length(wk - ax * dot(wk, ax)) * TAU / 120.0;
    float fine = 1.0 - smoothstep(0.5, 1.2, pixel * t / max(spacing, 1e-5));
    float strand = 1.0 - 0.4 * fine * (0.5 + 0.5 * sin(atan(dot(wk, e1), dot(wk, e2)) * 120.0));
    vec3 locks = u_cold * (0.008 + 0.025 * sky)
      + mix(u_cold, u_pale, 0.35) * sheen * strand * (0.07 + 0.3 * key)
      + u_cold * 0.2 * rim;
    // Brows: two dark arcs over the eyes.
    float bd = sdCap(vec3(m.xy, 0.0), vec3(0.012, 1.5578, 0.0), vec3(0.043, 1.5598, 0.0), 0.0);
    float brow = (1.0 - smoothstep(0.0016 + 0.001 * smoothstep(0.04, 0.012, m.x), 0.003, bd)) * smoothstep(0.055, 0.07, h.z);
    // Lips, a little warmer; they part as she speaks.
    float drop = 0.0075 * speak;
    float lip = 1.0 - smoothstep(0.8, 1.2, length((h - vec3(0.0, 1.468 - 0.5 * drop, 0.098)) / vec3(0.016, 0.0085 + drop, 0.03)));
    c = mix(skin, locks, hair);
    c = mix(c, u_cold * (0.012 + 0.08 * rim), brow * (1.0 - hair) * 0.85);
    c = mix(c, mix(c, u_warm * (0.05 + 0.32 * key), 0.45), lip * (1.0 - hair));
    c += u_warm * voice * 0.7;
  }
  // Where she meets the water.
  float crest;
  float level = L + waves(p.xz, 0.0, crest).x;
  c += mix(u_cold, u_pale, 0.6) * 0.55 * exp(-abs(p.y - level) / 0.0025);
  if (under) {
    c *= murk(t) * (0.75 + 0.25 * exp(min(p.y - L, 0.0) * 5.0));
    c = mix(c, u_cold * dot(c, vec3(0.3, 0.5, 0.2)), 0.35);
  }
  return c;
}
// A glow along her outline where a ray just misses her.
vec3 outline(float closest, float t, bool under) {
  if (closest > 0.03) return vec3(0.0);
  float px = max(closest, 0.0) / (pixel * t);
  return u_cold * (under ? 0.25 * murk(t) : 0.45) * exp(-px * px / (under ? 6.0 : 0.8));
}

// ---------- under the water
// Matrix code: mirrored katakana-like marks and two digits, as strokes in a
// cell -0.5..0.5 (y up); unused strokes sit far away.
const int GLYPHS = 14;
const vec4 NONE = vec4(9.0, 9.0, 9.0, 9.0);
const vec4 STROKES[GLYPHS * 4] = vec4[](
  vec4(-0.28, 0.42, 0.28, 0.42), vec4(0.28, 0.42, 0.06, 0.1), vec4(0.0, 0.2, -0.12, -0.48), NONE,
  vec4(0.0, 0.5, 0.0, 0.32), vec4(-0.26, 0.3, 0.26, 0.3), vec4(0.26, 0.3, 0.18, -0.08), vec4(0.18, -0.08, -0.2, -0.48),
  vec4(-0.24, 0.4, 0.24, 0.4), vec4(0.0, 0.4, 0.0, -0.4), vec4(-0.3, -0.4, 0.3, -0.4), NONE,
  vec4(-0.28, 0.25, 0.25, 0.25), vec4(0.25, 0.25, 0.18, -0.48), vec4(-0.02, 0.5, -0.25, -0.45), NONE,
  vec4(-0.28, 0.25, 0.28, 0.3), vec4(-0.3, -0.02, 0.3, 0.04), vec4(-0.05, 0.5, 0.08, -0.5), NONE,
  vec4(-0.15, 0.5, -0.3, 0.15), vec4(-0.22, 0.28, 0.3, 0.28), vec4(0.1, 0.28, -0.1, -0.5), NONE,
  vec4(-0.25, 0.38, -0.1, 0.3), vec4(-0.28, 0.08, -0.12, 0.0), vec4(-0.25, -0.45, 0.28, 0.25), NONE,
  vec4(-0.25, 0.35, -0.15, 0.15), vec4(0.0, 0.38, 0.08, 0.18), vec4(0.3, 0.38, -0.1, -0.5), NONE,
  vec4(-0.2, 0.25, 0.2, 0.25), vec4(-0.3, -0.3, 0.3, -0.3), NONE, NONE,
  vec4(-0.3, -0.1, -0.1, 0.25), vec4(-0.1, 0.25, 0.3, -0.3), NONE, NONE,
  vec4(-0.2, 0.38, 0.2, 0.25), vec4(-0.2, 0.05, 0.2, -0.05), vec4(-0.25, -0.3, 0.25, -0.45), NONE,
  vec4(-0.05, 0.5, -0.28, 0.1), vec4(-0.12, 0.35, 0.28, 0.35), vec4(0.28, 0.35, -0.15, -0.5), NONE,
  vec4(-0.2, 0.42, 0.2, 0.42), vec4(0.2, 0.42, 0.2, -0.42), vec4(0.2, -0.42, -0.2, -0.42), vec4(-0.2, -0.42, -0.2, 0.42),
  vec4(0.0, 0.45, 0.0, -0.45), vec4(0.0, 0.45, -0.15, 0.3), NONE, NONE
);
float seg2(vec2 p, vec4 s) {
  vec2 pa = p - s.xy;
  vec2 ba = s.zw - s.xy;
  return length(pa - ba * clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0));
}
// Coverage of glyph g at f (glyph units); px is one target pixel there.
float glyph(vec2 f, int g, float px) {
  float d = 9.0;
  for (int i = ZERO; i < 4; i++) d = min(d, seg2(f, STROKES[g * 4 + i]));
  const float w = 0.055;
  return (1.0 - smoothstep(w - px * 0.5, w + px * 0.5, d)) * min(1.0, 0.16 / (w + px));
}
// Five layers of slowly falling code, near to far, only under the water.
vec3 code(vec3 ro, vec3 rd, float tMax) {
  vec3 c = vec3(0.0);
  float sea = u_head.z;
  float ahead = max(dot(rd, u_fwd.xyz), 0.05);
  const float CW = 0.012;
  const float CH = 0.02;
  for (int k = ZERO; k < 5; k++) {
    float far = 0.9 * pow(1.5, float(k));
    float t = far / ahead;
    if (t > tMax) continue;
    vec3 p = ro + rd * t;
    if (p.y > L - 0.004) continue;
    float u = p.x / CW + float(k) * 17.0;
    float col = floor(u);
    // Each column falls at its own whole number of cells per loop, so the
    // loop closes; in it, streams of code, brightest at their lower end.
    float fall = 4.0 + floor(hash2(vec2(col, float(k)), 1u) * 9.0);
    float v = p.y / CH + fall * time / LOOP_SECONDS;
    float row = floor(v);
    float stream = 7.0 + floor(hash2(vec2(col, float(k)), 2u) * 10.0);
    float s = fract((row + floor(hash2(vec2(col, float(k)), 4u) * stream)) / stream);
    if (s > 0.35 + 0.4 * sea) continue;
    vec2 cell = vec2(col, row);
    if (hash2(cell, uint(k) + 3u) > 0.75) continue;
    float head = pow(max(1.0 - s / (0.35 + 0.4 * sea), 0.0), 1.6);
    vec2 f = vec2(fract(u) - 0.5, (fract(v) - 0.5) * CH / CW);
    float px = pixel * t / CW;
    // A sign changes now and then; the marks are mirrored, as in the matrix.
    float turn = floor(hash2(cell, 5u) * 3.0 + time / LOOP_SECONDS * 88.0 * hash2(cell, 6u));
    int gi = int(hash2(cell + turn * 7.0, uint(k) + 7u) * float(GLYPHS)) % GLYPHS;
    float g = glyph(vec2(-f.x, f.y) / 1.3, gi, px / 1.3) * (1.0 - smoothstep(0.3, 0.7, px));
    c += mix(u_cold, u_pale, 0.25 * head) * g * (0.15 + 0.85 * head) * (0.35 + 0.65 * sea) * murk(t) * 0.42;
  }
  return c;
}
// One ray per pixel, from the air eye above the waterline on the lens or from
// the water eye under it. A ray from above that comes down onto the water
// goes on once more, mirrored off the waves. Every pass shares one march, so
// her distance field and the strokes are compiled in once.
vec3 view(vec2 lens, float ys) {
  bool under = lens.y < ys;
  vec2 l = lens;
  vec3 ro = u_eye.xyz;
  if (under) {
    // The water magnifies and wavers.
    l = vec2(lens.x / ZOOM, ys + (lens.y - ys) / ZOOM);
    l += 0.002 * vec2(sin(l.y * 47.0 + TAU * 13.0 * time / LOOP_SECONDS), sin(l.x * 31.0 - TAU * 10.0 * time / LOOP_SECONDS));
    pixel /= ZOOM;
    ro = vec3(u_eye.x, WATER_EYE, u_eye.z);
  }
  vec3 rd = normalize(u_fwd.xyz + u_right.xyz * l.x + u_up.xyz * l.y);
  // While there is water: it fades out as the last of it drains under the frame.
  float sea = smoothstep(DRY, DRY + 0.35, L);
  // Where a ray from above the level comes down to the water.
  float down = ro.y > L && rd.y < -1e-5 ? (L - ro.y) / rd.y : -1.0;
  float limit = down > 0.0 && sea > 0.0 ? down : 1e9;
  if (under) {
    // Once the level falls under the water eye, its rays enter the water on
    // the way; while the eye is under the water, the surface from below
    // closes the ray.
    wet = max(down, 0.0);
    limit = ro.y < L && rd.y > 1e-5 ? (L - ro.y) / rd.y : 1e9;
  }
  vec3 c = under ? vec3(0.0) : u_cold * 0.012 * exp(-max(l.y - ys, 0.0) * 9.0) + sky(rd) * sea * step(1e8, limit);
  vec3 o = ro;
  vec3 d = rd;
  float lim = limit;
  float k = 1.0;
  float blur = 0.0;
  for (int pass = ZERO; pass < 2; pass++) {
    float closest;
    float tc;
    vec3 n;
    bool eye;
    float th = march(o, d, lim, closest, tc, n, eye);
    float tMax = th > 0.0 ? th : lim;
    if (under) {
      // Light from the surface, fading with depth, and its slow shafts.
      float depth = ys - l.y;
      c += u_cold * (0.02 + 0.055 * exp(-depth * 7.0));
      float shafts = 0.0;
      for (int j = ZERO; j < 3; j++) {
        float fj = float(j);
        shafts += pow(max(sin(l.x * (9.0 + 5.0 * fj) + depth * (2.0 - fj) + TAU * float(2 + j) * time / LOOP_SECONDS + fj * 2.1), 0.0), 10.0);
      }
      c += mix(u_cold, u_pale, 0.3) * shafts * 0.03 * exp(-depth * 2.5);
      // Code in front of her is thinned, so her body under the water still reads.
      float veil = th > 0.0 ? 0.45 : mix(0.45, 1.0, smoothstep(0.0, 0.012, closest));
      c += code(o, d, tMax) * veil;
    }
    if (th > 0.0) {
      c += k * shade(o + d * th, d, th, under, n, eye);
    } else {
      c += k * outline(closest, tc, under);
    }
    c += k * strokes(o, d, tMax, under, blur);
    c += k * beam(o, d, tMax, under);
    // Her lips when she speaks; under the water a softer, wider halo.
    c += k * lips(o, d, tMax, under ? 1.6 : 1.0) * (under ? 0.7 : 1.0);
    if (pass > 0 || under || th > 0.0 || lim > 1e8) break;
    // The water: its waves tilt the mirror, so what it mirrors shivers and
    // stretches down towards the eye; the ring crests catch the light.
    vec3 sp = o + d * lim;
    float crest;
    vec3 w = waves(sp.xz, pixel * lim / max(-d.y, 0.03), crest);
    vec3 wn = normalize(vec3(-w.y, 1.0, -w.z));
    float fresnel = 0.02 + 0.98 * pow(1.0 - max(-dot(d, wn), 0.0), 5.0);
    float fade = exp(-lim * 0.08) * sea;
    vec3 rr = reflect(d, wn);
    rr.y = max(rr.y, 0.002);
    c += (sky(rr) * fresnel + u_cold * 0.02 * (1.0 - fresnel) + mix(u_cold, u_pale, 0.6) * crest * 0.5) * fade;
    // Under each word a path of glints, as under the moon: the eye is too low
    // to see the word itself in the water, but the facets of the waves that
    // turn towards it flash in a column straight under it, out to the horizon.
    vec2 back = normalize(d.xz);
    // Far off, the waves are finer than a pixel: there the path breaks into
    // streaks across it.
    float distant = smoothstep(0.006, 0.03, pixel * lim / max(-d.y, 0.03));
    float streaks = 0.3 * sq(0.5 + 0.5 * sin(sp.z * 38.0 + sp.x * 6.0 + TAU * 11.0 * time / LOOP_SECONDS)) * (0.6 + 0.4 * sin(sp.x * 21.0 - TAU * 7.0 * time / LOOP_SECONDS));
    for (int j = ZERO; j < WORDS; j++) {
      vec4 b = u_words[j];
      if (b.w <= 0.0) continue;
      vec2 to = b.xz - u_eye.xz;
      float far = length(to);
      float side = back.x * to.y - back.y * to.x;
      float width = b.w * 0.6 + 0.04 * far;
      float path = exp(-sq(side / width)) * step(0.0, dot(back, to));
      float tilt = dot(w.yz, to / far);
      float glit = smoothstep(0.012, 0.05, tilt) * (0.35 + 0.65 * sq(sin(sp.x * 150.0 + TAU * 21.0 * time / LOOP_SECONDS) * sin(sp.z * 120.0 - TAU * 17.0 * time / LOOP_SECONDS)));
      glit = mix(glit, streaks, distant);
      float lit = u_seg[2 * (STARTS[j] + 2)].w;
      c += mix(u_pale, u_warm, 0.25) * lit * path * glit * fade * 0.7;
    }
    o = sp + vec3(0.0, 0.0005, 0.0);
    d = rr;
    lim = 30.0;
    k = fresnel * fade;
    blur = 0.0022;
  }
  return c;
}

void main() {
  vec2 frag = gl_FragCoord.xy;
  time = u_eye.w;
  pixel = 2.0 / (u_view.y * u_view.w);
  L = u_water.x;
  speak = u_water.z;
  wet = 0.0;
  bc = cos(u_body.w);
  bs = sin(u_body.w);
  hf = vec3(sin(u_head.x) * cos(u_head.y), sin(u_head.y), cos(u_head.x) * cos(u_head.y));
  hr = normalize(cross(vec3(0.0, 1.0, 0.0), hf));
  hu = cross(hf, hr);
  vec2 lens = (frag / u_view.zw * 2.0 - 1.0) / u_view.xy;
  float ys = splitAt(lens.x);
  float px = pixel;
  vec3 light = view(lens, ys);
  // The waterline on the lens: a thin bright edge, a glow just under it.
  float d = (lens.y - ys) / px;
  light += mix(u_cold, u_pale, 0.5) * 0.32 * exp(-d * d / 1.4);
  light += u_cold * 0.06 * exp(min(d, 0.0) / 10.0) * step(d, 0.0);

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
