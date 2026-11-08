// Shared by the scene's shaders: the frame's slots (lib.rs pack), the
// camera, the street's plan (lots, lamps, cars, puddles), its lights and a
// hash. Rust puts the version line and lib.rs's constants (#define) in
// front of it. Light is two numbers: x the cold light (the theme's one
// colour), y the warm light (added back in the theme's warm colour).
precision highp float;
precision highp int;

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
#define FIG_LO  u_d[5]   // the figure's box, its head hidden
#define FIG_HI  u_d[6]   // the figure's box, its outline's light
#define MOUTH   u_d[7]   // mouth, how thick the breath is
#define VOICE_A u_d[8]   // the newest shell: centre, radius (< 0 none)
#define VOICE_B u_d[9]   // the one before
#define VOICE_L u_d[10]  // their lights, how the walls ring
#define ECHO    u_d[11]  // the echo about the head: radius, light, radius, light
#define HEAD    u_d[12]  // head, the walk's track
#define CITY    u_d[13]  // unrest, the crossing light (1 stop), the steps' light, the crane
#define HAND    u_d[14]  // palm, the rain on it
#define RAINC   u_d[15]  // the rain box's centre
#define PUDDLE  u_d[16]  // the step's puddle: x, z, radius
#define PUFF(i) u_d[SLOT_PUFF + (i)]  // breath cloud: centre, age (< 0 none)
#define STEP(i) u_d[SLOT_STEP + (i)]  // footstep: x, z, seconds since, side

#define TIME     RIGHT.w
#define APERTURE UP.w
#define LENS     FWD.w
#define FOCUS    EYE.w

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

