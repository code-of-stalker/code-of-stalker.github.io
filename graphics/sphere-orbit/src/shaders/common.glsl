// Shared by the scene's shaders: the camera and its lens, the timeline's
// values, the named directions and their waves, the runner's trail and a
// hash. Rust puts
// the version line and lib.rs's constants (#define) in front of it.
precision highp float;
precision highp int;

#define TAU 6.28318531
#define PI 3.14159265

uniform vec4 u_eye;    // camera position xyz, focus distance
uniform vec4 u_right;  // right axis xyz, loop time
uniform vec4 u_up;     // up axis xyz, breath scale
uniform vec4 u_fwd;    // forward axis xyz, -
uniform vec4 u_view;   // lens scale x and y, canvas width and height in px
uniform vec4 u_build;  // ring radius, ring light, tick length, point light
uniform vec4 u_sphere; // first meridian standing, fan, parallels' slide, sphere light
uniform vec4 u_runner; // angle round the ring, strength, -, -
uniform vec4 u_caps0;  // in front, to the side, above, below
uniform vec4 u_caps1;  // behind, all around, -, -
uniform vec4 u_waves0; // each side's wave: radius, light; in front, to the side
uniform vec4 u_waves1; // above, below
uniform vec4 u_waves2; // behind, the unnamed side
uniform vec3 u_glow;
uniform vec4 u_kind;   // what this draw is

const vec3 DIRS[6] = vec3[6](DIRECTION_0, DIRECTION_1, DIRECTION_2, DIRECTION_3, DIRECTION_4, UNNAMED);
const float LATITUDES[4] = float[4](PARALLEL_0, PARALLEL_1, PARALLEL_2, PARALLEL_3);

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

// A point on the ring's plane at angle a (0 toward +z, turning to +x).
vec3 onRing(float a, float r) {
  return r * vec3(sin(a), 0.0, cos(a));
}

// World to the camera: right, up, and depth along its view.
vec3 toView(vec3 p) {
  vec3 q = p - u_eye.xyz;
  return vec3(dot(q, u_right.xyz), dot(q, u_up.xyz), dot(q, u_fwd.xyz));
}
// Canvas pixels of a point in the camera's view (y up), and back to clip.
vec2 toPx(vec3 v) {
  return (v.xy / v.z * u_view.xy * 0.5 + 0.5) * u_view.zw;
}
vec4 pxToClip(vec2 px) {
  return vec4(px / u_view.zw * 2.0 - 1.0, 0.0, 1.0);
}
// The lens's blur at a depth, px (lib.rs APERTURE).
float lensBlur(float z) {
  return APERTURE * abs(z - u_eye.w) / z * u_view.w;
}
// How much the named directions light what lies along `dir` from the centre.
float caps(vec3 dir) {
  float c = 0.0;
  for (int i = 0; i < 5; i++) {
    float w = i < 4 ? u_caps0[i] : u_caps1.x;
    c += w * smoothstep(0.35, 0.92, dot(dir, DIRS[i]));
  }
  return c + 0.55 * u_caps1.y;
}
// Side c's wave: how far it has opened from that side's pole, its light.
vec2 wave(int c) {
  vec4 w = c < 2 ? u_waves0 : (c < 4 ? u_waves1 : u_waves2);
  return c % 2 == 0 ? w.xy : w.zw;
}
// The far side of the sphere dimmer than the near.
float nearSide(float z) {
  return mix(1.15, 0.45, smoothstep(u_eye.w - 1.2, u_eye.w + 1.2, z));
}
// The light the runner leaves on the orbit at angle a: it runs toward
// smaller angles, so what it has passed lies just above its own.
float trail(float a) {
  return u_runner.y * exp(-mod(a - u_runner.x, TAU) / RUNNER_TAIL);
}
