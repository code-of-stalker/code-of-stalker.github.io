// The first pass, under the grass: each pixel's ray meets the sky, the
// ground or, inside their box, the chair and the seated person (distance
// fields). The ground is darker than the page inside the meadow, warm under
// the second ring in the clearing, bare and fogged beyond. The person and
// the chair are dark and matte with a cold rim. Over it all the two rings:
// the cold first one round the whole meadow, turning, its ticks and three
// bright runners going round; the warm second one round the person. It
// writes the depth of the person and the chair, so the grass behind them is
// hidden.
in vec2 v_uv;
out vec4 o;

float time;

// ---------- shapes (the same seated person and chair as «Фонарь»)
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
// A chair with a straight back.
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
vec2 box(vec3 ro, vec3 inv, vec3 lo, vec3 hi) {
  vec3 a = (lo - ro) * inv;
  vec3 b = (hi - ro) * inv;
  vec3 n = min(a, b);
  vec3 f = max(a, b);
  return vec2(max(max(n.x, n.y), max(n.z, 0.0)), min(min(f.x, f.y), f.z));
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
float grazing(vec3 rd) {
  return mix(1.0, min(1.0 / max(abs(rd.y), 1e-3), 3.5), 0.5);
}

// ---------- the rings
// The first ring: cold, a fine line and a soft glow, ticks on its outside
// and three bright runners with tails, all turning, so the turning always
// shows. q is the point on its plane from its centre.
vec3 outerRing(vec2 q, float r, float px) {
  float rr = length(q);
  float d = rr - r;
  float s = r / 1.35;
  if (abs(d) > 0.12 * s + 40.0 * px) return vec3(0.0);
  float a = (atan(q.y, q.x) + u_misc.x) / TAU;
  float minor = abs(fract(a * 144.0 + 0.5) - 0.5) / 144.0 * TAU * rr;
  float major = abs(fract(a * 12.0 + 0.5) - 0.5) / 12.0 * TAU * rr;
  float ticks = line(minor, 0.0022 * s, px) * between(d, 0.0, 0.03 * s, px)
              + line(major, 0.003 * s, px) * between(d, 0.0, 0.06 * s, px);
  // The runners: a head, and a tail behind it the way it has come.
  float ph = fract(a * 3.0);
  float head = min(ph, 1.0 - ph) / 3.0 * TAU * rr;
  float hw = max(0.011 * s, px);
  float run = exp(-(sq(head) + sq(d)) / sq(hw)) * 1.3
            + exp(-ph / 0.06) * line(d, 0.0055 * s, px) * 0.85;
  return u_cold * (line(d, 0.004 * s, px) * 0.95 + ticks * 0.5 + exp(-sq(d / (0.03 * s))) * 0.07)
       + mix(u_cold, u_pale, 0.45) * run;
}
// The second ring: warm, a fine line and a softer glow.
vec3 innerRing(float d, float px) {
  return u_warm * (line(d, 0.006, px) + 0.16 * exp(-sq(d / 0.05)));
}

// ---------- the world under the grass
float occlusion(vec3 p, vec3 n) {
  float a = (0.03 - solid(p + n * 0.03)) + 0.5 * (0.09 - solid(p + n * 0.09));
  return clamp(1.0 - 7.0 * a, 0.0, 1.0);
}
// The person and the chair: darker than the page, a cold rim, a little of
// the second ring's warmth from below.
vec3 dark(vec3 p, vec3 n, vec3 rd, float depth, float rimLight) {
  float fres = pow(1.0 - abs(dot(n, -rd)), 3.0);
  float ao = occlusion(p, n);
  vec3 c = -u_backdrop * depth * (1.0 - 0.25 * ao);
  c += u_cold * (rimLight * fres + 0.03 * max(n.y, 0.0) * ao);
  c += u_warm * 0.05 * u_misc.y * max(-n.y, 0.0) * exp(-max(p.y - 0.3, 0.0) / 0.3);
  return c;
}
// Low over the horizon a cold haze, darker above, a few faint stars.
vec3 sky(vec3 rd, float pixel) {
  float e = max(rd.y, 0.0);
  vec3 c = u_cold * 0.05 * exp(-e / 0.07) - u_backdrop * 0.35 * smoothstep(0.02, 0.5, e);
  vec2 m = vec2(atan(rd.z, rd.x), rd.y) * 90.0;
  vec2 cell = floor(m) + 4096.0;
  float h = hash2(cell, 7u);
  if (h > 0.985) {
    vec2 off = vec2(hash2(cell, 8u), hash2(cell, 9u)) - 0.5;
    float dpx = length(fract(m) - 0.5 - off * 0.6) / (90.0 * pixel * u_fwd.w);
    c += u_pale * (0.05 + 0.1 * hash2(cell, 10u)) * exp(-sq(dpx / 0.9)) * smoothstep(0.03, 0.15, e);
  }
  return c;
}
vec3 ground(vec2 xz, float dist) {
  float r = length(xz - FIELD.xy);
  float field = smoothstep(FIELD.z + 0.4, FIELD.z - 0.6, r);
  vec3 c = -u_backdrop * (0.12 + 0.3 * field * smoothstep(CLEARING * 0.8, CLEARING * 1.3, r));
  // the clearing, warm under the second ring
  float ri = length(xz - INNER.xz);
  c += u_warm * u_misc.y * (0.05 * exp(-sq((ri - INNER.w) / 0.18)) + 0.022 * smoothstep(INNER.w + 0.1, 0.0, ri));
  // darker under the person and the chair
  if (abs(xz.x) < 0.45 && xz.y > -0.4 && xz.y < 0.9) {
    float near = solid(vec3(xz.x, 0.015, xz.y));
    c -= u_backdrop * 0.3 * exp(-max(near, 0.0) / 0.035);
  }
  // the first ring's faint trace on the ground
  c += u_cold * 0.012 * exp(-sq((length(xz - OUTER.xz) - OUTER.w) / 0.4));
  return c;
}

void main() {
  vec2 frag = gl_FragCoord.xy;
  vec2 f = (frag / u_view.zw * 2.0 - 1.0) / u_view.xy;
  float pixel = 2.0 / (u_view.y * u_view.w);
  time = u_eye.w;
  vec3 ro = u_eye.xyz;
  vec3 rd = normalize(u_fwd.xyz + (u_right.xyz * f.x + u_up.xyz * f.y) * u_fwd.w);
  // The rings' planes at every pixel, before any branch, so a pixel's size
  // on them comes from its neighbours.
  float tsO = planeY(ro, rd, OUTER.y);
  vec2 qO = ro.xz + rd.xz * tsO - OUTER.xz;
  float pxO = clamp(length(fwidth(qO)), 1e-5, 2.0);
  float tsR = planeY(ro, rd, INNER.y);
  float dR = length(ro.xz + rd.xz * tsR - INNER.xz) - INNER.w;
  float pxR = clamp(fwidth(dR), 1e-5, 1.0);

  float tGround = rd.y < 0.0 ? -ro.y / rd.y : 1e9;
  int id = -1;
  float tHit = 1e9;
  float closest = 1e9;
  float tClosest = 1.0;
  vec2 b = box(ro, safeInv(rd), BOUNDS_FROM, BOUNDS_TO);
  if (b.x < b.y) {
    float t = b.x;
    float end = min(b.y, tGround);
    for (int i = 0; i < 100; i++) {
      vec3 p = ro + rd * t;
      float df = figure(p);
      float d = min(df, chair(p));
      if (df < closest) {
        closest = df;
        tClosest = t;
      }
      if (d < 0.0004 * max(t, 1.0)) {
        tHit = t;
        id = d == df ? 2 : 1;
        break;
      }
      t += d * 0.9;
      if (t > end) break;
    }
  }
  vec3 light;
  float depth = 1.0;
  if (id > 0) {
    vec3 p = ro + rd * tHit;
    light = id == 2 ? dark(p, figureNormal(p), rd, 0.6, 0.32) : dark(p, chairNormal(p), rd, 0.4, 0.16);
    depth = depthOf(tHit * dot(rd, u_fwd.xyz));
  } else if (tGround < 1e8) {
    tHit = tGround;
    vec3 p = ro + rd * tGround;
    light = ground(p.xz, tGround);
    // far off, the ground fades into the horizon's haze
    float fog = 1.0 - exp(-max(tGround - 9.0, 0.0) / 12.0);
    light = mix(light, sky(vec3(rd.x, 0.0, rd.z), pixel), fog);
  } else {
    light = sky(rd, pixel);
  }
  // a cold outline round the person where the ray passes close
  if (id != 2 && closest < 0.02) {
    float edge = max(closest, 0.0) / (pixel * tClosest);
    light += u_cold * 0.3 * exp(-edge * edge / 0.8);
  }
  // The rings, faint where the person or the chair is in front.
  if (tsO > 0.0) light += outerRing(qO, OUTER.w, pxO) * grazing(rd) * (tsO < tHit ? 1.0 : 0.15);
  if (tsR > 0.0) light += innerRing(dR, pxR) * u_misc.y * grazing(rd) * (tsR < tHit ? 1.0 : 0.15);
  // A soft shoulder where light piles up, then onto the page.
  vec3 over = 0.7 + 0.3 * (1.0 - exp(-(light - 0.7) / 0.3));
  vec3 c = mix(light, over, step(0.7, light)) * softEdge(frag);
  c = u_backdrop + c + (hash2(frag * 1.37 + 0.5, 0u) - 0.5) / 255.0;
  o = vec4(clamp(c, 0.0, 1.0), 1.0);
  gl_FragDepth = depth;
}
