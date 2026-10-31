// Shared by the scene's shaders: the painting's camera, the moving head,
// the depth map, the scanner and a hash. Rust puts the version line and
// lib.rs's constants (#define) in front of it.
precision highp float;
precision highp int;

#define TAU 6.28318531
#define PI 3.14159265

uniform sampler2D u_depth;   // disparity in red and green, region in blue
uniform vec4 u_cam;          // head position xyz, zoom
uniform vec4 u_turn;         // cos and sin of the turn, cos and sin of the tilt
uniform vec4 u_px;           // canvas px per painting px, loop time, cover scale x and y
uniform vec4 u_scanAxis[2];  // axis (or centre) xyz, 1 for a growing sphere
uniform vec4 u_scan[2];      // from, to, seconds since it started, seconds
uniform vec4 u_layers0;      // sounds, movement, temperature, light and shadow
uniform vec4 u_layers1;      // smells and pressure, vibrations, breath scale, -
uniform vec3 u_glow;

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

// Metres along z to the painted surface at a painting pixel, and its
// region: 0 the room, 0.5 outside the window, 1 the curtain.
vec2 surface(ivec2 texel) {
  vec3 d = texelFetch(u_depth, clamp(texel, ivec2(0), ivec2(SIZE) - 1), 0).rgb;
  float q = (round(d.r * 255.0) * 256.0 + round(d.g * 255.0)) / 65535.0;
  return vec2(1.0 / max(q * DISPARITY_MAX, 1.0 / FAR), d.b);
}
bool isOutside(float region) {
  return abs(region - 0.5) < 0.25;
}
// How far along the painting's own ray through `p` the painted surface is;
// outside the window the glass stops it.
float behind(vec3 p) {
  if (p.z <= 0.05) return 1e3;
  vec2 px = vec2(CENTRE + FOCAL * p.x / p.z, HORIZON - FOCAL * p.y / p.z);
  if (any(lessThan(px, vec2(0.0))) || any(greaterThanEqual(px, SIZE))) return 1e3;
  vec2 s = surface(ivec2(px));
  return isOutside(s.y) ? min(s.x, GLASS) : s.x;
}

// World to the head's view: undo its place, its turn and its tilt.
vec3 toView(vec3 p) {
  vec3 q = p - u_cam.xyz;
  float x = u_turn.x * q.x - u_turn.y * q.z;
  float z = u_turn.y * q.x + u_turn.x * q.z;
  return vec3(x, u_turn.z * q.y - u_turn.w * z, u_turn.w * q.y + u_turn.z * z);
}
// The head's view to clip space through the painting's lens, zoomed, the
// painting covering a canvas of any shape.
vec4 toClip(vec3 v) {
  vec2 px = vec2(CENTRE + FOCAL * v.x / v.z, HORIZON - FOCAL * v.y / v.z);
  return vec4(vec2(px.x / SIZE.x * 2.0 - 1.0, 1.0 - px.y / SIZE.y * 2.0) * u_cam.w * u_px.zw, 0.0, 1.0);
}
// The world direction through a point of the view, -1..1 (lib.rs view_ray).
vec3 viewRay(vec2 ndc) {
  ndc /= u_px.zw;
  vec2 px = vec2(CENTRE + ndc.x / u_cam.w * SIZE.x * 0.5, SIZE.y * 0.5 - ndc.y / u_cam.w * SIZE.y * 0.5);
  vec3 d = vec3((px.x - CENTRE) / FOCAL, (HORIZON - px.y) / FOCAL, 1.0);
  float y = u_turn.z * d.y + u_turn.w * d.z;
  float z = -u_turn.w * d.y + u_turn.z * d.z;
  return vec3(u_turn.x * d.x + u_turn.y * z, y, -u_turn.y * d.x + u_turn.x * z);
}

// A sweep's light fades in and out at its ends (lib.rs sweep_strength).
float strength(float local, float seconds) {
  return smoothstep(0.0, 0.5, local) * (1.0 - smoothstep(seconds - 0.5, seconds, local));
}
// Where sweep k's front is now.
float front(int k) {
  vec4 s = u_scan[k];
  return mix(s.x, s.y, clamp(s.z / s.w, 0.0, 1.0));
}
// Sweep k at a point: the band of light on it now, and the light it kept
// from the front passing.
vec2 scanned(vec3 p, int k) {
  vec4 a = u_scanAxis[k];
  vec4 s = u_scan[k];
  float c = a.w > 0.5 ? length(p - a.xyz) : dot(p, a.xyz);
  float x = (c - front(k)) / BAND;
  float band = exp(-x * x) * strength(s.z, s.w);
  float passed = (c - s.x) / (s.y - s.x) * s.w;
  float since = s.z - passed;
  float after = since > 0.0 ? exp(-since / AFTERGLOW) * strength(passed, s.w) : 0.0;
  return vec2(band, after);
}
