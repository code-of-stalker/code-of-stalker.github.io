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
#define PASS_LO(i) u_d[SLOT_PASS + 2 * (i)]      // passer i's box
#define PASS_HI(i) u_d[SLOT_PASS + 2 * (i) + 1]
#define SCREEN     u_d[SLOT_SCREEN]      // the phone's screen: centre, its light
#define SCREEN_DIR u_d[SLOT_SCREEN + 1]  // the way it faces
#define SPHERE     u_d[SLOT_SPHERE]      // the sphere round him: centre, radius
#define RINGS      u_d[SLOT_SPHERE + 1]  // its rings: first's height, second's, third's turn, how seen
// Page 07 (zero on page 06): the tunnel round his face, the city's hush,
// the light at his soles, the support's circles (0..1 out, 1..2 gone).
#define CHECK    u_d[SLOT_CHECK]
#define CROSSCAR u_d[SLOT_CHECK + 1]  // the side street's car: x, z, heading, how seen
#define RINGVIS  u_d[SLOT_CHECK + 2]  // how seen the first ring, the second; the third's boost; his screen
// Page 07's tape: the loop's clock, how much the picture is a tape's
// (0.35 standing, 1 running back), the flash as it stops.
#define TAPE_T     RAINC.w
#define TAPE_ON    PUDDLE.w
#define TAPE_FLASH VOICE_L.w

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

