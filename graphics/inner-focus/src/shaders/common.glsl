// What the passes share: the camera, the frame, the theme's colours, noise.
// Rust puts the version line and lib.rs's constants (#define) in front.
precision highp float;
precision highp int;

#define TAU 6.28318531
// The near layer is kept at half its light, so its glow can be twice what a
// frame holds; the composite doubles it back.
#define ENCODE 0.5

in vec2 v_uv;
out vec4 o;

uniform vec4 u_eye;   // eye xyz, loop time
uniform vec4 u_right;
uniform vec4 u_up;
uniform vec4 u_fwd;   // forward, tangent of half the frame's height
uniform vec4 u_view;  // frame scale x and y, canvas width and height in px
uniform vec4 u_blur;  // circles of confusion (px of an 800 px frame): him, the city; soft edges
uniform vec3 u_cold;
uniform vec3 u_warm;
uniform vec3 u_pale;
uniform vec3 u_backdrop; // the page

vec3 bg;
float time;
// A pixel in frame units, and in radians at the frame's middle.
float pixel;
float pxA;

// 0, but only at run time (time is never negative).
int zero() {
  return min(int(u_eye.w), 0);
}
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
  ivec2 c = ivec2(floor(cell));
  return float(mixBits(uint(c.x) * 0x9e3779b9u ^ mixBits(uint(c.y) + 0x632be5abu + k * 0x27d4eb2du)) >> 8) / 16777215.0;
}
float hash1(float x, uint k) {
  return hash2(vec2(x, 7.0), k);
}
float vnoise2(vec2 p) {
  vec2 i = floor(p) + 4096.0;
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash2(i, 3u);
  float b = hash2(i + vec2(1.0, 0.0), 3u);
  float c = hash2(i + vec2(0.0, 1.0), 3u);
  float d = hash2(i + vec2(1.0, 1.0), 3u);
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
float segd(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-12), 0.0, 1.0);
  return length(pa - ba * h);
}
// How much of a pixel `w` wide centred at x lies in [lo, hi].
float cover(float x, float lo, float hi, float w) {
  return clamp((min(x + 0.5 * w, hi) - max(x - 0.5 * w, lo)) / max(w, 1e-9), 0.0, 1.0);
}

// Where this fragment lies in the 3:2 frame (y -1..1 over its height), and
// the ray through it.
void setup(vec2 frag) {
  bg = u_backdrop;
  time = u_eye.w;
  pixel = 2.0 / (u_view.y * u_view.w);
  pxA = pixel * u_fwd.w;
}
vec2 frameAt(vec2 frag) {
  return (frag / u_view.zw * 2.0 - 1.0) / u_view.xy;
}
vec3 rayAt(vec2 f) {
  return normalize(u_fwd.xyz + (u_right.xyz * f.x + u_up.xyz * f.y) * u_fwd.w);
}
// A frame point back in canvas px.
vec2 fragOf(vec2 f) {
  return (f * u_view.xy + 1.0) * 0.5 * u_view.zw;
}
// px of an 800 px high frame in this canvas's px.
float px800() {
  return u_view.y * u_view.w / 800.0;
}
// A line `w` px wide at distance d px, kept to at least about a pixel and
// dimmed as it widens, so it never sparkles.
float line(float d, float w) {
  float s = max(w, 0.75);
  return w / s * exp(-sq(d / s));
}
// The glow of a stroke `lw` px wide at distance d px.
float stroke(float d, float lw) {
  return exp(-sq(d / (0.6 * lw))) + 0.35 * exp(-sq(d / (1.2 * lw + 2.0))) + 0.12 * exp(-sq(d / (2.5 * lw + 6.0)));
}

// ---------- the city across the river
// A way into the city is (azimuth from +x toward +z, height over the far
// waterline as the tangent of its elevation); FAR_BANK away.
vec3 cityWay(float az, float h) {
  return normalize(vec3(cos(az), h - u_eye.y / FAR_BANK, sin(az)));
}
vec2 cityAt(vec3 rd) {
  return vec2(atan(rd.z, rd.x), rd.y / length(rd.xz) + u_eye.y / FAR_BANK);
}
// The front row of houses, FRONT_ROW to a radian: the roof of house c;
// and the row behind it, BACK_ROW to a radian.
#define FRONT_ROW 55.0
#define BACK_ROW 34.0
float roofOf(float c) {
  float r = hash1(c, 1u);
  return 0.02 + 0.07 * r * r + step(0.92, hash1(c, 2u)) * 0.05;
}
float backOf(float c) {
  float r = hash1(c, 3u);
  return 0.035 + 0.1 * r * r;
}
float roofs(float az) {
  return roofOf(floor(az * FRONT_ROW));
}
// The lamp `i` along the far embankment (at azimuth i * LAMP_STEP): how
// bright, 0 for one that is out.
float lampLight(float i) {
  float r = hash1(i, 11u);
  return r < 0.2 ? 0.0 : 0.7 + 0.3 * hash1(i, 12u);
}

// ---------- the first ring
uniform vec4 u_ring0; // centre, radius
uniform vec4 u_ring1; // the normal of its plane, its turn
uniform vec4 u_ring2; // its first axis, its light

// Where the way (ro, rd) meets the first ring's plane: how far off the
// ring it is there (m, + outside), at which angle round it, and how far
// along the way (< 0: behind).
vec3 firstRing(vec3 ro, vec3 rd) {
  vec3 n = u_ring1.xyz;
  float dn = dot(rd, n);
  float t = dot(u_ring0.xyz - ro, n) / (abs(dn) > 1e-6 ? dn : 1e-6);
  vec3 q = ro + rd * t - u_ring0.xyz;
  vec3 ax = u_ring2.xyz;
  return vec3(length(q) - u_ring0.w, atan(dot(q, cross(n, ax)), dot(q, ax)), t);
}
// How far behind the nearest runner the angle a is, 0..1 of the way to the
// next one.
float behindRunner(float a) {
  return 1.0 - fract((a - u_ring1.w) * float(RUNNERS) / TAU);
}
