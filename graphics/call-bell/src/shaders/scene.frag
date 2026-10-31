// The tower, the bell and its clapper, seen through the lens: one ray per
// pixel. The dimensions are prepended from lib.rs. Out: the color, the
// signed size of the blur circle (alpha, 0.5 = sharp) for the finishing
// pass, and the depth the threads, rings and dust are tested against.
uniform vec2 u_res;
uniform vec3 u_eye;
uniform vec4 u_view;    // target xyz, zoom
uniform vec2 u_lens;    // focus distance, aperture (blur px per unit of defocus)
uniform vec4 u_bell;    // sway, clapper, tremor azimuth, tremor strength
uniform vec3 u_strike;  // age, side (z), flash
uniform vec3 u_light3;  // flood front, flood strength, window light
uniform vec3 u_paper;
uniform vec3 u_key;     // the strike and the flood
uniform vec3 u_fill;    // the window
uniform float u_glow;   // light pages: a quiet light from the mouth
in vec2 v_uv;
out vec4 o;

float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
vec3 rotX(vec3 p, float a) {
  float s = sin(a), c = cos(a);
  return vec3(p.x, p.y * c - p.z * s, p.y * s + p.z * c);
}

// The bell's profile, mirrored from lib.rs.
float radius(float h) {
  float k = 1.0 - clamp(h, 0.0, 1.0);
  float k3 = k * k * k, k6 = k3 * k3;
  return 0.56 + 0.1 * k + 0.3 * k3 + 0.06 * k6 * k6;
}
float thick(float h) { return 0.045 + 0.07 * (1.0 - smoothstep(0.03, 0.25, h)); }
// Cast rings round the waist and the sound bow.
float ridges(float h) {
  return 0.012 * (exp(-pow((h - 0.84) / 0.012, 2.0)) + exp(-pow((h - 0.88) / 0.012, 2.0))
       + exp(-pow((h - 0.2) / 0.015, 2.0)));
}
float ellipsoid(vec3 p, vec3 r) {
  float k0 = length(p / r), k1 = length(p / (r * r));
  return k0 * (k0 - 1.0) / k1;
}
float capsule(vec3 p, float a, float b, float r) {
  // along y, from a down to b
  return length(vec3(p.x, p.y - clamp(p.y, b, a), p.z)) - r;
}
float box(vec3 p, vec3 b) {
  vec3 q = abs(p) - b;
  return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
}

// In the bell's frame: 1 the bell, 2 the clapper.
float g_part;
float bellSdf(vec3 q) {
  float y = q.y - LIP;
  float h = y / BELL_H;
  float rho = length(q.xz);
  float r = radius(h) + ridges(h);
  float th = thick(h);
  float shell = (abs(rho - (r - 0.5 * th)) - 0.5 * th) * 0.6;
  // the lip is rounded off, not cut
  shell = max(shell, -y + 0.02 * (1.0 - smoothstep(0.0, 0.5 * th, abs(rho - (r - 0.5 * th)))));
  shell = max(shell, y - BELL_H);
  vec3 c = q - vec3(0.0, LIP + BELL_H, 0.0);
  float dome = max(max(ellipsoid(c, vec3(0.56, 0.24, 0.56)), -ellipsoid(c, vec3(0.5, 0.18, 0.5))), -c.y);
  float stem = box(q - vec3(0.0, -0.12, 0.0), vec3(0.1, 0.13, 0.08)) - 0.01;
  float d = min(min(shell, dome), stem);
  vec3 k = rotX(q - vec3(0.0, CLAPPER_PIVOT, 0.0), -u_bell.y);
  float rod = capsule(k, 0.0, -CLAPPER_ROD, 0.035);
  float ball = length(k - vec3(0.0, -CLAPPER_ROD, 0.0)) - BALL;
  float flight = capsule(k, -CLAPPER_ROD, -CLAPPER_ROD - 0.26, 0.05);
  float clapper = min(min(rod, ball), flight);
  g_part = clapper < d ? 2.0 : 1.0;
  return min(d, clapper);
}
vec3 local(vec3 p) { return rotX(p - PIVOT, -u_bell.x); }

