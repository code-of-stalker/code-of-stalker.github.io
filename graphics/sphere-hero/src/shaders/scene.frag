#version 300 es
precision highp float;
// Art's four layers seen by a drifting camera, and the wave of light that
// leaves the feet. Positions are the painting's own pixels (y down); the
// arrival functions mirror lib.rs.
uniform sampler2D u_world;
uniform sampler2D u_reflection;
uniform sampler2D u_figure;
uniform sampler2D u_front;
uniform vec2 u_res;      // target px
uniform vec4 u_out;      // straight to the canvas, soft edges, light paintings, light print
uniform vec3 u_backdrop; // the page around the scene
uniform vec4 u_edges;    // left, right, top, bottom
uniform vec4 u_motion;   // wave seconds, branch angle, leaf flutter, loop phase
uniform vec4 u_drift;    // camera x, y (-1..1), bird lift px, -
uniform vec3 u_glow;     // the wave's light, or its ink on the light paintings
uniform vec3 u_deep;     // the light print's deepest ink
uniform vec4 u_mid;      // its middle ink, and how much painted colour stays
uniform vec4 u_geo[7];   // GEOMETRY in lib.rs
uniform vec4 u_window;   // painting px shown: centre, size (window() in lib.rs)
in vec2 v_uv;
out vec4 o;

const vec2 SIZE = vec2(1536.0, 1024.0);
const float PI = 3.14159265;
// Art px a layer moves per unit of nearness off the feet's, at full drift.
const float SWING = 60.0;
// Nearness (1 / depth) of the far world and of the branch and bird.
const float FAR = 0.036;
const float FRONT = 0.45;

#define FEET u_geo[0].xy
#define HORIZON u_geo[0].z
#define FLOOR_K u_geo[0].w
#define RIM u_geo[1].x
#define FLOOR_START u_geo[1].y
#define FLOOR_SPEED u_geo[1].z
#define CLIMB u_geo[1].w
#define PIVOT u_geo[2].xy
#define TREE_START u_geo[2].z
#define TREE_RATE u_geo[2].w
#define BIRD u_geo[3].xy
#define BIRD_CALL u_geo[3].z
#define RIVER u_geo[4]
#define SPHERE u_geo[5]
#define SHELL_START u_geo[6].x
#define SHELL_SPAN u_geo[6].y
#define BODY_START u_geo[6].z
#define BODY_SPAN u_geo[6].w

float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
vec4 at(sampler2D s, vec2 p) { return texture(s, p / SIZE); }

// The floor under a row, in eye heights: across and away.
vec2 ground(vec2 p) {
  float z = FLOOR_K / max(p.y - HORIZON, 1.0);
  return vec2((p.x - SIZE.x * 0.5) * z / FLOOR_K, z);
}
float nearness(float y) { return max(max(y - HORIZON, 0.0) / FLOOR_K, FAR); }
// The camera's drift moves what is nearer than the feet against what is farther.
vec2 shift(float near) {
  float k = (near - nearness(FEET.y)) * SWING;
  return -vec2(u_drift.x, u_drift.y) * k;
}

float worldArrival(vec2 p) {
  float across = distance(ground(vec2(p.x, max(p.y, RIM))), ground(FEET));
  return FLOOR_START + across / FLOOR_SPEED + max(RIM - p.y, 0.0) / CLIMB;
}
float shellArrival(vec2 p) {
  vec2 d = (p - SPHERE.xy) / SPHERE.zw;
  return SHELL_START + atan(abs(d.x), d.y) / PI * SHELL_SPAN;
}
// The crest of the wave and the glow it leaves behind for a moment.
float crest(float s, float width) { return exp(-s * s / (width * width)); }
float lit(float arrival) {
  float s = u_motion.x - arrival;
  return crest(s, 0.22) + 0.35 * smoothstep(-0.1, 0.15, s) * (1.0 - smoothstep(0.15, 2.2, s));
}

