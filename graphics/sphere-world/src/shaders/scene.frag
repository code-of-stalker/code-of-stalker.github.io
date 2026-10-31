#version 300 es
precision highp float;
// Art's panorama around the viewer, seen from the centre of the sphere, and
// the beat that wakes where the camera looks. Directions are longitude and
// latitude in radians; the panorama's u runs with longitude and its v down
// from the zenith. The beats' timing and geometry mirror lib.rs.
uniform sampler2D u_world;
uniform vec2 u_res;      // target px
uniform vec4 u_out;      // straight to the canvas, soft edges, engrave on the page, -
uniform vec3 u_backdrop; // the page around the scene
uniform vec4 u_edges;    // left, right, top, bottom
uniform vec4 u_camera;   // view centre u, pitch, tan of half the view across, loop phase
uniform vec4 u_beat;     // beat (0 gust, 1 ripple, 2 bird, 3 ring, 4 stars), seconds into it, its centre u, -
uniform vec4 u_bird;     // u, latitude, wing lift, presence
uniform vec3 u_glow;     // the light the beats add
uniform vec3 u_deep;     // the engraving's deepest ink
uniform vec3 u_mid;      // its middle ink
uniform vec4 u_geo[6];   // GEOMETRY in lib.rs
in vec2 v_uv;
out vec4 o;

const float PI = 3.14159265;
const float TAU = 6.28318531;
const float DEG = PI / 180.0;
const vec2 SIZE = vec2(3072.0, 1536.0);
// Half the bird's wingspan; the meridians' spacing and their dots'.
const float BIRD_SPAN = 2.4 * DEG;
const float MERIDIAN_EVERY = 15.0 * DEG;
const float DOT_EVERY = 1.5 * DEG;
// Where the middle ink sits on the way from full ink to the page.
const float MID_AT = 0.45;

#define GUST_START u_geo[0].x
#define GUST_FROM u_geo[0].y
#define GUST_SPEED u_geo[0].z
#define SWAY u_geo[0].w
#define RIPPLE_LAT u_geo[1].x
#define RIPPLE_START u_geo[1].y
#define RIPPLE_GAP u_geo[1].z
#define RIPPLE_SPEED u_geo[1].w
#define RIPPLE_REACH u_geo[2].x
#define DROP_START u_geo[2].y
#define RING_LAT u_geo[2].z
#define RING_START u_geo[2].w
#define RING_SPEED u_geo[3].x
#define MERIDIAN_SPEED u_geo[3].y
#define MERIDIAN_REACH u_geo[3].z
#define RING_FROM u_geo[3].w
#define STAR_START u_geo[4].x
#define STAR_FROM u_geo[4].y
#define STAR_RISE u_geo[4].z
#define SHOOT_START u_geo[4].w
#define ENGRAVE_WHITE u_geo[5].x
#define ENGRAVE_GAMMA u_geo[5].y
#define RING_GLOW u_geo[5].z
#define MERIDIAN_GLOW u_geo[5].w

float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
// A difference of u folded into -0.5..0.5 (wrap_half in lib.rs).
float wrapHalf(float u) { return u - floor(u + 0.5); }
// The crest of a beat's light and the glow it leaves for `tail` seconds.
float lit(float s, float tail) {
  return exp(-s * s / 0.09) + 0.35 * smoothstep(-0.1, 0.2, s) * (1.0 - smoothstep(0.2, tail, s));
}
// The same crest, then a steadier glow: the ring holds while it closes.
float held(float s, float tail) {
  return exp(-s * s / 0.09) + 0.6 * smoothstep(-0.1, 0.3, s) * (1.0 - smoothstep(0.3, tail, s));
}
// Distance to a segment, and how far along it the nearest point lies.
vec2 segment(vec2 p, vec2 a, vec2 b) {
  vec2 ab = b - a;
  float h = clamp(dot(p - a, ab) / max(dot(ab, ab), 1e-12), 0.0, 1.0);
  return vec2(length(p - a - ab * h), h);
}

// The ripple on the water toward (rel, lat), the drop landing `RIPPLE_LAT`
// below the eye: x tilts the reflection, y is the rings' bright line.
vec2 ripple(float rel, float lat, float s) {
  if (lat > -2.0 * DEG) return vec2(0.0);
  float r = 1.0 / tan(-lat);
  vec2 p = r * vec2(sin(rel * TAU), cos(rel * TAU));
  float rho = distance(p, vec2(0.0, 1.0 / tan(-RIPPLE_LAT)));
  vec2 w = vec2(0.0);
  for (int k = 0; k < 3; k++) {
    float since = s - RIPPLE_START - float(k) * RIPPLE_GAP;
    if (since <= 0.0) continue;
    float radius = since * RIPPLE_SPEED;
    float x = rho - radius;
    float amp = smoothstep(0.0, 0.25, since) * exp(-since / 2.6) * (1.0 - 0.25 * float(k))
              * (1.0 - smoothstep(0.7 * RIPPLE_REACH, RIPPLE_REACH, radius));
    w.x += amp * exp(-x * x / 0.0025) * sin(x * 70.0);
    w.y += amp * exp(-x * x / 0.00016);
  }
  // A flash where the drop lands.
  float land = s - RIPPLE_START;
  w.y += 1.6 * exp(-rho * rho / 0.0016) * exp(-land * land / 0.03);
  return w;
}

