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
uniform vec4 u_state;     // dreams, their flicker, the world on the cornea, its grid
uniform vec4 u_dream;     // which dream, how far it has formed, seconds since it and the one before began
uniform vec4 u_holo;      // the grid over the face, the person in the pupil, light gathering
uniform vec4 u_light;     // key light, the loop's angle, the skin's least light, a light page
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
// The dreams' pictures span the lid: their centre and how many cm one unit
// of a picture is (x -2..2, y -1..1), and how soft the skin makes them;
// a dream melting into the next is softer.
const vec2 DREAM_AT = vec2(-0.02, EYE_Y + 0.22);
const float DREAM_UNIT = 0.48;
const float SKIN_BLUR = 0.03;
float blur = SKIN_BLUR;

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
float box(vec2 p, vec2 b) {
  vec2 d = abs(p) - b;
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}
float smin(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}
float bump(float y, float at, float width) {
  return exp(-pow((y - at) / width, 2.0));
}
// A hairline where `d` is 0, `w` its width in the same units.
float hairline(float d, float w) {
  return 1.0 - smoothstep(0.5 * w, 1.5 * w, abs(d));
}
// Hairlines at every whole value of v.
float lines(float v, float w) {
  return hairline(abs(fract(v + 0.5) - 0.5), w);
}
// Inside a shape (its signed distance d), as soft as the lid's skin.
float blurred(float d) {
  return 1.0 - smoothstep(-blur, blur, d);
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
  float streaks = noise(vec2(p.x * 6.0, (p.y - seam(p.x)) * 70.0 + 3.0 * noise(p * 3.0)));
  float along = exp(-pow(p.x / 1.7, 4.0));
  return 0.003 * streaks * lid * along + 0.0015 * noise(p * 60.0);
}

// A rounded cone from a (radius ra) to b (radius rb): one limb.
float limb(vec2 p, vec2 a, vec2 b, float ra, float rb) {
  vec2 ba = b - a;
  float l2 = dot(ba, ba), rr = ra - rb, a2 = l2 - rr * rr, il2 = 1.0 / l2;
  vec2 pa = p - a;
  float y = dot(pa, ba), z = y - l2;
  vec2 xv = pa * l2 - ba * y;
  float x2 = dot(xv, xv), y2 = y * y * l2, z2 = z * z * l2;
  float k = sign(rr) * rr * rr * x2;
  if (sign(z) * a2 * z2 > k) return sqrt(x2 + z2) * il2 - rb;
  if (sign(y) * a2 * y2 < k) return sqrt(x2 + y2) * il2 - ra;
  return (sqrt(x2 * a2 * il2) + y * rr) * il2 - ra;
}
// A person standing, the feet at y 0 and the crown at 1, facing the lens,
// eight heads tall, the arms a little open. `swing` (-1..1) lifts one foot
// and the other hand: a walker seen from behind.
float person(vec2 u, float swing) {
  vec2 h = (u - vec2(0.0, 0.937)) / vec2(0.05, 0.063);
  float d = (length(h) - 1.0) * 0.05;
  d = smin(d, limb(u, vec2(0.0, 0.885), vec2(0.0, 0.83), 0.021, 0.024), 0.012);
  // Shoulders sloping from the neck, the chest narrowing to the waist,
  // the pelvis.
  d = smin(d, limb(u, vec2(0.0, 0.82), vec2(-0.105, 0.79), 0.03, 0.036), 0.02);
  d = smin(d, limb(u, vec2(0.0, 0.82), vec2(0.105, 0.79), 0.03, 0.036), 0.02);
  d = smin(d, limb(u, vec2(0.0, 0.745), vec2(0.0, 0.6), 0.082, 0.06), 0.03);
  d = smin(d, (length((u - vec2(0.0, 0.525)) / vec2(0.083, 0.062)) - 1.0) * 0.062, 0.03);
  for (int k = 0; k < 2; k++) {
    float side = k == 0 ? -1.0 : 1.0;
    float lift = 0.035 * max(side * swing, 0.0);
    // The leg: thigh to knee, the calf's swell, the ankle, the foot.
    vec2 hip = vec2(side * 0.048, 0.5), knee = vec2(side * 0.044, 0.285 + lift);
    vec2 calf = vec2(side * 0.046, 0.21 + lift), ankle = vec2(side * 0.042, 0.04 + lift);
    d = smin(d, limb(u, hip, knee, 0.054, 0.032), 0.015);
    d = smin(d, limb(u, knee, calf, 0.032, 0.034), 0.01);
    d = smin(d, limb(u, calf, ankle, 0.034, 0.017), 0.01);
    d = smin(d, limb(u, ankle, ankle + vec2(side * 0.022, -0.028), 0.017, 0.012), 0.01);
    // The arm: deltoid, upper arm, elbow, forearm, wrist, the open hand.
    float reach = 0.025 * side * swing;
    vec2 shoulder = vec2(side * 0.112, 0.79), elbow = vec2(side * 0.148, 0.62 + reach);
    vec2 wrist = vec2(side * 0.178, 0.47 + 2.0 * reach);
    d = smin(d, length(u - shoulder) - 0.036, 0.015);
    d = smin(d, limb(u, shoulder, elbow, 0.031, 0.024), 0.012);
    d = smin(d, limb(u, elbow, wrist, 0.025, 0.016), 0.008);
    d = smin(d, limb(u, wrist, wrist + vec2(side * 0.012, -0.075), 0.017, 0.012), 0.008);
  }
  return d;
}

