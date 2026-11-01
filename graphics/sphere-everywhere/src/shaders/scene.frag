#version 300 es
precision highp float;
// Art's strip of places and a clear glass ball, the sphere of attention.
// Each pixel traces one ray from the camera. The strip is a surface that
// stands flat at z = RING facing the camera, or bends toward it into a
// ring round the origin, where the ball floats; its painting faces the
// camera, its back is a dim see-through film. The ball reflects and
// refracts the strip and carries the bands of memory. Positions are strip
// px, y down like the painting. Timing and geometry mirror lib.rs.
uniform sampler2D u_left;  // the strip's columns 0 .. HALF
uniform sampler2D u_right; // HALF .. SIZE
uniform vec2 u_res;        // target px
uniform vec4 u_out;        // straight to the canvas, soft edges, engrave on the page, -
uniform vec3 u_backdrop;   // the page around the scene
uniform vec4 u_edges;      // left, right, top, bottom
uniform vec4 u_eye;        // the camera, tan of half the view's height
uniform vec4 u_target;     // where it looks, the curl 0 flat … 1 a closed ring
uniform vec4 u_ball;       // the ball's centre and radius
uniform vec4 u_rang;       // seconds since each place rang
uniform vec4 u_bands;      // the light of each band on the glass
uniform vec4 u_state;      // the column facing the camera, the hum, the running light's column and strength
uniform vec4 u_time;       // loop time, loop phase, the ball's shine in the ring, -
uniform vec3 u_glow;       // the light the ball and the waves add
uniform vec3 u_deep;       // the engraving's deepest ink
uniform vec3 u_mid;        // its middle ink
uniform vec4 u_geo[8];     // GEOMETRY in lib.rs
in vec2 v_uv;
out vec4 o;

const float TAU = 6.28318531;
// Where the middle ink sits on the way from full ink to the page.
const float MID_AT = 0.45;
// The ball's light: head on, its edge, and the hum's.
const float RIM = 0.12;
const float RIM_HUM = 0.25;

#define RING u_geo[0].x
#define SIZE u_geo[0].yz
#define HALF u_geo[0].w
#define PLACE u_geo[1]
#define WAVE_Y u_geo[2].x
#define WAVE_SPEED u_geo[2].y
#define WAVE_LIFE u_geo[2].z
#define WAVE_WIDTH u_geo[2].w
#define IOR u_geo[3].x
#define F0 u_geo[3].y
#define ENGRAVE_WHITE u_geo[3].z
#define ENGRAVE_GAMMA u_geo[3].w
#define LATITUDE u_geo[4]
#define TILT u_geo[5].x
#define SCAN_WIDTH u_geo[5].y
#define BACK_LIGHT u_geo[5].z
#define BACK_SEE u_geo[5].w
#define EDGE u_geo[6].x
#define SEAM u_geo[6].y
#define ASPECT u_geo[6].z
#define SHINE_ON_RING u_geo[7].x
#define SHINE_IN_BALL u_geo[7].y

float hash12(vec2 p) {
  vec3 q = fract(vec3(p.xyx) * 0.1031);
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}
float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

// The painting at strip px q, from the half that holds it.
vec3 painted(vec2 q, float lod) {
  if (q.x < HALF) return textureLod(u_left, vec2(q.x / HALF, q.y / SIZE.y), lod).rgb;
  return textureLod(u_right, vec2((q.x - HALF) / HALF, q.y / SIZE.y), lod).rgb;
}

// The light running over the strip: the wave each ring sends over its
// place, and the light that runs round the closed ring.
float response(vec2 q) {
  float ages[4] = float[4](u_rang.x, u_rang.y, u_rang.z, u_rang.w);
  float places[4] = float[4](PLACE.x, PLACE.y, PLACE.z, PLACE.w);
  float light = 0.0;
  for (int i = 0; i < 4; i++) {
    float age = ages[i];
    if (age <= 0.0 || age >= WAVE_LIFE) continue;
    float rho = length(q - vec2(places[i], WAVE_Y));
    float x = (rho - WAVE_SPEED * age) / WAVE_WIDTH;
    float fade = pow(1.0 - age / WAVE_LIFE, 2.0) * smoothstep(0.0, 0.15, age);
    light += exp(-x * x) * fade;
  }
  if (u_state.w > 0.0) {
    float d = mod(q.x - u_state.z + 0.5 * SIZE.x, SIZE.x) - 0.5 * SIZE.x;
    light += u_state.w * exp(-0.5 * d * d / (SCAN_WIDTH * SCAN_WIDTH));
  }
  return light;
}

// The strip's painting where a ray meets it, lit by the waves and, in the
// ring, by the ball's shine; its long edges melt, and as it closes its two
// ends darken toward the seam.
vec3 surface(vec2 q, float lod) {
  float light = response(q);
  float dy = q.y - u_ball.y;
  float lit = u_time.z * RING * RING / (RING * RING + dy * dy);
  vec3 c = painted(q, lod) * (1.0 + 2.2 * light + SHINE_ON_RING * lit) + u_glow * 0.05 * light;
  float edge = smoothstep(0.0, EDGE, q.y) * smoothstep(0.0, EDGE, SIZE.y - q.y);
  float seam = 1.0 - 0.85 * u_target.w * (1.0 - smoothstep(0.0, SEAM, min(q.x, SIZE.x - q.x)));
  return c * edge * seam;
}

