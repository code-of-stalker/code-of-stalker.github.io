// The world put on the page with its bloom, the cloud he falls through,
// and over them what the storyboard drew by hand, here as distances: the
// two rings with their runners, the warm thread of his voice with its
// beads and words, the words at his mouth and round his feet, the signs of
// his inside, the sound of his voice, the brackets, the bolt, the meteors,
// the satellite. Then a soft shoulder for piled light, the edges melted
// into the page, the altimeter in the corner, a dither. Marks are in px of
// an 800 px high frame (px800), y up, 0 at the frame's middle (lib.rs
// `Marks`).

uniform sampler2D u_world;
uniform sampler2D u_bright;
uniform sampler2D u_atlas;
uniform vec4 u_edges;
uniform vec4 u_bloom;               // amount, blur (px800), the world's scale
uniform vec4 u_ring[8];             // per ring: centre, first, second half-axis, (turn, light, ticks, ink)
uniform vec4 u_box[2];
uniform vec4 u_thread[3];
uniform vec4 u_label[LABELS * 2];
uniform vec4 u_dot[DOTS * 2];
uniform vec4 u_text[TEXTS * 3];
uniform vec4 u_notice[4];
uniform vec4 u_bolt;
uniform vec4 u_meteor[3];
uniform vec4 u_meteorLight;
uniform vec4 u_sat;
uniform vec4 u_sign[4];
uniform vec4 u_arcs[2];
uniform vec4 u_alti;

const vec2 LABEL_INK[INK_ROWS] = LABEL_INK_LIST;
const vec4 SPARKS[5] = vec4[5](vec4(-1.0999, 0.1686, 0.2334, 0.7504), vec4(0.2163, -0.2510, 0.2082, 0.6146),
                               vec4(-1.0166, -0.4865, 0.2101, 0.8233), vec4(-0.0156, 0.6341, 0.2121, 0.8356),
                               vec4(-1.0704, 0.7630, 0.2100, 0.6802));

// Canvas px a px800.
float K8;
// How much of this pixel he covers.
float cov;

// ---------- strokes as the storyboard's canvas drew them

float erfa(float x) {
  float x2 = x * x;
  float ax = 0.147 * x2;
  return sign(x) * sqrt(1.0 - exp(-x2 * (1.2732395 + ax) / (1.0 + ax)));
}
// A line w px800 wide, d px800 off its middle, blurred by s px800 (CSS
// blur), smoothed over a pixel.
float band(float d, float w, float s) {
  float sg = sqrt(s * s + sq(0.45 / K8)) * 1.41421356;
  return 0.5 * (erfa((d + 0.5 * w) / sg) - erfa((d - 0.5 * w) / sg));
}
// The storyboard's GLOW passes: wide and soft, narrower, sharp.
float glowStroke(float d, float lw) {
  return 0.22 * band(d, 4.0 * lw, 7.0) + 0.5 * band(d, 1.8 * lw, 2.0) + band(d, lw, 0.0);
}
float softStroke(float d, float lw, float wide, float blur) {
  return 0.4 * band(d, wide * lw, blur) + band(d, lw, 0.0);
}
// The storyboard's radial glow: full at the middle, 0.45 at a quarter,
// none at R; kept to about a pixel, its light kept.
float glowDot(float r, float R) {
  float Rs = max(R, 0.8 / K8);
  float x = r / Rs;
  float g = x < 0.25 ? mix(1.0, 0.45, x / 0.25) : 0.45 * max(1.0 - x, 0.0) / 0.75;
  return g * sq(R / Rs);
}
vec3 inkOf(float k) {
  return k < 0.5 ? WARM : (k < 1.5 ? COLD : PALE);
}
float dot2(vec2 v) {
  return dot(v, v);
}
// About the distance to an ellipse's outline.
float ellipseLine(vec2 q, vec2 r) {
  float k0 = length(q / r);
  float k1 = length(q / (r * r));
  return abs(k0 * (k0 - 1.0) / max(k1, 1e-6));
}

// ---------- the label atlas