// The dreams, as pictures seen through the skin of the lid. Each returns
// its cool glow (x) and its warm lights (y); `q` spans the lid (x -2..2,
// y -1..1), `c` is the seconds since the dream began.

// A house at night: a dark gable and a tree against the glow of the sky,
// the moon, one window flickering and another lit later. Slowly nearer.
vec2 house(vec2 q, float c) {
  q = q / (1.0 + 0.025 * c) + vec2(0.04 * c, 0.0);
  float sky = 0.3 + 0.35 * smoothstep(-0.7, 1.0, q.y);
  vec2 m = q - vec2(1.15, 0.52);
  float moon = blurred(length(m) - 0.15) * 1.2 + 0.3 * exp(-length(m) / 0.3);
  vec2 h = q - vec2(-0.4, 0.0);
  float walls = box(h - vec2(0.0, -0.3), vec2(0.42, 0.3));
  float roof = max(-h.y, (h.y - 0.48 + 0.95 * abs(h.x)) / 1.38);
  float chimney = box(h - vec2(0.22, 0.32), vec2(0.05, 0.15));
  float ground = (q.y + 0.6 + 0.04 * sin(q.x * 2.0)) * 0.9;
  float trunk = box(q - vec2(0.62, -0.38), vec2(0.035, 0.24));
  float crown = min(min(length(q - vec2(0.62, 0.06)) - 0.27, length(q - vec2(0.48, -0.06)) - 0.19),
                    length(q - vec2(0.78, -0.04)) - 0.19);
  float dark = blurred(min(min(min(walls, roof), min(chimney, ground)), min(trunk, crown)));
  float flame = 0.75 + 0.25 * sin(c * 9.0) * sin(c * 3.3 + 1.0);
  float lit = blurred(box(h - vec2(-0.16, -0.22), vec2(0.09, 0.1))) * flame
            + blurred(box(h - vec2(0.18, -0.22), vec2(0.09, 0.1))) * 0.6 * smoothstep(2.0, 2.6, c);
  return vec2(sky * (1.0 - dark) + moon * (1.0 - dark), 1.3 * lit);
}