struct Hit {
  float t;     // along the ray; negative for none
  vec2 q;      // strip px
  float front; // 1 on the painted side, 0 from behind
  float slant; // the cosine between the ray and the strip's normal
};

Hit none() { return Hit(-1.0, vec2(0.0), 0.0, 1.0); }

// One root of the ray with the strip's surface, if it lands on the strip.
Hit landing(vec3 ro, vec3 rd, float t, float k) {
  if (t <= 0.5) return none();
  vec3 p = ro + rd * t;
  if (p.y < 0.0 || p.y > SIZE.y) return none();
  // The bend's angle from the column facing the camera, as (sin, cos);
  // flat, the arc is just x.
  vec2 sc = vec2(0.0, 1.0);
  float s = p.x;
  if (k > 1e-7) {
    sc = vec2(k * p.x, 1.0 + k * (p.z - RING));
    s = atan(sc.x, sc.y) / k;
  }
  float u = u_state.x + s;
  if (k > 1e-7) {
    float turn = TAU / k;
    if (u < 0.0) u += turn;
    else if (u > SIZE.x) u -= turn;
  }
  if (u < 0.0 || u > SIZE.x) return none();
  float facing = dot(rd.xz, sc);
  return Hit(t, vec2(u, p.y), facing > 0.0 ? 1.0 : 0.0, abs(facing));
}

// Where a ray meets the strip, nearest first. Flat or bent with curvature
// k toward the camera, its surface is k |p|^2 / 2 + p.z = 0 in xz about
// the column facing the camera; the roots are taken the stable way, so
// flat is the same formula with k = 0.
void meet(vec3 ro, vec3 rd, out Hit a, out Hit b) {
  float k = u_target.w / RING;
  vec2 o2 = vec2(ro.x, ro.z - RING), d2 = rd.xz;
  float qa = 0.5 * k * dot(d2, d2);
  float qb = d2.y + k * dot(o2, d2);
  float qc = o2.y + 0.5 * k * dot(o2, o2);
  float t0 = -1.0, t1 = -1.0;
  if (qa < 1e-12) {
    if (abs(qb) > 1e-9) t0 = -qc / qb;
  } else {
    float disc = qb * qb - 4.0 * qa * qc;
    if (disc >= 0.0) {
      float q = -0.5 * (qb + (qb >= 0.0 ? 1.0 : -1.0) * sqrt(disc));
      float r0 = q / qa;
      float r1 = abs(q) > 1e-9 ? qc / q : -1.0;
      t0 = min(r0, r1);
      t1 = max(r0, r1);
    }
  }
  a = landing(ro, rd, t0, k);
  b = landing(ro, rd, t1, k);
  if (a.t < 0.0) {
    a = b;
    b = none();
  }
}

// Beyond the strip: the night, a few faint stars round the ring.
vec3 space(vec3 rd) {
  if (u_target.w <= 0.0) return vec3(0.0);
  vec2 a = vec2(atan(rd.x, rd.z), asin(clamp(rd.y, -1.0, 1.0))) * 160.0;
  vec2 cell = floor(a);
  vec2 f = fract(a) - 0.5;
  float star = step(0.985, hash12(cell)) * exp(-30.0 * dot(f, f)) * (0.3 + 0.7 * hash12(cell + 7.0));
  return u_glow * 0.35 * star * u_target.w;
}

// What a ray sees of the strip: its painted side hides what lies beyond,
// its back shows dim and lets the rest through. `foot` is the ray's
// footprint, px, at its start, `spread` how fast it grows per px.
vec3 strip(vec3 ro, vec3 rd, float foot, float spread) {
  Hit a, b;
  meet(ro, rd, a, b);
  vec3 c = vec3(0.0);
  float keep = 1.0;
  for (int i = 0; i < 2; i++) {
    Hit h = a;
    if (i == 1) h = b;
    if (h.t < 0.0) break;
    float lod = log2(max(1.0, (foot + h.t * spread) / max(h.slant, 0.25)));
    vec3 paint = surface(h.q, lod);
    if (h.front > 0.5) {
      c += keep * paint;
      keep = 0.0;
      break;
    }
    c += keep * BACK_LIGHT * paint;
    keep *= BACK_SEE;
  }
  return c + keep * space(rd);
}

// The glass trembles when its place rings, and while it hums.
vec3 tremble(vec3 n) {
  float ages[4] = float[4](u_rang.x, u_rang.y, u_rang.z, u_rang.w);
  float a = 0.0;
  for (int i = 0; i < 4; i++) {
    float age = ages[i];
    if (age > 0.0 && age < 2.0) a += exp(-2.2 * age) * smoothstep(0.0, 0.08, age);
  }
  a = 0.07 * a + 0.025 * u_state.y;
  if (a <= 0.0) return n;
  float t = u_time.x;
  vec3 w = vec3(sin(23.0 * n.y + 40.0 * t), sin(19.0 * n.z - 37.0 * t + 1.3), sin(17.0 * n.x + 43.0 * t + 2.1));
  return normalize(n + a * w);
}