// Value noise that repeats every `period` cells along y (x does not).
float noiseP(vec2 p, int period) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  int x0 = int(i.x);
  int y0 = pm(int(i.y), period);
  int y1 = pm(int(i.y) + 1, period);
  float a = hash2(x0, y0, 11u), b = hash2(x0 + 1, y0, 11u);
  float c = hash2(x0, y1, 11u), d = hash2(x0 + 1, y1, 11u);
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
// Four octaves; the base frequency has `period` cells in one REPEAT.
float fbmP(vec2 p, int period) {
  float s = 0.0, w = 0.5;
  for (int o = 0 + ZERO; o < 4; o++) {
    s += w * noiseP(p, period);
    p = p * 2.0 + vec2(17.3, 0.0);
    period *= 2;
    w *= 0.5;
  }
  return s / 0.9375;
}
// 3D value noise, free (for the breath and the steam).
float noise3(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  vec3 u = f * f * (3.0 - 2.0 * f);
  ivec3 c = ivec3(i);
  float n000 = hash3(c.x, c.y, c.z, 5u), n100 = hash3(c.x + 1, c.y, c.z, 5u);
  float n010 = hash3(c.x, c.y + 1, c.z, 5u), n110 = hash3(c.x + 1, c.y + 1, c.z, 5u);
  float n001 = hash3(c.x, c.y, c.z + 1, 5u), n101 = hash3(c.x + 1, c.y, c.z + 1, 5u);
  float n011 = hash3(c.x, c.y + 1, c.z + 1, 5u), n111 = hash3(c.x + 1, c.y + 1, c.z + 1, 5u);
  return mix(mix(mix(n000, n100, u.x), mix(n010, n110, u.x), u.y),
             mix(mix(n001, n101, u.x), mix(n011, n111, u.x), u.y), u.z);
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

// The street's plan.
int cellOf(float z) {
  return int(floor((z + 0.5 * CELL) / CELL));
}
bool crossing(int c) {
  return pm(c, 5) == CROSS;
}
// The ground's height: the carriageway lies a kerb below the rest.
float groundAt(float x) {
  return abs(x) < ROAD ? -CURB : 0.0;
}

// Street lamp k on side s (+1 the far side, cold LED; -1 the walker's,
// warm sodium, halfway between): its head.
float lampOffset(float s) {
  return s > 0.0 ? 0.0 : 0.5;
}
vec3 lampHead(float s, float k) {
  return vec3(s * LAMP_HEAD_X, LAMP_HEAD_Y, (k + lampOffset(s)) * LAMP_GAP);
}
// One cold lamp in six stutters, harder while the street is restless.
float lampFlicker(float s, float k) {
  if (s < 0.0 || pm(int(k), 6) != 4) return 1.0;
  int epoch = pm(int(floor(TIME * 12.0)), int(LOOP * 12.0));
  float off = step(rand(uint(epoch) * 747796405u + 3u), 0.2 + 0.25 * CITY.x);
  return 1.0 - (0.35 + 0.6 * CITY.x) * off;
}
// How a lamp's light falls off from straight down.
float lampCone(vec3 fromHead) {
  return smoothstep(0.12, 0.62, -fromHead.y / max(length(fromHead), 1e-4));
}
// The lamps' light at p (cold, warm); n = 0 lights from every side.
vec2 lampsAt(vec3 p, vec3 n, float wrap) {
  vec2 l = vec2(0.0);
  for (int side = 0 + ZERO; side < 2; side++) {
    float s = side == 0 ? 1.0 : -1.0;
    float k0 = floor(p.z / LAMP_GAP - lampOffset(s) + 0.5);
    for (int j = -1 + ZERO; j <= 1; j++) {
      float k = k0 + float(j);
      vec3 d = p - lampHead(s, k);
      float d2 = dot(d, d);
      float lambert = 1.0;
      if (dot(n, n) > 0.0) lambert = clamp((dot(n, -d) * inversesqrt(d2) + wrap) / (1.0 + wrap), 0.0, 1.0);
      float i = LAMP_LIGHT * lampFlicker(s, k) * lampCone(d) * lambert / max(d2, 0.25);
      if (side == 0) l.x += i; else l.y += i;
    }
  }
  return l;
}

// A lot of row 1 (the street's own buildings) on side s: whether its shop
// is lit, how bright, and whether warm.
vec3 shop(float s, int c) {
  int k = pm(c, 10);
  uint side = s > 0.0 ? 1u : 2u;
  float on = step(0.22, hash1(k, 30u + side));
  float bright = 0.55 + 0.45 * hash1(k, 40u + side);
  float warm = step(0.55, hash1(k, 50u + side));
  return vec3(on * bright * float(!crossing(c)), warm, 0.0);
}
// Shop light spilled on the pavement and the air in front of it.
vec2 shopSpill(vec3 p) {
  float s = p.x > 0.0 ? 1.0 : -1.0;
  float out_ = FACADE - abs(p.x);
  if (out_ < 0.0 || out_ > 6.0) return vec2(0.0);
  int c = cellOf(p.z);
  float u = p.z - (float(c) * CELL - 0.5 * CELL);
  vec3 sh = shop(s, c);
  float along = smoothstep(0.0, 1.2, u) * smoothstep(CELL, CELL - 1.2, u);
  float i = SHOP_LIGHT * 0.55 * sh.x * along * exp(-out_ / 1.3) * smoothstep(4.5, 1.0, p.y);
  return sh.y > 0.5 ? vec2(0.0, i) : vec2(i, 0.0);
}

// The puddles: the step's own, and the wet lows of the pavement and the
// road (they repeat with the street).
float puddle(vec2 xz) {
  vec2 d = xz - PUDDLE.xy;
  float own = smoothstep(PUDDLE.z, PUDDLE.z * 0.55, length(d * vec2(1.0, 0.7)));
  float lows = fbmP(xz * (24.0 / REPEAT), 24);
  float gutter = smoothstep(0.7, 0.0, abs(abs(xz.x) - ROAD + 0.35)) * 0.12;
  return max(own, smoothstep(0.56, 0.6, lows + gutter));
}

// Cars, lights only: lane 0 drives with the walker (taillights, warm),
// lane 1 against him (headlights, cold). Car j's front in copy n.
float carSpeed(int lane) {
  return (lane == 0 ? CARS_0_REPEATS : CARS_1_REPEATS) * REPEAT / LOOP;
}
float carZ(int lane, int j, float n) {
  float count = lane == 0 ? CARS_0_COUNT : CARS_1_COUNT;
  float off = REPEAT * (float(j) + 0.37 * float(lane)) / count;
  return mod(carSpeed(lane) * TIME + off, REPEAT) + n * REPEAT;
}

// The voice's shells and the echo's: centre, radius, light.
vec4 shell(int i, out vec3 centre) {
  if (i == 0) { centre = VOICE_A.xyz; return vec4(VOICE_A.w, VOICE_L.x, 0.0, 0.0); }
  if (i == 1) { centre = VOICE_B.xyz; return vec4(VOICE_B.w, VOICE_L.y, 0.0, 0.0); }
  centre = HEAD.xyz;
  return i == 2 ? vec4(ECHO.x, ECHO.y, 0.0, 0.0) : vec4(ECHO.z, ECHO.w, 0.0, 0.0);
}
// Where a shell touches the street: a thin bright line.
float shellRings(vec3 p) {
  float l = 0.0;
  for (int i = 0 + ZERO; i < 4; i++) {
    vec3 c;
    vec4 s = shell(i, c);
    if (s.x <= 0.0 || s.y <= 0.0) continue;
    float w = 0.05 + 0.012 * s.x;
    float d = (length(p - c) - s.x) / w;
    l += s.y * exp(-d * d) * (i < 2 ? VOICE_L.z : 1.0);
  }
  return l;
}