// A road to the horizon and a walker going away along it; behind them their
// footprints glow and fade («ступни»).
vec2 road(vec2 q, float c) {
  const float HORIZON = 0.3;
  float depth = HORIZON - q.y;
  float above = blurred(depth);
  float sky = (0.2 + 0.45 * exp(-max(-depth, 0.0) / 0.3)) * above;
  float way = blurred(abs(q.x) - 0.03 - 0.75 * max(depth, 0.0)) * (1.0 - above);
  float far = 1.0 / (max(depth, 0.0) + 0.05);
  float dash = smoothstep(0.35, 0.45, fract(far * 0.5)) * (1.0 - smoothstep(0.85, 0.95, fract(far * 0.5)))
             * blurred(abs(q.x) - 0.006 - 0.025 * depth) * (1.0 - above);
  // The walker's feet go from near the lens toward the horizon.
  float feet = HORIZON - 0.95 * exp(-c / 9.0);
  float size = (HORIZON - feet) * 1.15;
  float walker = blurred(person((q - vec2(0.0, feet)) / size, sin(c * 2.0 * PI * 1.6)) * size);
  float prints = 0.0;
  float steps = floor(c * 3.2);
  for (int k = 1; k < 10; k++) {
    float at = (steps - float(k)) / 3.2;
    if (at < 0.0) break;
    float y = HORIZON - 0.95 * exp(-at / 9.0);
    float s = (HORIZON - y) * 1.15;
    float side = mod(steps - float(k), 2.0) < 0.5 ? -1.0 : 1.0;
    vec2 f = (q - vec2(side * 0.06 * s, y)) / vec2(0.028 * s, 0.05 * s);
    prints += exp(-dot(f, f) * 1.5) * exp(-(c - at) / 1.8);
  }
  return vec2((sky + 0.32 * way + 0.4 * dash) * (1.0 - walker), 1.2 * prints * (1.0 - walker));
}

// A head in profile, facing +x, about 1.3 tall around (0, 0).
float profile(vec2 u) {
  float y = u.y;
  float front = 0.29 + 0.03 * bump(y, 0.2, 0.05) + 0.17 * bump(y, -0.03, 0.055)
              + 0.05 * bump(y, -0.14, 0.03) - 0.03 * bump(y, -0.185, 0.02)
              + 0.05 * bump(y, -0.23, 0.03) + 0.06 * bump(y, -0.36, 0.05)
              - 0.17 * smoothstep(-0.4, -0.52, y);
  float face = u.x - front;
  vec2 e = (u - vec2(-0.05, 0.02)) / vec2(0.56, 0.64);
  float skull = (length(e) - 1.0) * 0.56;
  float neck = max(box(u - vec2(-0.05, -0.75), vec2(0.22, 0.4)), face);
  return min(max(face, skull), neck);
}
// Two faces close together, dark against a glow between them; a voice
// goes from one mouth to the other («голос»).
vec2 faces(vec2 q, float c) {
  float lean = 0.04 * sin(c * 0.9);
  float left = profile((q - vec2(-0.95 + lean, 0.05)) / 0.95) * 0.95;
  vec2 r = (q - vec2(0.95 - lean, 0.05)) / 0.95;
  float right = profile(vec2(-r.x, r.y)) * 0.95;
  float heads = blurred(min(left, right));
  float glow = 0.15 + 0.45 * exp(-q.x * q.x / 0.35);
  vec2 v = q - vec2(-0.95 + lean + 0.34 * 0.95, 0.05 - 0.185 * 0.95);
  float cone = smoothstep(0.8, 0.45, abs(atan(v.y, v.x)));
  float voice = 0.0;
  for (int k = 0; k < 3; k++) {
    float wave = fract(c * 0.55 + float(k) / 3.0);
    voice += exp(-pow((length(v) - 1.2 * wave) / 0.02, 2.0)) * (1.0 - wave);
  }
  return vec2(glow * (1.0 - heads), 1.2 * voice * cone * (1.0 - heads));
}

