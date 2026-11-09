// Shared by the scene's shaders: the frame's slots (lib.rs pack), the
// camera, the rope, the sky, the fog's plan, the haze and a hash. Rust puts
// the version line and lib.rs's constants (#define) in front of it. Light
// is two numbers: x the cold light (the theme's one colour), y the warm
// light (the low sun, added back in the theme's warm colour).
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
#define FIG_LO  u_d[5]   // his box, his head hidden
#define FIG_HI  u_d[6]   // his box, his outline's light
#define SPHERE  u_d[7]   // the sphere round him: centre, radius
#define RINGS   u_d[8]   // its rings: first's height, second's, third's turn, how seen
#define RINGLIT u_d[9]   // how lit the first ring, the second, the third
#define POLE_C  u_d[10]  // the pole's middle, how much of it there is
#define POLE_H  u_d[11]  // its half along it, how far its tips droop
#define ROPE    u_d[12]  // his z on the rope, how far he presses it down, its sway
#define SUN     u_d[13]  // toward the sun, how much of it is out
#define GLOW    u_d[14]  // his soles' height, how high the light has risen, how bright
#define FOG     u_d[15]  // the fog's top, how thick, how awake the city is, the birds
#define SHADOW  u_d[16]  // the persona: there, come apart, its pole, metres to the view's radians
#define SHADOW_BOX  u_d[17]  // its box on the shadow's plane
#define SHADOW_POLE u_d[18]  // its pole's two tips there
#define SHADOW_CONE(i) u_d[SLOT_SHADOW + (i)]  // its cones there: end (x, y, radius)

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

float softmin(float a, float b, float k) {
  float h = max(k - abs(a - b), 0.0) / k;
  return min(a, b) - h * h * k * 0.25;
}
// The rope's top at z off its straight line (x aside, y down): its sag,
// and in his span the rounded bend his weight presses into it (story.rs
// rope_offset). Over the roofs, nothing.
vec2 ropeOffset(float z) {
  float k = floor(z / SPAN);
  float z0 = k * SPAN + TOWER_Z;
  float len = SPAN - 2.0 * TOWER_Z;
  float u = (z - z0) / len;
  if (u < 0.0 || u >= 1.0) return vec2(0.0);
  float y = -ROPE_SAG * 4.0 * u * (1.0 - u);
  float x = 0.0;
  if (floor(ROPE.x / SPAN) == k) {
    float uw = clamp((ROPE.x - z0) / len, 0.02, 0.98);
    float v = max(softmin(u / uw, (1.0 - u) / (1.0 - uw), ROPE_ROUND), 0.0);
    y -= ROPE.y * v;
    x = ROPE.z * v;
  }
  return vec2(x, y);
}
// The rope's middle at z.
vec3 ropeAt(float z) {
  vec2 o = ropeOffset(z);
  return vec3(o.x, o.y - ROPE_R, z);
}

// ---- the sky ----

