#version 300 es
precision highp float;
// Art's figure of light stands at the origin on a floor grid (y = 0), facing
// the camera; the dark around it is open space. Every value that moves comes
// from compose() in lib.rs; this pass casts one ray a pixel and paints, back
// to front: the floor and what runs over it, the figure, then the light in
// front of it.
uniform sampler2D u_fig;
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
uniform vec4 u_image;    // the texture's px across and down, its empty rows over the figure, -
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
  vec3 c = u_glow * line * lit;
  c += u_glow * 0.7 * dash * line * fog;
  c += u_glow * (0.09 * side + 0.5 * wave);
  // The figure's own light on the floor around its feet.
  c += u_glow * 0.11 * exp(-(xz.x * xz.x / 0.3 + xz.y * xz.y / 0.16));
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

  // Open space: black, a faint glow along the horizon.
  vec3 c = u_glow * 0.03 * exp(-abs(d.y) * 14.0);
  c += motes(-3.2, 0.42, 1.2, 0.5, 1.0);
  c += motes(-1.6, 0.36, 1.6, 0.6, 2.0);

  // The floor, settled into the well: two steps onto the sagging surface.
  // Painted for every pixel (its grid needs screen derivatives), kept below
  // the horizon.
  float dy = min(d.y, -1e-4);
  vec3 p = eye + d * (-eye.y / dy);
  for (int i = 0; i < 2; i++) p = eye + d * ((-well(p.xz) - eye.y) / dy);
  c += floorAt(p) * step(d.y, -1e-4);

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

  // The figure: a plane through the origin square to the camera, the image
  // standing on the floor of the well.
  // Sampled for every pixel (mip levels need screen derivatives), kept
  // within the texture and above the floor of the well.
  vec3 n = normalize(vec3(fw.x, 0.0, fw.z));
  float tf = -dot(eye, n) / dot(d, n);
  vec3 q = eye + d * tf;
  float ly = q.y + sink;
  vec2 uv = vec2(CENTRE + dot(q, rt) / UNIT, u_image.z + SOLE - ly / UNIT) / u_image.xy;
  float inside = step(0.0, tf) * step(0.0, ly) * step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0);
  vec4 body = texture(u_fig, uv) * inside;
  float soft = textureLod(u_fig, uv, 4.0).a * inside;
  float wide = textureLod(u_fig, uv, 6.0).a * inside;
  float halo = soft * (1.0 - body.a);
  float contour = exp(-pow((wide - 0.22) / 0.06, 2.0)) * (1.0 - soft) * inside;
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
  vec3 lit = body.rgb * (1.0 + 0.7 * u_target.w * passed + 0.6 * u_life.z) + u_glow * 1.6 * band;
  c = mix(c, lit, body.a);
  // The band rings the body as it falls; then the form's outline holds.
  float bandHalo = exp(-pow((ly - u_lightA.z) / 0.05, 2.0)) * u_lightA.w;
  c += u_glow * cloud * (0.6 * bandHalo * halo + 0.25 * u_life.z * halo);
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