// An endless stair, flights over flights, climbing as it runs: fast while
// the thought makes its conclusion, slowing in «ты не проснулся».
vec2 stair(vec2 q, float c) {
  const float RUN = 0.24, RISE = 0.14, FLIGHT = 0.95;
  float run = 0.09 * c + 1.6 * (1.0 - exp(-c / 2.5));
  float x = (q.x + run) / RUN;
  float slant = q.y - q.x * RISE / RUN;
  float k = floor(slant / FLIGHT);
  float y = slant - (k + 0.5) * FLIGHT;
  float s = y - (0.5 - fract(x)) * RISE;
  float body = smoothstep(blur, -blur, s) * smoothstep(-0.27, -0.23, s);
  float tread = exp(-pow(s / 0.018, 2.0));
  float riser = 0.35 + 0.65 * fract(x);
  float alternate = mod(k, 2.0) < 0.5 ? 1.0 : 0.6;
  return vec2(0.08 + body * 0.3 * riser, tread * alternate);
}

vec2 dreamPicture(int which, vec2 q, float c) {
  if (which == 0) return house(q, c);
  if (which == 1) return road(q, c);
  if (which == 2) return faces(q, c);
  return stair(q, c);
}
// The dream now, formed out of the one before: at the start of the lid a
// ripple runs out from the middle of the picture, the old dream melts into
// the blur and fades, and the new one gathers out of it and sharpens.
vec2 reel(vec2 q) {
  int now = int(u_dream.x + 0.5);
  float m = u_dream.y;
  if (m >= 1.0) return dreamPicture(now, q, u_dream.z);
  float r = length(q);
  float wave = sin(PI * m) * sin(r * 7.0 - m * 16.0) * exp(-r * 0.6);
  vec2 bent = q + q / max(r, 1e-3) * 0.07 * wave;
  float melt = smoothstep(0.0, 1.0, m);
  blur = SKIN_BLUR + 0.3 * melt;
  vec2 old = dreamPicture((now + 3) % 4, bent, u_dream.w) * (1.0 - smoothstep(0.05, 0.75, m));
  blur = SKIN_BLUR + 0.3 * (1.0 - melt);
  vec2 next = dreamPicture(now, bent, u_dream.z) * smoothstep(0.3, 1.0, m);
  blur = SKIN_BLUR;
  return old + next;
}

// The world on the cornea, seen in a convex mirror: the sky, the low sun,
// two lines of hills and the ground. `c` runs across the iris (-1..1).
vec2 mirror(vec2 c) {
  return c * (1.0 + 0.55 * dot(c, c));
}
float horizonAt(float x) { return -0.08 - 0.22 * x * x; }
float farHills(float x) { return horizonAt(x) + 0.07 + 0.05 * sin(x * 6.0 + 1.0) + 0.03 * sin(x * 13.0); }
float nearHills(float x) { return horizonAt(x) + 0.02 + 0.06 * sin(x * 4.0 - 0.6) + 0.02 * sin(x * 17.0 + 2.0); }
const vec2 SUN = vec2(0.38, 0.12);
vec3 world(vec2 c) {
  const float soft = 0.02;
  vec2 w = mirror(c);
  float horizon = horizonAt(w.x);
  float sky = smoothstep(horizon - soft, horizon + soft, w.y);
  float far = smoothstep(farHills(w.x) + soft, farHills(w.x) - soft, w.y);
  float near = smoothstep(nearHills(w.x) + soft, nearHills(w.x) - soft, w.y);
  vec2 sun = w - vec2(SUN.x, horizon + 0.2);
  float disc = smoothstep(0.08 + soft, 0.08 - soft, length(sun));
  float glow = exp(-length(sun) / 0.22);
  vec3 col = u_key * (0.42 + 0.5 * clamp(w.y - horizon, 0.0, 1.0)) * sky;
  col += u_key * (0.9 * disc + 0.35 * glow) * (1.0 - near);
  col *= 1.0 - 0.6 * far;
  col *= 1.0 - 0.9 * near;
  return col * sky;
}
// The same world as its grid: lines of latitude and longitude under the
// mirror's warp, the horizon, the hills' edges, the sun's ring, and lit
// points where the lines cross. `k` is one pixel across the iris.
float worldGrid(vec2 c, float k) {
  vec2 w = mirror(c);
  float kw = k * (1.0 + 1.65 * dot(c, c));
  float horizon = horizonAt(w.x);
  float net = max(lines(w.x / 0.1, kw / 0.1), lines(w.y / 0.1, kw / 0.1)) * 0.6;
  float edges = max(max(hairline(w.y - horizon, kw), hairline(w.y - farHills(w.x), kw)),
                    hairline(w.y - nearHills(w.x), kw));
  float sun = hairline(length(w - vec2(SUN.x, horizon + 0.2)) - 0.08, kw);
  vec2 cell = abs(fract(w / 0.1 + 0.5) - 0.5) * 0.1;
  float dots = 1.0 - smoothstep(1.5 * kw, 3.0 * kw, length(cell));
  return 0.45 * net + 0.9 * max(edges, sun) + 0.8 * dots;
}

