#version 300 es
precision highp float;
// Art's painting seen by a crane camera that leans toward the lamp, through
// its depth map; the three rings drawn in depth; dust in the window's shafts,
// the lamp's sweeping beam, and the beat from his feet out to the sphere.
// The painting is recolored here and the light added on top of it, so the
// lamp's warmth keeps its warmth in every theme. Positions are the
// painting's own pixels (y down); the arrival functions mirror lib.rs.
uniform sampler2D u_paint;  // the painting
uniform sampler2D u_depth;  // R nearness / 2, G his body, B the shafts' air (half size)
uniform vec2 u_res;         // target px
uniform vec4 u_window;      // painting px shown: centre, size (window() in lib.rs)
uniform float u_px;         // painting px per target px
uniform vec4 u_out;         // soft edges, -, -, -
uniform vec3 u_backdrop;    // the page around the scene
uniform vec4 u_edges;       // left, right, top, bottom
uniform vec4 u_cam;         // drift x, y (-1..1), lean 0..1, loop phase
uniform vec4 u_beat;        // seconds since the beat, beads' turn, breath, the lamp's turn
uniform vec4 u_ring;        // the second ring's row, the first ring's plane turn, -, -
uniform vec4 u_mode;        // recolor mode (0 accent by luminance, 2 ink on paper)
uniform vec3 u_paper;
uniform vec3 u_accent;
uniform vec3 u_highlight;
uniform vec3 u_cold;        // the rings, the scan, his gaze
uniform vec3 u_warm;        // the lamp, the daylight, the warmth in him
uniform vec3 u_pale;        // white-hot cores
uniform vec4 u_geo[16];     // GEOMETRY in lib.rs
uniform vec3 u_rail[10];    // RAIL in lib.rs: x, y, half width, from the camera to his hand
in vec2 v_uv;
out vec4 o;

#define ZERO min(int(u_res.x), 0)

const vec2 SIZE = vec2(1536.0, 1024.0);
const float PI = 3.14159265;
const float TAU = 6.28318531;
const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);
const vec2 SHAFT = vec2(0.36, 0.93);

#define CROWN u_geo[0].x
#define EYE u_geo[0].yz
#define SOLES u_geo[0].w
#define HAND u_geo[1].xy
#define FOOT_L u_geo[1].z
#define FOOT_R u_geo[1].w
#define AXIS u_geo[2]
#define NEAR_TOP u_geo[3].x
#define NEAR_FOOT u_geo[3].y
#define HORIZON u_geo[3].z
#define FOCAL u_geo[3].w
#define SPHERE u_geo[4].xyz
#define TILT u_geo[4].w
#define LAMP u_geo[5].xy
#define BEND u_geo[5].zw
#define WINDOW u_geo[6]
#define R2 u_geo[7].x
#define R3 u_geo[7].y
#define RING_DEPTH u_geo[7].z
#define SPHERE_DEPTH u_geo[7].w
#define SWING u_geo[8].x
#define DOLLY u_geo[8].y
#define DOLLY_NEAR u_geo[8].z
#define TOUCH u_geo[8].w
#define FLOOR_AT u_geo[9].x
#define RIPPLE_SPEED u_geo[9].y
#define RIPPLE_REACH u_geo[9].z
#define REST u_geo[9].w
#define ANKLE u_geo[10].x
#define TOP u_geo[10].y
#define RISE_AT u_geo[10].z
#define RISE_LEN u_geo[10].w
#define DESC_AT u_geo[11].x
#define DESC_LEN u_geo[11].y
#define WARM_SPEED u_geo[11].z
#define GAZE_AT u_geo[11].w
#define GAZE_LEN u_geo[12].x
#define LAMP_AT u_geo[12].y
#define FALL_SPEED u_geo[12].z
#define RING1_AT u_geo[12].w
#define RUNNERS u_geo[13].x

float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float gauss(float d, float sigma) { return exp(-d * d / (2.0 * sigma * sigma)); }

