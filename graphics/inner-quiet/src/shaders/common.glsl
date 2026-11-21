// What every pass shares, vertex and fragment alike: the camera, the frame,
// the theme's colours, the land's state, noise, the land's height and the
// sky. Rust puts the version line and lib.rs's constants (#define) in front.
precision highp float;
precision highp int;

#define TAU 6.28318531
#define PI 3.14159265

uniform vec4 u_eye;      // eye xyz, loop time
uniform vec4 u_right;
uniform vec4 u_up;
uniform vec4 u_fwd;      // forward, tangent of half the frame's height
uniform vec4 u_view;     // frame scale x and y, target width and height in px
uniform vec3 u_cold;
uniform vec3 u_warm;
uniform vec3 u_pale;
uniform vec3 u_backdrop; // the page
uniform vec4 u_dusk;     // a black page's own dusk (rgb)
uniform vec3 u_sky;      // the glow of the air
uniform vec4 u_scene;    // his lift (m), soft edges (1)
uniform vec4 u_land;     // the noise, the ridge, the grid, the sphere's levels
uniform vec4 u_swell;    // its height, its crest's z, its width, its span
uniform vec4 u_spike[SIGNS * 2];

#define COLD u_cold
#define WARM u_warm
#define PALE u_pale
#define SKY u_sky

float time;

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

// The page, lifted on a black one.
vec3 page() {
  return u_backdrop + u_dusk.rgb;
}
// px of an 800 px high frame in this target's px.
float px800() {
  return u_view.y * u_view.w / 800.0;
}

// ---------- the camera

// A world point in clip space: the 3:2 frame (y -1..1 over its height)
// scaled into the target, depth over 0.1..200 m.
vec4 clipOf(vec3 p) {
  vec3 v = p - u_eye.xyz;
  float z = dot(v, u_fwd.xyz);
  float x = dot(v, u_right.xyz) / u_fwd.w * u_view.x;
  float y = dot(v, u_up.xyz) / u_fwd.w * u_view.y;
  const float N = 0.1;
  const float F = 200.0;
  return vec4(x, y, (z * (F + N) - 2.0 * F * N) / (F - N), z);
}
// Where a fragment lies in the 3:2 frame, and the ray through it.
vec2 frameAt(vec2 frag) {
  return (frag / u_view.zw * 2.0 - 1.0) / u_view.xy;
}
vec3 rayAt(vec2 f) {
  return normalize(u_fwd.xyz + (u_right.xyz * f.x + u_up.xyz * f.y) * u_fwd.w);
}

// ---------- the land

// Sharp ridged noise: the old mental noise as jagged peaks.
float jag(vec2 p) {
  float s = 0.0;
  float a = 0.55;
  for (int i = zero(); i < 3; i++) {
    float n = vnoise2(p);
    s += a * (1.0 - abs(2.0 * n - 1.0));
    p = p * 2.13 + vec2(3.1, 1.7);
    a *= 0.5;
  }
  return s;
}
float swellAt(vec2 p) {
  return u_swell.x * exp(-sq((p.y - u_swell.y) / u_swell.z) - sq(p.x / u_swell.w));
}
// The land's height at (x, z), without the swell: the noise round him, the
// spikes of what rises in him, the ridge through his soles. w: how warm the
// notice has made it here.
vec2 relief(vec2 p) {
  float calm = smoothstep(CALM.x, CALM.y, length(p));
  float fade = 1.0 - smoothstep(LAND_Z.y - 25.0, LAND_Z.y - 4.0, p.y);
  float flow = p.y + NOISE_FLOW * time;
  // Narrow along the rows, long across them: every row a jagged trace.
  vec2 q = vec2(p.x * 1.5, flow * 0.8);
  float n = NOISE_HEIGHT * pow(jag(q) / 0.96, 2.2);
  // A slow swell under the noise, so the peaks stand in ranges.
  n *= 0.35 + vnoise2(vec2(p.x * 0.2, flow * 0.25) + vec2(5.0, 1.0));
  float spike = 0.0;
  float warm = 0.0;
  float foot = 0.0;
  float tip = 1.0;
  for (int i = zero(); i < SIGNS; i++) {
    vec4 s = u_spike[2 * i];
    if (s.z <= 0.0) continue;
    float r = length(p - s.xy) / s.w;
    if (r >= 2.0) continue;
    // A sharp needle on jagged flanks, in a ring of jagged foothills.
    float teeth = jag(vec2(p.x * 7.0, p.y * 3.0) + vec2(float(i) * 7.3, 0.0)) / 0.96;
    float shape = r < 1.0 ? pow(1.0 - r, 2.2) * mix(1.0, teeth, 0.75 * smoothstep(0.0, 0.35, r)) : 0.0;
    spike = max(spike, s.z * shape);
    foot = max(foot, 0.3 * s.z * (1.0 - smoothstep(0.8, 2.0, r)) * teeth * teeth);
    tip = min(tip, smoothstep(0.0, 0.4, r));
    warm = max(warm, u_spike[2 * i + 1].x * smoothstep(0.0, 0.6, shape));
  }
  n = u_land.x * fade * (calm * n + smoothstep(CALM.x, 1.8, length(p)) * foot) * mix(0.2, 1.0, tip);
  float ridge = u_land.y * RIDGE_WAVE.x * exp(-sq(p.y / 0.3)) * smoothstep(0.25, 1.3, abs(p.x))
              * exp(-abs(p.x) / 14.0) * sin(RIDGE_WAVE.y * abs(p.x) - TAU * time / RIDGE_WAVE.z);
  return vec2(max(n, spike) + ridge, warm);
}

// ---------- the sky

vec3 skyAt(vec3 rd) {
  float up = rd.y;
  vec3 c = page() * (1.0 - 0.18 * smoothstep(0.0, 0.6, up));
  c += SKY * 0.03 * exp(-max(up, 0.0) * 11.0) * smoothstep(-0.3, 0.0, up);
  return c;
}