// A band of light on the glass at latitude offset d, rad; w is one px.
float band(float d, float w) {
  return (1.0 - smoothstep(0.0, 1.4 * w, abs(d))) + 0.25 * exp(-pow(d / (6.0 * w), 2.0));
}
float bands(vec3 n, float w) {
  vec3 axis = vec3(0.0, -cos(TILT), -sin(TILT));
  float lat = asin(clamp(dot(n, axis), -1.0, 1.0));
  return u_bands.x * band(lat - LATITUDE.x, w) + u_bands.y * band(lat - LATITUDE.y, w)
       + u_bands.z * band(lat - LATITUDE.z, w) + u_bands.w * band(lat - LATITUDE.w, w);
}

// The ball where the ray meets it at t: the strip reflected in its face
// and refracted through it upside down, the bands on its near and far
// side, a rim and one highlight. `pix` is the tan of one screen px.
vec3 glass(vec3 ro, vec3 rd, float t, float pix) {
  vec3 centre = u_ball.xyz;
  float r = u_ball.w;
  vec3 p = ro + rd * t;
  vec3 n0 = normalize(p - centre);
  vec3 n = tremble(n0);
  float cosi = clamp(-dot(rd, n), 0.0, 1.0);
  float fresnel = F0 + (1.0 - F0) * pow(1.0 - cosi, 5.0);
  float foot = t * pix;
  vec3 mirror = reflect(rd, n);
  vec3 reflected = strip(p, mirror, foot, 2.0 * foot / r);
  vec3 inside = refract(rd, n, 1.0 / IOR);
  vec3 p2 = p + inside * max(2.0 * dot(centre - p, inside), 0.0);
  vec3 n2 = normalize(p2 - centre);
  vec3 out2 = refract(inside, -n2, IOR);
  if (dot(out2, out2) < 0.5) out2 = reflect(inside, -n2);
  // A ball lens: the rays through one px fan out by its focal length.
  vec3 refracted = 0.94 * strip(p2, out2, 0.0, foot / (1.5 * r));
  vec3 c = mix(refracted, reflected, fresnel);
  float w = foot / (r * max(cosi, 0.2));
  c += u_glow * (0.9 * bands(n0, w) + 0.35 * bands(n2, 1.5 * w));
  c += u_glow * pow(1.0 - cosi, 3.0) * (RIM + RIM_HUM * u_state.y);
  c += u_glow * u_time.z * SHINE_IN_BALL * (0.4 + 0.6 * cosi * cosi);
  vec3 light = normalize(vec3(-0.5, -0.8, -0.35));
  c += u_glow * 0.5 * pow(max(dot(mirror, light), 0.0), 80.0);
  return c;
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
  // A 3:2 view; a narrower screen crops its sides.
  float aspect = u_res.x / max(u_res.y, 1.0);
  float halfX = u_eye.w * min(aspect, ASPECT);
  float halfY = halfX / aspect;
  float pix = 2.0 * halfY / u_res.y;
  vec3 eye = u_eye.xyz;
  vec3 forward = normalize(u_target.xyz - eye);
  vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), forward));
  vec3 down = cross(forward, right);
  vec3 rd = normalize(forward + right * (v_uv.x - 0.5) * 2.0 * halfX + down * (0.5 - v_uv.y) * 2.0 * halfY);

  // The ball, with its silhouette smoothed over one px.
  vec3 oc = eye - u_ball.xyz;
  float near = -dot(oc, rd);
  float miss = sqrt(max(dot(oc, oc) - near * near, 0.0));
  float r = u_ball.w;
  float px = max(near, 1.0) * pix;
  float cover = near > 0.0 ? 1.0 - smoothstep(r - 0.5 * px, r + 0.5 * px, miss) : 0.0;
  float tb = near - sqrt(max(r * r - miss * miss, 0.0));

  Hit a, b;
  meet(eye, rd, a, b);
  vec3 c = vec3(0.0);
  float keep = 1.0;
  bool ball = cover > 0.0;
  for (int i = 0; i < 2; i++) {
    Hit h = a;
    if (i == 1) h = b;
    if (ball && (h.t < 0.0 || tb < h.t)) {
      c += keep * cover * glass(eye, rd, tb, pix);
      keep *= 1.0 - cover;
      ball = false;
    }
    if (h.t < 0.0 || keep <= 0.0) break;
    float lod = log2(max(1.0, h.t * pix / max(h.slant, 0.25)));
    vec3 paint = surface(h.q, lod);
    if (h.front > 0.5) {
      c += keep * paint;
      keep = 0.0;
      break;
    }
    c += keep * BACK_LIGHT * paint;
    keep *= BACK_SEE;
  }
  if (ball) {
    c += keep * cover * glass(eye, rd, tb, pix);
    keep *= 1.0 - cover;
  }
  c += keep * space(rd);

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
