// What the passes share: the camera, the frame, his pose, the theme's
// colours, noise. Rust puts the version line and lib.rs's constants
// (#define) in front.
precision highp float;
precision highp int;

#define TAU 6.28318531
#define PI 3.14159265

in vec2 v_uv;
out vec4 o;

uniform vec4 u_eye;      // eye xyz, loop time
uniform vec4 u_right;
uniform vec4 u_up;
uniform vec4 u_fwd;      // forward, tangent of half the frame's height
uniform vec4 u_view;     // frame scale x and y, target width and height in px
uniform vec3 u_cold;
uniform vec3 u_warm;
uniform vec3 u_pale;
uniform vec3 u_backdrop; // the page
uniform vec4 u_dusk;     // a black page's own dusk (rgb), the code's light (Матрица)
uniform vec3 u_sky;      // the glow of the air
uniform vec4 u_pose;     // his yaw and pitch, over the land (1), soft edges (1)
uniform vec4 u_scene;    // his height (m), the cloud he falls through, the fade, his face's glow

// The storyboard's names for the theme's colours.
#define BG bg
#define COLD u_cold
#define WARM u_warm
#define PALE u_pale
#define SKY u_sky

// The dark: the page, lifted on a black one.
vec3 bg;
float time;
// A pixel in frame units, and in radians at the frame's middle.
float pixel;
float pxA;
// His pose's turns, once a fragment.
float yawC, yawS, pitchC, pitchS;

// 0, but only at run time (time is never negative), so loops are not
// unrolled by the compiler.
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
// The storyboard's hash of a cell moved by c.
float hs(vec2 cell, float c) {
  return hash2(cell, uint(c * 100.0 + 0.5));
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
float fbm(vec2 p) {
  float s = 0.0;
  float a = 0.5;
  for (int i = zero(); i < 5; i++) {
    s += a * vnoise2(p);
    p = p * 2.03 + vec2(1.7, 9.2);
    a *= 0.5;
  }
  return s;
}
float segd(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-12), 0.0, 1.0);
  return length(pa - ba * h);
}
// The storyboard's soft roll-off of light above 0.72.
vec3 knee(vec3 c) {
  return mix(c, 0.72 + 0.28 * (1.0 - exp(-(c - 0.72) / 0.28)), step(0.72, c));
}

void setup(vec2 frag) {
  bg = u_backdrop + u_dusk.rgb;
  time = u_eye.w;
  pixel = 2.0 / (u_view.y * u_view.w);
  pxA = pixel * u_fwd.w;
  yawC = cos(u_pose.x);
  yawS = sin(u_pose.x);
  pitchC = cos(u_pose.y);
  pitchS = sin(u_pose.y);
}
// Where this fragment lies in the 3:2 frame (y -1..1 over its height).
vec2 frameAt(vec2 frag) {
  return (frag / u_view.zw * 2.0 - 1.0) / u_view.xy;
}
vec3 rayAt(vec2 f) {
  return normalize(u_fwd.xyz + (u_right.xyz * f.x + u_up.xyz * f.y) * u_fwd.w);
}
// px of an 800 px high frame in this target's px.
float px800() {
  return u_view.y * u_view.w / 800.0;
}
