// Shared by the scene's shaders: the frame's slots (lib.rs pack), the
// camera and its lens, the rings' small helpers and a hash. Rust puts the
// version line and lib.rs's constants (#define) in front of it.
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
#define R1C    u_d[5]  // outer ring: centre, radius
#define R1     u_d[6]  // its light, ticks grown, part drawn, flash
#define R1RUN  u_d[7]  // runner: angle, light, gaze light
#define R2C    u_d[8]  // inner sphere: centre, radius
#define R2     u_d[9]  // its light, opened, flash, core light
#define R2X    u_d[10] // its turn, seconds since the beat
#define R3C    u_d[11] // waist ring: centre, radius
#define R3N    u_d[12] // its normal, light
#define R3     u_d[13] // its flash, joined, trail, turn
#define WORLD  u_d[14] // floor repeat, mote box, floor light, mote light
#define LOCK   u_d[15] // the lock's wave: origin, light
#define LOCK2  u_d[16] // its radius (< 0 none), the figure's light
#define META   u_d[SLOT_META] // loop seconds

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

// A circle of radius r about c, square to n, from its +z side.
vec3 onTilted(vec3 c, vec3 n, float r, float s) {
  vec3 e1 = normalize(cross(n, vec3(0.0, 0.0, 1.0)));
  vec3 e2 = cross(e1, n);
  return c + r * (sin(s) * e1 + cos(s) * e2);
}
// The floor lit in a pool round the figure.
float pool(vec3 p) {
  vec2 d = p.xz - R1C.xz;
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
// The lens's blur at a depth, px (lib.rs APERTURE).
float lensBlur(float z) {
  return APERTURE * abs(z - EYE.w) / z * VIEW.w;
}
// Behind the figure dimmer than before it.
float depthCue(float z) {
  return mix(1.15, 0.5, smoothstep(EYE.w - 1.3, EYE.w + 1.3, z));
}
// The light the runner leaves on the outer ring at angle a: it runs toward
// smaller angles, so what it has passed lies just above its own.
float trail(float a) {
  return R1RUN.y * exp(-mod(a - R1RUN.x, TAU) / RUNNER_TAIL);
}
// How much the lock's wave lights a point as it passes.
float lockWave(vec3 p) {
  if (LOCK2.x < 0.0) return 0.0;
  float d = (length(p - LOCK.xyz) - LOCK2.x) / 0.14;
  return LOCK.w * exp(-d * d);
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
