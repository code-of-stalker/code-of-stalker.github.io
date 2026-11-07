#version 300 es
precision highp float;
// Art's painting seen by a drifting, leaning camera through its depth map;
// the ring and the helix motes, drawn in depth; the beat: the scan down
// through the figure and the ripple from its feet. The painting is recolored here and the light added on top of it, so
// the warm inside keeps its warmth in every theme. Positions are the
// painting's own pixels (y down); the arrival functions mirror lib.rs.
uniform sampler2D u_paint;  // the painting, its ring erased
uniform sampler2D u_depth;  // R nearness / 2, G body, B cube (half size)
uniform vec2 u_res;         // target px
uniform vec4 u_window;      // painting px shown: centre, size (window() in lib.rs)
uniform float u_px;         // painting px per target px
uniform vec4 u_out;         // soft edges, -, -, -
uniform vec3 u_backdrop;    // the page around the scene
uniform vec4 u_edges;       // left, right, top, bottom
uniform vec4 u_cam;         // drift x, y (-1..1), lean 0..1, loop phase
uniform vec4 u_beat;        // seconds since the beat, ring turn, heart breath, motes' climb
uniform vec4 u_mode;        // recolor mode (0 accent by luminance, 2 ink on paper)
uniform vec3 u_paper;
uniform vec3 u_accent;
uniform vec3 u_highlight;
uniform vec3 u_cold;        // the outside light
uniform vec3 u_warm;        // the inside light
uniform vec3 u_pale;        // white-hot cores
uniform vec4 u_geo[8];      // GEOMETRY in lib.rs
in vec2 v_uv;
out vec4 o;

const vec2 SIZE = vec2(1536.0, 1024.0);
const float PI = 3.14159265;
const float TAU = 6.28318531;
const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);
const int MOTES = 16;

#define AXIS u_geo[0].x
#define HEART_Y u_geo[0].y
#define CROWN u_geo[0].z
#define ROOT u_geo[0].w
#define RING u_geo[1]
#define SPHERE u_geo[2].xyz
#define HORIZON u_geo[2].w
#define FEET u_geo[3].x
#define SWING u_geo[3].y
#define DOLLY u_geo[3].z
#define RING_DEPTH u_geo[3].w
#define CONVERGE u_geo[4].x
#define BODY_START u_geo[4].y
#define BODY_SPEED u_geo[4].z
#define RING_AT u_geo[4].w
#define RING_SPEED u_geo[5].x
#define SCAN_AT u_geo[5].y
#define SCAN_SPEED u_geo[5].z
#define RIPPLE_AT u_geo[5].w
#define RIPPLE_SPEED u_geo[6].x
#define RIPPLE_FLAT u_geo[6].y
#define RIPPLE_REACH u_geo[6].z
#define DOLLY_NEAR u_geo[6].w
#define SCAN_TOP u_geo[7].x
#define FOOT_L u_geo[7].y
#define FOOT_R u_geo[7].z

float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float gauss(float d, float sigma) { return exp(-d * d / (2.0 * sigma * sigma)); }

vec2 heart() { return vec2(AXIS, HEART_Y); }
vec4 depthAt(vec2 p) { return texture(u_depth, p / SIZE); }
float scaleAt(float n) { return 1.0 + DOLLY * u_cam.z * min(n, DOLLY_NEAR); }
vec2 shove(float n) { return -u_cam.xy * SWING * (n - 1.0); }
// lib.rs view(): where the camera shows a painting point of nearness n.
vec2 view(vec2 p, float n) { return heart() + (p - heart()) * scaleAt(n) + shove(n); }
// The painting point the camera shows at q: view() undone by fixed-point
// steps over the smooth depth map.
vec2 source(vec2 q) {
  vec2 p = q;
  for (int i = 0; i < 5; i++) {
    float n = depthAt(p).r * 2.0;
    p = heart() + (q - shove(n) - heart()) / scaleAt(n);
  }
  return p;
}

