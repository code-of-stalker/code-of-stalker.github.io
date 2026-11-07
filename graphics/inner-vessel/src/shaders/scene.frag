// «Наполнение» in one pass, straight onto the page. Each pixel's ray meets
// the floor (an exact plane) or, inside their box, the chair and the seated
// person (distance fields, the same as body.rs). The person is clear glass:
// a cold rim, what lies behind seen through it, and inside it a warm light
// that fills the body between two levels (the top rises from the feet to
// the crown, the bottom rises only when the light drains into the head),
// thicker toward the bottom once it has settled. The chair is dark, warmed
// where the body rests on it and, for «опору», by the light running down its
// legs to the floor. On the floor: the soles' and the legs' glow, and the
// roots running out of them. In the head drift a few glints of thought.
// Light is added onto the page in the theme's cold, warm and pale. Rust puts
// the version line and lib.rs's constants (#define) in front of it.
precision highp float;
precision highp int;

#define TAU 6.28318531

in vec2 v_uv;
out vec4 o;

uniform vec4 u_eye;    // camera position xyz, loop time
uniform vec4 u_right;  // camera axes
uniform vec4 u_up;
uniform vec4 u_fwd;
uniform vec4 u_view;   // lens scale x and y, canvas width and height in px
uniform vec4 u_fill;   // top of the light (breath in), its bottom, its light, how cold
uniform vec4 u_weight; // settled, the body bearing on soles and seat, the light down the chair, top line
uniform vec4 u_root;   // how far the roots reach, their light
uniform vec4 u_motes[MOTES]; // each glint of thought: where, its light
uniform float u_warmth[MOTES]; // and how warm
uniform vec3 u_cold;
uniform vec3 u_warm;
uniform vec3 u_pale;
uniform vec3 u_backdrop; // the page
uniform vec4 u_edges;    // left, right, top, bottom
uniform vec4 u_out;      // soft edges, -, -, -

const vec2 FEET_AT[2] = FEET_LIST;
const vec2 LEGS_AT[4] = LEGS_LIST;

// Loop time; the tangent of one pixel.
float time;
float pixel;

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

// ---------- the light inside
// Its colour: warm, going over to the cold of thought.
vec3 tone() {
  return mix(u_warm, mix(u_cold, u_pale, 0.3), u_fill.w);
}
// How far inside the light a point lies (> 0 inside): under its top, over
// its bottom, both surfaces stirring a little.
float band(vec3 q) {
  float a = TAU * 8.0 * time / LOOP_SECONDS;
  float b = TAU * 5.0 * time / LOOP_SECONDS;
  float top = u_fill.x + 0.006 * sin(q.x * 31.0 + 1.3 + a) * cos(q.z * 23.0 - b);
  float bottom = u_fill.y > 0.001 ? u_fill.y + 0.006 * sin(q.z * 29.0 + 0.4 - a) * cos(q.x * 27.0 + b) : -1.0;
  return min(top - q.y, q.y - bottom);
}
// How thick the light is at q, `d` inside the skin: fuller deep inside and
// in the feet; once it has settled, heavier low and lighter high.
float density(vec3 q, float d) {
  float deep = 0.4 + 0.6 * smoothstep(0.0, 0.06, -d);
  float feet = 1.0 + 1.2 * (1.0 - smoothstep(0.0, 0.12, q.y));
  float settle = 1.0 + u_weight.x * (1.4 * (1.0 - smoothstep(0.0, 0.75, q.y)) - 0.35 * smoothstep(0.7, 1.3, q.y));
  return deep * feet * settle;
}

