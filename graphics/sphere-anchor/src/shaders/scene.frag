#version 300 es
precision highp float;
// Art's figure of light stands at the origin on a floor grid (y = 0), facing
// the camera; the dark around it is open space. Every value that moves comes
// from compose() in lib.rs; this pass casts one ray a pixel and paints, back
// to front: the rain far behind, the floor and what runs over it, the figure
// mirrored in it, the figure, then the light in front of it.
uniform sampler2D u_fig;
uniform sampler2D u_form; // signed distance to the body, image px (lib.rs form_field)
uniform vec2 u_res;      // target px
uniform vec4 u_out;      // straight to the canvas, soft edges, engrave on the page, -
uniform vec3 u_backdrop; // the page around the scene
uniform vec4 u_edges;    // left, right, top, bottom
uniform vec4 u_eye;      // eye, tan of half the view's height
uniform vec4 u_target;   // where it looks, the glow the light leaves in the body
uniform vec4 u_life;     // drift, speed, the flash as it stops, lids
uniform vec4 u_lightA;   // side reach, side strength, band height, band strength
uniform vec4 u_lightB;   // contact, ring radius, ring strength, dent
uniform vec4 u_lightC;   // aura, axis bottom, axis strength, anchor
uniform vec4 u_image;    // the texture's px across and down, its empty rows over the figure, the form's range
uniform vec4 u_more;     // how high the outline has drawn, breath, the rain's progress, -
uniform vec3 u_glow;     // the light the beats add
uniform vec3 u_deep;     // the engraving's deepest ink
uniform vec3 u_mid;      // its middle ink
uniform vec4 u_geo[4];   // GEOMETRY in lib.rs
in vec2 v_uv;
out vec4 o;

const float TAU = 6.28318531;
// Where the middle ink sits on the way from full ink to the page.
const float MID_AT = 0.45;

#define UNIT u_geo[0].x
#define CENTRE u_geo[0].y
#define SOLE u_geo[0].z
#define HEIGHT u_geo[0].w
#define FOOT_L u_geo[1].x
#define FOOT_R u_geo[1].y
#define HEEL_Z u_geo[1].z
#define BALL_Z u_geo[1].w
#define CELL u_geo[2].x
#define ANCHOR_Y u_geo[2].y
#define ENGRAVE_WHITE u_geo[2].z
#define ENGRAVE_GAMMA u_geo[2].w
#define AXIS_TOP u_geo[3].x
#define DENT_DEPTH u_geo[3].y
#define DENT_RADIUS u_geo[3].z
#define AXIS_END u_geo[3].w

float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
vec2 hash2(vec2 p) { return vec2(hash(p), hash(p + 19.19)); }
float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

vec3 eye, fw, rt, up, d;
float px;
// How far below the floor the body has settled.
float sink;

// The floor's sag at p: a well under the body, deepest at its centre.
float well(vec2 p) {
  return DENT_DEPTH * u_lightB.w * exp(-dot(p, p) / (DENT_RADIUS * DENT_RADIUS));
}
// A point's glow, `size` px across, wherever it is in front of the eye.
float spot(vec3 p, float size) {
  vec3 v = p - eye;
  float depth = dot(v, fw);
  if (depth <= 0.0) return 0.0;
  float r = length(cross(v, d)) / (depth * px) / size;
  return exp(-r * r);
}

// The light themes engrave the dark scene on the page: black is the page,
// the brightest light the deep ink (lib.rs engrave).
vec3 engrave(vec3 c) {
  float t = 1.0 - pow(clamp(luma(c) / ENGRAVE_WHITE, 0.0, 1.0), ENGRAVE_GAMMA);
  vec3 ink = t < MID_AT ? mix(u_deep, u_mid, t / MID_AT)
                        : mix(u_mid, u_backdrop, (t - MID_AT) / (1.0 - MID_AT));
  return min(ink, u_backdrop);
}

