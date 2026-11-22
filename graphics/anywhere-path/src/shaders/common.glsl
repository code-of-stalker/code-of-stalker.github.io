// Shared by the scene's shader: the frame's slots (lib.rs pack), the camera,
// hashes and noise. Rust puts the version line and lib.rs's constants
// (#define) in front of it.
precision highp float;
precision highp int;
precision highp sampler2D;

#define TAU 6.28318531
#define PI 3.14159265

uniform vec4 u_d[SLOTS];
uniform vec4 u_res;  // target width, height px

// A zero the compiler cannot see through: loops counted from it stay loops.
// D3D's shader compiler (ANGLE on Windows) would otherwise unroll them and
// take seconds to link.
#define ZERO min(int(u_res.x), 0)

#define EYE    u_d[0]   // camera, loop time
#define RIGHT  u_d[1]   // right axis, the loop's length
#define UP     u_d[2]   // up axis
#define FWD    u_d[3]   // view axis, lens
#define MOON   u_d[5]   // toward the moon
#define TRAIN  u_d[6]   // the middle car's angle (rad), its doors, her door's opening (rad), speed
#define SPHERE u_d[7]   // his sphere: centre, radius
#define RINGS  u_d[8]   // the cold ring's height, the warm ring's, its radius
#define RINGFX u_d[9]   // -, -, -, the finale
#define HEROP  u_d[10]  // his head, how much the eye is his own
#define FX     u_d[11]  // fog distance, the route drawn, its light, the melt's reach
#define MEM    u_d[12]  // the warm fill's height, remembering, his soles, his crown
#define MEM2   u_d[13]  // the wheels' clack, the wind, the ring following the fill, the crowd
#define ROUTE_AT(i) u_d[16 + (i)]

#define TIME EYE.w
#define LOOP_T RIGHT.w
#define LENS FWD.w

uint mixBits(uint x) {
  x ^= x >> 16;
  x *= 0x7feb352du;
  x ^= x >> 15;
  x *= 0x846ca68bu;
  x ^= x >> 16;
  return x;
}
float rand(uint x) {
  return float(mixBits(x) >> 8) / 16777215.0;
}
// a mod m, never negative (GLSL's % is undefined for negatives).
int pm(int a, int m) {
  return a - m * int(floor(float(a) / float(m)));
}
float hash1(int a, uint salt) {
  return rand(uint(pm(a, 1 << 20)) * 0x9E3779B1u + salt * 0x632BE5ABu);
}
float hash2(int a, int b, uint salt) {
  return rand(mixBits(uint(pm(a, 1 << 20)) * 0x9E3779B1u + salt) ^ (uint(pm(b, 1 << 20)) * 0x85EBCA77u));
}
float hash3(int a, int b, int c, uint salt) {
  return hash2(a, b + 7919 * pm(c, 4096), salt);
}
float noise1(float x, uint salt) {
  float i = floor(x), f = fract(x);
  float u = f * f * (3.0 - 2.0 * f);
  return mix(hash1(int(i), salt), hash1(int(i) + 1, salt), u);
}
// The noises' lattice values: a float hash, far cheaper to compile than the
// integer ones (a shader with many noises links in seconds, not tens).
float latt2(vec2 p) {
  vec3 q = fract(p.xyx * 0.1031);
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}
float latt3(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.zyx + 31.32);
  return fract((p.x + p.y) * p.z);
}
float noise2(vec2 p, uint salt) {
  p += vec2(float(salt) * 37.17, float(salt) * 11.31);
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = latt2(i), b = latt2(i + vec2(1.0, 0.0));
  float c = latt2(i + vec2(0.0, 1.0)), d = latt2(i + 1.0);
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float noise3(vec3 p, uint salt) {
  p += float(salt) * vec3(37.17, 11.31, 23.71);
  vec3 i = floor(p);
  vec3 f = fract(p);
  vec3 u = f * f * (3.0 - 2.0 * f);
  vec2 e = vec2(1.0, 0.0);
  float a = mix(latt3(i), latt3(i + e.xyy), u.x);
  float b = mix(latt3(i + e.yxy), latt3(i + e.xxy), u.x);
  float c = mix(latt3(i + e.yyx), latt3(i + e.xyx), u.x);
  float d = mix(latt3(i + e.yxx), latt3(i + 1.0), u.x);
  return mix(mix(a, b, u.y), mix(c, d, u.y), u.z);
}

float window(float t, float a, float b, float c, float d) {
  return smoothstep(a, b, t) * (1.0 - smoothstep(c, d, t));
}
float softmin(float a, float b, float k) {
  float h = max(k - abs(a - b), 0.0) / k;
  return min(a, b) - h * h * k * 0.25;
}

// The eye's ray through this pixel (the lens is vertical).
vec3 eyeRay() {
  vec2 ndc = gl_FragCoord.xy / u_res.xy * 2.0 - 1.0;
  float aspect = u_res.x / u_res.y;
  return normalize(FWD.xyz + RIGHT.xyz * (ndc.x * aspect / LENS) + UP.xyz * (ndc.y / LENS));
}
// Metres one pixel spans at distance t.
float pixelAt(float t) {
  return t * 2.0 / (LENS * u_res.y);
}
