precision highp float;
// «Камертон». Positions are the image's own pixels, y down; lib.rs's
// constants arrive as #defines (browser.rs). The woman is the one raster:
// R her light, G her silhouette, B her mouth half open and open (see main).
// Everything else is drawn here: the wave of her voice, and the matrix code
// behind her in six layers, which her voice breaks as it reaches it and
// which is written back, column by column, when she falls silent.
uniform sampler2D u_fig;
uniform vec2 u_res;          // target px
uniform vec4 u_hum;          // loudness, -, -, seconds into the loop
uniform vec4 u_say;          // mouth open 0..1, glow in the mouth, breath, -
uniform vec3 u_cold;
uniform vec3 u_warm;
uniform vec3 u_pale;
uniform vec3 u_backdrop;     // the page around the scene
uniform vec4 u_edges;        // left, right, top, bottom
uniform vec4 u_out;          // soft edges
in vec2 v_uv;
out vec4 o;

const vec2 SIZE = vec2(1536.0, 1024.0);
const float TAU = 6.28318531;
// 0, but not known to the compiler: loops counted from it stay loops.
// Windows (ANGLE -> D3D11) unrolls every loop with constant bounds and
// inlines every call, which once held the page still for seconds.
int ZERO;

uint mixBits(uint x) {
  x ^= x >> 16;
  x *= 0x7feb352du;
  x ^= x >> 15;
  x *= 0x846ca68bu;
  x ^= x >> 16;
  return x;
}
float hash2(vec2 cell, uint k) {
  ivec2 c = ivec2(cell);
  return float(mixBits(uint(c.x) * 0x9e3779b9u ^ mixBits(uint(c.y) + 0x632be5abu + k * 0x27d4eb2du)) >> 8) / 16777215.0;
}
float sq(float x) {
  return x * x;
}

// ---------- matrix code
// Mirrored katakana-like marks and two digits, as strokes in a cell
// -0.5..0.5 (y up); unused strokes sit far away.
const int GLYPHS = 14;
const vec4 NONE = vec4(9.0, 9.0, 9.0, 9.0);
const vec4 STROKES[GLYPHS * 4] = vec4[](
  vec4(-0.28, 0.42, 0.28, 0.42), vec4(0.28, 0.42, 0.06, 0.1), vec4(0.0, 0.2, -0.12, -0.48), NONE,
  vec4(0.0, 0.5, 0.0, 0.32), vec4(-0.26, 0.3, 0.26, 0.3), vec4(0.26, 0.3, 0.18, -0.08), vec4(0.18, -0.08, -0.2, -0.48),
  vec4(-0.24, 0.4, 0.24, 0.4), vec4(0.0, 0.4, 0.0, -0.4), vec4(-0.3, -0.4, 0.3, -0.4), NONE,
  vec4(-0.28, 0.25, 0.25, 0.25), vec4(0.25, 0.25, 0.18, -0.48), vec4(-0.02, 0.5, -0.25, -0.45), NONE,
  vec4(-0.28, 0.25, 0.28, 0.3), vec4(-0.3, -0.02, 0.3, 0.04), vec4(-0.05, 0.5, 0.08, -0.5), NONE,
  vec4(-0.15, 0.5, -0.3, 0.15), vec4(-0.22, 0.28, 0.3, 0.28), vec4(0.1, 0.28, -0.1, -0.5), NONE,
  vec4(-0.25, 0.38, -0.1, 0.3), vec4(-0.28, 0.08, -0.12, 0.0), vec4(-0.25, -0.45, 0.28, 0.25), NONE,
  vec4(-0.25, 0.35, -0.15, 0.15), vec4(0.0, 0.38, 0.08, 0.18), vec4(0.3, 0.38, -0.1, -0.5), NONE,
  vec4(-0.2, 0.25, 0.2, 0.25), vec4(-0.3, -0.3, 0.3, -0.3), NONE, NONE,
  vec4(-0.3, -0.1, -0.1, 0.25), vec4(-0.1, 0.25, 0.3, -0.3), NONE, NONE,
  vec4(-0.2, 0.38, 0.2, 0.25), vec4(-0.2, 0.05, 0.2, -0.05), vec4(-0.25, -0.3, 0.25, -0.45), NONE,
  vec4(-0.05, 0.5, -0.28, 0.1), vec4(-0.12, 0.35, 0.28, 0.35), vec4(0.28, 0.35, -0.15, -0.5), NONE,
  vec4(-0.2, 0.42, 0.2, 0.42), vec4(0.2, 0.42, 0.2, -0.42), vec4(0.2, -0.42, -0.2, -0.42), vec4(-0.2, -0.42, -0.2, 0.42),
  vec4(0.0, 0.45, 0.0, -0.45), vec4(0.0, 0.45, -0.15, 0.3), NONE, NONE
);
const float STROKE = 0.055;
float seg(vec2 p, vec4 s) {
  vec2 pa = p - s.xy;
  vec2 ba = s.zw - s.xy;
  return length(pa - ba * clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0));
}
// Distance from f to glyph g's strokes, in cells.
float strokes(vec2 f, int g) {
  float d = 9.0;
  for (int i = ZERO; i < 4; i++) d = min(d, seg(f, STROKES[g * 4 + i]));
  return d;
}
// Coverage at distance d from a stroke; px is one target pixel (plus any
// defocus) in cells.
float ink(float d, float px) {
  return (1.0 - smoothstep(STROKE - px * 0.5, STROKE + px * 0.5, d)) * min(1.0, 0.16 / (STROKE + px));
}