// ---------- the floor
// Light that runs out of the soles and the chair legs into the floor.
float veins(vec2 xz) {
  float g = 0.0;
  for (int i = 0; i < 6; i++) {
    vec2 at = i < 2 ? FEET_AT[i] - vec2(0.0, 0.04) : LEGS_AT[i - 2];
    vec2 q = xz - at;
    float rr = length(q);
    float reach = u_root.x * (i < 2 ? 1.0 : 0.8);
    if (rr > reach) continue;
    float a = atan(q.y, q.x);
    float fi = float(i);
    float n = vnoise(rr * 4.0 + fi * 7.3) * 2.6 + vnoise(rr * 11.0 + fi) * 0.7;
    float w = abs(sin(a * 4.5 + n + fi)) / 4.5 * rr;
    float tip = 1.0 - smoothstep(reach * 0.6, reach, rr);
    g += exp(-w * w / (sq(0.0045) * (1.0 + rr * 2.0))) * exp(-rr / 0.55) * tip;
    float w2 = abs(sin(a * 9.0 + n * 1.7 + 2.0)) / 9.0 * rr;
    g += 0.45 * exp(-w2 * w2 / sq(0.003)) * exp(-rr / 0.3) * tip * step(0.08, rr);
    g += 0.8 * exp(-rr * rr / 0.0025);
  }
  return g;
}
vec3 floorLight(vec2 xz) {
  vec3 c = u_cold * 0.02 * exp(-length(xz - vec2(0.0, 0.2)) / 1.4);
  // Where the person and the chair stand, a little darker.
  if (abs(xz.x) < 0.45 && xz.y > -0.4 && xz.y < 0.9) {
    float near = solid(vec3(xz.x, 0.015, xz.y));
    c -= u_backdrop * 0.35 * exp(-max(near, 0.0) / 0.035);
  }
  // The soles glow as they bear the weight, the chair's feet once the light
  // has run down to them; then the roots.
  float soles = 0.0;
  for (int i = 0; i < 2; i++) {
    vec2 d = xz - vec2(FEET_AT[i].x, 0.55);
    soles += exp(-(d.x * d.x / 0.004 + d.y * d.y / 0.014));
  }
  float legs = 0.0;
  for (int i = 0; i < 4; i++) {
    vec2 d = xz - LEGS_AT[i];
    legs += exp(-dot(d, d) / 0.0016);
  }
  c += u_warm * 0.2 * u_weight.y * u_fill.z * soles;
  c += u_warm * 0.3 * smoothstep(0.8, 1.0, u_weight.z) * legs;
  c += u_warm * 0.7 * u_root.y * veins(xz);
  return c;
}

// ---------- the chair
vec3 chairLight(vec3 p, vec3 n, vec3 rd) {
  float rim = pow(1.0 - abs(dot(n, -rd)), 3.0);
  vec3 c = -u_backdrop * 0.38 + u_cold * (0.2 * rim + 0.045 * max(n.y, 0.0));
  // Where the body rests on it.
  float touch = exp(-max(figure(p), 0.0) / 0.01);
  c += u_warm * u_fill.z * u_weight.y * 0.45 * touch;
  // «опору»: the light runs from the seat down the legs to the floor, a
  // bright front ahead of it. Only the seat and the legs: the back is not
  // what bears the weight.
  float down = SEAT - p.y;
  float front = u_weight.z * (SEAT + 0.08);
  float bears = 1.0 - smoothstep(0.01, 0.04, -down);
  float lit = (1.0 - smoothstep(front - 0.08, front, down)) * bears;
  float edge = exp(-sq((down - front + 0.03) / 0.03)) * bears * (1.0 - smoothstep(0.9, 1.0, u_weight.z));
  c += u_warm * smoothstep(0.0, 0.2, u_weight.z) * (lit * (0.3 + 0.5 * rim) + edge * 0.6);
  return c;
}

// What the glass shows behind it: the chair inside the box, or the floor.
vec3 behind(vec3 ro, vec3 rd) {
  float tFloor = rd.y < 0.0 ? -ro.y / rd.y : 1e9;
  vec2 b = box(ro, safeInv(rd), BOUNDS_FROM, BOUNDS_TO);
  if (b.x < b.y) {
    float t = b.x;
    float end = min(b.y, tFloor);
    for (int i = 0; i < 48; i++) {
      vec3 p = ro + rd * t;
      float d = chair(p);
      if (d < 0.0006) return chairLight(p, chairNormal(p), rd);
      t += d;
      if (t > end) break;
    }
  }
  if (tFloor < 1e8) return floorLight((ro + rd * tFloor).xz);
  return vec3(0.0);
}

