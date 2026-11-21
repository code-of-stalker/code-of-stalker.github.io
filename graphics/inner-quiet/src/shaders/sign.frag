// A sign drawn as lines of light, in the sign's own units (its size is 1):
// a thought's cloud with its lines of words written into it and small
// bubbles down to the spike; a heart with its pulse running through; a bolt;
// a whirlpool turning. The warm ring's notice: four warm corners closing on
// it, the sign itself warming. Added to the light.
in vec2 v_q;
flat in vec4 v_kind;
flat in vec4 v_brackets;
out vec4 o;

float circle(vec2 q, vec2 c, float r) {
  return length(q - c) - r;
}
// The cloud: its outline, the union of five circles.
float cloud(vec2 q) {
  float d = circle(q, vec2(-0.42, 0.02), 0.36);
  d = min(d, circle(q, vec2(0.0, 0.18), 0.44));
  d = min(d, circle(q, vec2(0.43, 0.03), 0.34));
  d = min(d, circle(q, vec2(-0.16, -0.17), 0.3));
  d = min(d, circle(q, vec2(0.2, -0.18), 0.3));
  return d;
}
// The words: three lines inside the cloud, written in as `written` goes
// 0..1, each broken into words.
float words(vec2 q, float written) {
  float d = 1e3;
  for (int k = zero(); k < 3; k++) {
    float y = 0.2 - 0.17 * float(k);
    float x0 = -0.42 + 0.06 * float(k);
    float len = (k == 1 ? 0.78 : 0.66 - 0.12 * float(k)) * clamp(written * 3.0 - float(k), 0.0, 1.0);
    if (len <= 0.0) continue;
    float x = clamp(q.x, x0, x0 + len);
    // A gap between words.
    float u = (x - x0) / 0.2 + float(k) * 0.37;
    float gap = fract(u);
    float inWord = step(0.16, gap);
    d = min(d, inWord > 0.5 ? length(vec2(q.x - x, q.y - y)) : 1e3);
  }
  return d;
}
// The heart (Inigo Quilez's distance to a heart), its point at q.y = -0.5.
float heart(vec2 q) {
  q = q * 1.35 + vec2(0.0, 0.62);
  q.x = abs(q.x);
  if (q.y + q.x > 1.0) return (sqrt(dot(q - vec2(0.25, 0.75), q - vec2(0.25, 0.75))) - 0.35355339) / 1.35;
  vec2 a = q - vec2(0.0, 1.0);
  vec2 b = q - 0.5 * max(q.x + q.y, 0.0);
  return sqrt(min(dot(a, a), dot(b, b))) * sign(q.x - q.y) / 1.35;
}
// Its pulse: a flat line with a beat running through it.
float ecgY(float x, float phase) {
  float u = fract(x * 0.8 - phase + 0.5) - 0.5;
  return 0.26 * exp(-sq(u / 0.035)) - 0.12 * exp(-sq((u - 0.07) / 0.035)) + 0.05 * exp(-sq((u + 0.16) / 0.06));
}
float ecg(vec2 q, float phase) {
  if (abs(q.x) > 0.3) return 1e3;
  float y = ecgY(q.x, phase);
  float slope = (ecgY(q.x + 0.004, phase) - ecgY(q.x - 0.004, phase)) / 0.008;
  return abs(q.y - y) / sqrt(1.0 + slope * slope);
}
float bolt(vec2 q) {
  vec2 p0 = vec2(0.12, 0.72);
  vec2 p1 = vec2(-0.2, 0.02);
  vec2 p2 = vec2(0.1, 0.06);
  vec2 p3 = vec2(-0.14, -0.66);
  return min(segd(q, p0, p1), min(segd(q, p1, p2), segd(q, p2, p3)));
}
// A spiral of four turns, turned by `turn`.
float whirl(vec2 q, float turn) {
  const float STEP = 0.15;
  const float START = 0.05;
  float r = length(q);
  float a = mod(atan(q.y, q.x) + turn, TAU) / TAU;
  float n = clamp(floor((r - START) / STEP - a + 0.5), 0.0, 3.0);
  return abs(r - START - STEP * (a + n));
}
float corners(vec2 q, float s) {
  vec2 a = abs(q);
  float k = 0.32 * s;
  return min(segd(a, vec2(s - k, s), vec2(s)), segd(a, vec2(s), vec2(s, s - k)));
}

void main() {
  time = u_eye.w;
  float K8 = px800();
  // The sign's units a pixel.
  float px = max(length(fwidth(v_q)) * 0.7071, 1e-5);
  float w = 1.5 * K8 * px;
  int kind = int(v_kind.x + 0.5);
  float light = v_kind.y;
  float d = 1e3;
  float extra = 1e3;
  if (light > 0.0) {
    if (kind == 0) {
      d = abs(cloud(v_q));
      d = min(d, abs(circle(v_q, vec2(0.08, -0.6), 0.09)));
      d = min(d, abs(circle(v_q, vec2(0.02, -0.82), 0.05)));
      extra = words(v_q, v_kind.w);
    } else if (kind == 1) {
      d = abs(heart(v_q));
      extra = ecg(v_q - vec2(0.0, 0.02), v_kind.w);
    } else if (kind == 2) {
      d = bolt(v_q);
    } else {
      d = whirl(v_q, v_kind.w);
    }
  }
  float line = clamp(0.5 - (d - 0.5 * w) / px, 0.0, 1.0) + 0.45 * exp(-sq(d / (2.2 * w))) + 0.15 * exp(-sq(d / (6.0 * w)));
  float inner = clamp(0.5 - (extra - 0.4 * w) / px, 0.0, 1.0) + 0.35 * exp(-sq(extra / (2.0 * w)));
  vec3 ink = mix(COLD, WARM, v_kind.z);
  vec3 col = ink * light * (line + 0.85 * inner);
  if (v_brackets.x > 0.0) {
    float b = corners(v_q, v_brackets.y);
    float stroke = clamp(0.5 - (b - 0.6 * w) / px, 0.0, 1.0) + 0.4 * exp(-sq(b / (2.5 * w)));
    col += WARM * v_brackets.x * stroke;
  }
  o = vec4(col, 1.0);
}