// The layers, near to far: glyph width, defocus (px), light, how many of the
// stream's glyphs show, and how far behind her lips each stands (lib.rs).
const float L_SIZE[LAYERS] = float[](64.0, 30.0, 21.0, 15.0, 10.5, 7.5);
const float L_BLUR[LAYERS] = float[](9.0, 0.0, 0.0, 0.35, 0.8, 1.2);
const float L_GAIN[LAYERS] = float[](0.6, 1.0, 0.82, 0.64, 0.48, 0.34);
const float L_KEEP[LAYERS] = float[](0.3, 0.93, 0.93, 0.93, 0.93, 0.93);
const float DEPTH[LAYERS] = float[](DEPTHS);

// One glyph's cell in layer k (0 near .. LAYERS-1 far) at q.
struct Cell {
  vec2 id;      // column, row
  vec2 f;       // q in the glyph: -0.5..0.5 across, -0.65..0.65 up
  vec2 centre;  // image px
  float size;   // the cell's width, px
  float lit;    // 1 where the stream shows a glyph
  float head;   // 0..1 down the stream, brightest at its lower end
};
const float SHOW = 0.72;
Cell cellAt(vec2 q, int k, float time) {
  float fk = float(k);
  Cell c;
  c.size = L_SIZE[k];
  float ch = c.size * 1.3;
  float sway = 4.8 * (float(LAYERS) - fk) * sin(TAU * time / LOOP_SECONDS);
  float u = (q.x + sway) / c.size + fk * 17.0;
  float col = floor(u);
  // Whole cells per loop, so the loop closes.
  float drop = (5.0 + floor(hash2(vec2(col, fk), 1u) * 8.0)) * time / LOOP_SECONDS;
  float v = q.y / ch - drop;
  float row = floor(v);
  c.id = vec2(col, row);
  c.f = vec2(-(fract(u) - 0.5), -(fract(v) - 0.5) * 1.3);
  c.centre = vec2((col + 0.5 - fk * 17.0) * c.size - sway, (row + 0.5 + drop) * ch);
  float stream = 8.0 + floor(hash2(vec2(col, fk), 2u) * 14.0);
  float s = fract((row + floor(hash2(vec2(col, fk), 4u) * stream)) / stream);
  c.lit = step(s, SHOW) * step(hash2(c.id, uint(k) + 3u), L_KEEP[k]);
  c.head = c.lit * s / SHOW;
  return c;
}
// The glyph cell c shows at time t: each changes now and then.
int glyphOf(Cell c, int k, float t) {
  float rate = 1.0 + floor(hash2(c.id, 6u) * 30.0);
  float turn = mod(floor(t / LOOP_SECONDS * rate + hash2(c.id, 5u) * rate), rate);
  return int(hash2(c.id + turn * 7.0, uint(k) + 7u) * float(GLYPHS)) % GLYPHS;
}
// The stream's light on a glyph: dim at its top, bright at its lower end.
float shine(Cell c, int k) {
  return (0.1 + 0.9 * pow(c.head, 1.6)) * L_GAIN[k];
}