// The bird: two wings of light from a small body, raised and lowered.
float bird(float u, float lat) {
  vec2 q = vec2(wrapHalf(u - u_bird.x) * TAU * cos(u_bird.y), lat - u_bird.y) / BIRD_SPAN;
  float ax = abs(q.x);
  float wing = u_bird.z * 0.5 * pow(ax, 1.2) + 0.16 * sin(PI * min(ax, 1.0)) * (1.0 - 0.5 * abs(u_bird.z));
  float dy = q.y - wing;
  float thick = 0.045 * (1.0 - 0.55 * min(ax, 1.0)) + 0.012;
  float line = exp(-dy * dy / (thick * thick)) * (1.0 - smoothstep(0.9, 1.0, ax));
  vec2 b = q - vec2(0.0, 0.03);
  float body = exp(-dot(b, b) / 0.006);
  float halo = 0.12 * exp(-dot(q, q) / 0.35);
  return (line + body + halo) * u_bird.w;
}

// The light themes engrave the night on the page: black is the page, the
// brightest tones the deep ink (lib.rs engrave).
vec3 engrave(vec3 c) {
  float t = 1.0 - pow(clamp(luma(c) / ENGRAVE_WHITE, 0.0, 1.0), ENGRAVE_GAMMA);
  vec3 ink = t < MID_AT ? mix(u_deep, u_mid, t / MID_AT)
                        : mix(u_mid, u_backdrop, (t - MID_AT) / (1.0 - MID_AT));
  return min(ink, u_backdrop);
}

