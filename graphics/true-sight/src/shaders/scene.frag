// One human eye in macro, seen from the front: the skin of the lid and the
// brow as a lit height field, the lashes, and in the opening the eyeball,
// the iris, the pupil and the world on the cornea. Each pixel is a point of
// the face's frontal plane (cm); the dark is the paper and everything else
// is the key light on it. On a light page the browser passes black paper
// and white light, and the finish lays that light on the page in ink. The
// constants above come from lib.rs.
uniform vec2 u_res;       // target px
uniform vec3 u_cam;       // the lens's centre (cm) and half the frame's height
uniform vec4 u_eye;       // open, gaze x, gaze y, pupil radius
uniform vec4 u_state;     // dreams, their flicker, the world on the cornea, focus
uniform vec3 u_light;     // key light, the loop's angle, the skin's least light
uniform vec3 u_paper;
uniform vec3 u_key;
uniform vec3 u_fill;
uniform vec3 u_warm;      // the skin's warmth over the key light
in vec2 v_uv;
out vec4 o;

const float PI = 3.14159265;
// The eye's corners: the inner by the nose (left), the outer a little higher.
const vec2 INNER = vec2(-1.5, EYE_Y - 0.215);
const vec2 OUTER = vec2(1.45, EYE_Y - 0.085);
// The eyeball's radius.
const float BALL = 1.22;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
// Value noise that wraps every `period` cells across x: the iris's angle.
float ring(vec2 p, float period) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float i0 = mod(i.x, period), i1 = mod(i.x + 1.0, period);
  return mix(mix(hash(vec2(i0, i.y)), hash(vec2(i1, i.y)), u.x),
             mix(hash(vec2(i0, i.y + 1.0)), hash(vec2(i1, i.y + 1.0)), u.x), u.y);
}
float capsule(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h);
}
// Where p lies across the eye, -1 at the inner corner to 1 at the outer.
float across(float x) {
  return clamp((x - 0.5 * (INNER.x + OUTER.x)) / (0.5 * (OUTER.x - INNER.x)), -1.0, 1.0);
}
// The line from corner to corner, where the lids meet when shut.
float seam(float x) {
  float s = across(x);
  return mix(INNER.y, OUTER.y, 0.5 + 0.5 * s) - 0.12 * (1.0 - s * s);
}
float upperLid(float x) {
  float s = across(x), w = 1.0 - s * s;
  return seam(x) + u_eye.x * 0.72 * pow(w, 0.75) * (1.0 - 0.12 * s);
}
float lowerLid(float x) {
  float s = across(x), w = 1.0 - s * s;
  return seam(x) - u_eye.x * 0.26 * pow(w, 0.9) * (1.0 + 0.15 * s);
}
vec2 gazeAt() { return vec2(u_eye.y, EYE_Y + u_eye.z); }

// The skin's height over the frontal plane (cm): the eyeball's dome under
// the lid with the cornea's bump where the eye looks, the lid's crease, the
// brow's ridge, the cheek and the side of the nose.
float skin(vec2 p) {
  // The eyeball pushes the lid out softly, wider than tall.
  vec2 b = (p - vec2(0.0, EYE_Y)) / vec2(1.3, 1.0);
  float dome = 1.1 * exp(-dot(b, b) / 0.7);
  vec2 c = p - gazeAt();
  float cornea = 0.1 * exp(-dot(c, c) / 0.28) * (1.0 - u_eye.x);
  float w2 = exp(-pow(p.x / 1.5, 4.0));
  float creaseY = seam(p.x) + mix(0.98, 0.8, u_eye.x) * pow(w2, 0.6) + 0.12;
  float dc = (p.y - creaseY) / mix(0.08, 0.05, u_eye.x);
  float crease = -mix(0.035, 0.07, u_eye.x) * exp(-dc * dc) * w2;
  // Open, the lid folds under the crease: the skin above it overhangs.
  float fold = 0.04 * u_eye.x * smoothstep(-0.4, 0.6, dc) * w2;
  float browY = EYE_Y + 1.55 + 0.28 * exp(-pow(p.x / 1.9, 2.0));
  float brow = 0.42 * exp(-pow((p.y - browY) / 0.55, 2.0));
  float cheek = 0.3 * exp(-pow((p.y - EYE_Y + 1.55) / 0.75, 2.0)) * smoothstep(-2.6, -0.6, p.x);
  float nose = 0.6 * exp(-pow((p.x + 3.3) / 1.1, 2.0)) * smoothstep(EYE_Y + 2.4, EYE_Y - 0.6, p.y);
  float bag = 0.025 * exp(-pow((p.y - lowerLid(p.x) + 0.2) / 0.1, 2.0)) * w2;
  return 0.5 * dome + cornea + crease + fold + brow + cheek + nose + bag;
}
// Fine lines of the lid's skin, running along the lid, and its pores.
float grain(vec2 p) {
  float lid = smoothstep(0.0, 0.08, p.y - seam(p.x)) * (1.0 - smoothstep(0.7, 1.2, p.y - seam(p.x)));
  float lines = noise(vec2(p.x * 6.0, (p.y - seam(p.x)) * 70.0 + 3.0 * noise(p * 3.0)));
  float along = exp(-pow(p.x / 1.7, 4.0));
  return 0.003 * lines * lid * along + 0.0015 * noise(p * 60.0);
}