// ---------- the voice
// Seconds since her voice reached q in a layer `depth` px behind her lips
// and broke the code there (< 0 before): lib.rs's breaks().
float heard(vec2 q, float depth, float time) {
  return time - BREAK_AT - length(vec2(length(q - MOUTH), depth)) / SOUND_SPEED;
}
// How loud the wave that left her lips at time te looks: it comes on fast,
// so the crest that breaks the code is already bright.
float sung(float te) {
  float a = te - HUM;
  return smoothstep(0.0, 0.12, a) * (1.0 - smoothstep(HUM_SECONDS - RELEASE, HUM_SECONDS, a));
}
// How far the writing in c's column has run past c, px (< 0: not yet).
float written(Cell c, int k, float time) {
  vec2 column = vec2(c.id.x, float(k));
  float start = WRITE_AT + WRITE_SPREAD * hash2(column, 8u);
  float speed = mix(WRITE_SPEED.x, WRITE_SPEED.y, hash2(column, 9u));
  return (time - start) * speed - c.size * 1.3 - c.centre.y;
}
// Where the voice has carried a grain that lay at q, way i of three (slow,
// middle, fast), in the layer `depth` px behind her: pushed out from her
// lips at once, then drifting on the air of her voice, swirling a little
// and settling. Farther layers move less across the frame.
vec2 carried(vec2 q, float i, float fk, float depth, float time) {
  float a = max(heard(q, depth, time), 0.0);
  vec2 v = q - MOUTH;
  float r = max(length(v), 1.0);
  vec2 out_ = v / r;
  // Gentler right at her lips, so the dust thins there but leaves no hole.
  float push = (100.0 + 100.0 * i) * 600.0 / (600.0 + depth);
  float go = (push * 0.9 * (1.0 - exp(-a / 0.9)) + (8.0 + 8.0 * i) * a) * r / (r + 260.0);
  // Broad eddies gather the grains into wisps. Kept gentle (the flight
  // changes by well under a px per px), so rain() can undo it.
  vec2 w = q * 0.008 + vec2(1.3 * i, 0.7 * fk);
  float grow = 1.6 * (1.0 - exp(-a / 1.6));
  float swirl = (10.0 + 6.0 * i) * grow * sin(w.x + 1.1 * a) * cos(0.8 * w.y - 0.6 * a + 1.7 * i);
  float along = 8.0 * grow * sin(0.9 * w.y + 0.7 * w.x + 2.3 * i);
  return out_ * (go + along) + vec2(-out_.y, out_.x) * swirl + vec2(0.0, 12.0 * a);
}

