#version 300 es
precision highp float;
// Art's night lake. Above the far shore's waterline the painting is drawn as
// it is, with a ring of light hung over the water; below it the lake is
// computed: wave trains and drops tilt the surface, and each pixel shows the
// painted sky the tilted water reflects, glossy and glittering where the
// waves are too fine to see, over the painting's own dark water. Positions
// are painting px; the lake is in eye heights, the eye 1 above the water.
// Timing and geometry mirror lib.rs.
uniform sampler2D u_lake;
uniform vec2 u_res;      // target px
uniform vec4 u_out;      // straight to the canvas, soft edges, engrave on the page, -
uniform vec3 u_backdrop; // the page around the scene
uniform vec4 u_edges;    // left, right, top, bottom
uniform vec4 u_view;     // centre x, centre y, width in painting px, roll
uniform vec4 u_stir;     // drops, cross swell, wind ripple, long swell: 1 stirred … 0 still
uniform vec4 u_time;     // loop time, loop phase, the ring's glow, seconds since it sounded
uniform vec4 u_wave[12]; // wavenumber across, ahead; amplitude; angular speed (lib.rs waves)
uniform float u_part[12];
uniform vec3 u_glow;     // the light the ring and the drops add
uniform vec3 u_deep;     // the engraving's deepest ink
uniform vec3 u_mid;      // its middle ink
uniform vec4 u_geo[7];   // GEOMETRY in lib.rs
in vec2 v_uv;
out vec4 o;

const float PI = 3.14159265;
const float TAU = 6.28318531;
// The ring's line and halo, px; where the treetops end and the starry sky begins.
const float RING_LINE = 1.3;
const float RING_HALO = 9.0;
const float TREES = 300.0;
// Where the middle ink sits on the way from full ink to the page.
const float MID_AT = 0.45;
// The mean of a glint, pow(0.5 + 0.5 sin, 16): it keeps the glitter's light.
const float GLINT_MEAN = 0.13995;
// The mean of a fleck's swell, sin(pi x) sin(pi y) over its facet: 4 / pi^2.
const float FLECK_MEAN = 0.405285;

#define SHORE u_geo[0].x
#define FOCAL u_geo[0].y
#define SIZE u_geo[0].zw
#define RING_CENTRE u_geo[1].xy
#define RING_RADIUS u_geo[1].z
#define RAIN_CELL u_geo[2].x
#define RAIN_PERIOD u_geo[2].y
#define DROP_SPEED u_geo[2].z
#define DROP_LIFE u_geo[2].w
#define DROP_WAVE u_geo[3].x
#define DROP_STEEP u_geo[3].y
#define LOOP u_geo[3].z
#define RUN_SECONDS u_geo[3].w
#define SOUND_GAP u_geo[4].x
#define SOUND_SPEED u_geo[4].y
#define SOUND_FADE u_geo[4].z
#define ENGRAVE_WHITE u_geo[4].w
#define ENGRAVE_GAMMA u_geo[5].x
#define F0 u_geo[5].y
#define BODY u_geo[5].z
#define SOUND_WAVES u_geo[5].w
#define RAIN_STILL u_geo[6].xy
#define RAIN_BACK u_geo[6].zw

float hash12(vec2 p) {
  vec3 q = fract(vec3(p.xyx) * 0.1031);
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}
vec3 hash32(vec2 p) {
  vec3 q = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  q += dot(q, q.yxz + 33.33);
  return fract((q.xxy + q.yzz) * q.zyx);
}
float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

// How stirred the drops are at loop time t (lib.rs stir).
float rain(float t) {
  t = mod(t, LOOP);
  return clamp(1.0 - smoothstep(RAIN_STILL.x, RAIN_STILL.y, t) + smoothstep(RAIN_BACK.x, RAIN_BACK.y, t), 0.0, 1.0);
}

// A line of light `width` px across at distance x, blurred by `blur` px:
// it spreads but keeps its light.
float line(float x, float width, float blur) {
  float w = sqrt(width * width + blur * blur);
  return width / w * exp(-x * x / (w * w));
}

// The ring's light at painting point q: its line and halo, the light that
// runs round it when it sounds, and the waves that then leave it. Only the
// half in the air glows; the water shows the other half.
float ring(vec2 q, float blur) {
  vec2 d = q - RING_CENTRE;
  float rho = length(d);
  float x = rho - RING_RADIUS;
  float core = line(x, RING_LINE, blur) + 0.16 * line(x, RING_HALO, blur);
  float glow = u_time.z * core;
  float s = u_time.w;
  if (s > 0.0) {
    // From the top down both sides; the reflection runs up from the bottom,
    // and the two meet where the ring touches the water.
    float angle = atan(abs(d.x), max(-d.y, 0.0));
    float head = 0.5 * PI * min(s / RUN_SECONDS, 1.0);
    float crest = exp(-pow((angle - head) * RING_RADIUS / 26.0, 2.0)) * (1.0 - smoothstep(RUN_SECONDS, RUN_SECONDS + 0.8, s));
    float trail = step(angle, head) * smoothstep(0.0, 0.3, s) * (1.0 - smoothstep(RUN_SECONDS, RUN_SECONDS + 2.5, s));
    glow += core * (1.8 * crest + 0.6 * trail);
    for (int k = 0; k < 4; k++) {
      if (float(k) >= SOUND_WAVES) break;
      float since = s - RUN_SECONDS - float(k) * SOUND_GAP;
      if (since <= 0.0) continue;
      float r = RING_RADIUS + SOUND_SPEED * since;
      float fade = smoothstep(0.0, 0.2, since) * exp(-since / 1.8) * (1.0 - smoothstep(0.5 * SOUND_FADE, SOUND_FADE, since));
      glow += 0.9 * fade * (1.0 - 0.3 * float(k)) * (line(rho - r, 2.0 + 1.5 * since, blur) + 0.2 * line(rho - r, 14.0, blur));
    }
  }
  return glow * smoothstep(SHORE + 1.0, SHORE - 1.0, q.y);
}