// The dreams: soft lights drifting behind the lid, seen through its skin.
vec3 dreams(vec2 p) {
  float a = u_light.y, stir = u_state.y;
  vec3 sum = vec3(0.0);
  for (int i = 0; i < 4; i++) {
    float f = float(i);
    vec2 at = vec2(0.5 * sin(CYCLES[i] * a + 1.7 * f) - 0.05 + 0.2 * sin(CYCLES[(i + 1) % 4] * a + f),
                   EYE_Y + 0.12 + 0.2 * sin(CYCLES[(i + 2) % 4] * a + 2.3 * f));
    vec2 d = (p - at) / vec2(0.42, 0.26);
    float flick = 1.0 - stir * (0.5 + 0.5 * sin(CYCLES.w * a * (1.0 + 0.37 * f) + 4.1 * f));
    vec3 tone = (i % 2 == 0) ? u_fill : mix(u_key, u_fill, 0.4);
    sum += tone * exp(-dot(d, d)) * (0.45 + 0.55 * flick);
  }
  return sum;
}

// The world on the cornea, seen in a convex mirror: the sky, the low sun,
// two lines of hills and the ground. `c` runs across the iris (-1..1); the
// edges are as soft as the focus allows.
vec3 world(vec2 c) {
  float soft = mix(0.16, 0.012, u_state.w);
  vec2 w = c * (1.0 + 0.55 * dot(c, c));
  float horizon = -0.08 - 0.22 * w.x * w.x;
  float sky = smoothstep(horizon - soft, horizon + soft, w.y);
  float far = horizon + 0.07 + 0.05 * sin(w.x * 6.0 + 1.0) + 0.03 * sin(w.x * 13.0);
  float near = horizon + 0.02 + 0.06 * sin(w.x * 4.0 - 0.6) + 0.02 * sin(w.x * 17.0 + 2.0);
  float farHills = smoothstep(far + soft, far - soft, w.y);
  float nearHills = smoothstep(near + soft, near - soft, w.y);
  vec2 sun = w - vec2(0.38, horizon + 0.2);
  float disc = smoothstep(0.08 + soft, 0.08 - soft, length(sun));
  float glow = exp(-length(sun) / 0.22);
  vec3 col = u_key * (0.42 + 0.5 * clamp(w.y - horizon, 0.0, 1.0)) * sky;
  col += u_key * (0.9 * disc + 0.35 * glow) * (1.0 - nearHills);
  col *= 1.0 - 0.6 * farHills;
  col *= 1.0 - 0.9 * nearHills;
  return col * sky;
}