// The rain at p, near layer to far, kept off her body (`body`, her
// silhouette): the nearest layer, large and out of focus, falls in front of
// her too, faint there. A glyph stands until the voice reaches
// it, and flares. In the middle layers it then comes apart into grains (6 x 8
// to a cell, each going one of three ways), which fly, shrink and fade; in
// the nearest and the far layers it drifts a little and melts, block by
// block. Written back, it stands again, bright for a moment behind the
// writing head.
vec3 rain(vec2 p, float px, float time, float ring, float body) {
  vec3 c = vec3(0.0);
  bool dusty = heard(p, 0.0, time) > -0.3 && time < WRITE_AT + 0.4;
  for (int k = ZERO; k < LAYERS; k++) {
    float keep = k == 0 ? 1.0 - 0.65 * body : 1.0 - body;
    if (keep <= 0.0) continue;
    float fk = float(k);
    float depth = DEPTH[k];
    float soft = px + L_BLUR[k];
    Cell s = cellAt(p, k, time);
    float back = written(s, k, time);
    if (back > 0.0 || heard(s.centre, depth, time) < 0.0) {
      // The writing head: one bright glyph, lit or not, and a trail.
      float atHead = back > 0.0 ? 1.0 - step(s.size * 1.3, back) : 0.0;
      float fresh = back > 0.0 ? exp(-back / (s.size * 5.0)) : 0.0;
      float on = max(s.lit, atHead);
      // A crest of her voice rings through the code and shows, for a moment,
      // the glyphs between its streams too.
      float rung = (1.0 - on) * min(ring, 1.0);
      if (on > 0.0 || rung > 0.02) {
        float cover = ink(strokes(s.f, glyphOf(s, k, time)), soft / s.size);
        float lead = max(smoothstep(0.86, 1.0, s.head), max(atHead, 0.8 * fresh));
        float bright = max(shine(s, k) * (1.0 + 1.2 * fresh), atHead * L_GAIN[k]);
        c += mix(u_cold, u_pale, 0.7 * lead) * cover * bright * (0.62 + 0.5 * lead) * on * keep;
        // The lit heads glow a little round themselves.
        c += u_cold * lead * L_GAIN[k] * 0.07 * exp(-dot(s.f, s.f) * 5.0) * on * keep;
        c += mix(u_cold, u_pale, 0.5) * cover * rung * L_GAIN[k] * 0.5 * keep;
      }
    }
    if (!dusty) continue;
    if (k < GRAIN_FIRST || k > GRAIN_LAST) {
      // Melting: the glyph drifts whole and goes block by block. Find the
      // cell whose own drift brings it here (two steps).
      vec2 fly = carried(p, 1.0, fk, depth, time);
      Cell g = cellAt(p - fly, k, time);
      fly = carried(g.centre, 1.0, fk, depth, time);
      g = cellAt(p - fly, k, time);
      if (g.lit < 0.5) continue;
      fly = carried(g.centre, 1.0, fk, depth, time);
      float ag = heard(g.centre, depth, time);
      if (ag < 0.0) continue;
      vec2 lf = (g.centre - p + fly) / g.size;
      float cover = ink(strokes(lf, glyphOf(g, k, time - ag)), soft / g.size);
      vec2 at = floor((lf + vec2(0.5, 0.65)) * vec2(4.0, 5.0 / 1.3));
      float hm = hash2(g.id * vec2(4.0, 5.0) + at, uint(k) + 30u);
      float gone = 1.15 * smoothstep(0.05, MELT_SECONDS, ag);
      float alive = smoothstep(gone - 0.1, gone, hm);
      float flare = exp(-sq((ag - 0.1) / 0.16));
      float bright = (shine(g, k) + 0.6 * flare * L_GAIN[k]) * alive;
      c += mix(u_cold, u_pale, 0.7 * flare) * cover * bright * (0.62 + 0.5 * flare) * keep;
      continue;
    }
    float grain = s.size / 6.0;
    for (int i = ZERO; i < 3; i++) {
      float fi = float(i);
      // Which grain of this way lies here now: undo its flight (a few
      // steps, as the flight depends on where it started).
      vec2 q = p;
      for (int n = ZERO; n < 5; n++) q = p - carried(q, fi, fk, depth, time);
      Cell g = cellAt(q, k, time);
      if (g.lit < 0.5) continue;
      float ag = heard(g.centre, depth, time);
      if (ag < 0.0) continue;
      vec2 at = floor((g.f + vec2(0.5, 0.65)) * vec2(6.0, 8.0 / 1.3));
      float h = hash2(g.id * vec2(6.0, 8.0) + at, uint(k) + 20u);
      if (int(h * 3.0) != i) continue;
      // The grain's centre in the glyph and in the image; its own flight.
      vec2 gc = (at + 0.5) / vec2(6.0, 8.0 / 1.3) - vec2(0.5, 0.65);
      vec2 home = g.centre - gc * g.size;
      vec2 fly = carried(home, fi, fk, depth, time);
      int gl = glyphOf(g, k, time - ag);
      // First the glyph's own strokes, cut along the grains; then each
      // grain a round speck, shrinking.
      float m = smoothstep(0.05, 0.4, ag);
      float kind = fract(h * 13.7);
      float hangs = step(kind, 0.1) * smoothstep(0.6, 1.4, ag) * (1.0 - smoothstep(WRITE_AT - 0.6, WRITE_AT + 0.3, time));
      float whole = m < 1.0 ? ink(strokes((g.centre - p + fly) / g.size, gl), soft / g.size) : 0.0;
      float speck = 0.0;
      if (m > 0.0) {
        float near = 1.0 - smoothstep(STROKE + 0.03, STROKE + 0.13, strokes(gc, gl));
        float rad = grain * mix(mix(0.5, 0.28, smoothstep(0.4, DUST_SECONDS, ag)), 0.45, hangs);
        float edge = max(rad, 0.7 * px);
        float d = length(p - home - fly);
        speck = near * (1.0 - smoothstep(edge - 0.6 * px, edge + 0.6 * px, d)) * sq(rad / edge) * 0.8;
      }
      // Grains go out one by one, not all together: most soon after the
      // glyph breaks, some drift on for seconds, and a few hang in the air,
      // glinting, as long as she sings.
      float lasting = step(kind, 0.4);
      float span = mix(0.45 + 0.5 * fract(h * 7.31), DUST_SECONDS * (0.55 + 0.45 * fract(h * 7.31)), lasting);
      float life = 1.0 - smoothstep(0.5, 1.0, ag / span);
      float glint = 0.55 + 0.45 * sin(2.3 * time + 40.0 * fract(h * 3.7));
      float flare = exp(-sq((ag - 0.1) / 0.16));
      float bright = (shine(g, k) * (0.8 + 0.6 * lasting) + 0.75 * flare * L_GAIN[k]) * life + 0.8 * glint * hangs * L_GAIN[k];
      c += mix(u_cold, u_pale, 0.75 * flare) * mix(whole, speck, m) * bright * (0.62 + 0.6 * flare) * keep;
    }
  }
  return c;
}

