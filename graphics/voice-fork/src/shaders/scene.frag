precision highp float;
// «Камертон». Positions are the image's own pixels, y down; lib.rs's
// constants arrive as #defines (browser.rs). The woman is the one raster:
// R her light, G her silhouette, B her mouth half open and open (see main). Everything else is drawn here: the matrix code behind
// her; the rings of her voice, which cross the whole frame; and, where they
// have passed, the code gathered along the still lines of the note.
uniform sampler2D u_fig;
uniform vec2 u_res;          // target px
uniform vec4 u_hum;          // loudness, mode, ring phase, seconds into the loop
uniform vec4 u_say;          // mouth open 0..1, glow in the mouth, breath, -
uniform vec4 u_track[TRACK]; // over the loop: loudness, order, mode, -
uniform vec3 u_cold;
uniform vec3 u_warm;
uniform vec3 u_pale;
uniform vec3 u_backdrop;     // the page around the scene
uniform vec4 u_edges;        // left, right, top, bottom
uniform vec4 u_out;          // soft edges
in vec2 v_uv;
out vec4 o;

const vec2 SIZE = vec2(1536.0, 1024.0);
const float PI = 3.14159265;
const float TAU = 6.28318531;
// The pattern's axis follows her gaze, up and to the right.
const float GAZE = 0.12;

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

// ---------- the voice in the field
// What the voice was doing at time t (seconds, round the loop).
vec4 trackAt(float t) {
  float x = fract(t / LOOP_SECONDS) * float(TRACK);
  int i = min(int(floor(x)), TRACK - 1);
  return mix(u_track[i], u_track[(i + 1) % TRACK], fract(x));
}
// At p: the note's standing wave (0 on its still lines), how far the code
// there has gathered, and the loudness that has reached it, all heard
// distance / SOUND_SPEED late.
vec3 field(vec2 p) {
  vec2 v = p - MOUTH;
  float r = length(v);
  vec4 tr = trackAt(u_hum.w - r / SOUND_SPEED);
  float th = atan(-v.y, v.x) - GAZE;
  float wave = cos(TAU * r * tr.z / 900.0) * cos((tr.z - 1.0) * th);
  // Right at her lips the note is too close to have a shape.
  float near = smoothstep(30.0, 110.0, r);
  return vec3(wave, tr.y * near, tr.x);
}
// The rings of her voice, running out from her lips across the frame.
float rings(vec2 p) {
  vec2 v = p - MOUTH;
  float r = length(v);
  float loud = trackAt(u_hum.w - r / SOUND_SPEED).x;
  float gap = SOUND_SPEED / TREMBLE;
  float crest = pow(0.5 + 0.5 * cos(TAU * r / gap - u_hum.z), 40.0);
  return crest * loud * smoothstep(8.0, 60.0, r) / (1.0 + r / 700.0);
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
float seg(vec2 p, vec4 s) {
  vec2 pa = p - s.xy;
  vec2 ba = s.zw - s.xy;
  return length(pa - ba * clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0));
}
// Coverage of glyph g at f; px is the cell's size of one target pixel.
float glyph(vec2 f, int g, float px) {
  float d = 9.0;
  for (int i = 0; i < 4; i++) d = min(d, seg(f, STROKES[g * 4 + i]));
  const float w = 0.055;
  return (1.0 - smoothstep(w - px * 0.5, w + px * 0.5, d)) * min(1.0, 0.16 / (w + px));
}

// The rain at p. Four layers, near to far. Each glyph asks the voice's
// field at its own cell, so a glyph is kept or shaken off whole: on the
// still lines of the note it stays and lights; elsewhere it is shaken off.
vec3 rain(vec2 p, float px) {
  vec3 c = vec3(0.0);
  float time = u_hum.w;
  for (int k = 0; k < 4; k++) {
    float fk = float(k);
    float cw = 30.0 / pow(1.42, fk);
    float ch = cw * 1.3;
    float sway = 6.0 * (4.0 - fk) * sin(TAU * time / LOOP_SECONDS);
    float u = (p.x + sway) / cw + fk * 17.0;
    float col = floor(u);
    // Whole cells per loop, so the loop closes.
    float fall = 5.0 + floor(hash2(vec2(col, fk), 1u) * 8.0);
    float v = p.y / ch - fall * time / LOOP_SECONDS;
    float row = floor(v);
    vec2 cell = vec2(col, row);
    if (hash2(cell, uint(k) + 3u) > 0.93) continue;
    float stream = 8.0 + floor(hash2(vec2(col, fk), 2u) * 14.0);
    float s = fract((row + floor(hash2(vec2(col, fk), 4u) * stream)) / stream);
    const float SHOW = 0.72;
    float lit = step(s, SHOW);
    vec2 centre = vec2((col + 0.5 - fk * 17.0) * cw - sway, (row + 0.5 + fall * time / LOOP_SECONDS) * ch);
    vec3 f3 = field(centre);
    float still = 1.0 - smoothstep(0.08, 0.4, abs(f3.x));
    float keep = mix(1.0, still, f3.y);
    float hold = still * f3.y;
    float on = max(lit * keep, hold);
    if (on < 0.01) continue;
    float head = lit > 0.5 ? s / SHOW : 0.0;
    vec2 f = vec2(-(fract(u) - 0.5), -(fract(v) - 0.5) * 1.3);
    float rate = 1.0 + floor(hash2(cell, 6u) * 30.0);
    float turn = mod(floor(time / LOOP_SECONDS * rate + hash2(cell, 5u) * rate), rate);
    int g = int(hash2(cell + turn * 7.0, uint(k) + 7u) * float(GLYPHS)) % GLYPHS;
    float cover = glyph(f, g, px / cw);
    float lead = max(smoothstep(0.86, 1.0, head), 0.6 * hold);
    float bright = max((0.1 + 0.9 * pow(head, 1.6)) * lit * keep, hold * (0.55 + 0.25 * f3.z)) * (1.0 - 0.24 * fk);
    c += mix(u_cold, u_pale, 0.7 * lead) * cover * bright * (0.62 + 0.5 * lead);
  }
  return c;
}

void main() {
  // Cover the target with the image, kept on its middle.
  float scale = max(u_res.x / SIZE.x, u_res.y / SIZE.y);
  vec2 frag = vec2(gl_FragCoord.x, u_res.y - gl_FragCoord.y);
  vec2 p = (frag - 0.5 * u_res) / scale + 0.5 * SIZE;
  float px = 1.0 / scale;

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

  vec3 col = u_backdrop;
  vec3 f3 = field(p);
  float behind = 1.0 - body;
  col += rain(p, px) * behind;
  // Between the still lines the field shivers with the note.
  col += u_cold * 0.05 * f3.y * f3.z * sq(f3.x) * (0.6 + 0.4 * cos(u_hum.z)) * behind;
  col += mix(u_cold, u_pale, 0.5) * rings(p) * 0.3 * behind;
  col += u_cold * light * 1.05 + u_pale * pow(light, 2.6) * 0.5;
  // The voice: a warm glow deep in her open mouth.
  float dl = length((p - MOUTH - vec2(-36.0, 0.0)) / vec2(1.0, 0.45));
  col += u_warm * u_say.y * u_say.x * (0.22 * exp(-sq(dl / 16.0)) + 0.06 * exp(-dl / 40.0));

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