// The crest of a front and the glow it leaves for a while (lib.rs AFTERGLOW).
float crest(float s, float width) { return exp(-s * s / (width * width)); }
float lit(float arrival) {
  float s = u_beat.x - arrival;
  return crest(s, 0.22) + 0.4 * smoothstep(-0.1, 0.2, s) * (1.0 - smoothstep(0.2, 3.0, s));
}

// The theme's recolor of the painting, as scene-palette's recolor.frag.
vec3 recolor(vec3 c) {
  float level = clamp(dot(c, LUMA), 0.0, 1.0);
  if (u_mode.x < 0.5) return u_accent * level;
  float ink = pow(level, 1.3) * 0.74;
  vec3 muted = mix(u_accent, vec3(dot(u_accent, LUMA)), 0.4);
  vec3 tint = mix(muted, u_highlight, smoothstep(0.45, 0.95, level) * 0.55);
  return u_paper * (1.0 - ink) + tint * ink;
}

// A point of light: a hot core in the pale, a glow in its own color.
vec3 spark(float d, float core, float glow, vec3 color) {
  return u_pale * gauss(d, core) * 0.8 + color * (gauss(d, core * 1.6) * 0.6 + gauss(d, glow) * 0.22);
}

void main() {
  vec2 q = u_window.xy + (vec2(v_uv.x, 1.0 - v_uv.y) - 0.5) * u_window.zw;
  vec2 p = source(q);
  vec4 d = depthAt(p);
  float near = d.r * 2.0;
  float body = d.g;
  float occluder = max(d.g, d.b);
  float b = u_beat.x;
  float phase = u_cam.w;
  float breath = u_beat.z;
  // Thin lines never get thinner than about a target pixel.
  float thin = max(0.8, 0.6 * u_px);

  vec3 c = texture(u_paint, p / SIZE).rgb;
  float luma = dot(c, LUMA);
  float local = dot(textureLod(u_paint, p / SIZE, 3.0).rgb, LUMA);
  // The stars twinkle: points brighter than all their neighbours, each in its
  // own rhythm, away from the three great stars, the axis and the figure.
  // Lines (the body's outline, the glass) have bright neighbours along them
  // and stay whole.
  vec2 H = heart();
  vec2 crown = vec2(AXIS, CROWN);
  vec2 root = vec2(AXIS, ROOT);
  float stars = min(min(distance(p, H), distance(p, crown)), distance(p, root));
  float calm = smoothstep(26.0, 60.0, stars) * smoothstep(3.0, 7.0, abs(p.x - AXIS))
             * (1.0 - smoothstep(0.02, 0.2, occluder));
  float around = 0.0;
  for (int k = 0; k < 8; k++) {
    float a = float(k) * PI * 0.25;
    around = max(around, dot(texture(u_paint, (p + 3.5 * vec2(cos(a), sin(a))) / SIZE).rgb, LUMA));
  }
  float speck = smoothstep(0.05, 0.2, luma - around) * calm;
  float twinkle = pow(0.5 + 0.5 * sin(hash(floor(p / 3.0)) * 40.0 + phase * 9.0), 6.0);
  c *= 1.0 + speck * (1.7 * twinkle - 0.4);
  // The nebula outside the glass breathes: its clouds swell and ebb.
  float far = 1.0 - smoothstep(0.62, 0.8, near);
  vec2 orbit = vec2(cos(phase), sin(phase));
  float swell = noise(p / 260.0 + 0.9 * orbit) * 0.65 + noise(p / 110.0 - 1.7 * orbit) * 0.35;
  c *= 1.0 + far * smoothstep(0.015, 0.1, local) * (swell - 0.45) * 0.9;
  luma = dot(c, LUMA);
  vec3 col = recolor(c);

  // The warmth inside: a steady glow from the heart through the body.
  float r = distance(p, H);
  col += u_warm * body * (0.03 + 0.55 * luma) * exp(-r / 230.0) * (0.7 + 0.3 * breath);
  // The beat's warmth spreads from the heart and fills the body, but only
  // where the scan has been (body_arrival in lib.rs).
  float ts = SCAN_AT + (p.y - SCAN_TOP) / SCAN_SPEED;
  col += u_warm * body * (0.05 + 1.6 * luma) * 0.85 * lit(max(BODY_START + r / BODY_SPEED, ts + 0.1));

  // The heart: a warm star that breathes and flares when the scan reaches it.
  float flare = crest(b - CONVERGE, 0.3);
  float heartK = 0.6 + 0.3 * breath + 2.2 * flare;
  vec2 dh = abs(p - H);
  float rays = exp(-dh.y / thin - dh.x / 55.0) + exp(-dh.x / thin - dh.y / 55.0);
  col += heartK * (u_warm * (0.3 * gauss(r, 28.0) + 0.07 * exp(-r / 120.0) + 0.22 * rays)
                   + u_pale * 0.5 * gauss(r, 4.5));
  // As it flares, a warm breath leaves the heart through the glass.
  float wave = b - CONVERGE;
  float shell = gauss(r - wave * 520.0, 10.0) * step(0.0, wave) * (1.0 - smoothstep(150.0, 470.0, r));
  col += u_warm * 0.12 * shell * (1.0 - far);

  // The axis: the crown star gathers the cold light and lets it fall to the
  // head; from there it comes down with the scan (axis_arrival in lib.rs).
  float dx = abs(p.x - AXIS);
  float line = gauss(dx, thin);
  float beam = exp(-dx / 6.0);
  float onAxis = step(CROWN - 8.0, p.y) * step(p.y, ROOT + 8.0);
  float ta = p.y <= SCAN_TOP ? (p.y - CROWN) / (SCAN_TOP - CROWN) * SCAN_AT : ts;
  float sa = b - ta;
  float run = smoothstep(0.0, 0.25, b);
  col += onAxis * (u_cold * (line * (1.6 * crest(sa, 0.08) * run + 0.5 * lit(ta)) + beam * 0.6 * crest(sa, 0.1) * run)
                   + u_pale * line * crest(sa, 0.05) * run);
  float gather = smoothstep(0.0, 0.3, b) * (1.0 - smoothstep(0.3, 1.0, b));
  col += u_cold * 0.8 * gather * gauss(distance(p, crown), 16.0);

  // The inner scan: a level plane of light comes down through the figure
  // from the top of the head to the feet. Where it cuts the body and the cube
  // a bright line shows the cut and a band just above it shows their inner
  // lines; its rim runs faintly round the inside of the glass.
  float scanY = SCAN_TOP + (b - SCAN_AT) * SCAN_SPEED;
  float scanOn = smoothstep(SCAN_AT - 0.1, SCAN_AT + 0.3, b) * (1.0 - smoothstep(RIPPLE_AT - 0.2, RIPPLE_AT + 0.4, b));
  float detail = max(luma - local, 0.0);
  if (scanOn > 0.0) {
    float rimA = sqrt(max(SPHERE.z * SPHERE.z - (scanY - SPHERE.y) * (scanY - SPHERE.y), 400.0));
    float rimB = rimA * RING.w / RING.z;
    vec2 off = p - vec2(SPHERE.x, scanY);
    vec2 e = off / vec2(rimA, rimB);
    float k = length(e);
    float rimDist = abs(k - 1.0) * k / max(length(off / vec2(rimA * rimA, rimB * rimB)), 1e-4);
    // The cut follows the plane's front, a shallow arc like the ring's.
    float ux = clamp(e.x, -1.0, 1.0);
    float dy = p.y - (scanY + rimB * sqrt(1.0 - ux * ux));
    float band = dy < 0.0 ? exp(dy / 70.0) : gauss(dy, 5.0);
    float lines = 0.75 + 0.25 * sin(p.y * 1.3) * (1.0 - smoothstep(1.5, 3.0, u_px));
    float inner = occluder * scanOn;
    col += inner * (u_cold * (1.8 * gauss(dy, thin * 1.3) + band * lines * (0.08 + 3.2 * detail + 0.7 * luma))
                    + u_pale * 0.7 * gauss(dy, thin * 0.8));
    // Its rim on the glass stops at the figure: across it the cut goes on.
    float outside = (1.0 - occluder) * scanOn;
    float front = step(0.0, e.y);
    col += u_cold * outside * (gauss(rimDist, thin) * 0.9 + gauss(rimDist, 4.0) * 0.08) * (0.1 + 0.18 * front);
    col += u_cold * outside * 0.02 * (1.0 - smoothstep(0.8, 1.0, k));
    for (int j = 0; j < 2; j++) {
      vec2 T = vec2(SPHERE.x + (j == 0 ? -rimA : rimA), scanY);
      col += 0.45 * scanOn * spark(distance(p, T), 2.0, 10.0, u_cold);
    }
  }
  // Where the scan has passed, the inner lines keep its light a moment.
  float since = b - ts;
  col += occluder * u_cold * (0.04 + 0.6 * detail) * smoothstep(0.0, 0.2, since) * (1.0 - smoothstep(0.2, 1.6, since));

  // The floor: when the scan reaches the feet, warm light pools under them
  // and a ripple leaves them, warm at first and cold as it goes; the
  // reflections light where it passes (ripple_arrival in lib.rs).
  float floorK = smoothstep(HORIZON - 4.0, HORIZON + 14.0, p.y) * (1.0 - occluder);
  float rho = min(length(vec2(p.x - FOOT_L, (p.y - FEET) / RIPPLE_FLAT)),
                  length(vec2(p.x - FOOT_R, (p.y - FEET) / RIPPLE_FLAT)));
  float sr = b - RIPPLE_AT;
  float radius = sr * RIPPLE_SPEED;
  float reach = 1.0 - smoothstep(RIPPLE_REACH * 0.45, RIPPLE_REACH, rho);
  vec3 tint = mix(u_warm, u_cold, smoothstep(80.0, 520.0, rho));
  float ripple = gauss(rho - radius, 7.0) * step(0.0, sr) * reach;
  float shine = (0.05 + 2.0 * luma) * lit(RIPPLE_AT + rho / RIPPLE_SPEED) * reach;
  col += floorK * tint * (0.7 * ripple + 0.8 * shine);
  vec2 fl = vec2(p.x - FOOT_L, p.y - FEET) / vec2(75.0, 13.0);
  vec2 fr = vec2(p.x - FOOT_R, p.y - FEET) / vec2(75.0, 13.0);
  float pool = exp(-dot(fl, fl)) + exp(-dot(fr, fr));
  col += u_warm * pool * (0.9 * crest(sr, 0.35) + 0.25 * lit(RIPPLE_AT)) * (1.0 - 0.6 * occluder);
  // The root star answers when the light down the axis reaches it.
  float tRoot = SCAN_AT + (ROOT - SCAN_TOP) / SCAN_SPEED;
  col += u_cold * (1.2 * crest(b - tRoot, 0.25) + 0.3 * lit(tRoot)) * gauss(distance(p, root), 14.0);

  // The ring, in view space: an ellipse whose front is nearer than the
  // figure, so the drift moves it against the body.
  float s1 = scaleAt(1.0);
  vec2 C = H + (RING.xy - H) * s1;
  vec2 A = vec2(RING.z * s1, 0.0);
  vec2 B = vec2(0.0, RING.w * s1) - u_cam.xy * SWING * RING_DEPTH;
  vec2 e = q - C;
  float cy = e.y / B.y;
  float th = atan((e.x - B.x * cy) / A.x, cy);
  for (int i = 0; i < 4; i++) {
    float sn = sin(th), cs = cos(th);
    vec2 diff = C + A * sn + B * cs - q;
    vec2 d1 = A * cs - B * sn;
    vec2 d2 = -(A * sn + B * cs);
    float g2 = dot(d1, d1) + dot(diff, d2);
    th -= clamp(dot(diff, d1) / max(g2, 1e-3), -0.25, 0.25);
  }
  th = mod(th + PI, TAU) - PI;
  float sn = sin(th), front = cos(th);
  float dist = distance(C + A * sn + B * front, q);
  // Its back goes behind the body and the cube.
  float behind = smoothstep(0.05, -0.2, front) * occluder;
  float spin = u_beat.y;
  float tips = pow(abs(sn), 14.0);
  float flash = lit(RING_AT + abs(th) / RING_SPEED);
  float along = (0.55 + 0.3 * sin(2.0 * (th - spin))) * (0.75 + 0.25 * front) + 1.1 * tips + 1.6 * flash;
  float width = 0.8 / thin;
  float ringK = along * (gauss(dist, thin) * width * 0.9 + gauss(dist, 3.5) * 0.2 + exp(-dist / 16.0) * 0.035);
  vec3 ring = mix(u_cold, u_pale, 0.35 * gauss(dist, thin)) * ringK;
  // Beads ride the ring as it turns; on the beat two runners leave its front.
  for (int k = 0; k < 3; k++) {
    float a = spin + float(k) * TAU / 3.0;
    vec2 P = C + A * sin(a) + B * cos(a);
    float hide = 1.0 - smoothstep(0.05, -0.2, cos(a)) * occluder;
    ring += hide * (0.55 + 0.35 * cos(a)) * spark(distance(q, P), 1.8, 9.0, u_cold);
  }
  float sRun = b - RING_AT;
  float span = PI / RING_SPEED;
  if (sRun > 0.0 && sRun < span) {
    float a = sRun * RING_SPEED;
    float fade = sin(sRun / span * PI) * 0.6 + 0.4 * (1.0 - sRun / span);
    for (int k = 0; k < 2; k++) {
      float side = k == 0 ? 1.0 : -1.0;
      vec2 P = C + A * sin(a * side) + B * cos(a);
      float hide = 1.0 - smoothstep(0.05, -0.2, cos(a)) * occluder;
      ring += hide * fade * 1.8 * spark(distance(q, P), 2.4, 12.0, u_cold);
    }
  }
  // The ring's two tips flare along it, as Art painted them.
  for (int k = 0; k < 2; k++) {
    vec2 T = C + A * (k == 0 ? -1.0 : 1.0);
    vec2 dt = q - T;
    float shimmer = 0.85 + 0.15 * sin(phase * 7.0 + float(k) * 2.1);
    float k2 = shimmer * (1.0 + 1.4 * lit(RING_AT + 0.5 * PI / RING_SPEED));
    ring += k2 * (u_cold * exp(-abs(dt.x) / 40.0) * gauss(dt.y, thin) * 0.5 + spark(length(dt), 2.5, 14.0, u_cold));
  }
  col += ring * (1.0 - behind);

  // Motes climb a helix round the figure, passing in front and behind.
  vec3 motes = vec3(0.0);
  for (int i = 0; i < MOTES; i++) {
    float fi = float(i);
    float u = fract(fi / float(MOTES) + u_beat.w);
    float a = u * TAU * 1.75 + fi * 2.4;
    float radius = 250.0 + 70.0 * sin(u * PI + fi);
    float ca = cos(a);
    vec2 P = vec2(AXIS + radius * sin(a), 760.0 - u * 520.0 + radius * (RING.w / RING.z) * ca);
    vec2 Q = view(P, 1.0 + RING_DEPTH * (radius / RING.z) * ca);
    float life = sin(u * PI);
    float hide = 1.0 - smoothstep(0.05, -0.2, ca) * occluder;
    float dm = distance(q, Q);
    motes += hide * life * life * (0.45 + 0.3 * ca) * u_cold * (gauss(dm, 1.4) * 0.9 + gauss(dm, 6.0) * 0.2);
  }
  col += motes;

  // Dither against banding in the glows.
  col += (hash(gl_FragCoord.xy * 1.37) - 0.5) / 255.0;
  if (u_out.x > 0.5) {
    float m = smoothstep(0.0, u_edges.x, v_uv.x) * smoothstep(0.0, u_edges.y, 1.0 - v_uv.x)
            * smoothstep(0.0, u_edges.z, 1.0 - v_uv.y) * smoothstep(0.0, u_edges.w, v_uv.y);
    col = mix(u_backdrop, col, m);
  }
  o = vec4(clamp(col, 0.0, 1.0), 1.0);
}