// The wave of her voice at p: crests leave her lips every WAVE_PERIOD and
// run out at SOUND_SPEED, each with a sharp front and a soft tail, strongest
// where she sings, broken along its arc, fading with distance. Returns its
// light (x) and how far it bends the air (y, px, along the way out).
vec2 wave(vec2 p, float time) {
  vec2 v = p - MOUTH;
  float r = max(length(v), 1.0);
  float te = time - r / SOUND_SPEED;
  float loud = sung(te);
  if (loud <= 0.0) return vec2(0.0);
  float phase = (te - BREAK_AT) / WAVE_PERIOD;
  // The crests grow until the one that breaks the code.
  loud *= mix(0.55, 1.0, smoothstep(FIRST_CREST, BREAK_AT, te));
  float x = fract(phase);
  // A sharp front and a soft tail that is gone before the next crest.
  float rise = smoothstep(0.0, 0.03, x) * (1.0 - smoothstep(0.6, 1.0, x));
  float front = rise * exp(-9.0 * x);
  float tail = rise * 0.18 * exp(-4.0 * x);
  float along = dot(v / r, VOICE_DIR);
  float aim = 0.08 + 0.92 * smoothstep(-0.3, 0.95, along);
  // Each front is broken differently along its arc (its soft tail is not,
  // so no seams run out from her lips), keeps its breaks as it runs, and is
  // a little louder or softer than the one before.
  float n = 8.0 * atan(v.y, v.x);
  float wf = floor(phase);
  float broken = mix(hash2(vec2(floor(n), wf), 40u), hash2(vec2(floor(n) + 1.0, wf), 40u), smoothstep(0.0, 1.0, fract(n)));
  broken = 0.15 + 0.85 * smoothstep(0.1, 0.9, broken);
  float swell = 0.65 + 0.35 * hash2(vec2(wf, 3.0), 41u);
  // It leaves her lips and thins out as it spreads.
  float fall = smoothstep(6.0, 60.0, r) / (1.0 + r / 520.0);
  float bend = sin(TAU * x) * exp(-3.0 * x) * smoothstep(0.0, 0.05, x) * (1.0 - smoothstep(0.6, 1.0, x));
  return vec2((front * broken + tail) * swell, 12.0 * bend) * loud * aim * fall;
}