float atlasAt(vec2 at, float row, float lod) {
  vec2 uv = vec2(at.x, row * 128.0 + clamp(at.y, 0.0, 127.0)) / ATLAS;
  return textureLod(u_atlas, uv, lod).r;
}
// A word on the screen: left edge, baseline, size (px800), row, light,
// whether it glows.
vec3 label(vec2 P, vec4 a, vec4 b) {
  if (b.x <= 0.0 || a.z <= 0.0) return vec3(0.0);
  float per = a.z / 64.0;
  vec2 at = vec2(GLYPH_X0 + (P.x - a.x) / per, LABEL_BASE - (P.y - a.y) / per);
  int row = int(a.w + 0.5);
  vec2 ink = LABEL_INK[min(row, INK_ROWS - 1)];
  float m = b.y > 0.5 ? 14.0 / per : 2.0;
  if (at.x < ink.x - m || at.x > ink.y + m || at.y < LABEL_BAND.x - m || at.y > LABEL_BAND.y + m) return vec3(0.0);
  float sharp = atlasAt(at, a.w, max(log2(1.0 / (per * K8)), 0.0));
  float glow = b.y > 0.5 ? 0.55 * atlasAt(at, a.w, min(log2(12.0 / per), 4.5)) : 0.0;
  return WARM * b.x * (sharp + glow);
}

// ---------- the rings

vec2 ringAt(int k, float a, out float z) {
  vec4 v = u_ring[4 * k] + cos(a) * u_ring[4 * k + 1] + sin(a) * u_ring[4 * k + 2];
  z = v.z;
  return v.z > 0.02 ? v.xy / v.z : vec2(1e6);
}
float ringHeight(int k, float a) {
  return u_ring[4 * k].w + cos(a) * u_ring[4 * k + 1].w + sin(a) * u_ring[4 * k + 2].w + u_scene.x;
}
// One half of a ring (from angle h0, pi long): the closest angle and how
// far it is (px800).
vec2 ringHalf(int k, vec2 P, float h0) {
  float z;
  float best = h0;
  float bd = 1e9;
  for (int i = zero(); i < 13; i++) {
    float a = h0 + PI * float(i) / 12.0;
    float d = dot2(P - ringAt(k, a, z));
    if (d < bd) {
      bd = d;
      best = a;
    }
  }
  float st = PI / 24.0;
  for (int i = zero(); i < 6; i++) {
    float a0 = max(best - st, h0);
    float a1 = min(best + st, h0 + PI);
    float d0 = dot2(P - ringAt(k, a0, z));
    float d1 = dot2(P - ringAt(k, a1, z));
    if (d0 < bd) {
      bd = d0;
      best = a0;
    }
    if (d1 < bd) {
      bd = d1;
      best = a1;
    }
    st *= 0.5;
  }
  // The chords on either side of the closest sample.
  vec2 pm = ringAt(k, best, z);
  vec2 pa = ringAt(k, max(best - 2.0 * st, h0), z);
  vec2 pb = ringAt(k, min(best + 2.0 * st, h0 + PI), z);
  return vec2(best, min(segd(P, pa, pm), segd(P, pm, pb)));
}
vec3 ring(int k, vec2 P) {
  vec4 E = u_ring[4 * k + 3];
  vec4 bx = u_box[k];
  if (E.y <= 0.0 || P.x < bx.x || P.y < bx.y || P.x > bx.z || P.y > bx.w) return vec3(0.0);
  float a0 = atan(-u_ring[4 * k + 1].z, u_ring[4 * k + 2].z);
  float light = 0.0;
  for (int half_ = zero(); half_ < 2; half_++) {
    bool back = half_ == 0;
    vec2 r = ringHalf(k, P, a0 + PI * float(half_));
    float dd = mod(r.x - E.x, TAU);
    float trail = dd > TAU - 2.5 ? exp(-(TAU - dd) / 0.9) : 0.0;
    float tick = E.z > 0.5 ? (mod(floor(mod(r.x, TAU) / TAU * 90.0), 2.0) < 0.5 ? 1.0 : 0.55) : 1.0;
    float kk = min(1.0, (0.55 * tick + 1.4 * trail) * (back ? 0.6 : 1.0));
    float w = 1.7 * (1.0 + 0.6 * trail);
    float prof = (band(r.y, w, 0.0) + 0.45 * band(r.y, w, 6.0)) * kk;
    if (back) prof *= 1.0 - cov;
    prof *= smoothstep(-0.015, 0.015, ringHeight(k, r.x));
    light = max(light, prof);
  }
  return inkOf(E.w) * E.y * light;
}