bool lightPaintings() { return u_out.z > 0.5; }
// Lighting raises the painting's own light; on the light paintings the same
// amount deepens their ink instead, so nothing gets paler than the page.
vec3 shine(vec3 c, float k) {
  if (lightPaintings()) return mix(c, c * u_glow, clamp(k * 0.5, 0.0, 0.85));
  return c * (1.0 + k);
}
vec3 glowOn(vec3 c, float k) {
  if (lightPaintings()) return mix(c, c * u_glow * u_glow, clamp(k, 0.0, 0.9));
  return c + u_glow * k;
}

// A light theme prints the light painting in two muted inks on its page;
// Art's paper level and anything lighter is the page itself (lib.rs print).
const float PAPER_LEVEL = 0.875;
const float MID_AT = 0.45;
vec3 print(vec3 c) {
  float t = clamp(dot(c, vec3(0.2126, 0.7152, 0.0722)) / PAPER_LEVEL, 0.0, 1.0);
  vec3 ink = t < MID_AT ? mix(u_deep, u_mid.rgb, t / MID_AT)
                        : mix(u_mid.rgb, u_backdrop, (t - MID_AT) / (1.0 - MID_AT));
  return min(mix(ink, c, u_mid.a * (1.0 - smoothstep(0.85, 1.0, t))), u_backdrop);
}

vec3 world(vec2 q) {
  vec2 p = q - shift(nearness(q.y));
  vec3 c = at(u_world, p).rgb;
  float w = u_motion.x;
  // Floor and forest: the ring, then the climbing front.
  float t = worldArrival(p);
  float luma = dot(c, vec3(0.2126, 0.7152, 0.0722));
  float ink = smoothstep(0.03, 0.25, lightPaintings() ? 1.0 - luma : luma);
  c = shine(c, 1.4 * lit(t));
  // The crest itself catches the painted texture, so the front reads as a line.
  c = glowOn(c, 0.3 * crest(w - t, 0.16) * ink);
  // The ring's own line on the floor, thin in depth and wide at the sides,
  // with a soft band of light riding just behind it.
  float across = distance(ground(vec2(p.x, max(p.y, RIM))), ground(FEET));
  float reach = (w - FLOOR_START) * FLOOR_SPEED;
  float floorOnly = smoothstep(RIM, RIM + 24.0, p.y) * (1.0 - smoothstep(13.0, 18.0, across));
  float line = exp(-pow((across - reach) / 0.2, 2.0));
  float band = exp(-pow((across - reach + 0.6) / 0.9, 2.0));
  c = glowOn(c, (0.6 * line + 0.1 * band) * floorOnly * step(0.0, w - FLOOR_START));
  // A pool of light gathers under the soles before the wave leaves.
  vec2 f = (p - FEET) / vec2(120.0, 26.0);
  float pool = exp(-dot(f, f)) * smoothstep(0.0, 0.25, w) * (1.0 - smoothstep(0.25, 0.95, w));
  c = glowOn(c, 0.45 * pool);
  // The river glints where the front has climbed past it.
  vec2 r = (p - RIVER.xy) / RIVER.zw;
  float river = (1.0 - smoothstep(0.6, 1.0, length(r)));
  float shine0 = dot(at(u_world, p).rgb, vec3(0.2126, 0.7152, 0.0722));
  float wet = smoothstep(0.16, 0.34, lightPaintings() ? 1.0 - shine0 : shine0);
  float since = w - worldArrival(RIVER.xy);
  float glints = smoothstep(0.0, 0.3, since) * (1.0 - smoothstep(0.6, 2.4, since));
  vec2 cell = floor(p / 3.0);
  float twinkle = pow(0.5 + 0.5 * sin(hash(cell) * 40.0 + u_motion.w * 23.0), 14.0);
  c = glowOn(c, 0.9 * river * wet * twinkle * glints);
  // The orbits of the sphere light up its shell, from the floor to the crown.
  vec2 d = (p - SPHERE.xy) / SPHERE.zw;
  float e = length(d);
  float shell = smoothstep(0.5, 0.72, e) * (1.0 - smoothstep(1.05, 1.16, e)) * (1.0 - smoothstep(RIM, RIM + 60.0, p.y));
  c = shine(c, 1.9 * shell * lit(shellArrival(p)));
  // Between waves the code rain keeps falling down its own streaks.
  float column = floor(p.x / 5.0);
  float rate = 2.0 + floor(hash(vec2(column, 7.0)) * 3.0);
  float u = fract(p.y / SIZE.y - u_motion.w / (2.0 * PI) * rate - hash(vec2(column, 3.0)));
  float drop = pow(smoothstep(0.84, 1.0, u), 2.0) * step(0.55, hash(vec2(column, 11.0))) * smoothstep(1.0, 1.06, e);
  // On a light page the rain is a faint ink, not dark streaks.
  c = shine(c, (lightPaintings() ? 0.6 : 1.6) * drop);
  return c;
}