// Leaving the tower from inside: distance, normal (faces, floor, the dark above).
float tower(vec3 e, vec3 d, out vec3 n) {
  float far = 1e4;
  n = vec3(0.0, 1.0, 0.0);
  for (int k = 0; k < 8; k++) {
    float a = float(k) * 0.78539816;
    vec3 f = vec3(cos(a), 0.0, sin(a));
    float dn = dot(d, f);
    if (dn > 1e-4) {
      float t = (APOTHEM - dot(e, f)) / dn;
      if (t < far) { far = t; n = -f; }
    }
  }
  if (d.y < -1e-4) {
    float t = -e.y / d.y;
    if (t < far) { far = t; n = vec3(0.0, 1.0, 0.0); }
  }
  if (d.y > 1e-4) {
    float t = (CEILING - e.y) / d.y;
    if (t < far) { far = t; n = vec3(0.0, -1.0, 0.0); }
  }
  return far;
}
// The yoke: a beam across the tower at the pivot.
float beam(vec3 e, vec3 d, out vec3 n) {
  vec3 b = vec3(APOTHEM, 0.22, 0.2);
  vec3 inv = 1.0 / d;
  vec3 t0 = (PIVOT - b - e) * inv, t1 = (PIVOT + b - e) * inv;
  vec3 lo = min(t0, t1), hi = max(t0, t1);
  float tn = max(max(lo.x, lo.y), lo.z), tf = min(min(hi.x, hi.y), hi.z);
  if (tn > tf || tn < 0.0) return -1.0;
  n = -sign(d) * step(lo.yzx, lo) * step(lo.zxy, lo);
  return tn;
}

// How much of the window's light a point stands in.
float shaftAt(vec3 p) {
  vec3 axis = SHAFT_TO - WINDOW;
  float u = clamp(dot(p - WINDOW, axis) / dot(axis, axis), 0.0, 1.0);
  vec3 q = p - (WINDOW + axis * u);
  return exp(-dot(q, q) / (SHAFT_WIDTH * SHAFT_WIDTH));
}
// The light of the strike climbing the tower.
float floodAt(vec3 p) {
  return u_light3.y * smoothstep(u_light3.x, u_light3.x - 1.6, p.y);
}
// The arched slit of the window, on its face.
float windowGlow(vec3 p) {
  vec3 t = normalize(vec3(-WINDOW.z, 0.0, WINDOW.x));
  float u = dot(p - WINDOW, t);
  float y = p.y;
  float top = WINDOW.y + 0.46;
  float inside = step(abs(u), 0.14) * step(WINDOW.y - 0.7, y)
               * max(step(y, top), step(length(vec2(u, y - top)), 0.14));
  vec2 c = vec2(u, clamp(y, WINDOW.y - 0.7, top) - y);
  return inside * 1.3 + 0.2 * exp(-dot(c, c) / 0.2);
}

// The light falling on a point with this normal (the bell's frame aside).
vec3 lit(vec3 p, vec3 n, vec3 v, float shine, float sheen) {
  vec3 rad = u_fill * 0.012;
  // the window: a cold light from high up, strongest in its shaft
  vec3 toW = WINDOW - p;
  float dw = length(toW);
  vec3 lw = toW / dw;
  float w = u_light3.z * (0.55 / (1.0 + 0.04 * dw * dw));
  vec3 ls = normalize(WINDOW - SHAFT_TO);
  float s = u_light3.z * 1.6 * shaftAt(p);
  rad += u_fill * (w * max(dot(n, lw), 0.0) + s * max(dot(n, ls), 0.0));
  rad += u_fill * shine * (w * 3.0 * pow(max(dot(n, normalize(lw + v)), 0.0), sheen)
                        + s * 2.0 * pow(max(dot(n, normalize(ls + v)), 0.0), sheen));
  // the window's patch on the floor throws a little light back up
  vec3 tp = SHAFT_TO + vec3(0.0, 0.15, 0.0) - p;
  float dp = length(tp);
  rad += u_fill * u_light3.z * 0.3 * (0.2 + max(dot(n, tp / dp), 0.0)) / (1.0 + 0.5 * dp * dp);
  // the flood, from the mouth of the bell outwards and up
  float f = floodAt(p) + u_glow;
  if (f > 0.0) {
    vec3 lf = normalize(PIVOT + vec3(0.0, LIP, 0.0) - p);
    rad += u_key * f * (0.3 + 0.7 * max(dot(n, lf), 0.0));
    rad += u_key * f * shine * 1.5 * pow(max(dot(n, normalize(lf + v)), 0.0), sheen);
  }
  // the strike: a flash at the clapper's ball
  if (u_strike.z > 0.003) {
    vec3 b = PIVOT + rotX(vec3(0.0, CLAPPER_PIVOT, 0.0) + rotX(vec3(0.0, -CLAPPER_ROD, 0.0), u_bell.y), u_bell.x);
    vec3 tb = b - p;
    float db = length(tb);
    rad += u_key * u_strike.z * 5.0 * (0.25 + max(dot(n, tb / db), 0.0)) / (1.0 + 5.0 * db * db);
  }
  return rad;
}