// Motes in the open space: a plane of cells at depth z, one mote in some of
// them, drifting up whole cells and swaying whole cycles a loop.
vec3 motes(float z, float cell, float size, float bright, float seed) {
  if (abs(d.z) < 1e-4) return vec3(0.0);
  float t = (z - eye.z) / d.z;
  if (t <= 0.0) return vec3(0.0);
  vec3 q = eye + d * t;
  float drift = u_life.x;
  vec2 g = q.xy / cell - vec2(0.0, drift * 2.0);
  vec2 id = floor(g);
  vec2 h = hash2(id + seed);
  if (h.x < 0.55) return vec3(0.0);
  vec2 at = fract(g) - 0.5 - (h - 0.5) * 0.6;
  at.x += 0.18 * sin(TAU * (drift + h.y));
  float r = length(at) * cell / (t * px) / size;
  float twinkle = 0.55 + 0.45 * sin(TAU * (h.y + drift * floor(2.0 + h.x * 4.0)));
  // Fewer motes far off to the sides and none below the floor.
  float keep = smoothstep(-0.05, 0.25, q.y) * (1.0 - smoothstep(3.0, 6.0, abs(q.x)));
  return u_glow * bright * exp(-r * r) * twinkle * keep * (1.0 + 2.0 * u_life.z);
}

// Digital rain on a far plane at depth z: columns of dot glyphs, cw wide,
// falling whole periods a loop, each head bright and its trail fading; the
// glyphs change as it falls. It crawls while the world stands still.
vec3 rain(float z, float cw, float bright, float seed) {
  if (abs(d.z) < 1e-4) return vec3(0.0);
  float t = (z - eye.z) / d.z;
  if (t <= 0.0) return vec3(0.0);
  vec3 q = eye + d * t;
  // Only above the floor: below it the floor is nearer.
  if (q.y <= 0.0) return vec3(0.0);
  vec2 g = vec2(q.x / cw, -q.y / (cw * 1.6));
  vec2 id = floor(g);
  float column = hash(vec2(id.x, seed));
  if (column < 0.42) return vec3(0.0);
  // Heads fall from over the view to under the floor, two or three periods
  // a loop.
  float period = 40.0;
  float k = 2.0 + floor(hash(vec2(id.x, seed + 1.3)) * 2.0);
  float head = fract(hash(vec2(id.x, seed + 2.7)) + u_more.z * k) * period - (period - 6.0);
  float behind = floor(head) - id.y;
  if (behind < 0.0) return vec3(0.0);
  float len = 5.0 + 10.0 * hash(vec2(id.x, seed + 4.1));
  float trail = exp(-behind / len * 1.3) * (behind < 1.0 ? 2.0 : 1.0);
  // The glyph: 3 x 5 dots, a new one some 60 times a loop, the same at the
  // two ends of the loop.
  float glyph = mod(floor(u_more.z * 60.0 + hash(id + seed) * 60.0), 60.0);
  vec2 s = (fract(g) - vec2(0.15, 0.1)) / vec2(0.7, 0.8) * vec2(3.0, 5.0);
  vec2 dotId = floor(s);
  float within = step(0.0, s.x) * step(s.x, 3.0) * step(0.0, s.y) * step(s.y, 5.0);
  float on = step(0.45, hash(id * 3.1 + dotId * 0.7 + glyph * 1.37 + seed));
  // Dots under a pixel and a half blur into their average.
  float size = cw * 0.7 / 3.0 / (t * px);
  float r = length(fract(s) - 0.5);
  float dotLight = mix(0.3, 1.0 - smoothstep(0.32 - 0.5 / size, 0.32 + 0.5 / size, r), smoothstep(1.2, 2.2, size));
  float keep = smoothstep(0.0, 0.6, q.y) * (1.0 - smoothstep(4.0, 7.5, abs(q.x)))
             * exp(-max(t - 6.0, 0.0) * 0.07);
  return u_glow * bright * trail * on * within * dotLight * keep * (1.0 + 1.5 * u_life.z);
}