// The eye inside the opening: the white, the iris, the pupil, the world on
// the cornea and the window of the light.
vec3 eyeball(vec2 p, float px) {
  vec2 b = (p - vec2(0.0, EYE_Y)) / BALL;
  float z = sqrt(max(1.0 - dot(b, b), 0.0));
  float s = across(p.x), w = 1.0 - s * s;
  // The upper lid and its lashes shade the top of the eye.
  float lidShade = 0.3 + 0.7 * smoothstep(0.0, 0.26, upperLid(p.x) - p.y);
  float white = (0.18 + 0.32 * z) * (0.35 + 0.65 * w);
  vec3 col = u_key * white * lidShade * mix(1.0, 0.9, smoothstep(0.0, 1.0, -b.x));

  vec2 d = p - gazeAt();
  float r = length(d);
  float rp = u_eye.w;
  float sharp = mix(0.55, 1.0, u_state.w);
  if (r < IRIS_R + 0.05) {
    float t = clamp((r - rp) / (IRIS_R - rp), 0.0, 1.0);
    float ang = (atan(d.y, d.x) / (2.0 * PI) + 0.5) * 64.0;
    float fibres = ring(vec2(ang, t * 3.0), 64.0);
    float fine = ring(vec2(ang * 3.0, t * 9.0), 192.0);
    float crypt = smoothstep(0.62, 0.78, ring(vec2(ang * 0.5, t * 4.0 + 7.0), 32.0)) * (1.0 - smoothstep(0.4, 0.8, t));
    float collar = exp(-pow((t - 0.32 - 0.04 * sin(ang * 0.6)) / 0.06, 2.0));
    float tex = 0.55 + (0.5 * fibres + 0.3 * fine - 0.25) * sharp - 0.35 * crypt * sharp;
    // The cornea gathers the light into the iris's lower half.
    float under = 0.55 + 0.45 * smoothstep(0.4, -0.7, d.y / IRIS_R);
    vec3 iris = u_fill * (0.16 + 0.42 * tex) * under + u_fill * 0.18 * collar
              + u_key * 0.1 * (1.0 - smoothstep(0.0, 0.35, t));
    iris *= 1.0 - 0.7 * smoothstep(0.8, 1.0, r / IRIS_R);
    float inIris = 1.0 - smoothstep(IRIS_R - px, IRIS_R + px * 2.0, r);
    col = mix(col, iris * lidShade, inIris);
    float inPupil = 1.0 - smoothstep(rp - px, rp + px, r);
    col = mix(col, u_paper * 0.25, inPupil);

    // The world on the cornea, plainest over the dark pupil.
    vec2 c = d / IRIS_R;
    float on = (1.0 - smoothstep(0.96, 1.04, r / IRIS_R)) * u_state.z;
    float over = mix(0.45, 0.9, inPupil) * (0.75 + 0.25 * dot(c, c));
    col += world(c) * on * over;
  }
  // The light's own glint, small and soft, up and to the left.
  vec2 win = (d - vec2(-0.21, 0.24)) / vec2(0.055, 0.065);
  float pane = exp(-pow(dot(win, win), 2.0));
  col += u_key * 0.6 * pane * smoothstep(0.3, 0.8, u_eye.x);
  return col;
}

// How much of p the lashes cover: two loose rows on the upper lid that
// hang down while it is shut and stand up and out when it opens, each lash
// its own length, lean and curl, thinning to its tip; a few short ones below.
float lashes(vec2 p, float px) {
  float cover = 0.0;
  float up = smoothstep(0.0, 1.0, u_eye.x);
  float down = cos(PI * up);
  for (int row = 0; row < 2; row++) {
    float gap = row == 0 ? 0.06 : 0.085, shift = float(row) * 0.031;
    float k = floor((p.x - INNER.x - shift) / gap);
    for (int j = -6; j <= 6; j++) {
      float i = k + float(j);
      float h = hash(vec2(i, float(row) * 7.0 + 1.0));
      float h2 = hash(vec2(i * 1.7 + 3.0, float(row) + 11.0));
      float x = INNER.x + shift + (i + 0.5) * gap + 0.025 * (h2 - 0.5);
      float s = (x - 0.5 * (INNER.x + OUTER.x)) / (0.5 * (OUTER.x - INNER.x));
      if (s < -0.82 || s > 0.96) continue;
      float len = (0.3 + 0.32 * h * h) * (1.0 - 0.6 * pow(abs(s), 3.0)) * (row == 0 ? 1.0 : 0.75);
      vec2 root = vec2(x, upperLid(x) + 0.004);
      // Down when shut, up when open: halfway they point at the lens.
      vec2 dir = vec2(0.55 * s + 0.3 * (h2 - 0.5), -down);
      float reach = len * max(length(dir) * (0.3 + 0.7 * abs(down)), 0.14);
      dir = normalize(dir);
      vec2 side = vec2(-dir.y, dir.x) * sign(dir.x + 1e-3) * sign(-dir.y + 1e-3);
      vec2 tip = root + dir * reach + side * (0.05 + 0.08 * h) * reach;
      vec2 mid = root + dir * 0.55 * reach + side * 0.015 * reach;
      float dist = min(capsule(p, root, mid) - 0.0055, capsule(p, mid, tip) - 0.0022);
      cover = max(cover, (0.8 + 0.2 * h2) * (1.0 - smoothstep(-px * 0.5, px, dist)));
    }
  }
  // The lower row: short, sparse, faint, always down and out.
  float gap = 0.11;
  float k = floor((p.x - INNER.x) / gap);
  for (int j = -1; j <= 1; j++) {
    float i = k + float(j);
    float h = hash(vec2(i, 31.0));
    float x = INNER.x + (i + 0.5) * gap + 0.03 * (h - 0.5);
    float s = (x - 0.5 * (INNER.x + OUTER.x)) / (0.5 * (OUTER.x - INNER.x));
    if (s < -0.4 || s > 0.92) continue;
    vec2 root = vec2(x, lowerLid(x) - 0.014);
    vec2 tip = root + normalize(vec2(0.5 * s + 0.15, -1.0)) * (0.06 + 0.06 * h);
    float dist = capsule(p, root, tip) - 0.0025;
    cover = max(cover, 0.35 * (1.0 - smoothstep(-px * 0.5, px, dist)));
  }
  return cover;
}

