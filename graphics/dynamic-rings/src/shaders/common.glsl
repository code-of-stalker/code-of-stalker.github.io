// Shared by the scene's shaders: the frame's slots (lib.rs pack), the
// camera and its lens, the planet, the rings' small helpers and a hash.
// Rust puts the version line and lib.rs's constants (#define) in front of
// it.
precision highp float;
precision highp int;

#define TAU 6.28318531
#define PI 3.14159265

uniform vec4 u_d[SLOTS];
uniform vec3 u_glow;
uniform vec4 u_kind;   // what this draw is, the largest point size

#define EYE    u_d[0]  // camera xyz, focus distance
#define RIGHT  u_d[1]  // right axis, loop time
#define UP     u_d[2]  // up axis, breath 0 out .. 1 in
#define FWD    u_d[3]  // view axis, how much the figure walks
#define VIEW   u_d[4]  // lens scale x and y, canvas width and height px
#define SPH    u_d[5]  // the glass: centre, radius
#define SHELLS u_d[6]  // its light before filling, filled, how far round it is lit (radians), the walk's track
#define RC(k)  u_d[SLOT_RING + 3 * (k)]     // ring k: centre, radius
#define RN(k)  u_d[SLOT_RING + 3 * (k) + 1] // its normal, light
#define RX(k)  u_d[SLOT_RING + 3 * (k) + 2] // its flash, flow, form, scan; ring 2: flash, turned, speed
#define WORLD  u_d[SLOT_WORLD]     // floor repeat, mote box, floor light, world light
#define LOCK   u_d[SLOT_WORLD + 1] // the lock's wave: origin, light
#define LOCK2  u_d[SLOT_WORLD + 2] // its radius (< 0 none), the figure's light, spokes, seconds since the sweep's top
#define META   u_d[SLOT_META]      // loop seconds, lens, aperture, the things and the wires
// Wire t: its curve's points with how far it has grown, seconds since it
// broke (< 0 not yet), its light, its writhe; where it met the glass and
// its writhe then.
#define TT(t, j) u_d[SLOT_TENTACLE + 5 * (t) + (j)]
// Things 2c and 2c + 1: where along the walk each stands (z), whether it is
// in this chapter.
#define THING(c) u_d[SLOT_THING + (c) / 2]

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

// A point on a level circle at angle a (0 toward +z, turning to +x).
vec3 onRing(float a, float r) {
  return r * vec3(sin(a), 0.0, cos(a));
}

// A circle of radius r about c, square to n, from its +z side, or its +x
// side when it faces along z (lib.rs Ring::at).
vec3 onTilted(vec3 c, vec3 n, float r, float s) {
  vec3 e1 = normalize(cross(n, abs(n.z) < 0.9 ? vec3(0.0, 0.0, 1.0) : vec3(1.0, 0.0, 0.0)));
  vec3 e2 = cross(e1, n);
  return c + r * (sin(s) * e1 + cos(s) * e2);
}

// The planet's centre, under the top the figure walks over.
vec3 planetCentre() {
  return vec3(0.0, -PLANET_RADIUS, SHELLS.w);
}
// A point given on the flat ground (x, height, z) bent onto the planet:
// its distance from the top becomes arc, its height stays its height.
vec3 bend(vec3 p) {
  vec2 d = vec2(p.x, p.z - SHELLS.w);
  float r = length(d);
  if (r < 1e-4) return p;
  float a = r / PLANET_RADIUS;
  vec2 dir = d / r;
  float h = PLANET_RADIUS + p.y;
  return planetCentre() + vec3(dir.x * sin(a) * h, cos(a) * h, dir.y * sin(a) * h);
}
// Where a ray from o along unit d first meets the planet, or -1.
float hitPlanet(vec3 o, vec3 d) {
  vec3 q = o - planetCentre();
  float b = dot(q, d);
  float c = dot(q, q) - PLANET_RADIUS * PLANET_RADIUS;
  float h = b * b - c;
  if (h < 0.0) return -1.0;
  float t = -b - sqrt(h);
  return t > 0.0 ? t : -1.0;
}
// The planet hides what lies behind its curve from the camera.
bool hidden(vec3 p) {
  vec3 q = p - EYE.xyz;
  float far = length(q);
  float t = hitPlanet(EYE.xyz, q / far);
  return t > 0.0 && t < far - 0.05;
}