// Page 08 (CROSSCAR.w < 0): the underpass under the walker's pavement
// (lib.rs), between the walls UNDER_X0 and UNDER_X1, one every REPEAT.
#define UNDERPASS (CROSSCAR.w < 0.0)
// How far along its underpass z lies, from the top of the down flight.
float underAlong(float z) {
  float u = mod(z - UNDER_Z, REPEAT);
  return u < 0.5 * REPEAT ? u : u - REPEAT;
}
// The floor's cell round u (a tread, the flat, or the street beyond): its
// ends along the underpass and its level.
float underCell(float u, out float ua, out float ub) {
  if (u < 0.0) { ua = -1e4; ub = 0.0; return 0.0; }
  if (u >= UNDER_LEN) { ua = UNDER_LEN; ub = 1e4; return 0.0; }
  if (u < FLIGHT) {
    float k = floor(u / TREAD);
    ua = k * TREAD;
    ub = ua + TREAD;
    return -(k + 1.0) * RISE;
  }
  if (u < FLIGHT + FLAT) { ua = FLIGHT; ub = FLIGHT + FLAT; return -UNDER_DEPTH; }
  float i = floor((u - FLIGHT - FLAT) / TREAD);
  ua = FLIGHT + FLAT + i * TREAD;
  ub = ua + TREAD;
  return -(RISERS - 1.0 - i) * RISE;
}
// Whether the slab roofs it at u (else the sky shows: its openings).
bool underRoofed(float u) {
  return u >= OPEN && u < UNDER_LEN - OPEN;
}
// Whether p is inside it, between its walls under the street.
bool underInside(vec3 p) {
  float u = underAlong(p.z);
  return UNDERPASS && p.y < 0.0 && p.x > UNDER_X0 && p.x < UNDER_X1 && u >= 0.0 && u < UNDER_LEN;
}
// Whether a step at xz lands in it (on its stairs or its floor).
bool underFoot(vec2 xz) {
  float u = underAlong(xz.y);
  return UNDERPASS && xz.x > UNDER_X0 && xz.x < UNDER_X1 && u >= 0.0 && u < UNDER_LEN;
}
// The floor's level at xz: the stairs and the floor in it, the street's
// ground elsewhere.
float floorAt(vec2 xz) {
  if (!underFoot(xz)) return groundAt(xz.x);
  float ua, ub;
  return underCell(underAlong(xz.y), ua, ub);
}
// How much of the street's light reaches p: all of it over the street and
// down the openings, none under the slab. Pass p a little out along its
// surface's normal: the kerb's face shares a plane with the wall behind it.
float streetShare(vec3 p) {
  if (!underInside(p)) return 1.0;
  float u = underAlong(p.z);
  return smoothstep(0.5, -0.6, min(u - OPEN, UNDER_LEN - OPEN - u));
}
// Its fluorescent tubes along the ceiling's middle under the slab, from
// the foot of the down flight to the foot of the up one; one stutters.
const float TUBES = 10.0;
const float TUBE_GAP = 2.0;
const float TUBE_HALF = 0.6;
const float TUBE_LIGHT = 1.0;
vec3 tubeAt(float z0, float k) {
  return vec3(0.5 * (UNDER_X0 + UNDER_X1), -SLAB - 0.05, z0 + FLIGHT + TUBE_GAP * k);
}
float tubeNear(float u) {
  return clamp(floor((u - FLIGHT) / TUBE_GAP + 0.5), 0.0, TUBES - 1.0);
}
float tubeFlicker(float k) {
  if (k != 6.0) return 1.0;
  int epoch = pm(int(floor(TIME * 12.0)), int(LOOP * 12.0));
  return 1.0 - 0.75 * step(rand(uint(epoch) * 2654435761u + 9u), 0.1);
}
// The tubes' light at p (cold); n = 0 lights from every side. They light
// only downward: nothing over the slab.
vec2 tubesAt(vec3 p, vec3 n, float wrap) {
  // Lifted off the surface: the walls stand right on the underpass's edge.
  p += 0.02 * n;
  if (!underInside(p)) return vec2(0.0);
  float u = underAlong(p.z);
  float k0 = tubeNear(u);
  float l = 0.0;
  for (int j = -1 + ZERO; j <= 1; j++) {
    float k = k0 + float(j);
    if (k < 0.0 || k > TUBES - 1.0) continue;
    vec3 d = p - tubeAt(p.z - u, k);
    d.z -= clamp(d.z, -TUBE_HALF, TUBE_HALF);
    float d2 = dot(d, d) + 0.02;
    float id = inversesqrt(d2);
    float lambert = 1.0;
    if (dot(n, n) > 0.0) lambert = clamp((dot(n, -d) * id + wrap) / (1.0 + wrap), 0.0, 1.0);
    l += tubeFlicker(k) * lambert * smoothstep(0.15, -0.25, d.y * id) / max(d2, 0.3);
  }
  return vec2(TUBE_LIGHT * l, 0.0);
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
  return l * streetShare(p + 0.01 * n) + tubesAt(p, n, wrap);
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

// The cars: lane 0 drives with the walker (we see its taillights, warm),
// lane 1 against him (its headlights, cold). A lane's cars follow one
// another `gap` apart; car `id` stands at z = base + gap * id (its middle)
// and keeps its number as it drives.
float carSpeed(int lane) {
  return (lane == 0 ? CARS_0_REPEATS : CARS_1_REPEATS) * REPEAT / LOOP;
}
void laneCars(int lane, out float x, out float dir, out float gap, out float base) {
  float count = lane == 0 ? CARS_0_COUNT : CARS_1_COUNT;
  x = lane == 0 ? -CAR_LANE : CAR_LANE;
  dir = lane == 0 ? 1.0 : -1.0;
  gap = REPEAT / count;
  base = carSpeed(lane) * TIME + 0.37 * float(lane) * gap;
}
// Which of the lane's looks car `id` has: the same car comes round with
// the loop.
int carLook(int lane, float id) {
  float count = lane == 0 ? CARS_0_COUNT : CARS_1_COUNT;
  float laps = abs(lane == 0 ? CARS_0_REPEATS : CARS_1_REPEATS);
  return pm(int(id), int(count * laps));
}

// Page 07's car out of the side street: where it stands (on the road a
// kerb lower) and the way it faces, (sin, cos) of its heading from +z.
vec3 crossCar(out vec2 f) {
  f = vec2(sin(CROSSCAR.z), cos(CROSSCAR.z));
  float x = CROSSCAR.x;
  return vec3(x, -CURB * smoothstep(ROAD + 0.8, ROAD - 0.8, abs(x)), CROSSCAR.y);
}

// Its headlights' light, and how it pours along their beams: x along the
// way the car faces, `off` the point's offset from the beams' axis.
const float CROSS_LIGHT = 3.0 * CAR_LIGHT;
float crossBeam(float along, vec3 off) {
  return smoothstep(0.0, 0.8, along) * exp(-dot(off, off) / (0.06 + 0.1 * along * along));
}

// Page 07's narrowing: what share of the frame's light at uv (0..1) is
// kept, a round window about his head where the eye sees it.
float tunnel(vec2 uv) {
  if (CHECK.x <= 0.0) return 1.0;
  vec3 h = project(HEAD.xyz);
  vec2 c = mix(vec2(0.5), clamp(h.xy / u_res.xy, 0.3, 0.7), smoothstep(0.4, 1.2, h.z));
  vec2 d = (uv - c) * vec2(u_res.x / u_res.y, 1.0);
  float r = mix(1.1, 0.14, CHECK.x);
  return 1.0 - 0.93 * CHECK.x * smoothstep(r, r + 0.3, length(d));
}

// The tape's bands at the frame's height y (0 … 1): one shivering low
// while it stands, two rolling down the frame while it runs back.
float tapeBand(float y, float c, float w) {
  return 1.0 - smoothstep(0.0, w, abs(fract(y - c + 0.5) - 0.5));
}
float tapeBands(float y) {
  float run = smoothstep(0.45, 0.9, TAPE_ON);
  float b = (1.0 - run) * tapeBand(y, 0.07 + 0.004 * sin(53.0 * TAPE_T), 0.035);
  float c = fract(-0.85 * TAPE_T);
  return max(b, run * max(tapeBand(y, c, 0.05), tapeBand(y, c + 0.43, 0.025)));
}
// Where the tape shows the frame's point uv: its rows torn sideways, most
// in the bands, and the picture jumping a little while it runs back.
vec2 tapeUv(vec2 uv) {
  if (TAPE_ON <= 0.0) return uv;
  int tick = int(TAPE_T * 30.0);
  float n = hash2(int(uv.y * u_res.y * 0.5), tick, 7u) - 0.5;
  uv.x += TAPE_ON * (0.0025 * n + tapeBands(uv.y) * (0.035 + 0.04 * n));
  uv.y += 0.006 * smoothstep(0.45, 0.9, TAPE_ON) * (hash1(tick / 3, 11u) - 0.5);
  return uv;
}
// The tape's scanlines at the target's row y px.
float tapeLines(float y) {
  return mix(1.0, 0.82 + 0.18 * (0.5 + 0.5 * cos(TAU * y / 3.0)), TAPE_ON);
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