// Stone blocks with mortar, in a face's own coordinates.
float stone(vec2 u, out float mortar) {
  vec2 b = vec2(0.9, 0.42);
  float row = floor(u.y / b.y);
  vec2 c = vec2(u.x / b.x + 0.5 * mod(row, 2.0), u.y / b.y);
  vec2 f = fract(c);
  vec2 edge = min(f, 1.0 - f) * b;
  mortar = 1.0 - smoothstep(0.008, 0.022, min(edge.x, edge.y));
  vec2 id = floor(c);
  return 0.75 + 0.5 * hash(id) + 0.25 * noise(u * 9.0) - 0.15 * noise(u * 31.0);
}

void main() {
  vec2 uv = (v_uv - 0.5) * vec2(u_res.x / u_res.y, 1.0);
  vec3 fw = normalize(u_view.xyz - u_eye);
  vec3 rt = normalize(cross(fw, vec3(0.0, 1.0, 0.0)));
  vec3 up = cross(rt, fw);
  vec3 d = normalize(fw * u_view.w + rt * uv.x + up * uv.y);
  vec3 e = u_eye;

  vec3 n;
  float hit = tower(e, d, n);
  float part = 0.0; // 0 tower, 1 bell, 2 clapper, 3 beam
  vec3 nb;
  float tb = beam(e, d, nb);
  if (tb > 0.0 && tb < hit) { hit = tb; n = nb; part = 3.0; }

  // The bell, marched in its own frame inside its box.
  vec3 le = local(e), ld = rotX(d, -u_bell.x);
  vec3 lo = vec3(-1.12, LIP - 0.42, -1.12), hi = vec3(1.12, 0.05, 1.12);
  vec3 inv = 1.0 / ld;
  vec3 t0 = (lo - le) * inv, t1 = (hi - le) * inv;
  vec3 a = min(t0, t1), b = max(t0, t1);
  float tn = max(max(max(a.x, a.y), a.z), 0.0), tf = min(min(min(b.x, b.y), b.z), hit);
  if (tn < tf) {
    float t = tn;
    for (int i = 0; i < 140; i++) {
      float s = bellSdf(le + ld * t);
      if (s < 0.0005 * t) { hit = t; part = g_part; break; }
      t += s;
      if (t > tf) break;
    }
  }

  vec3 p = e + d * hit;
  vec3 v = -d;
  vec3 rad = vec3(0.0);
  if (part == 1.0 || part == 2.0) {
    vec3 q = le + ld * hit;
    float s = 0.001;
    vec3 ln = normalize(vec3(
      bellSdf(q + vec3(s, 0, 0)) - bellSdf(q - vec3(s, 0, 0)),
      bellSdf(q + vec3(0, s, 0)) - bellSdf(q - vec3(0, s, 0)),
      bellSdf(q + vec3(0, 0, s)) - bellSdf(q - vec3(0, 0, s))));
    n = rotX(ln, u_bell.x);
    float h = (q.y - LIP) / BELL_H;
    float az = atan(q.z, q.x);
    // inside the mouth is darker; the outer face carries the patina
    float inner = step(dot(ln.xz, q.xz), 0.0) * step(h, 1.0) * step(part, 1.5);
    float patina = noise(vec2(az * 5.0, h * 9.0)) * 0.6 + noise(vec2(az * 23.0, h * 41.0)) * 0.4;
    vec3 bronze = mix(vec3(0.16), u_key * 0.35, 0.6) * (0.7 + 0.5 * patina) * (1.0 - 0.4 * inner);
    if (part == 2.0) bronze = vec3(0.1);
    vec3 light = lit(p, n, v, 1.0 - 0.6 * inner, 26.0 + 30.0 * patina);
    rad = bronze * light * 2.2;
    // the dark it reflects: the window and, once lit, the tower below
    vec3 r = reflect(d, n);
    rad += u_fill * u_light3.z * 0.05 * pow(max(dot(r, normalize(WINDOW - p)), 0.0), 40.0);
    rad += u_key * u_light3.y * 0.35 * smoothstep(0.2, -0.6, r.y);
    // the edge catches what light there is
    rad += u_fill * 0.035 * pow(1.0 - abs(dot(n, v)), 4.0) * (1.0 - inner);
    if (part == 1.0 && inner < 0.5) {
      // the tremor runs once round the rim
      float da = mod(az - u_bell.z + 3.14159265, 6.2831853) - 3.14159265;
      float run = exp(-da * da / 0.012) + 0.35 * exp(3.0 * min(da, 0.0)) * step(da, 0.0);
      rad += mix(u_fill, u_key, 0.5) * 1.4 * u_bell.w * run * (1.0 - smoothstep(0.02, 0.16, h));
      // after a strike the sound runs down the body to the lip
      float age = u_strike.x;
      if (age < 4.0) {
        float band = 0.5 + 0.5 * sin(h * 34.0 + age * 26.0);
        rad += u_key * 0.35 * exp(-age / 1.2) * pow(band, 6.0) * (0.4 + 0.6 * smoothstep(0.6, 0.0, h));
      }
    }
  } else if (part == 3.0) {
    float grain = noise(vec2(p.x * 3.0, p.y * 40.0)) * 0.5 + 0.75;
    rad = vec3(0.1) * grain * lit(p, n, v, 0.1, 8.0);
  } else {
    float mortar = 0.0;
    float albedo;
    if (abs(n.y) > 0.5) {
      // floor slabs; the dark overhead is only lit by the flood's last reach
      albedo = n.y > 0.0 ? stone(p.xz * 1.4, mortar) * 0.14 : 0.04;
    } else {
      vec3 t = vec3(-n.z, 0.0, n.x);
      albedo = stone(vec2(dot(p, t), p.y), mortar) * 0.16;
      n = normalize(n + (vec3(noise(p.xy * 11.0), 0.0, noise(p.zy * 11.0)) - 0.5) * 0.12);
    }
    albedo *= 1.0 - 0.7 * mortar;
    rad = vec3(albedo) * lit(p, n, v, 0.05, 6.0);
    if (dot(n, normalize(vec3(WINDOW.x, 0.0, WINDOW.z))) < -0.9) rad += u_fill * u_light3.z * windowGlow(p);
  }
  // The window's light hangs in the dust of the air.
  vec3 axis = SHAFT_TO - WINDOW;
  vec3 w0 = e - WINDOW;
  float A = dot(d, d), B = dot(d, axis), C = dot(axis, axis), D = dot(d, w0), E = dot(axis, w0);
  float den = max(A * C - B * B, 1e-5);
  float sr = clamp((B * E - C * D) / den, 0.0, hit);
  float sa = clamp((sr * B + E) / C, 0.0, 1.0);
  vec3 gap = e + d * sr - (WINDOW + axis * sa);
  float beamLight = exp(-dot(gap, gap) / (SHAFT_WIDTH * SHAFT_WIDTH * 2.2)) * (0.4 + 0.6 * sa);
  rad += u_fill * u_light3.z * 0.18 * beamLight;
  // and the flood in the whole air of the tower
  rad += u_key * u_light3.y * 0.025 * min(hit, 6.0) * smoothstep(u_light3.x, u_light3.x - 3.0, min(p.y, e.y + 1.0));

  vec3 col = 1.0 - (1.0 - u_paper) * exp(-rad * 1.3);
  float z = dot(p - e, fw);
  float coc = clamp(u_lens.y * (z - u_lens.x) / max(z, 0.01), -22.0, 22.0);
  gl_FragDepth = clamp(z / FAR, 0.0, 1.0);
  o = vec4(col, 0.5 + coc / 44.0);
}
