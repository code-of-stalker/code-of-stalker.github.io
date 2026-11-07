// «Лабиринт»: the stone labyrinth at night, ray-marched. The walls are an
// extruded plan: rings, one doorway in each, an axis wall closing every
// ring. Lines of script are carved along them: the walls are the book. After
// the break each block keeps a ruined stub while its top lifts, burns and is
// gone. The measures come as defines and every moving value as a uniform,
// both from Rust.
uniform vec2 u_res;
uniform vec3 u_eye;
uniform vec4 u_view;     // target, zoom
uniform vec4 u_walker;   // the walker's light: position, power
uniform vec3 u_trail;    // lit length of the path, where the haze begins, walk
uniform vec3 u_figure;   // formed, bright, flare
uniform vec4 u_wave;     // seconds since the break, dust, dawn, time
uniform float u_pieces[PIECES + 1];
uniform vec3 u_paper;
uniform vec3 u_stone;
uniform vec3 u_moon;
uniform vec3 u_lamp;
uniform vec3 u_core;
uniform vec4 u_ink;      // the figure's drawing; a: how much light its body keeps
uniform sampler2D u_hero;
in vec2 v_uv;
out vec4 o;

const float PI = 3.14159265;
const float TAU = 6.2831853;
const vec3 MOON = vec3(-0.5, 0.72, -0.48);
const vec3 HEART = vec3(0.0, 0.56 * FIGURE, 0.0);
const float COURSE = HEIGHT / 4.0;
const float STONE_LENGTH = 0.036;
const float GLYPH = 0.0052;

// The highest stone this frame.
float g_top;
bool g_broken;

float hash(vec2 p) {
  vec3 q = fract(vec3(p.xyx) * 0.1031);
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm(vec2 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) {
    s += a * noise(p);
    p = p * 2.03 + 17.1;
    a *= 0.5;
  }
  return s;
}
float maxc(vec3 c) { return max(c.r, max(c.g, c.b)); }

// ---- The plan ----------------------------------------------------------

// The ring wall nearest to q: its index, and the signed distance to its
// stone with the doorway cut out (every second wall has it on the other
// side of the axis).
float ringWall(vec2 q, float r, out float k) {
  k = clamp(floor((r - COURT) / RING + 0.5), 0.0, float(RINGS));
  float d = abs(r - (COURT + k * RING)) - WALL;
  float door = mod(k, 2.0) < 0.5 ? DOOR : -DOOR;
  if (q.y < 0.0) d = max(d, GAP - abs(q.x - door));
  return d;
}
float axisWall(vec2 q) {
  return length(vec2(q.x, q.y - clamp(q.y, -OUTER, -COURT))) - WALL;
}
float extrude(float d, float y, float lo, float hi) {
  vec2 w = vec2(d, abs(y - 0.5 * (lo + hi)) - 0.5 * (hi - lo));
  return min(max(w.x, w.y), 0.0) + length(max(w, 0.0));
}

// The block of ring k the point is in: its hash, how far from its middle
// along the wall, half its length; and when the wave breaks it.
float ringBlocks(float rb) { return 2.0 * floor(PI * rb / BLOCK + 0.5); }
vec3 ringBlock(vec2 q, float k, out float tb) {
  float rb = COURT + k * RING;
  float n = ringBlocks(rb);
  float len = TAU * rb / n;
  float along = atan(q.y, q.x) * rb;
  float b = floor(along / len);
  float h = hash(vec2(mod(b, n), k * 7.0 + 1.0));
  tb = (rb - COURT) / WAVE_SPEED + JITTER * h;
  return vec3(h, along - (b + 0.5) * len, 0.5 * len);
}
// The same for the axis wall; the wave reaches a block at its middle.
float axisTime(float b, float h) {
  return (clamp((b + 0.5) * BLOCK, COURT, OUTER) - COURT) / WAVE_SPEED + JITTER * h;
}
vec3 axisBlock(vec2 q, out float tb) {
  float along = -q.y;
  float b = floor(along / BLOCK);
  float h = hash(vec2(b, 91.0));
  tb = axisTime(b, h);
  return vec3(h, along - (b + 0.5) * BLOCK, 0.5 * BLOCK);
}

