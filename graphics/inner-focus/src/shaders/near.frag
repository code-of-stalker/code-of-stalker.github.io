// The near layer: the person on his chair (distance fields, the same as
// body.rs, in his own frame), the deck of the pier and its rail; the warm
// second ring round him and its runner; the warm signs of his inside (the
// thought over his head with its words, the heart, the wave in his belly,
// the sparks at his hands). Out: premultiplied, the light halved
// (ENCODE) so the glow keeps its head; surfaces cover (alpha), the glow
// only adds. The person's distance field is long and a shader compiler
// copies a function into every place that calls it, so the march and the
// normal each call it from one place, in loops that start at zero().

uniform vec4 u_inner0;   // the second ring: centre, radius
uniform vec4 u_inner1;   // the normal of its plane, its turn
uniform vec4 u_inner2;   // its first axis, its light
uniform vec4 u_innerRun; // its runner: frame x, y, depth along the view, light
uniform vec4 u_body;     // how far his shoulders are up
uniform vec4 u_sign[SIGN_SLOTS];
uniform sampler2D u_atlas; // the thought's words, one 128 px row a word

const vec2 INK[2] = LABEL_INK_LIST;

float dy;

// ---------- his frame
vec3 toLocal(vec3 p) {
  return vec3(YAW_SC.y * p.x - YAW_SC.x * p.z, p.y, YAW_SC.x * p.x + YAW_SC.y * p.z);
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
// One arm: the shoulder dy up, the elbow part of the way, the hand on the
// thigh.
float limb(vec3 p) {
  vec3 shoulder = SHOULDER + vec3(0.0, dy, 0.0);
  vec3 elbow = ELBOW + vec3(0.0, dy * ELBOW_FOLLOWS, 0.0);
  float a = sdRC(p, shoulder, elbow, 0.049, 0.04);
  a = smin(a, sdRC(p, elbow, WRIST, 0.039, 0.031), 0.03);
  return smin(a, sdEll(p - HAND_AT, HAND), 0.02);
}
float figure(vec3 p) {
  vec3 q = vec3(abs(p.x), p.y, p.z);
  float d = sdEll(p - vec3(0.0, 0.6, -0.035), vec3(0.165, 0.12, 0.128));
  d = smin(d, sdEll(p - vec3(0.0, 0.79, -0.045), vec3(0.142, 0.15, 0.094)), 0.07);
  d = smin(d, sdEll(p - vec3(0.0, 0.975, -0.04), vec3(0.172, 0.165, 0.118)), 0.07);
  float sy = 1.09 + dy;
  d = smin(d, sdCap(p, vec3(-0.165, sy, -0.055), vec3(0.165, sy, -0.055), 0.056), 0.07);
  d = smin(d, sdCap(p, vec3(0.0, 1.1, -0.045), vec3(0.0, 1.21, -0.035), 0.046), 0.04);
  d = smin(d, sdEll(p - vec3(0.0, 1.31, -0.02), vec3(0.091, 0.117, 0.104)), 0.045);
  float l = sdRC(q, vec3(0.1, 0.565, -0.01), vec3(0.112, 0.535, 0.43), 0.085, 0.057);
  l = smin(l, sdRC(q, vec3(0.114, 0.51, 0.445), vec3(0.116, 0.095, 0.47), 0.053, 0.036), 0.045);
  l = smin(l, sdRC(q, vec3(0.116, 0.06, 0.455), vec3(0.126, 0.036, 0.615), 0.04, 0.03), 0.03);
  d = smin(d, l, 0.05);
  return smin(d, limb(q), 0.028);
}
float chair(vec3 p) {
  vec3 q = vec3(abs(p.x), p.y, p.z);
  float d = sdBox(p - vec3(0.0, 0.457, 0.08), vec3(0.215, 0.018, 0.215)) - 0.006;
  d = min(d, sdBox(q - vec3(0.195, 0.222, 0.27), vec3(0.016, 0.222, 0.016)) - 0.003);
  d = min(d, sdBox(q - vec3(0.195, 0.5, -0.12), vec3(0.016, 0.5, 0.016)) - 0.003);
  d = min(d, sdBox(p - vec3(0.0, 0.83, -0.17), vec3(0.2, 0.13, 0.011)) - 0.004);
  return min(d, sdBox(p - vec3(0.0, 0.58, -0.12), vec3(0.2, 0.02, 0.012)) - 0.003);
}
// One of them by kind: 2 the person, 1 the chair, 3 both.
float shape(vec3 p, int kind) {
  float d = 1e9;
  if (kind != 1) d = figure(p);
  if (kind != 2) d = min(d, chair(p));
  return d;
}
// The normal at a hit on `kind` (four taps round it) and how open the
// place is (two taps out along the normal against both).
vec3 surface(vec3 p, int kind, out float ao) {
  vec3 n = vec3(0.0);
  float a = 0.0;
  for (int k = zero(); k < 6; k++) {
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
  ao = clamp(1.0 - 7.0 * a, 0.0, 1.0);
  return n;
}
// What stands on the deck: the chair's legs and his shins and feet.
float onDeck(vec3 p) {
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
vec2 box(vec3 ro, vec3 inv, vec3 lo, vec3 hi) {
  vec3 a = (lo - ro) * inv;
  vec3 b = (hi - ro) * inv;
  vec3 n = min(a, b);
  vec3 f = max(a, b);
  return vec2(max(max(n.x, n.y), max(n.z, 0.0)), min(min(f.x, f.y), f.z));
}
// The person and the chair along a ray (his frame), inside their box:
// where it hits (-1 for nothing), which (2 the person, 1 the chair), and how
// near it passes them.
float march(vec3 ro, vec3 rd, out int id, out float closest, out float tClosest) {
  id = -1;
  closest = 1e9;
  tClosest = 1.0;
  vec2 b = box(ro, safeInv(rd), BOUNDS_FROM, BOUNDS_TO);
  if (b.x >= b.y) return -1.0;
  float t = b.x;
  for (int i = zero(); i < 110; i++) {
    vec3 p = ro + rd * t;
    float df = figure(p);
    float d = min(df, chair(p));
    if (d < closest) {
      closest = d;
      tClosest = t;
    }
    if (d < 0.0004) {
      id = d == df ? 2 : 1;
      return t;
    }
    t += d * 0.9;
    if (t > b.y) break;
  }
  return -1.0;
}

// ---------- his inside: warm signs in the frame
float sdHeart(vec2 p) {
  p.x = abs(p.x);
  if (p.y + p.x > 1.0) return length(p - vec2(0.25, 0.75)) - 0.35355339;
  vec2 a = p - vec2(0.0, 1.0);
  vec2 b = p - 0.5 * max(p.x + p.y, 0.0);
  return sqrt(min(dot(a, a), dot(b, b))) * sign(p.x - p.y);
}
// The thought: a cloud (an ellipse with nine round puffs on its rim), its
// two small bubbles toward his head, and its word inside.
float thought(vec2 f, out float fill) {
  vec4 b = u_sign[1];
  fill = 0.0;
  if (b.w <= 0.002) return 0.0;
  float s = b.z;
  vec2 p = f - b.xy;
  float c = 0.0;
  if (abs(p.x) < 1.5 * s && abs(p.y) < 1.0 * s) {
    vec2 ab = vec2(s, 0.5 * s);
    float d = (length(p / ab) - 1.0) * 0.5 * s;
    for (int k = 0; k < 9; k++) {
      float a = TAU * (float(k) + 0.5) / 9.0;
      d = min(d, length(p - ab * vec2(cos(a), sin(a))) - 0.22 * s);
    }
    c = stroke(abs(d) / pixel, 1.25 * px800());
    fill = d < 0.0 ? 1.0 : 0.0;
    // The word, centred.
    float cap = 0.16 * s / pixel;
    float per = cap / LABEL_CAP;
    float lod = max(0.0, log2(1.0 / per));
    vec2 cf = fragOf(b.xy);
    vec2 frag = fragOf(f);
    float base = cf.y - 0.5 * cap;
    float ay = LABEL_BASE - (frag.y - base) / per;
    float ink = 0.0;
    if (ay > LABEL_BAND.x - 2.0 && ay < LABEL_BAND.y + 2.0) {
      for (int w = 0; w < 2; w++) {
        float light = w == 0 ? u_sign[3].x : u_sign[3].y;
        if (light <= 0.002) continue;
        vec2 span = INK[w];
        float ax = span.x + (frag.x - (cf.x - 0.5 * (span.y - span.x) * per)) / per;
        if (ax < span.x - 3.0 || ax > span.y + 3.0) continue;
        vec2 uv = vec2(ax, float(w) * 128.0 + ay) / ATLAS;
        ink = max(ink, textureLod(u_atlas, uv, lod).r * light);
      }
    }
    c += 1.1 * ink;
  }
  vec4 t = u_sign[2];
  float m = u_sign[0].z;
  float dt = min(abs(length(f - t.xy) - 0.0225 * m), abs(length(f - t.zw) - 0.015 * m));
  c += stroke(dt / pixel, 1.1 * px800());
  return c * b.w;
}
// The heart in his chest, beating, a ring leaving it at each beat.
float heart(vec2 f) {
  vec4 h = u_sign[4];
  if (h.w <= 0.002) return 0.0;
  vec2 p = f - h.xy;
  if (length(p) > 4.0 * h.z) return 0.0;
  float unit = 0.95 * h.z * (1.0 + 0.12 * u_sign[8].x);
  float d = sdHeart(p / unit + vec2(0.0, 0.55)) * unit;
  float c = stroke(abs(d) / pixel, 1.3 * px800());
  float ph = u_sign[8].z;
  float r = h.z * (0.9 + 1.6 * ph);
  c += 0.5 * sq(1.0 - ph) * stroke(abs(length(p) - r) / pixel, 1.0 * px800());
  return c * h.w;
}
// The wave in his belly, quieter as he eases.
float wave(vec2 f) {
  vec4 w = u_sign[5];
  if (w.w <= 0.002) return 0.0;
  vec2 p = f - w.xy;
  if (abs(p.x) > 1.3 * w.z || abs(p.y) > 0.6 * w.z) return 0.0;
  float hw = w.z;
  float amp = 0.2 * hw * (1.0 - 0.6 * u_sign[3].z);
  float u = clamp(p.x / hw, -1.0, 1.0);
  float env = sin(0.5 * 3.14159265 * (u + 1.0));
  float k = 1.5 * 3.14159265;
  float y = amp * env * sin(k * u + u_sign[8].y);
  float dydx = amp / hw * (0.5 * 3.14159265 * cos(0.5 * 3.14159265 * (u + 1.0)) * sin(k * u + u_sign[8].y)
                           + env * k * cos(k * u + u_sign[8].y));
  float d = length(vec2(p.x - u * hw, (p.y - y) / sqrt(1.0 + dydx * dydx)));
  return stroke(d / pixel, 1.2 * px800()) * w.w;
}
// Sparks at a hand: five small crosses, each twinkling.
float sparks(vec2 f, vec4 s, float seed) {
  if (s.w <= 0.002) return 0.0;
  vec2 p = f - s.xy;
  if (length(p) > 2.0 * s.z) return 0.0;
  const vec2 AT[5] = vec2[5](vec2(-1.1, 0.3), vec2(-0.4, 0.8), vec2(0.5, 0.6), vec2(1.1, -0.1), vec2(0.1, -0.6));
  float c = 0.0;
  for (int k = 0; k < 5; k++) {
    float r = hash1(float(k) + seed, 41u);
    vec2 q = abs(p - AT[k] * s.z);
    float arm = s.z * (0.18 + 0.2 * r);
    float d = min(length(vec2(max(q.x - arm, 0.0), q.y)), length(vec2(q.x, max(q.y - arm, 0.0))));
    float cycles = 17.0 + floor(r * 9.0);
    float tw = 0.35 + 0.65 * sq(0.5 + 0.5 * sin(TAU * cycles * time / LOOP_SECONDS + r * 40.0));
    c += stroke(d / pixel, 1.0 * px800()) * tw;
  }
  return c * s.w;
}

void main() {
  vec2 frag = gl_FragCoord.xy;
  setup(frag);
  dy = u_body.x;
  vec2 f = frameAt(frag);
  vec3 ro = u_eye.xyz;
  vec3 rd = rayAt(f);
  // Every plane at every pixel, so a pixel's size on each comes from its
  // neighbours: the deck, the rail, the second ring's plane.
  float tD = rd.y < -1e-5 ? -ro.y / rd.y : 1e9;
  vec3 pD = ro + rd * min(tD, 200.0);
  vec2 fwD = max(fwidth(pD.xz), vec2(1e-5));
  float tR = rd.x > 1e-5 ? (RAIL_X - ro.x) / rd.x : 1e9;
  vec3 pR = ro + rd * min(tR, 200.0);
  vec2 fwR = max(fwidth(pR.yz), vec2(1e-5));
  vec3 n2 = u_inner1.xyz;
  float dn = dot(rd, n2);
  float tI = dot(u_inner0.xyz - ro, n2) / (abs(dn) > 1e-6 ? dn : 1e-6);
  vec3 qI = ro + rd * tI - u_inner0.xyz;
  float dI = length(qI) - u_inner0.w;
  float pxI = max(fwidth(dI), 1e-6);

  // The person and the chair.
  vec3 roL = toLocal(ro);
  vec3 rdL = toLocal(rd);
  int id;
  float closest;
  float tClosest;
  float tB = march(roL, rdL, id, closest, tClosest);

  vec3 cityL = toLocal(normalize(vec3(1.0, 0.12, 0.25)));
  vec3 rim = mix(u_cold, u_pale, 0.4);
  vec3 col = vec3(0.0);
  float a = 0.0;
  float tHit = 1e9;
  // The deck, up to the rail.
  if (tD < 1e8 && pD.x < RAIL_X + fwD.x && abs(pD.z) < PIER_HALF + fwD.y) {
    float k = cover(pD.x, -1e3, RAIL_X, fwD.x) * cover(pD.z, -PIER_HALF, PIER_HALF, fwD.y);
    float u = pD.z / 0.14;
    float e = min(fract(u), 1.0 - fract(u)) * 0.14;
    float seam = (1.0 - smoothstep(0.004, 0.004 + fwD.y, e)) * (1.0 - smoothstep(0.03, 0.09, fwD.y));
    float plank = 0.85 + 0.15 * vnoise2(vec2(floor(u) * 7.3, pD.x * 1.4)) - 0.35 * seam;
    vec3 deck = bg * 0.38 * plank + u_cold * 0.03 * smoothstep(-1.5, RAIL_X, pD.x);
    deck *= 1.0 - 0.5 * exp(-length(pD.xz) / 0.45);
    vec3 pl = toLocal(pD);
    if (abs(pl.x) < 0.45 && pl.z > -0.4 && pl.z < 0.9) {
      deck *= 1.0 - 0.6 * exp(-max(onDeck(vec3(pl.x, 0.015, pl.z)), 0.0) / 0.035);
    }
    col = deck * k;
    a = k;
    tHit = tD;
  }
  // The rail: a bar on posts, a lower bar; under the deck's edge its end
  // beam.
  if (tR < tHit && pR.y < 1.03 && pR.y > -0.16 && abs(pR.z) < PIER_HALF) {
    float post = cover(abs(fract(pR.z / 1.3) - 0.5) * 1.3, -1.0, 0.022, fwR.y) * cover(pR.y, 0.0, 1.0, fwR.x);
    float bars = max(cover(pR.y, 0.96, 1.01, fwR.x), cover(pR.y, 0.48, 0.505, fwR.x));
    float beam = cover(pR.y, -0.15, 0.0, fwR.x);
    float k = max(max(post, bars), beam);
    if (k > 0.0) {
      vec3 rail = bg * 0.3 + u_cold * 0.06 * (0.5 + 0.5 * cover(pR.y, 0.995, 1.01, fwR.x));
      rail = mix(rail, bg * 0.32 * (0.85 + 0.15 * vnoise2(vec2(pR.z * 3.0, 1.0))), beam);
      col = mix(col, rail, k);
      a = mix(a, 1.0, k);
      if (k > 0.5) tHit = tR;
    }
  }
  // Him, and a soft edge round him from how near the way passes.
  float heartGlow = u_sign[4].w * (0.4 + 0.6 * u_sign[8].x);
  if (tB > 0.0) {
    vec3 hp = roL + rdL * tB;
    float ao;
    vec3 n = surface(hp, id, ao);
    float fr = pow(1.0 - abs(dot(n, rdL)), 3.0);
    float lit = dot(n, cityL);
    vec3 c = bg * 0.42 * (0.6 + 0.4 * ao) + rim * 0.34 * fr * smoothstep(-0.3, 0.5, lit) + u_pale * 0.05 * max(lit, 0.0) * ao;
    if (id == 1) {
      c *= 0.8;
    } else {
      vec3 pk = hp - CHEST;
      c += u_warm * 0.08 * heartGlow * ao * exp(-dot(pk, pk) / 0.03);
    }
    // The band of warmth where the second ring passes.
    vec3 hw = ro + rd * tB;
    c += u_warm * 0.25 * u_inner2.w * exp(-sq(dot(hw - u_inner0.xyz, n2) / 0.025));
    col = c;
    a = 1.0;
    tHit = tB;
  } else if (closest < 0.05) {
    float e = max(closest, 0.0) / (pxA * tClosest);
    float k = 1.0 - smoothstep(0.0, 1.5, e);
    col = mix(col, bg * 0.42 + rim * 0.3, k);
    a = mix(a, 1.0, k);
  }

  // The second ring, faint where something near is in front of it, a
  // little less on its far side; its runner and the tail behind it.
  vec3 glow = vec3(0.0);
  if (tI > 0.0) {
    float dpx = dI / pxI;
    vec3 ax = u_inner2.xyz;
    float ang = atan(dot(qI, cross(n2, ax)), dot(qI, ax));
    float behind = fract((u_inner1.w - ang) / TAU);
    float tail = exp(-behind * TAU / 0.7);
    float k = (tI < tHit ? 1.0 : 0.12) * (dot(qI, u_fwd.xyz) > 0.0 ? 0.7 : 1.0);
    glow += u_warm * u_inner2.w * k * (line(dpx, 1.2 * px800()) * (0.8 + 0.7 * tail) + 0.12 * exp(-sq(dpx / (7.0 * px800()))));
  }
  if (u_innerRun.w > 0.0) {
    float d = length(f - u_innerRun.xy) / pixel / px800();
    float k = tHit * dot(rd, u_fwd.xyz) < u_innerRun.z - 0.02 ? 0.12 : 1.0;
    glow += mix(u_warm, u_pale, 0.35) * u_innerRun.w * k * (1.3 * exp(-sq(d / 3.2)) + 0.3 * exp(-d / 12.0));
  }
  // His inside.
  float fill;
  float s = thought(f, fill) + heart(f) + wave(f) + sparks(f, u_sign[6], 0.0) + sparks(f, u_sign[7], 9.0);
  glow += u_warm * (s + 0.04 * fill * u_sign[1].w);

  col += glow;
  col += (hash2(frag * 1.37 + 0.5, 0u) - 0.5) / 255.0 * a;
  o = vec4(clamp(col * ENCODE, 0.0, 1.0), clamp(a, 0.0, 1.0));
}