// The floor where the ray meets it: the grid, the light running along it,
// the figure's light on it, the side light, the wave and the well.
vec3 floorAt(vec3 p) {
  vec2 xz = p.xz;
  float dist = length(p - eye);
  float r = length(xz);
  // Grid lines a pixel wide, faded where they get finer than a pixel.
  vec2 g = xz / CELL;
  vec2 w = fwidth(g);
  vec2 q = abs(fract(g - 0.5) - 0.5) / max(w, 1e-4);
  float line = max(1.0 - smoothstep(0.0, 1.2, q.x), 1.0 - smoothstep(0.0, 1.2, q.y));
  line *= 1.0 - smoothstep(0.2, 0.6, max(w.x, w.y));
  // A finer grid close round the figure, five lines to a cell.
  vec2 gf = xz / (CELL * 0.2);
  vec2 wf = fwidth(gf);
  vec2 qf = abs(fract(gf - 0.5) - 0.5) / max(wf, 1e-4);
  float fine = max(1.0 - smoothstep(0.0, 1.2, qf.x), 1.0 - smoothstep(0.0, 1.2, qf.y));
  fine *= (1.0 - smoothstep(0.2, 0.6, max(wf.x, wf.y))) * exp(-r * r / 1.6);
  float fog = exp(-max(dist - 4.0, 0.0) * 0.28) * (1.0 - smoothstep(6.0, 11.0, r));
  // Each grid line carries one dash of light running along it, frozen while
  // the world stands still.
  vec2 cellId = floor(g + 0.5);
  float runX = (fract(hash(vec2(cellId.y, 3.1)) + u_life.x) - 0.5) * 14.0;
  float runZ = (fract(hash(vec2(cellId.x, 7.7)) - u_life.x) - 0.5) * 14.0;
  float onX = step(0.55, hash(vec2(cellId.y, 1.3))) * (1.0 - smoothstep(0.0, 1.2, q.y));
  float onZ = step(0.55, hash(vec2(cellId.x, 5.9))) * (1.0 - smoothstep(0.0, 1.2, q.x));
  float dash = onX * exp(-pow((xz.x - runX) / 0.35, 2.0)) + onZ * exp(-pow((xz.y - runZ) / 0.35, 2.0));
  // The side light runs out from the body to both sides, a crest at its front.
  float reach = u_lightA.x;
  float side = u_lightA.y * (1.0 - smoothstep(reach - 0.4, reach, abs(xz.x)))
             * (0.35 + 0.65 * exp(-pow((abs(xz.x) - reach) / 0.3, 2.0)));
  // The wave through the floor from the points of contact.
  float e = r - u_lightB.y;
  float wave = u_lightB.z * exp(-e * e / 0.004) * (1.0 - smoothstep(2.0, 4.0, u_lightB.y));
  float near = u_lightB.z * exp(-e * e / 0.06) * (1.0 - smoothstep(2.0, 4.0, u_lightB.y));
  // The well: its lines catch a little more light the deeper it is.
  float deep = well(xz) / max(DENT_DEPTH, 1e-4);
  float lit = 0.2 + 0.14 * exp(-r * r / 5.0) + 0.6 * deep * u_lightB.w + 1.4 * side + 2.0 * near
            + 0.6 * u_life.z;
  vec3 c = u_glow * line * lit + u_glow * 0.07 * fine;
  c += u_glow * 0.7 * dash * line * fog;
  c += u_glow * (0.09 * side + 0.5 * wave);
  // The figure's own light on the floor around its feet, breathing.
  c += u_glow * (0.11 + 0.03 * u_more.y) * exp(-(xz.x * xz.x / 0.3 + xz.y * xz.y / 0.16));
  // The points of contact light the floor under them.
  float touch = 0.0;
  for (int i = 0; i < 2; i++) {
    float x = i == 0 ? FOOT_L : FOOT_R;
    vec2 heel = xz - vec2(x, HEEL_Z), ball = xz - vec2(x * 1.1, BALL_Z);
    touch += exp(-dot(heel, heel) / 0.0025) + exp(-dot(ball, ball) / 0.0025);
  }
  c += u_glow * 0.9 * u_lightB.x * touch;
  return c * fog;
}

