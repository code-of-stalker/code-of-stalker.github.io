// Shared by prints.frag and scene.frag: the sand's own grain and the seals.
// The seals' outlines and faces must match `REACH` in lib.rs.
const float DEPTH = 0.03;
// The print texture covers [-SPAN, SPAN]² of the ground around the origin.
const float SPAN = 0.6;
const float HMIN = -0.04, HMAX = 0.02;

// Hashes without sine: the same on every GPU and cheap in a ray's inner loop.
float hash(vec2 p) {
  vec3 q = fract(vec3(p.xyx) * 0.1031);
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}
float hash1(float n) {
  n = fract(n * 0.1031);
  n *= n + 33.33;
  return fract(n * (n + n));
}
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
float sdBox(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}
float sdEllipse(vec2 p, vec2 r) { return (length(p / r) - 1.0) * min(r.x, r.y); }
float sdOctagon(vec2 p, float r) {
  const vec3 k = vec3(-0.9238795325, 0.3826834323, 0.4142135623);
  p = abs(p);
  p -= 2.0 * min(dot(k.xy, p), 0.0) * k.xy;
  p -= 2.0 * min(dot(vec2(-k.x, k.y), p), 0.0) * vec2(-k.x, k.y);
  p -= vec2(clamp(p.x, -k.z * r, k.z * r), r);
  return length(p) * sign(p.y);
}

// The seal's outline, one per kind: the six beliefs and the opening seal.
float shape(vec2 p, int kind) {
  if (kind == 0) return length(p) - 0.36;
  if (kind == 1) return sdEllipse(p, vec2(0.43, 0.30));
  if (kind == 2) return sdBox(p, vec2(0.33), 0.07);
  if (kind == 3) return sdOctagon(p, 0.34);
  if (kind == 4) return sdBox(p, vec2(0.44, 0.27), 0.12);
  if (kind == 5) return sdEllipse(p, vec2(0.30, 0.39));
  return length(p) - 0.34;
}

float bar(vec2 q, float x0, float x1, float th) {
  return sdBox(vec2(q.x - (x0 + x1) * 0.5, q.y), vec2((x1 - x0) * 0.5, th), th);
}

// The seal's face: rings and rows of letterless words, 1 where it was cut.
// No emblem of any faith: only the form of a seal and the form of words.
float face(vec2 p, int kind) {
  float k = float(kind);
  float sd = shape(p, kind);
  float th = 0.0075;
  float m = 1.0 - smoothstep(th - 0.002, th + 0.004, abs(sd + 0.03));
  bool round = kind != 2 && kind != 4;
  if (round) {
    m = max(m, 1.0 - smoothstep(th * 0.8 - 0.002, th * 0.8 + 0.004, abs(sd + 0.105)));
    // words around the rim
    float a = atan(p.y, p.x) / 6.2831853 + 0.5;
    float n = 9.0 + floor(hash1(k + 2.0) * 6.0);
    float cell = fract(a * n), id = floor(a * n);
    float len = 0.35 + 0.5 * hash1(k * 7.0 + id);
    float on = smoothstep(len + 0.03, len - 0.01, cell) * smoothstep(0.04, 0.09, cell);
    m = max(m, on * (1.0 - smoothstep(th - 0.002, th + 0.004, abs(sd + 0.0675))));
  }
  // rows of words in the middle
  float lim = round ? -0.13 : -0.07;
  if (sd < lim + 0.01) {
    float rows = (round ? 3.0 : 4.0) + floor(hash1(k * 3.3) * 2.0);
    float span = round ? 0.17 : 0.2;
    float row = 2.0 * span / rows;
    float r = floor((span - p.y) / row);
    if (r >= 0.0 && r < rows) {
      float y = span - (r + 0.5) * row;
      float x = -0.4, best = 1e3;
      for (int j = 0; j < 8; j++) {
        float len = 0.05 + 0.13 * hash1(k * 13.1 + r * 7.7 + float(j) * 3.3);
        best = min(best, bar(vec2(p.x, p.y - y), x, x + len, th * 1.1));
        x += len + 0.032;
        if (x > 0.4) break;
      }
      float inside = 1.0 - smoothstep(lim - 0.01, lim, sd);
      m = max(m, (1.0 - smoothstep(-0.003, 0.003, best)) * inside);
    }
  }
  return m;
}

// One imprint at the origin: height, how much of the ground it covers and
// how hard the sand under it was pressed.
vec3 imprint(vec2 p, int kind, float depth) {
  if (depth <= 0.0) return vec3(0.0);
  float d = shape(p, kind);
  if (d > 0.12) return vec3(0.0);
  float F = 1.0 - smoothstep(-0.012, 0.006, d);
  float G = F > 0.0 ? face(p, kind) : 0.0;
  float h = DEPTH * depth * (-F + 0.7 * G * F);
  float rim = 0.45 * DEPTH * depth * exp(-pow(max(d + 0.004, 0.0) / 0.045, 2.0)) * smoothstep(-0.012, 0.006, d);
  return vec3(h + rim, max(F, smoothstep(0.03, 0.0, d) * 0.6) * depth, F * (1.0 - G) * depth);
}

// The sand's own grain: wind ripples, gentle on one side and steep on the
// other, and the fine grain that shivers while the sand is alive.
float ripples(vec2 p, float far, vec2 drift) {
  vec2 w = p + 0.22 * vec2(noise(p * 0.8), noise(p * 0.8 + 7.3));
  float s = dot(w, vec2(0.94, 0.34)) / 0.24 + 1.6 * noise(p * 0.35);
  float f = fract(s);
  float prof = f < 0.7 ? smoothstep(0.0, 0.7, f) : 1.0 - smoothstep(0.7, 1.0, f);
  float amp = 0.0065 * (0.6 + 0.4 * noise(p * 0.6 + 3.1));
  return mix(amp * prof, amp * 0.5, far) + 0.0009 * noise(p * 55.0 + drift) * (1.0 - far);
}