// Inside the pupil: a person standing whole in its dark, woven of light,
// glowing out from the heart and breathing; motes of light drift in to
// them while they form. `p` is the point (cm), `k` one pixel.
vec3 within(vec2 p, float k) {
  float f = u_holo.y, gather = u_holo.z;
  if (f + gather <= 0.0) return vec3(0.0);
  vec2 fu = (p - vec2(u_eye.y, FIGURE_FEET)) / FIGURE_HEIGHT;
  float d = person(fu, 0.0) * FIGURE_HEIGHT;
  vec2 heart = fu - vec2(0.0, 0.68);
  float shown = smoothstep(f * 0.8, f * 0.8 - 0.25, length(heart * vec2(1.0, 0.7)))
              * smoothstep(0.0, 0.25, f);
  float breath = 1.0 + 0.06 * sin(7.0 * u_light.y);
  // The body's light: a fine bright edge, a soft fill that deepens inward,
  // a wide glow around. On a light page the strongest light is ink, so the
  // fill and the glow are quieter there: an inked edge round a lamp-tinted
  // body, not a solid shadow.
  float soft = mix(1.0, 0.3, u_light.w);
  float inside = 1.0 - smoothstep(-k, k, d);
  float depth = smoothstep(0.0, 0.035 * FIGURE_HEIGHT, -d);
  float edge = exp(-abs(d) / (1.6 * k + 0.002 * FIGURE_HEIGHT));
  float near = exp(-max(d, 0.0) / (0.04 * FIGURE_HEIGHT));
  float far = exp(-max(d, 0.0) / (0.16 * FIGURE_HEIGHT));
  float core = exp(-dot(heart, heart) / 0.004);
  vec3 glow = mix(u_fill, u_key, 0.55);
  vec3 col = glow * (0.75 * edge + soft * inside * (0.3 + 0.25 * depth)) + soft * u_fill * (0.3 * near + 0.14 * far)
           + u_key * u_warm * (0.7 * core + 0.18 * inside * exp(-dot(heart, heart) / 0.03));
  col *= shown * breath;
  // Motes drift in toward the heart while the light gathers.
  vec2 a = fu - vec2(0.0, 0.6);
  float spin = atan(a.y, a.x);
  vec2 cell = vec2(floor(spin / (2.0 * PI) * 40.0), 0.0);
  float lane = (fract(spin / (2.0 * PI) * 40.0) - 0.5) * length(a) * 2.0 * PI / 40.0;
  float run = fract(hash(cell + 5.0) - gather * (1.2 + hash(cell + 2.0)));
  float mote = exp(-(lane * lane + pow(length(a) - 0.25 - 1.6 * run, 2.0)) / pow(0.004 + 2.0 * k / FIGURE_HEIGHT, 2.0));
  col += glow * mote * 0.8 * gather * step(0.55, hash(cell + 9.0)) * run;
  return col;
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
  float sharp = mix(0.8, 1.0, max(u_state.z, u_holo.y));
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
    col = mix(col, u_paper * 0.25 + within(p, px), inPupil);

    // The world on the cornea, plainest over the dark pupil. With the grid
    // it breaks from the pupil outward into its lines, a bright front
    // running ahead.
    vec2 c = d / IRIS_R;
    float on = (1.0 - smoothstep(0.96, 1.04, r / IRIS_R)) * u_state.z;
    float over = mix(0.45, 0.9, inPupil) * (0.75 + 0.25 * dot(c, c));
    float g = u_state.w;
    float front = g * 1.25;
    float broken = smoothstep(front, front - 0.12, length(c));
    col += world(c) * on * over * (1.0 - broken);
    if (g > 0.0) {
      // Once broken, the grid fades from the eye while it runs over the
      // face, and the iris is left real.
      float disc = 1.0 - smoothstep(0.96, 1.04, r / IRIS_R);
      float sweep = exp(-pow((length(c) - front) / 0.05, 2.0)) * (1.0 - g);
      float fading = u_state.z > 0.0 ? 1.0 : g;
      col += (u_fill * 0.6 * worldGrid(c, px / IRIS_R) * broken * fading + u_key * 0.6 * sweep) * disc;
    }
  }
  // The light's own glint, small and soft, up and to the left.
  vec2 win = (d - vec2(-0.21, 0.24)) / vec2(0.055, 0.065);
  float pane = exp(-pow(dot(win, win), 2.0));
  col += u_key * 0.6 * pane * smoothstep(0.3, 0.8, u_eye.x) * (1.0 - max(u_holo.y, u_holo.z));
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

  // The dreams show through the lid's thin skin like pictures, the skin
  // dimming a little over them.
  float s = across(p.x), w = 1.0 - s * s;
  float rise = p.y - seam(p.x);
  float screen = smoothstep(-0.02, 0.1, rise) * (1.0 - smoothstep(0.62, 0.98, rise))
               * (1.0 - smoothstep(0.6, 0.98, abs(s)));
  if (u_state.x * screen > 0.0) {
    vec2 pic = reel((p - DREAM_AT) / DREAM_UNIT);
    float flick = 1.0 - 0.3 * u_state.y * (0.5 + 0.5 * sin(CYCLES.w * u_light.y));
    float through = u_state.x * screen * lit;
    col *= 1.0 - 0.3 * through;
    col += (u_fill * pic.x + mix(u_key, u_fill, 0.25) * pic.y) * 0.4 * through * flick;
  }

  // «Различение»: the grid runs out of the eye over the face, and the skin
  // turns into its own wireframe: lines of equal height, a mesh draped over
  // it and lit points where the mesh crosses, a bright front ahead.
  float wire = 0.0;
  if (u_holo.x > 0.0) {
    float de = length((p - vec2(0.0, EYE_Y)) / vec2(1.0, 0.75));
    float reach = u_holo.x * 5.0;
    wire = smoothstep(reach, reach - 0.25, de);
    float height = skin(p);
    float slope = length(vec2(hx, hy)) / (2.0 * e);
    float contours = lines(height / 0.03, max(px * slope, 0.0005) / 0.03);
    vec2 mesh = vec2(p.x, p.y + 0.35 * height) / 0.1;
    float net = max(lines(mesh.x, px / 0.1), lines(mesh.y, px / 0.1));
    vec2 cell = abs(fract(mesh + 0.5) - 0.5) * 0.1;
    float dots = 1.0 - smoothstep(1.5 * px, 3.0 * px, length(cell));
    float shade = (0.25 + 0.75 * clamp(light * 1.6, 0.0, 1.0)) * (0.9 + 0.1 * sin(300.0 * u_light.y));
    vec3 holo = u_paper + u_fill * (0.03 + (0.55 * contours + 0.35 * net + 0.8 * dots) * shade);
    col = mix(col, holo, wire);
    float sweep = exp(-pow((de - reach) / 0.08, 2.0)) * smoothstep(0.0, 0.1, u_holo.x) * (1.0 - u_holo.x);
    col += u_fill * 0.9 * sweep;
  }

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
  // little light; in the grid they are lines of it.
  if (abs(p.y - top) < 0.75 || abs(p.y - bottom) < 0.3) {
    float cover = lashes(p, px);
    vec3 lash = mix(u_paper * 0.5 + u_key * u_warm * 0.035 * spot, u_paper + u_fill * 0.85, wire);
    col = mix(col, lash, cover);
  }
  o = vec4(col, 1.0);
}