// One block w seconds after the wave reached it: the stub's top, the
// burning top's bottom and top, how much of that top is left (1 … 0).
vec4 blockState(float w, float h) {
  if (w <= 0.0) return vec4(HEIGHT, HEIGHT, HEIGHT, 0.0);
  float k = clamp(w / DISSOLVE, 0.0, 1.0);
  float stub = HEIGHT * (0.08 + 0.3 * h);
  float lift = LIFT * (0.45 + 0.55 * fract(h * 7.13)) * pow(k, 1.6) + 0.005 * smoothstep(0.0, 0.15, w);
  float left = 1.0 - smoothstep(0.3, 1.0, k);
  float mid = 0.5 * (HEIGHT + stub) + lift;
  float hh = 0.5 * (HEIGHT - stub) * left;
  return vec4(stub, mid - hh, mid + hh, left);
}

// The stone of one block: its stub and its burning top, kept inside the
// block's own column. `d` is the wall's plan distance, `side` the distance
// from its middle line, `u` the distance from the block's middle along the
// wall and `halfLen` half its length (both already in plan units).
float blockStone(float d, float side, float y, float u, float halfLen, float h, float tb) {
  float column = abs(u) - halfLen;
  float w = u_wave.x - tb;
  if (w <= 0.0) return max(extrude(d, y, -1.0, HEIGHT), column);
  vec4 s = blockState(w, h);
  float own = extrude(d, y, -1.0, s.x);
  if (s.w > 0.0) {
    float cut = max(max(d, side - WALL * s.w), abs(u) - (halfLen - 0.002) * s.w);
    own = min(own, extrude(cut, y, s.y, s.z));
  }
  return max(own, column);
}

// A ring wall breaking up: the block the point is in and its nearer
// neighbour exactly, every other block no nearer than its column.
float ringStones(vec2 q, float r, float k, float d, float y) {
  float rb = COURT + k * RING;
  float n = ringBlocks(rb);
  float len = TAU * rb / n;
  float along = atan(q.y, q.x) * rb;
  float b = floor(along / len);
  float u = along - (b + 0.5) * len;
  float nb = b + (u > 0.0 ? 1.0 : -1.0);
  // Arc length at the wall's radius is a little longer than the plan
  // distance inside it.
  float scale = min(r / rb, 1.0) * 0.98;
  float side = abs(r - rb);
  float t0 = (rb - COURT) / WAVE_SPEED;
  float h0 = hash(vec2(mod(b, n), k * 7.0 + 1.0));
  float h1 = hash(vec2(mod(nb, n), k * 7.0 + 1.0));
  float own = blockStone(d, side, y, u * scale, 0.5 * len * scale, h0, t0 + JITTER * h0);
  float next = blockStone(d, side, y, (u - sign(u) * len) * scale, 0.5 * len * scale, h1, t0 + JITTER * h1);
  // Every block lies inside the ring's footprint, so never nearer than d.
  return min(min(own, next), max((0.5 * len + abs(u)) * scale, d));
}
float axisStones(vec2 q, float d, float y) {
  float along = -q.y;
  float b = floor(along / BLOCK);
  float u = along - (b + 0.5) * BLOCK;
  float nb = b + (u > 0.0 ? 1.0 : -1.0);
  float h0 = hash(vec2(b, 91.0)), h1 = hash(vec2(nb, 91.0));
  float own = blockStone(d, abs(q.x), y, u, 0.5 * BLOCK, h0, axisTime(b, h0));
  float next = blockStone(d, abs(q.x), y, u - sign(u) * BLOCK, 0.5 * BLOCK, h1, axisTime(nb, h1));
  return min(min(own, next), max(0.5 * BLOCK + abs(u), d));
}

float walls(vec3 p) {
  vec2 q = p.xz;
  float r = length(q), k;
  float ring = ringWall(q, r, k);
  float axis = axisWall(q);
  if (!g_broken) return extrude(min(ring, axis), p.y, -1.0, HEIGHT);
  // The next ring out (or in) is never nearer than its footprint, whatever
  // its blocks do; inside the court and outside the last wall there is none.
  float rb = COURT + k * RING;
  float rings = r > rb ? (k < float(RINGS) ? rb + RING - r - WALL : 1e3)
                       : (k > 0.0 ? r - (rb - RING) - WALL : 1e3);
  return min(min(ringStones(q, r, k, ring, p.y), axisStones(q, axis, p.y)), rings);
}