void main() {
  ZERO = min(int(u_hum.w), 0);
  // Cover the target with the image, kept on its middle.
  float scale = max(u_res.x / SIZE.x, u_res.y / SIZE.y);
  vec2 frag = vec2(gl_FragCoord.x, u_res.y - gl_FragCoord.y);
  vec2 p = (frag - 0.5 * u_res) / scale + 0.5 * SIZE;
  float px = 1.0 / scale;
  float time = u_hum.w;

  // Her breath lifts her chest and shoulders a pixel or two.
  vec2 s = p + vec2(0.0, 1.4 * u_say.z * smoothstep(560.0, 1000.0, p.y));
  vec4 fig = texture(u_fig, s / SIZE);
  float light = fig.r;
  // Her mouth is drawn three times: closed (R), open (B) and, MOUTH_SHIFT px
  // to the right, half open (B). Opening, she passes through all three.
  if (u_say.x > 0.001 && all(greaterThan(s, MOUTH_BOX.xy)) && all(lessThan(s, MOUTH_BOX.zw))) {
    float part = texture(u_fig, (s + vec2(MOUTH_SHIFT, 0.0)) / SIZE).b;
    float a = 2.0 * u_say.x;
    light = a < 1.0 ? mix(fig.r, part, a) : mix(part, fig.b, a - 1.0);
  }
  float body = fig.g;

  // The air bends where a crest passes, and the code behind it with it.
  vec2 w = wave(p, time);
  vec2 away = p - MOUTH;
  float rw = max(length(away), 1.0);
  vec3 col = u_backdrop;
  // A crest lights the code and the dust it passes through.
  vec2 bent = p - away / rw * w.y;
  float lift = 1.0 + 4.0 * w.x;
  float ring = 1.6 * w.x;
  col += rain(bent, px, time, ring, body) * lift;
  // The wave itself: warm at her lips, paler as it goes.
  col += mix(u_warm, mix(u_cold, u_pale, 0.6), smoothstep(15.0, 140.0, rw)) * w.x * 0.42 * (1.0 - body);
  col += u_cold * light * 1.05 + u_pale * pow(light, 2.6) * 0.5;
  // The voice: a warm glow deep in her open mouth, beating with the crests
  // it sends out.
  float dl = length((p - MOUTH - vec2(-36.0, 0.0)) / vec2(1.0, 0.45));
  float beat = 0.82 + 0.18 * cos(TAU * (time - BREAK_AT) / WAVE_PERIOD);
  col += u_warm * u_say.y * u_say.x * beat * (0.22 * exp(-sq(dl / 16.0)) + 0.06 * exp(-dl / 40.0));

  // A soft shoulder instead of clipping the brightest glows.
  vec3 over = max(col - 0.85, 0.0);
  col = min(col, 0.85) + over / (1.0 + over * 2.5);
  col += (hash2(gl_FragCoord.xy, 11u) - 0.5) / 255.0;
  if (u_out.x > 0.5) {
    float e = smoothstep(0.0, u_edges.x, v_uv.x) * smoothstep(0.0, u_edges.y, 1.0 - v_uv.x)
            * smoothstep(0.0, u_edges.z, 1.0 - v_uv.y) * smoothstep(0.0, u_edges.w, v_uv.y);
    col = mix(u_backdrop, col, e);
  }
  o = vec4(clamp(col, 0.0, 1.0), 1.0);
}