// The floor lit in a pool round the figure.
float pool(vec3 p) {
  vec2 d = p.xz - SPH.xz;
  return exp(-dot(d, d) / (FLOOR_POOL * FLOOR_POOL));
}
// World to the camera: right, up, and depth along its view.
vec3 toView(vec3 p) {
  vec3 q = p - EYE.xyz;
  return vec3(dot(q, RIGHT.xyz), dot(q, UP.xyz), dot(q, FWD.xyz));
}
// Canvas pixels of a point in the camera's view (y up), and back to clip.
vec2 toPx(vec3 v) {
  return (v.xy / v.z * VIEW.xy * 0.5 + 0.5) * VIEW.zw;
}
vec4 pxToClip(vec2 px) {
  return vec4(px / VIEW.zw * 2.0 - 1.0, 0.0, 1.0);
}
// The lens's blur at a depth, px.
float lensBlur(float z) {
  return META.z * abs(z - EYE.w) / z * VIEW.w;
}
// Behind the figure dimmer than before it.
float depthCue(float z) {
  return mix(1.15, 0.5, smoothstep(EYE.w - 1.3, EYE.w + 1.3, z));
}
// How much the lock's wave lights a point as it passes.
float lockWave(vec3 p) {
  if (LOCK2.x < 0.0) return 0.0;
  float d = (length(p - LOCK.xyz) - LOCK2.x) / 0.14;
  return LOCK.w * exp(-d * d);
}
// How much the crown ring's plane lights a point as it scans past.
float scanned(vec3 p) {
  float d = dot(p - RC(0).xyz, RN(0).xyz) / SCAN_WIDTH;
  return RX(0).w * RN(0).w * exp(-d * d);
}
// Wire t's middle at s (0 its root … 1 its tip), writhing at phase w: a
// wave runs along it, still at both ends.
vec3 wire(int t, float s, float w) {
  vec3 p0 = TT(t, 0).xyz;
  vec3 p3 = TT(t, 3).xyz;
  float r = 1.0 - s;
  vec3 p = r * r * r * p0 + 3.0 * r * r * s * TT(t, 1).xyz + 3.0 * r * s * s * TT(t, 2).xyz + s * s * s * p3;
  vec3 chord = p3 - p0;
  vec3 e1 = normalize(cross(chord, vec3(0.0, 1.0, 0.0)) + vec3(1e-4, 0.0, 0.0));
  vec3 e2 = normalize(cross(e1, chord));
  return p + length(chord) * WRITHE_REACH * sin(PI * s)
           * (e1 * sin(9.0 * s - w) + e2 * sin(7.0 * s - 1.3 * w + 1.0));
}
// Where wire t has crumbled back to (1 whole … 0 gone).
float wireCut(int t) {
  float broken = TT(t, 1).w;
  return broken < 0.0 ? 1.0 : 1.0 - clamp(broken / TENTACLE_BREAK, 0.0, 1.0);
}
// Spire c over the horizon: its foot on the flat ground and its height,
// repeating every loop's walk.
vec4 spire(int c) {
  uint seed = uint(c) * 23u + 811u;
  float L = WORLD.x;
  float side = rand(seed) < 0.55 ? 1.0 : -1.0;
  float x = side * mix(4.5, 26.0, pow(rand(seed + 1u), 0.9));
  float zc = SHELLS.w + 6.0;
  float dz = mod(rand(seed + 2u) * L - zc + 0.5 * L, L) - 0.5 * L;
  return vec4(x, 0.0, zc + dz, mix(3.5, 11.0, rand(seed + 3u)));
}

// Whole cycles a loop, for anything that twinkles.
float loopPhase() {
  return TAU * RIGHT.w / META.x;
}
// A quiet pace for each thing: whole cycles a loop, about one in `about`
// seconds.
float pace(uint seed, float about) {
  return max(1.0, floor(META.x / about * mix(0.7, 1.3, rand(seed))));
}
// Star j of figure c in the sky, as a direction: a short walk of stars
// from a seed high over the horizon.
vec3 constellationStar(int c, int j) {
  uint seed = uint(c) * 131u + 977u;
  float az = rand(seed) * TAU;
  float el = mix(0.1, 0.62, rand(seed + 1u));
  vec2 at = vec2(az, el);
  float heading = rand(seed + 2u) * TAU;
  for (int k = 0; k < CONSTELLATION_STARS; k++) {
    if (k >= j) break;
    heading += (rand(seed + 10u + uint(k)) - 0.5) * 2.2;
    float reach = mix(0.035, 0.08, rand(seed + 20u + uint(k)));
    at += reach * vec2(cos(heading) / max(cos(at.y), 0.3), sin(heading));
  }
  return vec3(cos(at.y) * sin(at.x), sin(at.y), cos(at.y) * cos(at.x));
}