vec4 depthAt(vec2 p) { return texture(u_depth, p / SIZE); }
float scaleAt(float n) { return 1.0 + DOLLY * u_cam.z * min(n, DOLLY_NEAR); }
vec2 shove(float n) { return -u_cam.xy * SWING * (n - 1.0); }
// lib.rs view(): where the camera shows a painting point of nearness n; the
// lean pivots on the lamp.
vec2 view(vec2 p, float n) { return LAMP + (p - LAMP) * scaleAt(n) + shove(n); }
// The painting point the camera shows at q: view() undone by fixed-point
// steps over the smooth depth map.
vec2 source(vec2 q) {
  vec2 p = q;
  for (int i = ZERO; i < 5; i++) {
    float n = depthAt(p).r * 2.0;
    p = LAMP + (q - shove(n) - LAMP) / scaleAt(n);
  }
  return p;
}

// The crest of a front and the glow it leaves for a while (lib.rs AFTERGLOW).
float crest(float s, float width) { return exp(-s * s / (width * width)); }
float lit(float arrival) {
  float s = u_beat.x - arrival;
  return crest(s, 0.22) + 0.4 * smoothstep(-0.1, 0.2, s) * (1.0 - smoothstep(0.2, 3.0, s));
}
// lib.rs unsmooth(): the inverse of smoothstep on 0..1.
float unsmooth(float v) {
  v = clamp(v, 0.0, 1.0);
  return 0.5 - sin(asin(1.0 - 2.0 * v) / 3.0);
}
// lib.rs rise_arrival() and warm_arrival().
float riseArrival(float y) { return RISE_AT + RISE_LEN * unsmooth((ANKLE - y) / (ANKLE - TOP)); }
float warmArrival(float y) {
  if (y <= REST) return DESC_AT + DESC_LEN * unsmooth((y - TOP) / (REST - TOP));
  return DESC_AT + DESC_LEN + (y - REST) / WARM_SPEED;
}
// His axis at a row (he leans a little) and his nearness there.
float axisX(float y) {
  if (y <= AXIS.w) return mix(AXIS.x, AXIS.y, clamp((y - CROWN) / (AXIS.w - CROWN), 0.0, 1.0));
  return mix(AXIS.y, AXIS.z, clamp((y - AXIS.w) / (SOLES - AXIS.w), 0.0, 1.0));
}
float bodyNear(float y) { return mix(NEAR_TOP, NEAR_FOOT, clamp((y - CROWN) / (SOLES - CROWN), 0.0, 1.0)); }

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

// The point of the ellipse C + A sin(th) + B cos(th) nearest q: its th and
// how far q is from it.
vec2 ellipse(vec2 q, vec2 C, vec2 A, vec2 B) {
  vec2 e = q - C;
  float det = A.x * B.y - A.y * B.x;
  float th = atan(B.y * e.x - B.x * e.y, A.x * e.y - A.y * e.x) ;
  if (det < 0.0) th = atan(-(B.y * e.x - B.x * e.y), -(A.x * e.y - A.y * e.x));
  for (int i = ZERO; i < 4; i++) {
    float sn = sin(th), cs = cos(th);
    vec2 diff = C + A * sn + B * cs - q;
    vec2 d1 = A * cs - B * sn;
    vec2 d2 = -(A * sn + B * cs);
    float g2 = dot(d1, d1) + dot(diff, d2);
    th -= clamp(dot(diff, d1) / max(g2, 1e-3), -0.25, 0.25);
  }
  th = mod(th + PI, TAU) - PI;
  return vec2(th, distance(C + A * sin(th) + B * cos(th), q));
}

// A ring's line: a fine core, a soft glow and a faint halo.
vec3 ringLine(float dist, float k, float thin) {
  float width = 0.8 / thin;
  float ringK = k * (gauss(dist, thin) * width * 0.9 + gauss(dist, 3.5) * 0.2 + exp(-dist / 16.0) * 0.035);
  return mix(u_cold, u_pale, 0.35 * gauss(dist, thin)) * ringK;
}