// ---------- the glass person
vec3 glass(vec3 p, vec3 rd) {
  vec3 n = figureNormal(p);
  float fres = pow(1.0 - abs(dot(n, -rd)), 2.4);
  vec3 rd2 = refract(rd, n, 1.0 / 1.12);
  if (dot(rd2, rd2) < 0.5) rd2 = rd;
  // Through the inside: how much light the ray passes, how often it
  // crosses the light's surface.
  vec3 q = p + rd2 * 0.002;
  float dens = 0.0;
  float span = 0.001;
  float sheen = 0.0;
  float g0 = band(q);
  for (int i = 0; i < 80; i++) {
    float d = figure(q);
    if (d > 0.0015) break;
    float h = clamp(-d * 0.5, 0.004, 0.022);
    vec3 q1 = q + rd2 * h;
    float g1 = band(q1);
    float part = g0 > 0.0 && g1 > 0.0 ? 1.0 : (g0 <= 0.0 && g1 <= 0.0 ? 0.0 : max(g0, g1) / abs(g0 - g1));
    dens += part * h * density(q, d);
    span += h;
    if (g0 * g1 < 0.0) sheen += 1.0;
    g0 = g1;
    q = q1;
  }
  // Thin arms fill as clearly as the thick body: the mean density counts
  // as well as the amount.
  float fill = (1.0 - exp(-(dens * 8.0 + 0.5 * dens / span))) * u_fill.z;
  // The chair shows through the glass, but softly: it is behind, not in.
  vec3 back = u_backdrop + behind(q, rd2) * 0.45;
  // The line where the light's surface meets the skin.
  float line = exp(-abs(band(p)) / 0.004) * u_weight.w;
  vec3 c = tone();
  vec3 col = back * (0.8 - 0.45 * fill) + c * fill * 0.85 + c * u_fill.z * (sheen * 0.1 + line * 0.55) + u_cold * fres * 0.85;
  col += u_pale * pow(max(dot(reflect(rd, n), normalize(vec3(-0.3, 1.0, 0.4))), 0.0), 40.0) * 0.5;
  return col - u_backdrop;
}

void main() {
  vec2 frag = gl_FragCoord.xy;
  pixel = 2.0 / (u_view.y * u_view.w);
  vec2 lens = (frag / u_view.zw * 2.0 - 1.0) / u_view.xy;
  vec3 rd = normalize(u_fwd.xyz + u_right.xyz * lens.x + u_up.xyz * lens.y);
  vec3 ro = u_eye.xyz;
  time = u_eye.w;

  // The nearest surface: the person or the chair inside their box, else
  // the floor. A ray that just misses the glass still catches its rim.
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
    light = chairLight(p, chairNormal(p), rd);
  } else if (id == 2) {
    light = glass(p, rd);
  }
  if (id != 2 && closest < 0.02) {
    float px = max(closest, 0.0) / (pixel * tClosest);
    light += u_cold * 0.5 * exp(-px * px / 0.8);
  }

  // The glints of thought: clear through the glass, hidden by the chair.
  float tChair = id == 1 ? tHit : 1e9;
  for (int k = 0; k < MOTES; k++) {
    float lit = u_motes[k].w;
    if (lit < 0.001) continue;
    vec3 v = u_motes[k].xyz - ro;
    float t = dot(v, rd);
    if (t <= 0.0 || t > tChair) continue;
    float s = max(pixel * t * 1.3, 0.0045);
    float d = sq(length(v - rd * t) / s);
    float twinkle = 0.8 + 0.2 * sin(TAU * float(13 + 4 * k) * time / LOOP_SECONDS + float(k));
    vec3 c = mix(mix(u_cold, u_pale, 0.35), u_warm, u_warmth[k]);
    light += c * lit * twinkle * (0.95 * exp(-d) + 0.2 * exp(-d / 25.0));
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