void main() {
  float aspect = u_res.x / u_res.y;
  vec2 p = u_cam.xy + vec2((v_uv.x - 0.5) * aspect, v_uv.y - 0.5) * 2.0 * u_cam.z;
  float px = 2.0 * u_cam.z / u_res.y;
  float lit = u_light.x;

  // The key light falls on the eye from the upper left and fades into the
  // dark around it.
  vec2 q = (p - vec2(0.15, EYE_Y + 0.35)) / vec2(3.1, 2.3);
  float spot = exp(-dot(q, q));
  float e = 0.012;
  float hx = skin(p + vec2(e, 0.0)) - skin(p - vec2(e, 0.0));
  float hy = skin(p + vec2(0.0, e)) - skin(p - vec2(0.0, e));
  vec2 pore = vec2(noise(p * 46.0) - noise(p * 46.0 + vec2(0.37, 0.0)), noise(p * 46.0) - noise(p * 46.0 + vec2(0.0, 0.37)));
  float gx = grain(p + vec2(0.004, 0.0)) - grain(p - vec2(0.004, 0.0));
  float gy = grain(p + vec2(0.0, 0.004)) - grain(p - vec2(0.0, 0.004));
  vec3 n = normalize(vec3(-vec2(hx, hy) / (2.0 * e) - vec2(gx, gy) / 0.008 + 0.05 * pore, 1.0));
  vec3 l = normalize(vec3(-0.45, 0.6, 0.66));
  float wrap = max((dot(n, l) + 0.35) / 1.35, 0.0);
  float sheen = pow(max(dot(reflect(-l, n), vec3(0.0, 0.0, 1.0)), 0.0), 18.0);
  float light = lit * spot * (u_light.z + 0.06 + 0.5 * pow(wrap, 1.5)) + 0.07 * lit * spot * sheen;
  vec3 col = u_paper + u_key * u_warm * 0.8 * light;

  // The lid's thin skin glows with the dreams behind it.
  float s = across(p.x), w = 1.0 - s * s;
  float lidBand = smoothstep(upperLid(p.x) - 0.02, upperLid(p.x) + 0.08, p.y)
                * (1.0 - smoothstep(seam(p.x) + 0.55, seam(p.x) + 1.05, p.y)) * w;
  col += dreams(p) * 0.2 * u_state.x * lidBand * lit;

  // The opening between the lids, and the eye in it.
  float top = upperLid(p.x), bottom = lowerLid(p.x);
  float open = smoothstep(-px, px, top - p.y) * smoothstep(-px, px, p.y - bottom) * step(abs(s), 0.999);
  if (open > 0.0) col = mix(col, u_paper + eyeball(p, px) * lit, open);
  // The lid's margins: a dark rim under the upper lid, a wet glint on the
  // lower one.
  float margin = exp(-pow((p.y - top) / max(0.012 + 0.01 * u_eye.x, px), 2.0)) * w;
  col = mix(col, u_paper * 0.6, 0.55 * margin);
  float wet = exp(-pow((p.y - bottom - 0.014) / max(0.008, px), 2.0)) * w * smoothstep(0.1, 0.5, u_eye.x);
  col += u_key * 0.22 * wet * spot * lit;

  // The lashes, dark against the skin and the eye, their edges catching a
  // little light.
  if (abs(p.y - top) < 0.75 || abs(p.y - bottom) < 0.3) {
    float cover = lashes(p, px);
    col = mix(col, u_paper * 0.5 + u_key * u_warm * 0.035 * spot, cover);
  }
  o = vec4(col, 1.0);
}