vec3 normalAt(vec3 p) {
  const vec2 e = vec2(1.0, -1.0) * 0.0004;
  return normalize(e.xyy * walls(p + e.xyy) + e.yyx * walls(p + e.yyx)
                 + e.yxy * walls(p + e.yxy) + e.xxx * walls(p + e.xxx));
}

// ---- The path ----------------------------------------------------------

float footOf(float rc) { return -sqrt(rc * rc - DOOR * DOOR); }

// How far q is from the path's middle line, and how far along the path the
// nearest point of it lies.
vec2 pathAt(vec2 q) {
  float best = 1e3, s = 0.0;
  vec2 a, b, ab;
  float h, d;
  // The entrance.
  a = vec2(DOOR, -(OUTER + ENTRANCE));
  b = vec2(DOOR, footOf(OUTER - 0.5 * RING));
  ab = b - a;
  h = clamp(dot(q - a, ab) / dot(ab, ab), 0.0, 1.0);
  d = length(q - a - ab * h);
  if (d < best) { best = d; s = u_pieces[0] + h * length(ab); }
  float ang = atan(q.y, q.x);
  if (ang < -0.5 * PI) ang += TAU;
  for (int j = 0; j < RINGS; j++) {
    float rc = OUTER - (float(j) + 0.5) * RING;
    float phi = asin(DOOR / rc);
    float len = rc * (TAU - 2.0 * phi);
    bool ccw = j % 2 == 0;
    float u = (ccw ? ang - (-0.5 * PI + phi) : (1.5 * PI - phi) - ang) * rc;
    float uc = clamp(u, 0.0, len);
    float at = ccw ? -0.5 * PI + phi + uc / rc : 1.5 * PI - phi - uc / rc;
    d = length(q - rc * vec2(cos(at), sin(at)));
    if (d < best) { best = d; s = u_pieces[1 + 2 * j] + uc; }
    // The doorway out of corridor j.
    float x = ccw ? -DOOR : DOOR;
    a = vec2(x, footOf(rc));
    b = vec2(x, j + 1 < RINGS ? footOf(rc - RING) : -LANDING);
    ab = b - a;
    h = clamp(dot(q - a, ab) / dot(ab, ab), 0.0, 1.0);
    d = length(q - a - ab * h);
    if (d < best) { best = d; s = u_pieces[2 + 2 * j] + h * length(ab); }
  }
  // Across the court to its middle.
  a = vec2(DOOR, -LANDING);
  ab = -a;
  h = clamp(dot(q - a, ab) / dot(ab, ab), 0.0, 1.0);
  d = length(q - a - ab * h);
  if (d < best) { best = d; s = u_pieces[PIECES - 1] + h * length(ab); }
  return vec2(best, s);
}

// ---- Light -------------------------------------------------------------

float shadow(vec3 p, vec3 dir, float far, float k) {
  float res = 1.0, t = 0.003;
  for (int i = 0; i < 28; i++) {
    float h = walls(p + dir * t);
    res = min(res, k * h / t);
    t += clamp(h, 0.003, 0.05);
    if (res < 0.02 || t > far) break;
  }
  return clamp(res, 0.0, 1.0);
}
float occlusion(vec3 p, vec3 n) {
  float o = 0.0, w = 1.0;
  for (int i = 1; i <= 4; i++) {
    float h = 0.005 * float(i * i);
    o += (h - walls(p + n * h)) * w;
    w *= 0.6;
  }
  return clamp(1.0 - o * 7.0, 0.0, 1.0);
}

// ---- Surfaces ----------------------------------------------------------