// ---------- the thread of his voice

vec3 thread(vec2 P) {
  vec4 a = u_thread[0];
  vec4 b = u_thread[1];
  if (b.w <= 0.0) return vec3(0.0);
  vec2 ab = a.zw - a.xy;
  float u2 = clamp(dot(P - a.xy, ab) / max(dot(ab, ab), 1e-6), 0.0, 1.0);
  float d = length(P - a.xy - ab * u2);
  if (d > 40.0) return vec3(0.0);
  // The share of its length here: the screen's share undone by perspective.
  float u = u2 * u_thread[2].x;
  float lam = u * b.x / max(b.y * (1.0 - u) + u * b.x, 1e-6);
  float s = lam * b.z;
  float alpha = b.w * (1.0 - 0.8 * sqrt(clamp(s, 0.0, 1.0)));
  return WARM * alpha * (0.7 * band(d, 1.7, 7.0) + 0.8 * band(d, 1.7, 2.0) + band(d, 1.7, 0.0));
}

// ---------- the signs of his inside

vec2 heartCurve(vec2 c, float s, float t) {
  vec2 p0 = c + vec2(0.0, -0.35) * s;
  vec2 p1 = c + vec2(-0.9, 0.25) * s;
  vec2 p2 = c + vec2(-0.45, 0.95) * s;
  vec2 p3 = c + vec2(0.0, 0.42) * s;
  float u = 1.0 - t;
  return u * u * u * p0 + 3.0 * u * u * t * p1 + 3.0 * u * t * t * p2 + t * t * t * p3;
}
vec3 heart(vec2 P, vec4 chest, float s0) {
  float ins = chest.z;
  if (ins <= 0.0) return vec3(0.0);
  float s = 0.032 * s0;
  vec2 c = chest.xy;
  if (abs(P.x - c.x) > 2.6 * s + 24.0 || abs(P.y - c.y - 0.2 * s) > 2.6 * s + 24.0) return vec3(0.0);
  // Its left half, the right one mirrored onto it.
  vec2 q = vec2(c.x - abs(P.x - c.x), P.y);
  float d = 1e9;
  vec2 prev = heartCurve(c, s, 0.0);
  for (int i = zero() + 1; i <= 12; i++) {
    vec2 next = heartCurve(c, s, float(i) / 12.0);
    d = min(d, segd(q, prev, next));
    prev = next;
  }
  float ph = chest.w;
  vec3 col = WARM * ins * (0.85 + 0.3 * exp(-6.0 * ph)) * glowStroke(d, 1.8);
  // Its beat going out in rings: each is born at the heart and fades as it
  // widens, the next taking its place.
  for (int k = zero(); k < 2; k++) {
    float u = float(k) + ph;
    float rr = s * (1.05 + 0.55 * u);
    float a = ins * 0.45 * (1.0 - 0.5 * u) * smoothstep(0.0, 0.35, u);
    float dr = ellipseLine(P - c - vec2(0.0, 0.2 * s), vec2(rr, 0.92 * rr));
    col += WARM * a * softStroke(dr, 1.2, 2.0, 3.0);
  }
  return col;
}
vec3 breath(vec2 P, vec4 belly, float s0) {
  float ins = belly.z;
  if (ins <= 0.0) return vec3(0.0);
  float half_ = 0.06 * s0;
  float amp = 0.011 * s0;
  if (abs(P.x - belly.x) > half_ + 24.0 || abs(P.y - belly.y) > amp + 24.0) return vec3(0.0);
  float d = 1e9;
  vec2 prev = vec2(belly.x - half_, belly.y);
  for (int i = zero() + 1; i <= 16; i++) {
    float u = float(i) / 16.0;
    vec2 next = vec2(belly.x - half_ + 2.0 * half_ * u, belly.y + sin(u * TAU * 1.5 - TAU * belly.w) * amp * sin(u * PI));
    d = min(d, segd(P, prev, next));
    prev = next;
  }
  return WARM * 0.75 * ins * glowStroke(d, 1.7);
}
vec3 sparks(vec2 P, vec4 hand, float s0) {
  float ins = hand.z;
  if (ins <= 0.0) return vec3(0.0);
  float s = 0.025 * s0;
  if (abs(P.x - hand.x + 0.45 * s) > 1.6 * s + 24.0 || abs(P.y - hand.y) > 1.2 * s + 24.0) return vec3(0.0);
  vec3 col = vec3(0.0);
  for (int k = zero(); k < 5; k++) {
    vec4 sp = SPARKS[k];
    vec2 c = hand.xy + vec2(sp.x, -sp.y) * s;
    float l = sp.z * s;
    vec2 q = abs(P - c);
    float d = min(segd(q, vec2(0.0), vec2(l, 0.0)), segd(q, vec2(0.0), vec2(0.0, l)));
    col += WARM * 0.8 * ins * sp.w * softStroke(d, 1.3, 2.5, 3.0);
  }
  return col;
}