void main() {
  // The view's direction: across fixed by the view, then tilted by the pitch.
  vec2 ndc = v_uv * 2.0 - 1.0;
  float aspect = u_res.x / max(u_res.y, 1.0);
  vec3 d = normalize(vec3(ndc.x * u_camera.z, ndc.y * u_camera.z / aspect, 1.0));
  float cp = cos(u_camera.y), sp = sin(u_camera.y);
  d = vec3(d.x, d.y * cp + d.z * sp, d.z * cp - d.y * sp);
  float lon = atan(d.x, d.z);
  float lat = asin(clamp(d.y, -1.0, 1.0));
  // u runs on past 1 across the seam; the texture repeats, so no edge shows.
  vec2 uv = vec2(u_camera.x + lon / TAU, 0.5 - lat / PI);
  int beat = int(u_beat.x + 0.5);
  float s = u_beat.y;
  float rel = wrapHalf(uv.x - u_beat.z);
  vec2 at = uv;

  // Gust: the trees lean with the front and ring out, tops the most.
  float gust = 0.0;
  if (beat == 0) {
    float since = s - (GUST_START + (rel - GUST_FROM) / GUST_SPEED);
    float span = smoothstep(GUST_FROM - 0.01, GUST_FROM + 0.02, rel) * (1.0 - smoothstep(0.17, 0.2, rel));
    float bend = smoothstep(-22.0 * DEG, 12.0 * DEG, lat) * (1.0 - smoothstep(16.0 * DEG, 24.0 * DEG, lat));
    float sway = since > 0.0 ? sin(TAU * since / 1.3) * exp(-since) * (1.0 - exp(-since / 0.15)) : 0.0;
    at.x -= SWAY * sway * bend * span;
    float band = smoothstep(-26.0 * DEG, -18.0 * DEG, lat) * (1.0 - smoothstep(12.0 * DEG, 20.0 * DEG, lat));
    gust = lit(since, 2.2) * band * span;
  }
  // Ripple: the rings tilt the reflection only below the far shore.
  vec2 waves = vec2(0.0);
  if (beat == 1) {
    waves = ripple(rel, lat, s) * (1.0 - smoothstep(-24.0 * DEG, -21.0 * DEG, lat));
    at += vec2(0.0005, 0.003) * waves.x;
  }

  vec3 base = texture(u_world, at).rgb;
  vec3 c = base;
  // Between beats the stars twinkle, each at its own whole number of
  // times a loop, so the loop closes.
  float sky = smoothstep(8.0 * DEG, 18.0 * DEG, lat);
  float spark = smoothstep(0.1, 0.4, luma(base));
  vec2 cell = floor(vec2(fract(uv.x), uv.y) * SIZE / 3.0);
  float times = 20.0 + floor(hash(cell) * 24.0);
  float twinkle = pow(0.5 + 0.5 * sin(hash(cell + 7.0) * TAU + u_camera.w * times), 10.0);
  c *= 1.0 + 0.6 * twinkle * spark * sky;

  if (beat == 0) c *= 1.0 + 1.4 * gust;
  if (beat == 1) {
    c += u_glow * 0.55 * waves.y;
    // The drop falls out of the sky to where it lands.
    float f = (s - DROP_START) / (RIPPLE_START - DROP_START);
    if (f > 0.0 && f < 1.0) {
      vec2 p = vec2(rel * TAU * cos(lat), lat);
      vec2 head = vec2(0.0, mix(12.0 * DEG, RIPPLE_LAT, f * f));
      vec2 trail = segment(p, head, head + vec2(0.0, 3.0 * DEG * f));
      float drop = exp(-dot(p - head, p - head) / pow(0.18 * DEG, 2.0))
                 + 0.5 * exp(-trail.x * trail.x / pow(0.07 * DEG, 2.0)) * (1.0 - trail.y);
      c += u_glow * drop;
    }
  }
  if (beat == 2) c += u_glow * 0.9 * bird(uv.x, lat);
  if (beat == 3) {
    // The ring runs both ways from where it was born; light spreads from
    // it up and down the meridians, dot by dot.
    float dl = lat - RING_LAT;
    float ringAt = RING_START + abs(wrapHalf(rel - RING_FROM)) / RING_SPEED;
    float line = exp(-dl * dl / pow(0.15 * DEG, 2.0)) + 0.25 * exp(-dl * dl / pow(1.0 * DEG, 2.0));
    float ring = line * held(s - ringAt, RING_GLOW);
    float lonW = uv.x * TAU;
    float meridian = floor(lonW / MERIDIAN_EVERY + 0.5) * MERIDIAN_EVERY;
    float across = (lonW - meridian) * cos(lat);
    float along = (fract(lat / DOT_EVERY + 0.5) - 0.5) * DOT_EVERY;
    float dots = exp(-(across * across + along * along) / pow(0.2 * DEG, 2.0));
    float merAt = RING_START + abs(wrapHalf(meridian / TAU - u_beat.z - RING_FROM)) / RING_SPEED + abs(dl) / MERIDIAN_SPEED;
    float meridians = dots * held(s - merAt, MERIDIAN_GLOW) * (1.0 - smoothstep(0.6 * MERIDIAN_REACH, MERIDIAN_REACH, abs(dl)));
    c += u_glow * (1.2 * ring + 1.3 * meridians);
  }
  if (beat == 4) {
    // The sky brightens upward from the mountains, star by star.
    float rise = lit(s - (STAR_START + max(lat - STAR_FROM, 0.0) / STAR_RISE), 2.5);
    c *= 1.0 + (1.4 + 1.6 * twinkle) * rise * spark * smoothstep(3.0 * DEG, 10.0 * DEG, lat);
    // Then one star falls.
    float f = (s - SHOOT_START) / 0.8;
    if (f > 0.0 && f < 1.0) {
      vec2 p = vec2(rel * TAU * cos(lat), lat);
      vec2 a = vec2(0.035 * TAU * cos(33.0 * DEG), 33.0 * DEG);
      vec2 b = vec2(0.08 * TAU * cos(24.0 * DEG), 24.0 * DEG);
      vec2 head = mix(a, b, f), tail = mix(a, b, max(f - 0.3, 0.0));
      vec2 trail = segment(p, tail, head);
      float streak = exp(-trail.x * trail.x / pow(0.08 * DEG, 2.0)) * trail.y * trail.y
                   + exp(-dot(p - head, p - head) / pow(0.18 * DEG, 2.0));
      c += u_glow * 1.5 * streak * sin(PI * f);
    }
  }

  if (u_out.z > 0.5) c = engrave(c);
  // Dither against banding in the glows.
  c += (hash(gl_FragCoord.xy * 1.37) - 0.5) / 255.0;
  if (u_out.x > 0.5) {
    // Drawn straight to the canvas: melt into the page here, and on a light
    // page never get lighter than the page.
    if (u_out.y > 0.5) {
      float m = smoothstep(0.0, u_edges.x, v_uv.x) * smoothstep(0.0, u_edges.y, 1.0 - v_uv.x)
              * smoothstep(0.0, u_edges.z, 1.0 - v_uv.y) * smoothstep(0.0, u_edges.w, v_uv.y);
      c = mix(u_backdrop, c, m);
    }
    if (u_out.z > 0.5) c = min(c, u_backdrop);
  }
  o = vec4(clamp(c, 0.0, 1.0), 1.0);
}