// The sun's height over the horizon (the tangent), and its way along it.
float sunRise() {
  return SUN.y / length(SUN.xz);
}
// The low cloud bank on the horizon under the sun: its top at the azimuth
// of rd (tangent of its height); the sun comes out over it. It thins out
// away from the sun and sinks under the fog's horizon.
float bankTop(vec3 rd) {
  float az = atan(rd.x, -rd.z);
  float edge = 0.012 * (fbm(vec2(az * 9.0, 0.5), 3, 31u) - 0.5) + 0.006 * sin(az * 23.0);
  float c = dot(normalize(rd.xz + vec2(1e-6, 0.0)), normalize(SUN.xz));
  return mix(-0.03, mix(sunRise() + 0.03, sunRise() - 0.032, SUN.w) + edge, smoothstep(0.2, 0.75, c));
}
// The open sky in direction rd (no sun disc): cold above, a band of dawn
// along the horizon that warms toward the sun.
vec2 sky(vec3 rd) {
  float e = rd.y / max(length(rd.xz), 1e-3);
  float up = max(e, 0.0);
  vec3 s = normalize(SUN.xyz);
  float toward = max(dot(normalize(vec2(rd.x, rd.z)), normalize(s.xz)), 0.0);
  float band = exp(-up * 12.0);
  float dawn = 0.35 + 0.65 * SUN.w;
  vec2 L = vec2(0.025 + (0.14 + 0.3 * toward * toward) * band + 0.04 * exp(-up * 3.0),
                (0.03 + 0.2 * dawn) * band * pow(toward, 3.0) + 0.012 * band);
  // Round the sun, its glow.
  float a = acos(clamp(dot(rd, s), -1.0, 1.0));
  L += SUN.w * vec2(0.12, 0.9) * exp(-a / 0.07) + SUN.w * vec2(0.04, 0.2) * exp(-a / 0.3);
  // The cloud bank: lit from behind along its top edge.
  float top = bankTop(rd);
  if (e < top) {
    float under = smoothstep(top, top - 0.012, e);
    float lining = exp(-max(top - e, 0.0) / 0.004) * (0.4 + 2.5 * exp(-a / 0.12)) * (0.4 + 0.6 * dawn);
    vec2 cloud = vec2(0.05 + 0.04 * band, 0.03 + 0.09 * pow(toward, 4.0) * dawn);
    L = mix(L, cloud, under) + lining * vec2(0.05, 0.25) * pow(toward, 2.0);
  }
  return L;
}
// The sky at the horizon below rd's azimuth: what the haze turns the far
// world into.
vec2 horizonSky(vec3 rd) {
  return sky(normalize(vec3(rd.x, 0.004 * length(rd.xz), rd.z)));
}

// ---- the fog and the haze ----

// The fog's top rides in billows over its plane; the pattern drifts along
// the rope as fast as he crosses on average, so the loop closes on it.
vec2 fogPlace(vec2 xz) {
  return vec2(xz.x, xz.y - SPAN * TIME / LOOP);
}
float fogHeight(vec2 xz) {
  vec2 q = fogPlace(xz);
  return FOG.x + 7.0 * (fbm(q / 34.0, 4, 41u) - 0.5) + 2.0 * (noise2(q / 9.0, 43u) - 0.5);
}
// How solid the fog is at xz (0 a hole onto the city … 1 solid): it
// thins below him as the city wakes and stays thick far off.
float fogSolid(vec2 xz) {
  float near = smoothstep(260.0, 90.0, length(xz - vec2(0.0, ROPE.x + 20.0)));
  // Where his shadow falls, away from the sun, the fog stays whole.
  vec2 a = normalize(-SUN.xz), d = xz - vec2(0.0, ROPE.x);
  float along = dot(d, a), across = abs(d.x * a.y - d.y * a.x);
  near *= 1.0 - smoothstep(-10.0, 5.0, along) * smoothstep(14.0 + 0.12 * along, 5.0 + 0.12 * along, across);
  float thin = mix(-0.2, 0.4, clamp((1.0 - FOG.y) / 0.72, 0.0, 1.0) * near);
  float f = fbm(fogPlace(xz) / 46.0, 3, 47u);
  return smoothstep(thin - 0.05, thin + 0.07, f);
}
// The haze's depth along a ray from ro to t: a thin even haze and the mist
// thickening down to the fog.
float hazeDepth(vec3 ro, vec3 rd, float t) {
  float k = 1.0 / MIST_HEIGHT;
  float y0 = ro.y - FOG.x;
  float y1 = max(y0 + rd.y * t, -4.0);
  float e0 = exp(-y0 * k), e1 = exp(-y1 * k);
  float m = abs(rd.y) > 1e-3 ? (e0 - e1) / (rd.y * k) : e0 * t;
  return HAZE * t + MIST * max(m, 0.0);
}
float hazeLeft(vec3 ro, vec3 rd, float t) {
  return exp(-hazeDepth(ro, rd, t));
}