// ---------- the sound of his voice, the brackets, the sky's marks

vec3 sound(vec2 P) {
  vec4 a = u_arcs[0];
  vec4 b = u_arcs[1];
  if (a.w <= 0.0) return vec3(0.0);
  vec2 v = P - a.xy;
  float len = length(v);
  if (len > 1.45 * a.z + 24.0) return vec3(0.0);
  float ang = atan(v.y, v.x) - b.x;
  ang = atan(sin(ang), cos(ang));
  vec3 col = vec3(0.0);
  for (int k = zero(); k < 3; k++) {
    float r = a.z * (0.55 + 0.45 * float(k));
    float d;
    if (abs(ang) <= b.y) {
      d = abs(len - r);
    } else {
      float e = b.x + sign(ang) * b.y;
      d = length(P - a.xy - r * vec2(cos(e), sin(e)));
    }
    col += WARM * a.w * (1.0 - 0.25 * float(k)) * softStroke(d, 1.5, 2.4, 3.0);
  }
  return col;
}
vec3 notices(vec2 P) {
  vec3 col = vec3(0.0);
  for (int i = zero(); i < 4; i++) {
    vec4 n = u_notice[i];
    if (n.w <= 0.0) continue;
    float s = n.z;
    vec2 q = abs(P - n.xy);
    if (q.x > s + 24.0 || q.y > s + 24.0) continue;
    float k = 0.4 * s;
    float d = min(segd(q, vec2(s - k, s), vec2(s)), segd(q, vec2(s), vec2(s, s - k)));
    col += COLD * n.w * softStroke(d, 1.5, 2.0, 3.0);
  }
  return col;
}
vec3 sky(vec2 P) {
  vec3 col = vec3(0.0);
  if (u_bolt.z > 0.0) {
    vec2 c = u_bolt.xy;
    if (abs(P.x - c.x) < 40.0 && abs(P.y - c.y - 3.0) < 50.0) {
      vec2 p0 = c + vec2(-6.0, 16.0);
      vec2 p1 = c + vec2(2.0, 5.0);
      vec2 p2 = c + vec2(-3.0, 3.0);
      vec2 p3 = c + vec2(6.0, -10.0);
      float d = min(segd(P, p0, p1), min(segd(P, p1, p2), segd(P, p2, p3)));
      col += PALE * u_bolt.z * glowStroke(d, 1.3);
    }
  }
  for (int i = zero(); i < 3; i++) {
    float l = u_meteorLight[i];
    if (l <= 0.0) continue;
    vec4 m = u_meteor[i];
    col += PALE * 0.8 * l * glowStroke(segd(P, m.xy, m.zw), 1.4);
  }
  if (u_sat.z > 0.0) {
    vec2 c = u_sat.xy;
    float d = min(segd(P, c + vec2(-7.0, -1.0), c + vec2(-2.5, 0.0)), segd(P, c + vec2(2.5, 0.0), c + vec2(7.0, 1.0)));
    col += COLD * 0.8 * u_sat.z * band(d, 1.6, 0.0);
  }
  return col;
}
vec3 dots(vec2 P) {
  vec3 col = vec3(0.0);
  for (int i = zero(); i < DOTS; i++) {
    vec4 a = u_dot[2 * i];
    if (a.w <= 0.0) continue;
    float r = length(P - a.xy);
    float R = max(a.z, 0.8 / K8);
    if (r >= R) continue;
    vec4 b = u_dot[2 * i + 1];
    float g = glowDot(r, a.z) * a.w;
    if (b.y > 0.5) g *= 1.0 - cov;
    col += inkOf(b.x) * g;
  }
  return col;
}