// The branch bends about its base, its leaves flutter and the bird lifts.
vec2 frontSource(vec2 q) {
  vec2 p = q - shift(FRONT);
  float branch = 1.0 - smoothstep(820.0, 880.0, p.x);
  vec2 r = p - PIVOT;
  float bend = u_motion.y * smoothstep(0.0, 760.0, length(r)) * branch;
  float cb = cos(bend), sb = sin(bend);
  p = PIVOT + mat2(cb, sb, -sb, cb) * r;
  float leaf = u_motion.z * branch * smoothstep(80.0, 300.0, length(r));
  p += leaf * 1.6 * vec2(sin(p.y * 0.045 + u_motion.w * 7.0), cos(p.x * 0.05 - u_motion.w * 6.0));
  p.y += u_drift.z * smoothstep(990.0, 1010.0, p.x);
  return p;
}

void main() {
  vec2 q = u_window.xy + (vec2(v_uv.x, 1.0 - v_uv.y) - 0.5) * u_window.zw;
  float w = u_motion.x;
  vec3 c = world(q);

  // The reflection lies on the floor under the feet and moves with it.
  vec2 pr = q - shift(nearness(FEET.y));
  vec4 reflection = at(u_reflection, pr);
  reflection.rgb = shine(reflection.rgb, 1.2 * lit(worldArrival(pr)));
  c = mix(c, reflection.rgb, reflection.a);

  // The figure stands on that floor; the light rises through the body.
  vec4 body = at(u_figure, pr);
  float rise = BODY_START + (FEET.y - pr.y) / 700.0 * BODY_SPAN;
  body.rgb = shine(body.rgb, 0.9 * lit(rise));
  c = mix(c, body.rgb, body.a);

  // The branch and the bird, nearest of all.
  vec2 pf = frontSource(q);
  vec4 front = at(u_front, pf);
  float isBird = smoothstep(860.0, 900.0, pf.x);
  float reached = mix(TREE_START + distance(pf, PIVOT) * TREE_RATE, BIRD_CALL, isBird);
  front.rgb = shine(front.rgb, 1.5 * lit(reached));
  c = mix(c, front.rgb, front.a);

  // The bird's call: rings open to its left when the wave reaches it.
  vec2 b = q - shift(FRONT) - BIRD;
  float rb = length(b);
  float side = smoothstep(-0.25, -0.6, b.x / max(rb, 1.0));
  float call = 0.0;
  for (int k = 0; k < 3; k++) {
    float s = w - BIRD_CALL - float(k) * 0.3;
    float radius = 24.0 + s * 150.0;
    float ring = exp(-pow((rb - radius) / 2.6, 2.0));
    call += step(0.0, s) * ring * (1.0 - smoothstep(70.0, 230.0, radius));
  }
  c = glowOn(c, 0.55 * call * side);

  if (u_out.w > 0.5) c = print(c);
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
    if (lightPaintings()) c = min(c, u_backdrop);
  }
  o = vec4(clamp(c, 0.0, 1.0), 1.0);
}
