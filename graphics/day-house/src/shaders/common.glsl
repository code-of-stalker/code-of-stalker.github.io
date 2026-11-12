// Shared by the scene's shaders: the frame's slots (lib.rs pack), the
// camera, hashes and noise. Rust puts the version line and lib.rs's
// constants (#define) in front of it. Light is two numbers: x the cold
// light (the theme's one colour), y the warm light (lamps, the evening sun,
// the line of his day), added back in the theme's warm colour.
precision highp float;
precision highp int;
precision highp sampler2D;

#define TAU 6.28318531
#define PI 3.14159265

uniform vec4 u_d[SLOTS];
uniform vec4 u_res;  // target width, height px; light the target keeps; what this draw is

// A zero the compiler cannot see through: loops counted from it stay loops.
// D3D's shader compiler (ANGLE on Windows) would otherwise unroll every
// nested loop of the world shader, and linking it then outlasts the GPU's
// watchdog, which drops the context before the first frame.
#define ZERO min(int(u_res.x), 0)

#define EYE     u_d[0]   // camera, focus distance
#define RIGHT   u_d[1]   // right axis, loop time
#define UP      u_d[2]   // up axis, aperture
#define FWD     u_d[3]   // view axis, lens
#define VIEW    u_d[4]   // lens scale x, y
#define SUN     u_d[5]   // toward the sun, how much of it is out
#define DAY     u_d[6]   // the sky's light, the golden hour, the night, the table's gloss
#define SX (SLOT_LAMPS + LAMP_SLOTS)
#define SPHERE  u_d[SX]       // the sphere round him: its centre, its radius
#define RINGS   u_d[SX + 1]   // the first ring's height, the second's, the meridian's turn, how plainly
#define RINGVIS u_d[SX + 2]   // how much of the first, second, third ring shows; the glass
#define RINGFX  u_d[SX + 3]   // the flashes: first, second (its tremble), third; the floor under it
#define HEROP   u_d[SX + 4]   // his head, how much the eye is his own
#define CHORD   u_d[SX + 5]   // the three rings striking together, since
#define PATHS   u_d[SX + 6]   // the line of his day: drawn, bright, the beads
#define MELT    u_d[SX + 7]   // the house going to code, the table's gloss, the code in his sphere, his voice in it
#define SPARKS  u_d[SX + 8]   // the deadlines' sparks
#define SPARK_TO u_d[SX + 9]  // where they burn
#define DESK    u_d[SX + 10]  // his screen, the desk lamp, how much he typed, the bad news
#define TRAM    u_d[SX + 11]  // the tram's place, its doors
#define MOTION  u_d[SX + 12]  // story time, slowness, the sky's time, the street clock's hour
#define CUP     u_d[SX + 13]  // the child's cup, slowness
#define STEAM   u_d[SX + 14]  // over his tea, how much
#define HONK    u_d[SX + 15]  // the tram's horn, how much
#define COIN    u_d[SX + 16]  // the coin's glint, how much
#define LIFT    u_d[SX + 17]  // the lift's floor, moving
#define VOICE   u_d[SX + 18]  // his mouth, how much he speaks
#define VOICE_TO u_d[SX + 19] // the way his voice goes, how far
#define EAR     u_d[SX + 20]  // where it comes back to, how much he listens
#define EAR_K   u_d[SX + 21]  // the smallest ring there, the widest more
#define WATER   u_d[SX + 22]  // the eye under the water, how liquid, how deep, since the drop met its own
#define ROUTE_AT(i) u_d[SLOT_PATH + (i)]

#define TIME     RIGHT.w
#define APERTURE UP.w
#define LENS     FWD.w
#define FOCUS    EYE.w
#define STORY    MOTION.x

// Cell c's lamp, 0 … 1.
float lampOf(int c) {
  vec4 v = u_d[SLOT_LAMPS + c / 4];
  return v[c - 4 * (c / 4)];
}

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

// Value noise.
float noise2(vec2 p, uint salt) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  int x0 = int(i.x), y0 = int(i.y);
  float a = hash2(x0, y0, salt), b = hash2(x0 + 1, y0, salt);
  float c = hash2(x0, y0 + 1, salt), d = hash2(x0 + 1, y0 + 1, salt);
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float noise3(vec3 p, uint salt) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  vec3 u = f * f * (3.0 - 2.0 * f);
  int x = int(i.x), y = int(i.y), z = int(i.z);
  float a = mix(hash3(x, y, z, salt), hash3(x + 1, y, z, salt), u.x);
  float b = mix(hash3(x, y + 1, z, salt), hash3(x + 1, y + 1, z, salt), u.x);
  float c = mix(hash3(x, y, z + 1, salt), hash3(x + 1, y, z + 1, salt), u.x);
  float d = mix(hash3(x, y + 1, z + 1, salt), hash3(x + 1, y + 1, z + 1, salt), u.x);
  return mix(mix(a, b, u.y), mix(c, d, u.y), u.z);
}
// `octaves` of it, 0 … 1.
float fbm(vec2 p, int octaves, uint salt) {
  float s = 0.0, w = 0.5, total = 0.0;
  for (int o = 0 + ZERO; o < octaves; o++) {
    s += w * noise2(p, salt);
    total += w;
    p = mat2(1.6, 1.2, -1.2, 1.6) * p + vec2(17.3, 5.1);
    w *= 0.5;
  }
  return s / total;
}

float window(float t, float a, float b, float c, float d) {
  return smoothstep(a, b, t) * (1.0 - smoothstep(c, d, t));
}
// A line w wide at distance e from it.
float sline(float e, float w) {
  float x = e / w;
  return exp(-x * x);
}

// The camera: where a point lands in the target (px) and how far ahead.
vec3 project(vec3 p) {
  vec3 v = p - EYE.xyz;
  float z = dot(v, FWD.xyz);
  vec2 ndc = vec2(dot(v, RIGHT.xyz), dot(v, UP.xyz)) / max(z, 1e-3) * VIEW.xy;
  return vec3((ndc * 0.5 + 0.5) * u_res.xy, z);
}
// How wide the lens blurs a point at depth z, px of this target.
float blurAt(float z) {
  return APERTURE * LENS * abs(z - FOCUS) / max(z, 1e-3) * u_res.y;
}
// Metres one pixel spans at distance t.
float pixelAt(float t) {
  return t * 2.0 / (VIEW.y * u_res.y);
}
vec3 eyeRay() {
  vec2 ndc = gl_FragCoord.xy / u_res.xy * 2.0 - 1.0;
  return normalize(FWD.xyz + RIGHT.xyz * (ndc.x / VIEW.x) + UP.xyz * (ndc.y / VIEW.y));
}

// Under the water the whole frame sways a little, more the deeper.
float underDeep() {
  return WATER.x * smoothstep(0.0, 0.8, WATER.z);
}
vec2 waterUv(vec2 uv) {
  float k = underDeep();
  if (k < 0.001) return uv;
  return uv + k * 0.003 * vec2(sin(uv.y * 23.0 + TIME * 1.3), sin(uv.x * 17.0 - TIME * 1.1));
}

float softmin(float a, float b, float k) {
  float h = max(k - abs(a - b), 0.0) / k;
  return min(a, b) - h * h * k * 0.25;
}