// ---------- the bloom of the world

vec3 bloom() {
  vec2 texel = 1.0 / vec2(textureSize(u_bright, 0));
  float s = max(u_bloom.y * K8 * u_bloom.z / 2.0 / 1.12, 1.0);
  float lod = log2(s);
  vec3 sum = vec3(0.0);
  for (int j = zero(); j < 5; j++) {
    float wj = j == 2 ? 6.0 : (j == 1 || j == 3 ? 4.0 : 1.0);
    for (int i = 0; i < 5; i++) {
      float wi = i == 2 ? 6.0 : (i == 1 || i == 3 ? 4.0 : 1.0);
      sum += wi * wj * textureLod(u_bright, v_uv + vec2(float(i - 2), float(j - 2)) * s * texel, lod).rgb;
    }
  }
  return sum / 256.0;
}

// ---------- the altimeter in the corner, the storyboard's px from the
// frame's top left (y down)

vec3 altimeter(vec2 P) {
  if (u_alti.w <= 0.0) return vec3(0.0);
  vec2 corner = vec2(-400.0 / u_view.x, 400.0 / u_view.y);
  vec2 q = vec2(P.x - corner.x, corner.y - P.y);
  if (q.x > 240.0 || q.y > 270.0) return vec3(0.0);
  vec3 col = COLD * 0.3 * band(segd(q, vec2(46.0, 96.0), vec2(46.0, 246.0)), 1.2, 0.0);
  for (int i = zero(); i < 6; i++) {
    float y = 96.0 + 30.0 * float(i);
    col += COLD * 0.45 * softStroke(segd(q, vec2(46.0, y), vec2(62.0, y)), 1.8, 2.0, 2.0);
  }
  float ym = 96.0 + 30.0 * u_alti.z;
  col += WARM * softStroke(segd(q, vec2(46.0, ym), vec2(84.0, ym)), 1.8, 2.0, 2.0);
  // «410 КМ», «900 М»: the digits, a space, the unit.
  float per = 30.0 / 64.0;
  vec2 at = vec2((q.x - 44.0) / per, 64.0 + (q.y - 50.0) / per);
  float n = u_alti.x;
  float digits = n >= 99.5 ? 3.0 : (n >= 9.5 ? 2.0 : 1.0);
  float slots = digits + 1.0 + (u_alti.y > 0.5 ? 1.0 : 2.0);
  float slot = floor(at.x / GLYPH_ADV);
  if (slot >= 0.0 && slot < slots && slot != digits && at.y > LABEL_BAND.x - 30.0 && at.y < LABEL_BAND.y + 30.0) {
    float g;
    if (slot < digits) {
      g = mod(floor(floor(n + 0.5) / pow(10.0, digits - 1.0 - slot) + 0.001), 10.0);
    } else {
      g = u_alti.y > 0.5 || slot > digits + 1.0 ? 11.0 : 10.0;
    }
    vec2 cell = vec2(GLYPH_X0 + GLYPH_ADV * g + (at.x - GLYPH_ADV * slot), at.y);
    float sharp = atlasAt(cell, GLYPH_ROW, max(log2(1.0 / (per * K8)), 0.0));
    float glow = atlasAt(cell, GLYPH_ROW, log2(6.0 / per));
    col += COLD * 0.95 * (sharp + 0.55 * glow);
  }
  return col * u_alti.w / 0.95;
}

