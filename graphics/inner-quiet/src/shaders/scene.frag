precision highp float;
// «Тише шума»: Art's painting «Струны» in five layers, seen by a drifting
// camera through their depth map. The land of noise rolls in over the quiet
// strings; the painting's own spikes stretch up out of it from their feet,
// with their signs; the warm brackets notice each sign and its spike sinks;
// at the end the strings go calm from his feet outward. The rings, motes,
// pulses and the tone are drawn on top in the theme's light. Positions are
// the painting's own px (y down); the values come from compose() in lib.rs,
// the constants are its #defines (browser.rs).
uniform sampler2D u_noise;    // the land of noise, its spikes and signs
uniform sampler2D u_quiet;    // the same land with every string calm
uniform sampler2D u_figure;   // him, straight alpha
uniform sampler2D u_depth;    // closeness / DEPTH_MAX: R the noise land, G the quiet (half size)
uniform sampler2D u_terrain;  // the land of noise without spikes and signs, only behind them
uniform vec2 u_res;
uniform vec4 u_window;        // painting px shown: centre, size (window() in lib.rs)
uniform float u_px;           // painting px per target px
uniform vec4 u_out;           // soft edges, -, -, -
uniform vec3 u_backdrop;      // the page around the scene
uniform vec4 u_edges;         // left, right, top, bottom
uniform float u_mode;         // recolor mode (0 accent by luminance, 2 ink on paper)
uniform vec3 u_paper;
uniform vec3 u_accent;
uniform vec3 u_highlight;
uniform vec3 u_cold;          // the first ring, the noise's front, the pulses
uniform vec3 u_warm;          // the second ring, the brackets, the swell, the light through him
uniform vec3 u_pale;          // white-hot cores
uniform vec4 u_cam;           // shift x, y (px at closeness 1), zoom, parallax
uniform vec4 u_land;          // noise front, calm front (closeness), their glows
uniform vec4 u_ring[4];       // per ring: centre, A | B, runner, light
uniform vec4 u_fx[4];         // Frame.fx
uniform vec4 u_spike[10];     // spike_uniforms()
uniform vec4 u_geo[15];       // geometry()
in vec2 v_uv;
out vec4 o;

const float PI = 3.14159265;
const float TAU = 6.28318531;
const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);

#define APEX(i) u_geo[3 * (i)].xy
#define FOOT_ROW(i) u_geo[3 * (i)].z
#define HALF(i) u_geo[3 * (i)].w
#define SIGN(i) u_geo[3 * (i) + 1].xyz
#define TIP(i) u_geo[3 * (i) + 1].w
#define FOOT_M(i) u_geo[3 * (i) + 2].xy
#define HEIGHT(i) u_spike[2 * (i)].x
#define SIGN_ON(i) u_spike[2 * (i)].y
#define GAIN(i) u_spike[2 * (i)].z
#define PATCH(i) u_spike[2 * (i)].w
#define BRACKET(i) u_spike[2 * (i) + 1].x
#define BRACKET_LIGHT(i) u_spike[2 * (i) + 1].y
#define SWAY(i) u_spike[2 * (i) + 1].z
#define SPECIAL(i) u_spike[2 * (i) + 1].w

float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float hash1(float n) { return fract(sin(n * 12.9898) * 43758.5453); }
float vnoise(float x) {
  float i = floor(x), f = fract(x);
  return mix(hash1(i), hash1(i + 1.0), f * f * (3.0 - 2.0 * f));
}
float gauss(float d, float sigma) { return exp(-d * d / (2.0 * sigma * sigma)); }
// smoothstep that falls from 1 to 0 between a and b (a < b).
float fall(float a, float b, float x) { return 1.0 - smoothstep(a, b, x); }