void main() {
  vec2 ndc = v_uv * 2.0 - 1.0;
  float aspect = u_res.x / max(u_res.y, 1.0);
  eye = u_eye.xyz;
  fw = normalize(u_target.xyz - eye);
  rt = normalize(vec3(-fw.z, 0.0, fw.x));
  up = cross(rt, fw);
  d = normalize(fw + ndc.x * u_eye.w * aspect * rt + ndc.y * u_eye.w * up);
  px = 2.0 * u_eye.w / max(u_res.y, 1.0);
  sink = DENT_DEPTH * u_lightB.w;

  // Open space: black, a faint glow along the horizon, and far behind the
  // rain, three planes deep.
  vec3 c = u_glow * 0.03 * exp(-abs(d.y) * 14.0);
  c += rain(-12.0, 0.12, 0.24, 11.0);
  c += rain(-7.0, 0.1, 0.3, 23.0);
  c += rain(-4.0, 0.09, 0.36, 37.0);
  c += motes(-3.2, 0.42, 1.2, 0.5, 1.0);
  c += motes(-1.6, 0.36, 1.6, 0.6, 2.0);

  // The floor, settled into the well: two steps onto the sagging surface.
  // Painted for every pixel (its grid needs screen derivatives), kept below
  // the horizon.
  float dy = min(d.y, -1e-4);
  vec3 p = eye + d * (-eye.y / dy);
  for (int i = 0; i < 2; i++) p = eye + d * ((-well(p.xz) - eye.y) / dy);
  float ground = step(d.y, -1e-4);
  c += floorAt(p) * ground;

  // The figure stands in a plane through the origin square to the camera.
  vec3 n = normalize(vec3(fw.x, 0.0, fw.z));
  // The floor mirrors it, faint and softer the farther from the soles.
  vec3 dr = vec3(d.x, -d.y, d.z);
  float tr = -dot(p, n) / dot(dr, n);
  vec3 qr = p + dr * tr;
  float lr = qr.y + sink;
  vec2 uvr = vec2(CENTRE + dot(qr, rt) / UNIT, u_image.z + SOLE - lr / UNIT) / u_image.xy;
  float seen = ground * step(0.0, tr) * step(0.0, lr) * step(0.0, uvr.x) * step(uvr.x, 1.0) * step(0.0, uvr.y) * step(uvr.y, 1.0);
  vec4 mirror = textureLod(u_fig, uvr, 1.5 + 2.5 * clamp(lr, 0.0, 1.0));
  float fade = exp(-length(p.xz) * 0.5) * exp(-lr * 1.0);
  c += (mirror.rgb * mirror.a + 0.25 * mirror.rgb * (1.0 - mirror.a)) * 0.35 * fade * seen;

  // The axis, from above the crown down into the ground: the point on it
  // nearest the ray, kept within the part already drawn.
  vec3 axisGlow = vec3(0.0);
  if (u_lightC.z > 0.0) {
    float b = d.y, de = dot(d, eye);
    float s = (eye.y - b * de) / max(1.0 - b * b, 1e-4);
    s = clamp(s, u_lightC.y, AXIS_TOP);
    vec3 a = vec3(0.0, s, 0.0);
    float depth = dot(a - eye, fw);
    float r = length(cross(a - eye, d)) / (depth * px);
    float under = s < -sink ? 0.45 * exp((s + sink) * 1.2) : 1.0;
    float head = smoothstep(0.0, 0.3, u_lightC.y - AXIS_END);
    axisGlow = u_glow * u_lightC.z * under * (1.3 * exp(-r * r / 1.4) + 0.3 * exp(-r * r / 40.0));
    axisGlow += u_glow * u_lightC.z * head * 2.0 * spot(vec3(0.0, u_lightC.y, 0.0), 5.0);
  }

  // The figure, the image standing on the floor of the well.
  // Sampled for every pixel (mip levels and the outline need screen
  // derivatives), kept within the texture and above the floor of the well.
  float tf = -dot(eye, n) / dot(d, n);
  vec3 q = eye + d * tf;
  float ly = q.y + sink;
  // Each breath in widens the chest a little and lifts the shoulders.
  float breath = u_more.y;
  float chest = 1.0 + 0.016 * breath * exp(-pow((ly - 1.28) / 0.24, 2.0));
  float lift = 0.004 * breath * smoothstep(0.95, 1.45, ly);
  vec2 uv = vec2(CENTRE + dot(q, rt) / UNIT / chest, u_image.z + SOLE - (ly - lift) / UNIT) / u_image.xy;
  float inside = step(0.0, tf) * step(0.0, ly) * step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0);
  vec4 body = texture(u_fig, uv) * inside;
  // How far outside the body, image px.
  float dist = (texture(u_form, uv).r - 0.5) * u_image.w;
  float aa = max(fwidth(dist), 1e-3);
  float halo = exp(-max(dist, 0.0) / 24.0) * (1.0 - body.a) * inside;
  // The form's outline: two even lines at fixed distances, drawn up from the
  // floor over the crown, a spark at their front; the near one breathes.
  float rise = u_more.x;
  float drawn = (1.0 - smoothstep(rise - 0.1, rise, ly)) * inside * step(0.0, dist);
  float near = 28.0 + 5.0 * breath;
  float l1 = 1.0 - smoothstep(0.5, 1.5, abs(dist - near) / aa);
  float l2 = 1.0 - smoothstep(0.5, 1.5, abs(dist - 62.0) / aa);
  float glowLine = exp(-pow((dist - near) / 9.0, 2.0));
  float climbing = 1.0 - smoothstep(HEIGHT, HEIGHT + 0.35, rise);
  float tip = exp(-pow((ly - rise) / 0.05, 2.0)) * climbing * inside * step(0.0, dist);
  float contour = drawn * (l1 + 0.45 * l2 + 0.18 * glowLine) + tip * (2.0 * l1 + l2 + 0.6 * glowLine);
  // Engraved on a light page the soft glow around the body would be a dark
  // cloud: there it stays at half, so the figure and its lines lead.
  float cloud = u_out.z > 0.5 ? 0.5 : 1.0;
  // The authored glow lives in the colour where alpha is 0: kept from the
  // floor to just over the crown.
  // It is cut where the image ends just over the crown, so it fades out first.
  float column = smoothstep(0.0, 0.12, ly) * (1.0 - smoothstep(HEIGHT - 0.3, SOLE * UNIT - 0.01, ly));
  c += body.rgb * (1.0 - body.a) * 0.45 * cloud * column;
  // The light has passed down through everything above the band, and leaves
  // its glow there.
  float passed = smoothstep(u_lightA.z - 0.02, u_lightA.z + 0.06, ly);
  float band = exp(-pow((ly - u_lightA.z) / 0.02, 2.0)) * u_lightA.w;
  vec3 lit = body.rgb * (1.0 + 0.12 * breath + 0.7 * u_target.w * passed + 0.6 * u_life.z) + u_glow * 1.6 * band;
  c = mix(c, lit, body.a);
  // The band rings the body as it falls; then the form's outline holds.
  float bandHalo = exp(-pow((ly - u_lightA.z) / 0.05, 2.0)) * u_lightA.w;
  c += u_glow * cloud * (0.6 * bandHalo * halo + 0.25 * u_life.z * halo + 0.06 * breath * halo);
  c += u_glow * u_lightC.x * (0.9 * contour + 0.2 * cloud * halo);

  c += axisGlow;
  // The points of contact: heel and ball of each foot.
  float pts = 0.0;
  for (int i = 0; i < 2; i++) {
    float x = i == 0 ? FOOT_L : FOOT_R;
    pts += spot(vec3(x, -sink, HEEL_Z), 5.0) + spot(vec3(x * 1.1, -sink, BALL_Z), 5.0);
    pts += 0.3 * (spot(vec3(x, -sink, HEEL_Z), 22.0) + spot(vec3(x * 1.1, -sink, BALL_Z), 22.0));
  }
  float flare = 1.0 + 1.5 * exp(-pow(u_lightB.y / 0.15, 2.0)) * u_lightB.z;
  c += u_glow * 1.4 * u_lightB.x * flare * pts;
  // The anchor in the body.
  vec3 anchor = vec3(0.0, ANCHOR_Y - sink, 0.0);
  c += u_glow * u_lightC.w * (2.4 * spot(anchor, 6.0) + 0.8 * spot(anchor, 26.0) + 0.25 * spot(anchor, 70.0));

  // Motes between us and the figure, large and soft.
  c += motes(1.1, 0.5, 3.5, 0.35, 3.0);
  c += motes(2.4, 0.6, 7.0, 0.25, 4.0);

  // Side vision: the edges of the view wake.
  c += u_glow * 0.09 * u_lightA.y * smoothstep(0.45, 1.0, abs(ndc.x));
  // The lids: lowered, the view narrows from above to a soft eye shape.
  float lids = u_life.w;
  float top = 1.15 - lids * 0.7 * (1.0 - 0.3 * ndc.x * ndc.x);
  float bottom = -1.15 + lids * 0.2 * (1.0 - 0.3 * ndc.x * ndc.x);
  c *= (1.0 - smoothstep(top - 0.3, top + 0.05, ndc.y)) * smoothstep(bottom - 0.05, bottom + 0.25, ndc.y);

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