void main() {
  vec2 frag = gl_FragCoord.xy;
  setup(frag);
  K8 = px800();
  vec2 f = frameAt(frag);
  vec2 P = f * 400.0;
  vec3 rd = rayAt(f);

  // The words lying in the scene: where this pixel falls in the atlas and
  // how many atlas px a pixel spans, worked out before anything branches.
  vec2 tAt[TEXTS];
  float tL[TEXTS];
  for (int i = 0; i < TEXTS; i++) {
    vec4 a = u_text[3 * i];
    vec4 b = u_text[3 * i + 1];
    vec4 c = u_text[3 * i + 2];
    vec3 nrm = cross(b.xyz, c.xyz);
    float den = dot(rd, nrm);
    den = abs(den) < 1e-6 ? 1e-6 : den;
    float t = dot(a.xyz - u_eye.xyz, nrm) / den;
    vec3 h = u_eye.xyz + rd * t - a.xyz;
    vec2 l = vec2(dot(h, b.xyz), dot(h, c.xyz)) * 64.0 / max(a.w, 1e-4);
    int row = int(mod(b.w + 0.5, MASKED_ROW));
    vec2 ink = LABEL_INK[min(row, INK_ROWS - 1)];
    vec2 at = vec2(0.5 * (ink.x + ink.y) + l.x, 64.0 - l.y);
    vec2 dx = dFdx(at);
    vec2 dy = dFdy(at);
    tAt[i] = t > 0.0 ? at : vec2(-1e4);
    tL[i] = log2(max(max(abs(dx.x), abs(dx.y)), max(max(abs(dy.x), abs(dy.y)), 1e-6)));
  }

  vec4 w = texture(u_world, v_uv);
  cov = w.a;
  vec3 col = w.rgb + u_bloom.x * bloom();

  // The cloud he falls through.
  float fog = u_scene.y;
  if (fog > 0.0) {
    vec3 fogCol = bg * 1.35 + PALE * 0.04 * vnoise2(f * 3.0 + vec2(0.0, 2.0 * log(max(u_scene.x, 1.0)))) + SKY * 0.01;
    col = mix(col, fogCol, fog);
  }

  vec3 marks = ring(0, P) + ring(1, P) + thread(P) + dots(P) + sky(P) + notices(P) + sound(P);
  for (int i = zero(); i < LABELS; i++) {
    marks += label(P, u_label[2 * i], u_label[2 * i + 1]);
  }
  for (int i = 0; i < TEXTS; i++) {
    vec4 b = u_text[3 * i + 1];
    float light = u_text[3 * i + 2].w;
    vec2 at = tAt[i];
    if (light <= 0.0) continue;
    float row = mod(b.w + 0.5, MASKED_ROW);
    row = floor(row);
    vec2 ink = LABEL_INK[min(int(row), INK_ROWS - 1)];
    float m = 30.0;
    if (at.x < ink.x - m || at.x > ink.y + m || at.y < LABEL_BAND.x - m || at.y > LABEL_BAND.y + m) continue;
    float L = tL[i];
    float v = atlasAt(at, row, max(L, 0.0)) + 0.55 * atlasAt(at, row, min(L + log2(12.0 * K8), 4.5))
            + 0.6 * atlasAt(at, row, min(L + log2(4.0 * K8), 4.5));
    if (b.w >= MASKED_ROW - 0.5) v *= 1.0 - cov;
    marks += WARM * light * v;
  }
  vec4 head = u_sign[0];
  marks += heart(P, u_sign[1], head.z) + breath(P, u_sign[2], head.z) + sparks(P, u_sign[3], head.z);
  col += marks * (1.0 - fog);

  // The loop's seam: everything gives way to the dark.
  col = mix(bg, col, u_scene.z);
  // A soft shoulder where light piles up, then the edges melt into the page.
  vec3 over = 0.7 + 0.3 * (1.0 - exp(-(col - 0.7) / 0.3));
  col = mix(col, over, step(0.7, col));
  if (u_pose.w > 0.5) {
    float e = smoothstep(0.0, u_edges.x, v_uv.x) * smoothstep(0.0, u_edges.y, 1.0 - v_uv.x)
            * smoothstep(0.0, u_edges.z, 1.0 - v_uv.y) * smoothstep(0.0, u_edges.w, v_uv.y);
    col = mix(u_backdrop, col, e);
  }
  col += altimeter(P) * u_scene.z;
  col += (hash2(frag * 1.37 + 0.5, 0u) - 0.5) / 255.0;
  o = vec4(clamp(col, 0.0, 1.0), 1.0);
}