// lib.rs view()/unview(): the camera scales about PIVOT, nearer things more,
// and shifts nearer things more.
float zoomAt(float s) { return u_cam.z * (1.0 + u_cam.w * (s - 1.0)); }
vec2 view(vec2 p, float s) { return PIVOT + (p - PIVOT) * zoomAt(s) + u_cam.xy * s; }
vec2 unview(vec2 q, float s) { return PIVOT + (q - u_cam.xy * s - PIVOT) / zoomAt(s); }
vec4 depthAt(vec2 p) { return texture(u_depth, p / SIZE) * DEPTH_MAX; }
// lib.rs ground(), closeness(), project().
vec2 ground(vec2 p) {
  float z = FOCAL * EYE / max(p.y - HORIZON, 0.5);
  return vec2((p.x - AXIS) * z / FOCAL, z);
}
float closeness(vec2 g) { return 1.0 / (1.0 + length(vec2(g.x, g.y - DISTANCE)) / CLOSE_METRES); }
vec3 project(vec3 w) {
  float z = max(w.z, 0.1);
  return vec3(AXIS + FOCAL * w.x / z, HORIZON + FOCAL * (EYE - w.y) / z, DISTANCE / z);
}

// A spike as mask_terrain.py cut it out: a cone widening as pow 1.6 down to
// its foot, soft at its sides, its apex and its foot; the wide one also
// takes the land just round it.
float coneU(vec2 p, int i) { return (p.y - APEX(i).y) / (FOOT_ROW(i) - APEX(i).y); }
float coneW(float u, int i) { return HALF(i) * pow(max(u, 0.0), 1.6) + 10.0 + 8.0 * u; }
float cone(vec2 p, int i) {
  float u = coneU(p, i), w = coneW(u, i), dx = abs(p.x - APEX(i).x);
  return fall(w - 8.0, w + 8.0, dx) * smoothstep(APEX(i).y - 16.0, APEX(i).y - 4.0, p.y) * fall(0.85, 1.05, u);
}
float coneWide(vec2 p, int i) {
  float u = coneU(p, i), w = coneW(u, i), dx = abs(p.x - APEX(i).x);
  return fall(w + 8.0, w + 20.0, dx) * smoothstep(APEX(i).y - 28.0, APEX(i).y - 16.0, p.y) * fall(1.05, 1.17, u);
}
// The land the terrain plate replaces while a spike is down: the wide cone,
// kept inside what mask_terrain.py left of the plate.
float behind(vec2 p, int i) {
  float u = coneU(p, i), w = coneW(u, i), dx = abs(p.x - APEX(i).x);
  return fall(w + 8.0, w + 20.0, dx) * smoothstep(APEX(i).y - 28.0, APEX(i).y - 16.0, p.y) * fall(1.0, 1.1, u);
}
float disc(vec2 p, int i) { vec3 s = SIGN(i); return fall(s.z + 6.0, s.z + 16.0, distance(p, s.xy)); }

// The code rain falls: bright heads run down the painted columns, each
// column in its own place of the fall. Only the fine columns move, not the haze.
float skyRow(float y) { return fall(HORIZON - 40.0, HORIZON - 6.0, y); }
float rainAt(vec2 p) {
  float f = fract(p.y / 260.0 - u_fx[3].x + vnoise(p.x / 12.0) * 4.0);
  return 0.5 + 2.6 * pow(f, 5.0);
}
vec3 rained(vec3 c, vec3 haze, float rain, float sky) {
  return c + max(c - haze, 0.0) * (rain - 1.0) * 0.85 * sky;
}

// The theme's recolor of the painting, as scene-palette's recolor.frag.
vec3 recolor(vec3 c) {
  float level = clamp(dot(c, LUMA), 0.0, 1.0);
  if (u_mode < 0.5) return u_accent * level;
  float ink = pow(level, 1.3) * 0.74;
  vec3 muted = mix(u_accent, vec3(dot(u_accent, LUMA)), 0.4);
  vec3 tint = mix(muted, u_highlight, smoothstep(0.45, 0.95, level) * 0.55);
  return u_paper * (1.0 - ink) + tint * ink;
}

// A point of light: a hot core in the pale, a glow in its own color.
vec3 spark(float d, float core, float glow, vec3 color) {
  return u_pale * gauss(d, core) * 0.8 + color * (gauss(d, core * 1.6) * 0.6 + gauss(d, glow) * 0.22);
}