float segment(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a, ba = b - a;
  return length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0));
}
// Lines of script carved along a wall: c is (along the wall, height).
float script(vec2 c, float pix, float seed) {
  float fade = smoothstep(0.0018, 0.0006, pix);
  float row = floor(c.y / COURSE);
  if (fade <= 0.0 || row < 1.0 || row > 3.0) return 0.0;
  float ly = fract(c.y / COURSE) * 2.0;
  float line = floor(ly) + row * 2.0 + seed * 11.0;
  float gx = c.x / GLYPH;
  float ci = floor(gx);
  float h = hash(vec2(ci, line));
  // Spaces between words, and an end to some lines.
  if (h < 0.16 || hash(vec2(floor(ci / 23.0), line + 5.0)) < 0.12 && fract(ci / 23.0) > 0.6) return 0.0;
  vec2 g = (vec2(fract(gx), fract(ly)) - 0.5) / vec2(0.62, 0.5) + 0.5;
  int bits = int(h * 61.0) + 3;
  float d = 1.0;
  if ((bits & 1) != 0) d = min(d, segment(g, vec2(0.5, 0.0), vec2(0.5, 1.0)));
  if ((bits & 2) != 0) d = min(d, segment(g, vec2(0.0, 1.0), vec2(1.0, 1.0)));
  if ((bits & 4) != 0) d = min(d, segment(g, vec2(0.0, 0.0), vec2(1.0, 0.0)));
  if ((bits & 8) != 0) d = min(d, segment(g, vec2(0.0, 0.0), vec2(1.0, 1.0)));
  if ((bits & 16) != 0) d = min(d, segment(g, vec2(0.0, 0.5), vec2(0.7, 0.5)));
  if ((bits & 32) != 0) d = min(d, abs(length(g - vec2(0.5, 0.7)) - 0.28));
  float width = 0.1 + pix / GLYPH * 0.8;
  return (1.0 - smoothstep(width * 0.55, width, d)) * fade;
}

// The burn of the stone at p: x the heat of a burning top, y the glow of the
// cracks before the break, z the embers on a fresh broken top.
vec3 burnAt(vec3 p) {
  if (u_wave.x <= -0.6) return vec3(0.0);
  vec2 q = p.xz;
  float r = length(q), k, tb;
  float ring = ringWall(q, r, k);
  vec3 b = axisWall(q) < ring ? axisBlock(q, tb) : ringBlock(q, k, tb);
  float w = u_wave.x - tb;
  if (w <= 0.0) return vec3(0.0, smoothstep(-0.5, 0.0, w), 0.0);
  vec4 s = blockState(w, b.x);
  if (p.y > s.x + 0.0015) return vec3(smoothstep(0.0, 0.2, w) * (0.55 + 0.45 * (1.0 - s.w)), 0.0, 0.0);
  return vec3(0.0, 0.0, exp(-w / 1.4) * smoothstep(s.x - 0.008, s.x, p.y));
}

vec3 sky(vec3 rd, vec3 moon) {
  float up = max(rd.y, 0.0);
  vec3 c = u_paper * (0.7 + 0.55 * pow(1.0 - up, 3.0));
  c += u_moon * 0.05 * pow(max(dot(rd, moon), 0.0), 10.0);
  c += u_moon * 0.85 * smoothstep(0.99955, 0.9998, dot(rd, moon));
  vec2 sc = vec2(atan(rd.z, rd.x), asin(clamp(rd.y, -1.0, 1.0))) * 70.0;
  vec2 id = floor(sc);
  float h = hash(id);
  vec2 at = vec2(hash(id + 3.1), hash(id + 7.7)) * 0.6 + 0.2;
  float star = step(0.9, h) * smoothstep(0.2, 0.0, length(fract(sc) - at));
  c += u_moon * star * (0.25 + 0.3 * sin(u_wave.w * 1.7 + h * 50.0)) * smoothstep(0.02, 0.2, up);
  return c;
}

vec3 tone(vec3 c) {
  vec3 over = max(c - 0.62, 0.0);
  return min(c, 0.62) + 0.38 * (1.0 - exp(-over / 0.38));
}