void main() {
  vec2 q = u_window.xy + (vec2(v_uv.x, 1.0 - v_uv.y) - 0.5) * u_window.zw;
  vec2 p = source(q);
  vec4 d = depthAt(p);
  float near = d.r * 2.0;
  float body = d.g;
  float air = d.b;
  float b = u_beat.x;
  float phase = u_cam.w;
  float breath = u_beat.z;
  float beam = u_beat.w;
  // Thin lines never get thinner than about a target pixel.
  float thin = max(0.8, 0.6 * u_px);
  vec2 orbit = vec2(cos(phase), sin(phase));

  vec3 c = texture(u_paint, p / SIZE).rgb;
  float local = dot(textureLod(u_paint, p / SIZE, 3.0).rgb, LUMA);
  // The sky in the window: its clouds catch and lose the sun.
  float arch = WINDOW.y + 0.5 * (WINDOW.z - WINDOW.x);
  float inWindow = smoothstep(WINDOW.x, WINDOW.x + 6.0, p.x) * smoothstep(WINDOW.z, WINDOW.z - 6.0, p.x)
                 * smoothstep(WINDOW.y, arch, p.y) * smoothstep(WINDOW.w, WINDOW.w - 10.0, p.y);
  float sky = inWindow * smoothstep(0.25, 0.5, dot(c, LUMA));
  float sun = noise(p / vec2(70.0, 22.0) + 1.6 * orbit) * 0.7 + noise(p / 30.0 - 2.3 * orbit) * 0.3;
  c *= 1.0 + sky * (sun - 0.5) * 0.45;
  float luma = dot(c, LUMA);
  float detail = max(luma - local, 0.0);
  vec3 col = recolor(c);
  float far = 1.0 - smoothstep(0.45, 0.8, near);

  // The daylight: the shafts warm, their light passes as clouds go by the
  // sun, and dust drifts down them, glinting.
  vec2 across = vec2(SHAFT.y, -SHAFT.x);
  float pass = 0.65 + 0.7 * noise(vec2(dot(p, across) / 80.0, 0.0) + 1.3 * orbit);
  col += u_warm * air * (0.05 + 0.32 * luma) * pass;
  col += u_warm * sky * 0.18 * smoothstep(WINDOW.y + 160.0, WINDOW.w, p.y);
  if (air > 0.01) {
    vec3 dust = vec3(0.0);
    for (int k = ZERO; k < 3; k++) {
      float fk = float(k);
      float cell = 10.0 + 8.0 * fk;
      // Whole cells a loop, so the drift closes; about the shafts' slope.
      vec2 laps = vec2(1.0 + floor(fk * 0.5), 3.0 + fk);
      vec2 g = (p - laps * cell * (phase / TAU)) / cell;
      vec2 id = floor(g), f = fract(g);
      float h = hash(id + fk * 17.0);
      vec2 at = vec2(hash(id + 3.1), hash(id + 7.7)) * 0.7 + 0.15;
      at += 0.12 * vec2(sin(phase * (2.0 + fk) + h * TAU), cos(phase * (1.0 + fk) + h * 9.0));
      float dm = length((f - at) * cell);
      float glint = pow(0.5 + 0.5 * sin(h * 40.0 + phase * (3.0 + fk)), 3.0);
      float r = max(0.7 + 0.35 * fk, 0.45 * u_px);
      dust += step(0.5, h) * glint * (gauss(dm, r) * 0.9 + gauss(dm, r * 3.0) * 0.1);
    }
    col += air * pass * dust * mix(u_warm, u_pale, 0.45) * 0.9;
  }

  // The lamp: a warm glow that flares as its beam faces us, and on the beat.
  float lampNear = 0.02;
  vec2 L = view(LAMP, lampNear);
  float rl = distance(q, L);
  float facing = pow(max(cos(beam), 0.0), 6.0);
  float flare = crest(b - LAMP_AT, 0.45);
  col += u_warm * (0.10 + 0.3 * facing + 0.9 * flare) * exp(-rl / (60.0 + 90.0 * flare))
       + u_pale * (0.25 + 0.6 * facing + 1.4 * flare) * gauss(rl, 7.0 + 4.0 * flare);
  // Its beam turns: seen from the side it sweeps across the well...
  float side = sin(beam);
  vec2 dir = normalize(vec2(side, 0.12));
  vec2 v = q - L;
  float along = max(dot(v, dir), 0.0);
  float off = abs(v.x * dir.y - v.y * dir.x);
  float fan = smoothstep(0.0, 30.0, along) * exp(-off / (5.0 + 0.16 * along)) * exp(-along / (30.0 + 260.0 * abs(side)));
  col += u_warm * 0.3 * fan * abs(side);
  // ...and turned away it lights the far wall of the well behind the lamp.
  float patchX = L.x + 330.0 * side;
  float spot = gauss(q.x - patchX, 75.0) * gauss(q.y - (L.y + 80.0), 120.0) * smoothstep(0.2, -0.6, cos(beam));
  col += u_warm * spot * far * (0.03 + 1.6 * detail + 0.45 * luma) * 0.8;
  // On the beat its light falls down the well over the far railings.
  float fa = LAMP_AT + distance(p, LAMP) / FALL_SPEED;
  col += u_warm * far * (0.02 + 1.8 * detail + 0.4 * luma) * 0.75 * lit(fa);

  // The glint: light runs up the brass rail from us to his hand.
  if (p.x > 740.0 && p.y > 470.0 && b < TOUCH + 4.0) {
    float best = 1e6, s = 0.0, w = 1.0, run = 0.0;
    for (int i = ZERO; i < 9; i++) {
      vec3 a = u_rail[i], e = u_rail[i + 1];
      vec2 ab = e.xy - a.xy;
      float len = length(ab);
      float t = clamp(dot(p - a.xy, ab) / (len * len), 0.0, 1.0);
      float dd = distance(p, a.xy + ab * t);
      if (dd < best) { best = dd; s = run + t * len; w = mix(a.z, e.z, t); }
      run += len;
    }
    float onRail = 1.0 - smoothstep(0.55, 1.05, best / w);
    float x = clamp(b / TOUCH, 0.0, 1.0);
    float front = run * (1.0 - (1.0 - x) * (1.0 - x));
    float running = smoothstep(-0.05, 0.1, b) * (1.0 - smoothstep(TOUCH, TOUCH + 0.4, b));
    float glint = gauss(s - front, 26.0 + 0.6 * w) * running;
    float trail = smoothstep(front, front - 120.0, s) * smoothstep(-0.1, 0.3, b) * (1.0 - smoothstep(TOUCH, TOUCH + 2.5, b));
    col += onRail * (0.25 + 1.6 * luma) * (mix(u_warm, u_pale, 0.4) * 1.6 * glint + u_warm * 0.25 * trail);
  }
  // His hand takes it.
  vec2 H = view(HAND, 0.95);
  col += crest(b - TOUCH, 0.3) * 1.2 * spark(distance(q, H), 2.5, 16.0, u_warm);

  // His glass breathes faintly.
  col += u_cold * body * (0.015 + 0.3 * detail) * (0.4 + 0.6 * breath);

  // The second ring's scan: as it rises it shows his inner lines, and where
  // it has passed they keep its light a moment (rise_arrival in lib.rs).
  float y2 = u_ring.x;
  vec2 c2 = vec2(axisX(y2), y2);
  float minor2 = R2 * (y2 - HORIZON) / FOCAL;
  minor2 = (minor2 < 0.0 ? -1.0 : 1.0) * max(0.45 * R2 * tanh(abs(minor2) / (0.45 * R2)), 2.0);
  float rising = smoothstep(RISE_AT - 0.2, RISE_AT + 0.2, b) * (1.0 - smoothstep(RISE_AT + RISE_LEN - 0.1, RISE_AT + RISE_LEN + 0.4, b));
  if (body > 0.01) {
    float ux = clamp((p.x - c2.x) / R2, -1.0, 1.0);
    float dy = p.y - (y2 + minor2 * sqrt(1.0 - ux * ux));
    float band = dy > 0.0 ? exp(-dy / 70.0) : gauss(dy, 5.0);
    float lines = 0.75 + 0.25 * sin(p.y * 1.3) * (1.0 - smoothstep(1.5, 3.0, u_px));
    col += body * rising * u_cold * band * lines * (0.06 + 3.0 * detail + 0.6 * luma);
    float since = b - riseArrival(p.y);
    col += body * u_cold * (0.03 + 0.7 * detail) * smoothstep(0.0, 0.2, since) * (1.0 - smoothstep(0.2, 2.0, since));
    // Coming down, the ring brings the lamp's warmth into him (warm_arrival).
    float sw = b - warmArrival(p.y);
    col += u_warm * body * (0.04 + 1.3 * luma) * (0.8 * smoothstep(0.0, 0.5, sw) * (1.0 - smoothstep(0.8, 3.0, sw)) + 0.6 * crest(sw, 0.25));
  }

  // The second ring, round his body: its front nearer than he is.
  float n2 = bodyNear(y2);
  float s2 = scaleAt(n2);
  vec2 C2 = view(c2, n2);
  vec2 A2 = vec2(R2 * s2, 0.0);
  vec2 B2 = vec2(0.0, minor2 * s2) - u_cam.xy * SWING * RING_DEPTH;
  vec2 hit = ellipse(q, C2, A2, B2);
  float front2 = cos(hit.x);
  float hide2 = max(smoothstep(0.05, -0.2, front2) * body, smoothstep(0.08, 0.2, near - (n2 + RING_DEPTH * front2)));
  float busy = smoothstep(TOUCH - 0.2, TOUCH + 0.4, b) * (1.0 - smoothstep(DESC_AT + DESC_LEN - 0.5, DESC_AT + DESC_LEN + 1.5, b));
  // Over his head it waits quietly while his gaze goes up to the lamp.
  float rest = smoothstep(RISE_AT + RISE_LEN, RISE_AT + RISE_LEN + 0.5, b) * (1.0 - smoothstep(DESC_AT - 0.4, DESC_AT + 0.2, b));
  busy *= 1.0 - 0.8 * rest;
  float k2 = (0.42 + 0.75 * busy) * (0.75 + 0.25 * front2) * (0.85 + 0.15 * sin(2.0 * (hit.x - u_beat.y)));
  vec3 ring2 = ringLine(hit.y, k2, thin);
  for (int k = ZERO; k < 2; k++) {
    float a = u_beat.y + float(k) * PI;
    vec2 P = C2 + A2 * sin(a) + B2 * cos(a);
    float hide = smoothstep(0.05, -0.2, cos(a)) * body;
    ring2 += (1.0 - hide) * (0.45 + 0.3 * cos(a)) * (0.6 + 0.6 * busy) * spark(distance(q, P), 1.8, 9.0, u_cold);
  }
  col += ring2 * (1.0 - hide2);

  // The third ring, on the tread under his feet: it flares as his hand
  // takes the glint, and a ripple leaves his feet over its plane.
  vec2 c3 = vec2(0.5 * (FOOT_L + FOOT_R), SOLES);
  float n3 = NEAR_FOOT + 0.05;
  float s3 = scaleAt(n3);
  vec2 C3 = view(c3, n3);
  float minor3 = R3 * (SOLES - HORIZON) / FOCAL;
  vec2 A3 = vec2(R3 * s3, 0.0);
  vec2 B3 = vec2(0.0, minor3 * s3) - u_cam.xy * SWING * 0.12;
  vec2 hit3 = ellipse(q, C3, A3, B3);
  float front3 = cos(hit3.x);
  float hide3 = max(smoothstep(0.05, -0.2, front3) * body, smoothstep(1.55, 1.75, near));
  float k3 = (0.38 + 1.6 * lit(FLOOR_AT)) * (0.75 + 0.25 * front3) * (0.85 + 0.15 * sin(3.0 * (hit3.x + u_beat.y)));
  vec3 ring3 = ringLine(hit3.y, k3, thin);
  for (int k = ZERO; k < 3; k++) {
    float a = -u_beat.y + float(k) * TAU / 3.0;
    vec2 P = C3 + A3 * sin(a) + B3 * cos(a);
    float hide = smoothstep(0.05, -0.2, cos(a)) * body;
    ring3 += (1.0 - hide) * (0.4 + 0.3 * cos(a)) * spark(distance(q, P), 1.6, 8.0, u_cold);
  }
  col += ring3 * (1.0 - hide3);
  // The ripple, on the ring's plane and flattened like it: a fine line and
  // a soft wave the stone of the tread catches. Its rear half goes behind
  // his feet, and the near column hides it.
  vec2 e3 = (q - C3) / vec2(A3.x, minor3 * s3);
  float rho = length(e3) * R3;
  float grad = max(length(vec2(e3.x, e3.y * R3 / (minor3 * s3))) / max(length(e3), 1e-3), 0.2);
  float sr = b - FLOOR_AT;
  float dr = (rho - sr * RIPPLE_SPEED) / grad;
  float fade = step(0.0, sr) * smoothstep(20.0, 70.0, rho) * (1.0 - smoothstep(140.0, RIPPLE_REACH, rho));
  float seen = (1.0 - smoothstep(0.0, -0.3, e3.y) * body) * (1.0 - smoothstep(1.55, 1.75, near));
  col += seen * fade * (mix(u_cold, u_pale, 0.3) * gauss(dr, 1.4 * thin) * 0.55
                        + u_cold * gauss(dr, 9.0) * (1.0 - body) * (0.03 + 2.2 * detail + 0.5 * luma));

  // The first ring rides the sphere: its plane leans a little from level and
  // turns about the vertical, seen from below like everything above the eye.
  float pitch = asin(clamp((HORIZON - SPHERE.y) / FOCAL, -0.9, 0.9));
  float beta = u_ring.y;
  vec3 N = vec3(sin(TILT) * cos(beta), cos(TILT), sin(TILT) * sin(beta));
  vec3 U = normalize(vec3(N.z, 0.0, -N.x));
  vec3 V = cross(N, U);
  float cp = cos(pitch), sp = sin(pitch);
  float s1 = scaleAt(1.0);
  vec2 C1 = view(SPHERE.xy, 1.0);
  vec2 A1 = SPHERE.z * s1 * vec2(U.x, -(U.y * cp + U.z * sp));
  vec2 B1 = SPHERE.z * s1 * vec2(V.x, -(V.y * cp + V.z * sp));
  vec2 zAB = vec2(-U.y * sp + U.z * cp, -V.y * sp + V.z * cp);
  A1 -= u_cam.xy * SWING * SPHERE_DEPTH * zAB.x;
  B1 -= u_cam.xy * SWING * SPHERE_DEPTH * zAB.y;
  vec2 hit1 = ellipse(q, C1, A1, B1);
  float z1 = zAB.x * sin(hit1.x) + zAB.y * cos(hit1.x);
  float hide1 = max(smoothstep(0.05, -0.2, z1) * body, smoothstep(0.15, 0.35, near - (1.0 + SPHERE_DEPTH * z1)));
  // Where the lamp's light reaches the sphere, two runners leave the ring's
  // top and meet at its bottom; the ring flashes behind them.
  float top = atan(-A1.y, -B1.y);
  float fromTop = abs(mod(hit1.x - top + PI, TAU) - PI);
  float flash1 = lit(RING1_AT + fromTop / PI * RUNNERS);
  float k1 = (0.36 + 0.12 * z1 + 1.4 * flash1) * (0.85 + 0.15 * sin(2.0 * (hit1.x - u_beat.y)));
  vec3 ring1 = ringLine(hit1.y, k1, thin);
  for (int k = ZERO; k < 3; k++) {
    float a = u_beat.y * 0.5 + float(k) * TAU / 3.0;
    vec2 P = C1 + A1 * sin(a) + B1 * cos(a);
    float za = zAB.x * sin(a) + zAB.y * cos(a);
    float hide = smoothstep(0.05, -0.2, za) * body;
    ring1 += (1.0 - hide) * (0.4 + 0.25 * za) * spark(distance(q, P), 1.8, 9.0, u_cold);
  }
  float sRun = b - RING1_AT;
  if (sRun > 0.0 && sRun < RUNNERS) {
    float a = sRun / RUNNERS * PI;
    float fade = sin(sRun / RUNNERS * PI) * 0.6 + 0.4 * (1.0 - sRun / RUNNERS);
    for (int k = ZERO; k < 2; k++) {
      float th = top + (k == 0 ? a : -a);
      vec2 P = C1 + A1 * sin(th) + B1 * cos(th);
      float zr = zAB.x * sin(th) + zAB.y * cos(th);
      float hide = smoothstep(0.05, -0.2, zr) * body;
      ring1 += (1.0 - hide) * fade * 1.8 * spark(distance(q, P), 2.4, 12.0, u_cold);
    }
  }
  col += ring1 * (1.0 - hide1);

  // His gaze: a thread of light runs from his eyes up to the lamp.
  if (b > GAZE_AT - 0.1 && b < LAMP_AT + 2.2) {
    vec2 E = view(EYE, NEAR_TOP);
    vec2 M = view(BEND, 0.4);
    float best = 1e6, at = 0.0;
    vec2 prev = E;
    for (int i = ZERO; i < 24; i++) {
      float t1 = float(i + 1) / 24.0;
      vec2 next = mix(mix(E, M, t1), mix(M, L, t1), t1);
      vec2 ab = next - prev;
      float t = clamp(dot(q - prev, ab) / max(dot(ab, ab), 1e-3), 0.0, 1.0);
      float dd = distance(q, prev + ab * t);
      if (dd < best) { best = dd; at = (float(i) + t) / 24.0; }
      prev = next;
    }
    float u = smoothstep(0.0, 1.0, (b - GAZE_AT) / GAZE_LEN);
    float head = crest(at - u, 0.05) * smoothstep(GAZE_AT - 0.1, GAZE_AT + 0.1, b) * (1.0 - smoothstep(LAMP_AT, LAMP_AT + 0.3, b));
    float trail = step(at, u) * (1.0 - smoothstep(LAMP_AT + 0.2, LAMP_AT + 2.0, b)) * (0.35 + 0.65 * smoothstep(u - 0.4, u, at));
    float k = 0.8 * trail + 1.4 * head;
    col += k * (u_cold * (gauss(best, thin) * 0.9 + gauss(best, 4.0) * 0.12) + u_pale * gauss(best, thin * 0.7) * 0.5 * head);
    vec2 F = mix(mix(E, M, u), mix(M, L, u), u);
    col += head * spark(distance(q, F), 2.2, 12.0, u_cold);
  }

  // Dither against banding in the glows.
  col += (hash(gl_FragCoord.xy * 1.37) - 0.5) / 255.0;
  if (u_out.x > 0.5) {
    float m = smoothstep(0.0, u_edges.x, v_uv.x) * smoothstep(0.0, u_edges.y, 1.0 - v_uv.x)
            * smoothstep(0.0, u_edges.z, 1.0 - v_uv.y) * smoothstep(0.0, u_edges.w, v_uv.y);
    col = mix(u_backdrop, col, m);
  }
  o = vec4(clamp(col, 0.0, 1.0), 1.0);
}