// One ring round him in the camera's view: centre + A sin θ + B cos θ, its
// front at θ = 0; a runner goes round it (dir: which way) with a bright tail.
vec3 ring(vec2 q, int r, vec3 color, float dir, float figure, float thin) {
  vec4 a = u_ring[2 * r], b = u_ring[2 * r + 1];
  vec2 C = a.xy, A = a.zw, B = b.xy;
  // At his eye's height the ring is seen edge on: keep it a thin oval.
  B.y = (B.y < 0.0 ? -1.0 : 1.0) * max(abs(B.y), 0.5);
  vec2 e = q - C;
  float cy = clamp(e.y / B.y, -1.0, 1.0);
  float th = atan(clamp((e.x - B.x * cy) / A.x, -1.0, 1.0), cy);
  for (int i = 0; i < 4; i++) {
    float sn = sin(th), cs = cos(th);
    vec2 diff = C + A * sn + B * cs - q;
    vec2 d1 = A * cs - B * sn;
    vec2 d2 = -(A * sn + B * cs);
    float g2 = dot(d1, d1) + dot(diff, d2);
    th -= clamp(dot(diff, d1) / max(g2, 1e-3), -0.25, 0.25);
  }
  float front = cos(th);
  float dist = distance(C + A * sin(th) + B * front, q);
  // Its back goes behind him.
  float hidden = fall(-0.2, 0.05, front) * figure;
  float behind = mod(dir * (b.z - th), TAU) / TAU;
  float tail = 1.0 + 1.3 * exp(-behind / 0.06) + 0.4 * exp(-behind / 0.25);
  float k = b.w * tail * (0.75 + 0.25 * front)
          * (gauss(dist, thin) * (0.8 / thin) * 0.9 + gauss(dist, 3.5) * 0.18 + exp(-dist / 16.0) * 0.03);
  vec3 light = mix(color, u_pale, 0.35 * gauss(dist, thin)) * k;
  vec2 P = C + A * sin(b.z) + B * cos(b.z);
  float hideP = fall(-0.2, 0.05, cos(b.z)) * figure;
  light += (1.0 - hideP) * b.w * 1.4 * spark(distance(q, P), 2.2, 11.0, color);
  return light * (1.0 - hidden);
}