void main() {
  vec3 ro = u_eye;
  vec3 fw = normalize(u_view.xyz - ro);
  vec3 rt = normalize(cross(fw, vec3(0.0, 1.0, 0.0)));
  vec3 up = cross(rt, fw);
  vec2 sp = (v_uv - 0.5) * vec2(u_res.x / u_res.y, 1.0);
  vec3 rd = normalize(fw * u_view.w + rt * sp.x + up * sp.y);
  float pixK = 1.0 / (u_view.w * u_res.y);
  vec3 moon = normalize(MOON);
  float walk = u_trail.z;
  g_broken = u_wave.x > 0.0;
  g_top = HEIGHT + (g_broken ? LIFT + 0.01 : 0.002);

  // Only the slab of the walls, inside the outer wall, needs marching.
  float tFloor = rd.y < -1e-5 ? -ro.y / rd.y : 1e5;
  float t0 = 0.0, t1 = min(tFloor, 30.0);
  if (ro.y > g_top) t0 = rd.y < 0.0 ? (g_top - ro.y) / rd.y : 1e5;
  else if (rd.y > 0.0) t1 = min(t1, (g_top - ro.y) / rd.y);
  float a = dot(rd.xz, rd.xz), b = dot(ro.xz, rd.xz);
  float c = dot(ro.xz, ro.xz) - (OUTER + 0.03) * (OUTER + 0.03);
  if (a > 1e-8) {
    float disc = b * b - a * c;
    if (disc < 0.0) t1 = -1.0;
    else {
      float sq = sqrt(disc);
      t0 = max(t0, (-b - sq) / a);
      t1 = min(t1, (-b + sq) / a);
    }
  } else if (c > 0.0) t1 = -1.0;

  float t = t0;
  bool stone = false;
  if (t0 < t1) {
    float d = 1.0;
    for (int i = 0; i < 128; i++) {
      d = walls(ro + rd * t);
      if (d < 0.0002 + t * pixK * 0.4) { stone = true; break; }
      t += d * (g_broken ? 0.85 : 1.0);
      if (t > t1) break;
    }
    // Out of steps right at a face (a grazing look along a wall).
    if (!stone && t < t1 && d < 0.004) stone = true;
  }
  float tHit = stone ? t : tFloor;

  vec3 col;
  // Light added over everything, and light already in col; both bloom.
  vec3 glow = vec3(0.0);
  vec3 bloom = vec3(0.0);
  float s = 0.0;
  if (tHit < 1e4) {
    vec3 p = ro + rd * tHit;
    vec3 n = stone ? normalAt(p) : vec3(0.0, 1.0, 0.0);
    float pix = tHit * pixK;
    vec2 q = p.xz;
    float r = length(q);
    vec2 path = pathAt(q);
    float lane = path.x;
    s = path.y;
    float lit = smoothstep(0.0, 0.015, u_trail.x - s);
    vec3 albedo;
    vec3 emit = vec3(0.0);
    if (stone) {
      float k;
      float ring = ringWall(q, r, k);
      bool onAxis = axisWall(q) < ring;
      float along = onAxis ? q.y : atan(q.y, q.x) * (COURT + k * RING);
      float seed = onAxis ? 9.0 : k;
      vec2 wc = vec2(along, p.y);
      albedo = u_stone * (0.74 + 0.36 * fbm(wc * vec2(70.0, 90.0) + seed * 3.0));
      vec3 burn = burnAt(p);
      float carved = 0.0;
      if (n.y < 0.6) {
        float row = floor(p.y / COURSE);
        float shift = 0.5 * mod(row, 2.0);
        float jy = abs(fract(p.y / COURSE + 0.5) - 0.5) * COURSE;
        float jx = abs(fract(along / STONE_LENGTH + shift + 0.5) - 0.5) * STONE_LENGTH;
        float jw = 0.0004 + pix * 0.8;
        float joint = (1.0 - smoothstep(jw * 0.5, jw, min(jx, jy))) * smoothstep(0.004, 0.0012, pix);
        albedo *= (0.88 + 0.24 * hash(vec2(floor(along / STONE_LENGTH + shift), row + seed * 7.0)))
                * (1.0 - 0.5 * joint);
        carved = script(wc, pix, seed);
        albedo *= 1.0 - 0.5 * carved;
      } else {
        // The tops of the walls catch the moon: the plan reads from above.
        albedo *= 1.3;
      }
      float heat = burn.x;
      float vein = 1.0 - smoothstep(0.0, 0.05 + 0.05 * heat, abs(fbm(wc * 110.0 + seed) - 0.5));
      // A burning top chars: dark stone, the light in its cracks and letters.
      albedo *= 1.0 - 0.55 * heat;
      emit += mix(u_lamp, u_core, 0.2 + 0.5 * heat) * heat
            * (0.06 + 0.9 * vein + 1.1 * carved) * (0.7 + 0.3 * sin(u_wave.w * 9.0 + seed * 5.0 + along * 90.0));
      // Before the break the cracks and the words light up.
      emit += u_lamp * burn.y * (vein * 0.9 + carved * 0.55);
      emit += u_lamp * burn.z * (0.3 + 0.7 * noise(wc * 260.0)) * 0.9;
    } else if (r > OUTER + 0.015) {
      albedo = mix(u_paper * 1.6, u_stone * 0.55, 0.55) * (0.65 + 0.5 * fbm(q * 9.0));
    } else if (r < COURT - WALL) {
      albedo = u_stone * 0.82 * (0.9 + 0.15 * fbm(q * 40.0));
      float rings = abs(fract(r / 0.034 + 0.5) - 0.5) * 0.034;
      albedo *= 1.0 - 0.35 * (1.0 - smoothstep(0.0006, 0.0014 + pix, rings)) * smoothstep(0.005, 0.0015, pix);
    } else {
      albedo = u_stone * 0.62 * (0.7 + 0.45 * fbm(q * 55.0)) * (0.9 + 0.12 * noise(q * 300.0));
    }

    if (!stone) {
      // The path's groove: faint ahead (it is already written), alight behind.
      float gw = max(0.0026, pix * 1.3);
      float g = exp(-lane * lane / (gw * gw));
      albedo *= 1.0 - 0.4 * g;
      float ahead = mix(0.14, 0.2, walk) * (1.0 - smoothstep(0.0, 0.5, s - u_trail.x) * 0.6);
      emit += u_lamp * g * mix(ahead, 1.15, lit);
      float head = exp(-pow((s - u_trail.x) / 0.025, 2.0)) * (1.0 - walk);
      emit += u_core * head * exp(-lane * lane / (4.0 * gw * gw)) * 2.4 * u_walker.w;
      // The ring of light the figure sends out.
      float rw = max(COURT + u_wave.x * WAVE_SPEED, 0.0);
      float wfade = smoothstep(-0.6, 0.0, u_wave.x) * (1.0 - smoothstep(OUTER - 0.1, OUTER + 0.6, rw));
      emit += mix(u_lamp, u_core, 0.5) * exp(-pow((r - rw) / (0.012 + pix), 2.0)) * wfade * 1.6;
      // The court, alight under the figure.
      emit += mix(u_lamp, u_core, 0.3) * u_figure.y * 0.3 * (1.0 - smoothstep(0.0, COURT, r)) * (0.7 + 0.3 * fbm(q * 30.0));
    }

    vec3 n2 = n;
    float ao = occlusion(p + n * 0.001, n);
    // The moon.
    float far = max((g_top + 0.02 - p.y) / moon.y, 0.0);
    float mlit = max(dot(n2, moon), 0.0);
    float msh = mlit > 0.0 ? shadow(p + n * 0.0015, moon, far, 12.0) : 0.0;
    col = albedo * u_moon * 0.42 * mlit * msh;
    col += albedo * (u_paper * 1.0 + u_moon * 0.025) * (0.5 + 0.5 * n.y) * ao * ao * (1.0 + 1.3 * u_wave.z);
    // The walker's lamp.
    if (u_walker.w > 0.002) {
      vec3 lv = u_walker.xyz - p;
      float dist = length(lv);
      vec3 l = lv / dist;
      float fall = u_walker.w / (1.0 + dist * dist / 0.0036);
      if (fall > 0.004) {
        float diff = max(dot(n2, l), 0.0) * 0.85 + 0.15;
        float sh = shadow(p + n * 0.0015, l, dist - 0.006, 10.0);
        col += albedo * u_lamp * 2.6 * fall * diff * sh * (0.6 + 0.4 * ao);
      }
    }
    // The figure's light.
    float power = u_figure.y * (1.0 + 2.2 * u_figure.z);
    if (power > 0.003) {
      vec3 lv = HEART - p;
      float dist = length(lv);
      vec3 l = lv / dist;
      float fall = power / (1.0 + dist * dist / 0.09);
      float diff = max(dot(n2, l), 0.0);
      float sh = diff > 0.0 ? shadow(p + n * 0.0015, l, dist - 0.02, 14.0) : 0.0;
      col += albedo * mix(u_lamp, u_core, 0.4) * 1.2 * fall * diff * sh;
    }
    // The lit path lights the foot of the walls along it.
    col += albedo * u_lamp * 0.9 * lit * exp(-max(lane - 0.004, 0.0) / 0.022) * exp(-p.y / 0.02);
    col += emit;
    // The night's haze.
    vec3 haze = u_paper * (1.0 + 0.2 * u_wave.z) + u_lamp * 0.025 * u_wave.z;
    float keep = exp(-max(tHit - u_trail.y, 0.0) * 0.45);
    col = mix(haze, col, keep);
    bloom += emit * keep;
  } else {
    col = sky(rd, moon);
  }

  // The walker seen from above: a point of light.
  {
    vec3 wv = u_walker.xyz - ro;
    float tc = dot(wv, rd);
    if (tc > 0.0 && tc < tHit + 0.03) {
      float ang = length(wv - rd * tc) / tc;
      float k = u_walker.w * (1.0 - walk);
      glow += k * (u_core * 1.6 * exp(-pow(ang / 0.0035, 2.0)) + u_lamp * 0.5 * exp(-ang / 0.014));
    }
  }

  // The figure of light at the centre: the hero, rising out of the light.
  if (u_figure.x > 0.001) {
    vec3 nb = vec3(ro.x, 0.0, ro.z);
    nb = dot(nb, nb) > 1e-8 ? normalize(nb) : vec3(0.0, 0.0, -1.0);
    float den = dot(rd, nb);
    if (abs(den) > 1e-4) {
      float tf = -dot(ro, nb) / den;
      if (tf > 0.0 && tf < tHit + 0.002) {
        vec3 hp = ro + rd * tf;
        vec3 lat = normalize(cross(-nb, vec3(0.0, 1.0, 0.0)));
        vec2 uv = vec2(dot(hp, lat) / (FIGURE * 0.9955) + 0.5, 1.0 - (hp.y / FIGURE + 0.2) / 1.4);
        if (all(greaterThan(uv, vec2(0.0))) && all(lessThan(uv, vec2(1.0)))) {
          vec3 tex = texture(u_hero, uv).rgb;
          float hy = hp.y / FIGURE;
          float front = u_figure.x * 1.14 - 0.06;
          float shown = smoothstep(front + 0.02, front - 0.06, hy);
          float edge = exp(-pow((hy - front) / 0.035, 2.0)) * (1.0 - smoothstep(0.92, 1.0, u_figure.x));
          // Lit from within: the body a translucent light, brightest at the
          // heart, and the drawing of the man on it. Far away, where its lines
          // are thinner than a pixel, the body carries the light alone.
          float sharp = smoothstep(60.0, 190.0, FIGURE / (tf * pixK));
          float heart = exp(-dot(hp - HEART, hp - HEART) / (0.3 * FIGURE * FIGURE));
          float rim = clamp(tex.b - tex.r, 0.0, 1.0);
          vec3 body = mix(u_lamp, u_core, 0.25 + 0.45 * heart) * (mix(0.8, 0.34, sharp) + 0.35 * heart) * u_ink.a;
          // The drawing keeps its strength once formed; only its light grows.
          float drawn = min(u_figure.y, 0.75);
          vec3 fig = (body * tex.r + u_ink.rgb * mix(0.2, 1.25, sharp) * tex.g) * shown * drawn;
          fig += mix(u_lamp, u_core, 0.6) * (tex.r + 0.5 * tex.b) * edge * 1.6;
          col *= 1.0 - clamp(tex.r * shown * u_figure.y, 0.0, 1.0) * 0.85;
          glow += fig + u_lamp * (0.25 * tex.b + 0.5 * rim) * shown * drawn;
        }
      }
    }
    // The steady aura, and the flare that breaks the walls.
    vec3 hv = HEART - ro;
    float tc = dot(hv, rd);
    if (tc > 0.0) {
      float ang = length(hv - rd * tc) / tc;
      float f = u_figure.z;
      glow += u_lamp * exp(-ang / 0.05) * 0.18 * u_figure.y;
      glow += f * (u_core * 1.4 * exp(-pow(ang / 0.012, 2.0)) + u_lamp * 0.6 * exp(-ang / 0.07));
      // A column of light over the figure while it flares.
      vec2 o2 = ro.xz, d2 = rd.xz;
      float dd = dot(d2, d2);
      if (dd > 1e-6) {
        float tl = -dot(o2, d2) / dd;
        float dist = length(o2 + d2 * tl);
        float yl = ro.y + rd.y * tl;
        if (tl > 0.0 && tl < tHit && yl > 0.6 * FIGURE) {
          glow += mix(u_lamp, u_core, 0.5) * f * 0.8 * exp(-pow(dist / 0.012, 2.0)) * exp(-(yl - FIGURE) / 0.5);
        }
      }
    }
  }

  // The wall of light running out from the figure.
  if (u_wave.x > -0.6 && u_wave.x < 4.5) {
    float rw = max(COURT + u_wave.x * WAVE_SPEED, 0.002);
    float wfade = smoothstep(-0.6, 0.0, u_wave.x) * (1.0 - smoothstep(OUTER - 0.1, OUTER + 0.6, rw));
    float aa = dot(rd.xz, rd.xz), bb = dot(ro.xz, rd.xz);
    float cc = dot(ro.xz, ro.xz) - rw * rw;
    float disc = bb * bb - aa * cc;
    if (aa > 1e-6 && disc > 0.0) {
      float sq = sqrt(disc);
      for (int i = 0; i < 2; i++) {
        float tw = (-bb + (i == 0 ? -sq : sq)) / aa;
        if (tw <= 0.0 || tw >= tHit) continue;
        vec3 wp = ro + rd * tw;
        if (wp.y < 0.0) continue;
        vec3 nw = vec3(wp.x, 0.0, wp.z) / rw;
        float grazing = 1.0 / max(abs(dot(nw, rd)), 0.3);
        glow += mix(u_lamp, u_core, 0.45) * exp(-wp.y / 0.045) * wfade * 0.22 * grazing;
      }
    }
  }

  // Burning dust over the ruins, rising.
  if (u_wave.y > 0.001 && abs(rd.y) > 0.02) {
    for (int i = 0; i < 6; i++) {
      float fi = float(i);
      float y = fract(fi / 6.0 + u_wave.w * 0.02) * 0.44 + 0.004;
      float ty = (y - ro.y) / rd.y;
      if (ty <= 0.0 || ty > tHit) continue;
      vec2 q = (ro + rd * ty).xz + 0.02 * vec2(sin(u_wave.w * 0.3 + fi), cos(u_wave.w * 0.23 + fi * 1.7));
      float cell = 0.028 + 0.005 * fi;
      vec2 id = floor(q / cell);
      float h = hash(id + fi * 17.0);
      if (h > 0.5) continue;
      vec2 at = vec2(hash(id + 3.7), hash(id + 9.1)) * 0.8 + 0.1;
      float d = length(q / cell - id - at) * cell;
      float size = max(0.0011, ty * pixK * 1.1);
      float life = smoothstep(0.0, 0.06, y) * (1.0 - smoothstep(0.24, 0.44, y));
      float rr = length(q);
      float there = smoothstep(OUTER + 0.2, OUTER - 0.1, rr) * smoothstep(-0.05, 0.25, COURT + u_wave.x * WAVE_SPEED - rr);
      float burst = 0.55 + 1.6 * exp(-max(u_wave.x, 0.0) * 0.4);
      float twinkle = 0.6 + 0.4 * sin(u_wave.w * 3.0 + h * 40.0);
      glow += mix(u_lamp, u_core, h * 1.6) * exp(-d * d / (size * size)) * life * there * burst * twinkle * u_wave.y * 0.9;
    }
  }

  bloom += glow;
  o = vec4(tone(col + glow), clamp(maxc(bloom) * 0.85, 0.0, 1.0));
}