// The painted night at q and the ring over it. The stars twinkle, each a
// whole number of times a loop, so the loop closes.
vec3 sky(vec2 q, float lod, float blur) {
  vec3 base = textureLod(u_lake, q / SIZE, lod).rgb;
  vec2 cell = floor(q / 3.0);
  float times = 20.0 + floor(hash12(cell) * 24.0);
  float twinkle = pow(0.5 + 0.5 * sin(hash12(cell + 7.0) * TAU + u_time.y * times), 10.0);
  float spark = smoothstep(0.1, 0.4, luma(base)) * smoothstep(TREES, TREES - 30.0, q.y);
  return base * (1.0 + 0.6 * twinkle * spark) + u_glow * ring(q, blur);
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
  // The view on the painting: no taller than 3:2, so a narrow frame keeps
  // the height and crops the sides.
  float aspect = u_res.x / max(u_res.y, 1.0);
  float width = u_view.z * min(1.0, aspect / 1.5);
  vec2 off = vec2(v_uv.x - 0.5, (0.5 - v_uv.y) / aspect) * width;
  float cr = cos(u_view.w), sr = sin(u_view.w);
  vec2 p = u_view.xy + vec2(cr * off.x - sr * off.y, sr * off.x + cr * off.y);
  float px = width / u_res.x;
  float lod = max(log2(px), 0.0);
  float t = u_time.x;

  // The lake under p: tan of the angle below the horizon, the point on the
  // water and how far apart neighbouring pixels land on it. Taken for every
  // pixel, before any branch, so the derivatives hold at the shore.
  float below = max(p.y - SHORE, 0.25) / FOCAL;
  vec2 at = vec2((p.x - 0.5 * SIZE.x) / FOCAL, 1.0) / below;
  vec2 ax = dFdx(at), ay = dFdy(at);
  float foot = max(length(ax), length(ay));

  vec3 c;
  if (p.y < SHORE - px) {
    c = sky(p, lod, 0.0);
  } else {
    // Wind patches: the ripple gathers and thins as gusts drift over the
    // lake, whole cycles a loop. Too far to see apart, they average.
    float gust = sin(0.8 * at.x + 0.3 * at.y - u_time.y * 2.0) * sin(0.25 * at.x - 0.55 * at.y + u_time.y * 3.0 + 1.3);
    float gusts = mix(0.45, 0.35 + 0.65 * smoothstep(-0.3, 0.7, gust), exp(-foot * foot * 0.3));

    // Wave trains: what is finer than a few pixels is not drawn but kept as
    // roughness, the spread of the slopes across and ahead.
    vec2 slope = vec2(0.0);
    vec2 rough = vec2(0.0);
    for (int i = 0; i < 12; i++) {
      vec4 w = u_wave[i];
      float part = u_part[i];
      float stir = dot(u_stir, vec4(equal(vec4(part), vec4(0.0, 1.0, 2.0, 3.0))));
      if (part > 1.5 && part < 2.5) stir *= gusts;
      float f = dot(w.xy, ax) * dot(w.xy, ax) + dot(w.xy, ay) * dot(w.xy, ay);
      float keep = exp(-0.45 * f);
      vec2 s = w.z * stir * w.xy;
      slope += s * keep * cos(dot(w.xy, at) - w.w * t + hash12(vec2(float(i), 3.0)) * TAU);
      rough += 0.5 * s * s * (1.0 - keep * keep);
    }

    // Drops: two a cell a period, the same ones every loop; each ring
    // spreads and dies down, and lands with a pin of light.
    vec2 home = floor(at / RAIN_CELL);
    float now = floor(t / RAIN_PERIOD);
    float periods = LOOP / RAIN_PERIOD;
    float kd = TAU / DROP_WAVE;
    float sharp = exp(-2.0 * pow(foot / DROP_WAVE, 2.0));
    vec2 drops = vec2(0.0);
    float dropRough = 0.0;
    float pin = 0.0;
    float crest = 0.0;
    for (int j = -1; j <= 1; j++) {
      for (int i = -1; i <= 1; i++) {
        vec2 cell = home + vec2(float(i), float(j));
        for (int n = 0; n < 2; n++) {
          float period = now - float(n);
          for (int k = 0; k < 2; k++) {
            vec3 r = hash32(cell * 1.618 + vec2(mod(period, periods) * 7.31 + float(k) * 3.7, float(k) * 11.13));
            float landed = (period + r.z) * RAIN_PERIOD;
            float age = t - landed;
            if (age < 0.0 || age > DROP_LIFE) continue;
            float strength = rain(landed);
            vec2 rel = at - (cell + r.xy) * RAIN_CELL;
            float rho = length(rel);
            float x = rho - DROP_SPEED * age;
            float spread = DROP_WAVE * (0.7 + age);
            float env = exp(-x * x / (spread * spread));
            float fade = strength * pow(1.0 - age / DROP_LIFE, 2.0) * smoothstep(0.0, 0.08, age);
            float dh = DROP_STEEP / kd * fade * env * (kd * cos(kd * x) - 2.0 * x / (spread * spread) * sin(kd * x));
            drops += dh * rel / max(rho, 1e-4);
            dropRough += 0.5 * pow(DROP_STEEP * fade * env, 2.0);
            // The ring's front catches a little of the light, a thin line
            // that keeps its light when it is too fine to draw.
            float thin = max(0.3 * DROP_WAVE, 0.8 * foot);
            crest += fade * 0.3 * DROP_WAVE / thin * exp(-x * x / (thin * thin));
            float size = max(0.008, 0.7 * foot);
            pin += strength * pow(0.008 / size, 2.0) * exp(-rho * rho / (size * size)) * exp(-age * age / 0.006);
          }
        }
      }
    }
    slope += drops * sharp;
    rough += vec2(0.5 * dropRough * (1.0 - sharp * sharp));

    // Reflect the eye's ray off the tilted water and find where it meets
    // the painted sky: the horizon is the shore line, straight ahead its middle.
    vec3 v = normalize(vec3((p.x - 0.5 * SIZE.x) / FOCAL, -below, 1.0));
    vec3 n = normalize(vec3(-slope.x, 1.0, -slope.y));
    vec3 r = reflect(v, n);
    float ahead = max(r.z, 0.05);
    vec2 q = vec2(0.5 * SIZE.x + FOCAL * r.x / ahead, SHORE - FOCAL * max(r.y, 0.0) / ahead);
    float fresnel = F0 + (1.0 - F0) * pow(1.0 - clamp(dot(-v, n), 0.0, 1.0), 5.0);

    // Glossy: unseen slopes ahead spread the reflection up and down, those
    // across spread it a little sideways. Five taps up and down, each
    // blurred to fill the gaps; the ring's line widens with them.
    float spread = 2.0 * sqrt(rough.y) * FOCAL;
    float side = 2.0 * sqrt(rough.x) * FOCAL * below;
    float blur = max(0.6 * spread, side);
    float tapLod = clamp(log2(max(px, blur)), 0.0, 8.0);
    vec3 mirror = vec3(0.0);
    float total = 0.0;
    for (int k = -2; k <= 2; k++) {
      float o = 0.8 * float(k);
      float weight = exp(-0.5 * o * o);
      vec2 tap = vec2(q.x, min(q.y + o * spread, SHORE - 0.5));
      mirror += weight * sky(tap, tapLod, blur);
      total += weight;
    }
    mirror /= total;
    // Rough water breaks the reflection into glints that keep its light.
    float rough1 = sqrt(rough.x + rough.y);
    // A glint is a few pixels each way: far off, a long thin facet.
    vec2 facet = max(vec2(0.01), 2.5 * vec2(length(vec2(ax.x, ay.x)), length(vec2(ax.y, ay.y))));
    vec2 band = exp2(ceil(log2(facet / 0.01)));
    vec2 cellAt = at / (0.01 * band);
    // Each row of facets slides its own way, so they never line up in columns.
    cellAt.x += hash12(vec2(floor(cellAt.y), band.y + 3.0));
    vec2 grain = floor(cellAt) + 17.0 * band;
    float glint = pow(0.5 + 0.5 * sin(hash12(grain) * TAU + u_time.y * (90.0 + floor(hash12(grain - 5.0) * 120.0))), 16.0);
    // Each glint swells and fades across its facet, a soft fleck, not a tile.
    vec2 swell = sin(PI * fract(cellAt));
    glint *= swell.x * swell.y / FLECK_MEAN;
    mirror *= mix(1.0, glint / GLINT_MEAN, 0.75 * smoothstep(0.004, 0.04, rough1));

    vec3 body = textureLod(u_lake, vec2(p.x, max(p.y, SHORE + 48.0)) / SIZE, 5.0).rgb;
    vec3 water = fresnel * mirror + (1.0 - fresnel) * BODY * body + u_glow * (0.8 * pin + 0.4 * crest);
    // The waterline: one pixel's blend from the painted shore into the lake.
    c = mix(sky(p, lod, 0.0), water, smoothstep(SHORE - px, SHORE + px, p.y));
  }

  if (u_out.z > 0.5) c = engrave(c);
  // Dither against banding in the glows.
  c += (hash12(gl_FragCoord.xy * 1.37) - 0.5) / 255.0;
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