void main() {
  vec2 q = u_window.xy + (vec2(v_uv.x, 1.0 - v_uv.y) - 0.5) * u_window.zw;
  float thin = max(0.8, 0.6 * u_px);
  float phase = u_fx[3].w;

  // Where each layer lies under this pixel: the camera moves nearer things more.
  vec2 pN = unview(q, 1.0), pQ = pN;
  for (int i = 0; i < 3; i++) {
    pN = unview(q, depthAt(pN).r);
    pQ = unview(q, depthAt(pQ).g);
  }
  vec2 pF = unview(q, 1.0);
  float sN = depthAt(pN).r;

  // The land of noise; where a spike is down, the land behind it.
  float behindSpikes = 0.0;
  for (int i = 0; i < 5; i++) behindSpikes = max(behindSpikes, max(behind(pN, i), disc(pN, i)));
  vec2 uvN = pN / SIZE;
  vec3 nz = mix(texture(u_noise, uvN).rgb, texture(u_terrain, uvN).rgb, behindSpikes);
  vec3 nzHaze = mix(textureLod(u_noise, uvN, 3.0).rgb, textureLod(u_terrain, uvN, 3.0).rgb, behindSpikes);
  float skyN = skyRow(pN.y);
  nz = rained(nz, nzHaze, rainAt(pN), skyN);
  // The strings tremble: slow waves run over the noise toward us.
  float zN = DISTANCE / max(sN, 0.06);
  nz *= 1.0 + 0.2 * sin(TAU * (3.0 * log(zN) + u_fx[3].z)) * (1.0 - skyN);

  // The spikes shoot up from their feet: the painting's own spike, stretched
  // to its height now, its tip swaying.
  for (int i = 0; i < 5; i++) {
    float g = HEIGHT(i);
    if (g <= 0.0) continue;
    vec2 A = APEX(i);
    float yb = FOOT_ROW(i);
    vec2 s = pN;
    s.y = s.y < yb ? yb - (yb - s.y) / max(g, 1e-3) : s.y;
    float u = clamp((s.y - A.y) / (yb - A.y), 0.0, 1.0);
    s.x -= SWAY(i) * (1.0 - u) * (1.0 - u);
    vec2 uvS = s / SIZE;
    vec3 c = texture(u_noise, uvS).rgb;
    // Only the spike itself comes along: beside it in the sky the painting and
    // the plate behind agree, and there the land under this pixel stays.
    vec3 gap = abs(c - texture(u_terrain, uvS).rgb);
    float own = max(skyRow(s.y) * smoothstep(0.025, 0.07, max(gap.r, max(gap.g, gap.b))), 1.0 - skyRow(s.y));
    c = rained(c, textureLod(u_noise, uvS, 3.0).rgb, rainAt(s), skyRow(s.y) * (1.0 - cone(s, i)));
    nz = mix(nz, c, max(cone(s, i), coneWide(s, i) * own));
  }

  // The quiet land, its rain falling too.
  vec2 uvQ = pQ / SIZE;
  vec3 qt = rained(texture(u_quiet, uvQ).rgb, textureLod(u_quiet, uvQ, 3.0).rgb, rainAt(pQ), skyRow(pQ.y));

  // Which land shows: the noise rolls in over the quiet from far and near to
  // his feet; where a spike sank an oval goes calm; at the end the calm
  // spreads from his feet outward.
  vec2 gq = ground(pQ);
  float c = closeness(gq);
  float groundQ = 1.0 - skyRow(pQ.y);
  float open = smoothstep(-0.04, 0.04, u_land.x - c);
  float calm = smoothstep(-0.04, 0.04, c - u_land.y);
  float noiseShare = open * (1.0 - calm);
  float rims = 0.0;
  for (int i = 0; i < 5; i++) {
    float grow = PATCH(i);
    if (grow <= 0.0) continue;
    vec2 centre = vec2(APEX(i).x, mix(HORIZON, FOOT_ROW(i), 0.6));
    vec2 radii = vec2(PATCH_REACH * HALF(i), max(PATCH_DEPTH * (FOOT_ROW(i) - HORIZON), 30.0)) * grow;
    float r = length((pQ - centre) / max(radii, vec2(1.0)));
    noiseShare *= smoothstep(0.75, 1.0, r);
    rims += sin(PI * grow) * gauss(r - 1.0, 0.06);
  }
  vec3 land = mix(qt, nz, noiseShare);

  // The signs over the tips, each swaying with its tip; the swirl turns.
  vec3 signs = vec3(0.0);
  vec3 light = vec3(0.0);
  for (int i = 0; i < 5; i++) {
    float on = SIGN_ON(i), bl = BRACKET_LIGHT(i);
    if (on <= 0.0 && bl <= 0.0) continue;
    vec3 S = SIGN(i);
    float tip = TIP(i);
    vec2 off = vec2(SWAY(i), 2.0 * sin(TAU * 7.0 * phase + 1.9 * float(i)));
    vec2 ps = unview(q, tip) - off;
    float turn = i == 4 ? -SPECIAL(4) : 0.0;
    vec2 rel = ps - S.xy;
    ps = S.xy + vec2(cos(turn) * rel.x - sin(turn) * rel.y, sin(turn) * rel.x + cos(turn) * rel.y);
    vec2 uvS = ps / SIZE;
    vec3 d = max(texture(u_noise, uvS).rgb - texture(u_terrain, uvS).rgb, 0.0) * disc(ps, i) * (1.0 - cone(ps, i));
    float dl = dot(d, LUMA);
    float gain = GAIN(i), sp = SPECIAL(i);
    float shown = on;
    if (i == 0) {
      // Words write themselves into the cloud, line by line, a pen at their head.
      vec2 w = (ps - WORDS_DISC.xy) / WORDS_DISC.z;
      float inside = fall(0.9, 1.08, length(w));
      float row = floor(clamp((w.y + 1.0) * 2.5, 0.0, 4.99));
      float order = (row + clamp((w.x + 1.0) * 0.5, 0.0, 1.0)) / 5.0;
      float written = smoothstep(0.0, 0.03, sp - order);
      shown *= mix(1.0, mix(0.3, 1.0, written), gain * inside);
      light += on * gain * inside * written * u_cold * 2.4 * dl;
      float head = clamp(sp, 0.0, 0.999) * 5.0;
      vec2 pen = WORDS_DISC.xy + vec2(fract(head) * 1.6 - 0.8, (floor(head) + 0.5) / 2.5 - 1.0) * WORDS_DISC.z;
      light += on * gain * step(sp, 0.999) * spark(distance(ps, pen), 1.6, 7.0, u_cold);
    } else if (i == 1) {
      // The chain lights from its small end to the big cloud and goes out the same way.
      for (int j = 0; j < 3; j++) {
        vec4 bb = j == 0 ? BUBBLE2 : (j == 1 ? BUBBLE1 : BUBBLE0);
        float lit = clamp(sp - float(j), 0.0, 1.0) * (1.0 - clamp(sp - 3.0 - float(j), 0.0, 1.0));
        float inB = fall(0.85, 1.35, length((ps - bb.xy) / bb.zw));
        light += on * gain * lit * inB * (u_cold * (0.06 + 2.6 * dl) + u_pale * 0.8 * dl);
      }
    } else if (i == 2) {
      // The heart beats: lub-dub in the warm, a halo round it.
      light += gain * u_warm * (2.4 * dl + 0.12 * gauss(distance(ps, S.xy), S.z * 0.7));
    } else if (i == 3) {
      // The bolt flickers.
      light += gain * (u_pale * 1.6 * dl + u_cold * 0.06 * gauss(distance(ps, S.xy), S.z));
    } else {
      // The whirlpool turns faster and faster.
      light += gain * u_cold * (1.8 * dl + 0.05 * gauss(distance(ps, S.xy), S.z * 0.8));
    }
    signs += shown * d;
    // The warm brackets close on the sign and flash as it is noticed.
    if (bl > 0.0) {
      float pr = BRACKET(i);
      float ease = smoothstep(0.0, 1.0, min(pr, 1.0));
      float R = S.z * mix(2.2, 1.15, ease) * zoomAt(tip);
      vec2 db = q - view(S.xy + off, tip);
      float rb = length(db);
      float a = mod(atan(db.y, db.x), 0.5 * PI) - 0.25 * PI;
      float arc = fall(0.3, 0.4, abs(a));
      float flash = exp(-pow((pr - 1.0) / 0.17, 2.0));
      float line = gauss(rb - R, thin * 1.2) * (0.8 / thin) + gauss(rb - R, 4.0) * 0.15;
      light += u_warm * bl * (arc * line * (1.0 + 1.5 * flash) + flash * 2.2 * dl);
    }
  }
  land += signs;
  float landL = dot(land, LUMA);

  // Him over the land.
  vec4 fig = texture(u_figure, pF / SIZE);
  float figure = smoothstep(0.065, 0.994, fig.a);
  float figL = dot(fig.rgb, LUMA);
  // He is woven of the same strings as the land: a sharper look keeps his
  // strings apart when he is small, and the dark between them deepens
  // (L -> 1.6 L^1.35) so he reads as strings over a dark body, not milk.
  vec3 strings = texture(u_figure, pF / SIZE, -0.7).rgb;
  vec3 raw = mix(land, min(strings * 1.6 * pow(max(dot(strings, LUMA), 1e-4), 0.35), 1.0), figure);
  vec3 col = recolor(raw);
  float onLand = (1.0 - figure) * groundQ;
  // Light on the land thins out toward the horizon instead of piling into a line.
  float near = smoothstep(0.02, 0.14, c);

  // The fronts: cold where the noise arrives, warm where the calm spreads.
  col += onLand * u_cold * u_land.z * gauss(c - u_land.x, 0.02) * (0.05 + 1.4 * landL) * mix(0.35, 1.0, near);
  col += onLand * u_warm * u_land.w * gauss(c - u_land.y, 0.02) * (0.05 + 1.4 * landL) * near;
  col += (1.0 - figure) * u_warm * rims * (0.04 + 1.2 * landL);

  // The heart's swell runs over the land from its spike, through him and on.
  float swellK = u_fx[2].w;
  if (swellK > 0.0) {
    float R = u_fx[2].z;
    float dist = length(gq - FOOT_M(2));
    col += onLand * swellK * u_warm * gauss(dist - R, 0.45) * (0.05 + 1.6 * landL) * smoothstep(0.0, 0.25, c);
    float him = length(FOOT_M(2) - vec2(0.0, DISTANCE));
    col += figure * swellK * u_warm * exp(-pow((R - him) / 2.0, 2.0)) * (0.05 + 1.3 * figL);
  }
  // «Второй уровень»: the warm ring fills him from the shins up.
  // Light, not paint: it glows along his outline and in his lit folds.
  float rimF = figure * clamp((1.0 - textureLod(u_figure, pF / SIZE, 3.0).a) * 2.5, 0.0, 1.0);
  float fillK = u_fx[0].y;
  col += figure * fillK * u_warm * (smoothstep(u_fx[0].x - 8.0, u_fx[0].x + 8.0, pF.y) * (0.01 + 0.22 * figL + 1.3 * rimF)
                                    + gauss(pF.y - u_fx[0].x, 5.0) * 0.5);
  // «Когда оба кольца активны»: cold pulses run out over the land.
  col += onLand * near * u_fx[1].z * u_cold * gauss(fract(c * 6.0 + u_fx[1].w) - 0.5, 0.05) * (0.03 + 1.3 * landL);
  // The close: calm light runs out along the quiet strings; a light rises
  // through him from the soles to the crown and on up as a thin tone.
  col += onLand * near * u_fx[2].x * mix(u_cold, u_pale, 0.4) * gauss(fract(c * 4.0 + u_fx[2].y) - 0.5, 0.07)
       * (0.02 + 1.1 * landL);
  float riseK = u_fx[0].w;
  col += figure * riseK * u_warm * (gauss(pF.y - u_fx[0].z, 9.0) * (0.25 + 2.2 * figL)
                                    + smoothstep(u_fx[0].z - 4.0, u_fx[0].z + 30.0, pF.y) * (0.01 + 0.15 * figL + 0.7 * rimF));
  float toneK = u_fx[1].x;
  if (toneK > 0.0) {
    float above = CROWN - 6.0 - pF.y;
    float dx = abs(pF.x - HEAD_X);
    float up = smoothstep(0.0, 12.0, above) * exp(-max(above, 0.0) / 260.0);
    float pulse = gauss(fract(pF.y / 150.0 + u_fx[1].y) - 0.5, 0.08);
    col += toneK * up * (u_warm * (gauss(dx, thin) * (0.8 / thin) * (0.5 + 1.2 * pulse) + gauss(dx, 6.0) * 0.12)
                        + u_pale * gauss(dx, thin * 0.7) * pulse * 0.6);
  }

  // The rings: the cold first slides over his sphere, the warm second climbs him.
  col += ring(q, 0, u_cold, 1.0, fig.a, thin);
  col += ring(q, 1, u_warm, -1.0, fig.a, thin);

  // Motes climb round him, in front and behind.
  vec3 motes = vec3(0.0);
  for (int i = 0; i < MOTES; i++) {
    float fi = float(i);
    float u = fract(fi / float(MOTES) + u_fx[3].y);
    float x = (hash1(fi * 7.13 + 1.0) * 2.0 - 1.0) * 2.2 + 0.15 * sin(u * TAU + fi);
    float z = DISTANCE + (hash1(fi * 3.71 + 2.0) * 2.0 - 1.0) * 2.5;
    vec3 pr = project(vec3(x, u * 2.6, z));
    vec2 Q = view(pr.xy, pr.z);
    float life = sin(u * PI);
    float hide = z > DISTANCE ? fig.a : 0.0;
    float dm = distance(q, Q);
    motes += (1.0 - hide) * life * life * u_cold * (gauss(dm, 1.3 * pr.z) * 0.8 + gauss(dm, 5.0 * pr.z) * 0.16);
  }
  col += motes + light;

  // Dither against banding in the glows.
  col += (hash(gl_FragCoord.xy * 1.37) - 0.5) / 255.0;
  if (u_out.x > 0.5) {
    float m = smoothstep(0.0, u_edges.x, v_uv.x) * smoothstep(0.0, u_edges.y, 1.0 - v_uv.x)
            * smoothstep(0.0, u_edges.z, 1.0 - v_uv.y) * smoothstep(0.0, u_edges.w, v_uv.y);
    col = mix(u_backdrop, col, m);
  }
  o = vec4(clamp(col, 0.0, 1.0), 1.0);
}
