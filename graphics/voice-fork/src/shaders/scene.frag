precision highp float;
// «Камертон». Positions are the image's own pixels, y down; lib.rs's
// constants arrive as #defines (browser.rs). The woman is the one raster:
// R her light, G her silhouette. Everything else is drawn here: the matrix
// code behind her, parted round the voice into a channel; the string of the
// voice from her lips, trembling as a standing wave with its long-exposure
// envelope; the knots that run along it; the glow at her lips.
uniform sampler2D u_fig;
uniform vec2 u_res;          // target px
uniform vec4 u_hum;          // loudness, mode, phase, seconds into the loop
uniform vec4 u_chan;         // channel half-width, front, swing, breath
uniform vec4 u_lips;         // glow at the lips, -, -, -
uniform vec4 u_pulse[PULSES];// px along the string, strength
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

float axisY(float x) {
  float s = max(x - MOUTH.x, 0.0);
  return AXIS_Y + (MOUTH.y - AXIS_Y) * exp(-s / RISE);
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

// The rain at p, parted round the voice. Three layers, near to far.
vec3 rain(vec2 p, float px) {
  vec3 c = vec3(0.0);
  float time = u_hum.w;
  float ax = axisY(p.x);
  float d = p.y - ax;
  float reach = smoothstep(REACH.x, REACH.y, p.x) * (1.0 + 0.12 * max(p.x - REACH.y, 0.0) / 400.0);
  for (int k = 0; k < 3; k++) {
    float fk = float(k);
    float cw = 30.0 / pow(1.5, fk);
    float ch = cw * 1.3;
    float W = u_chan.x * reach * (1.0 - 0.12 * fk);
    float e = abs(d) - W;
    if (e < 0.0) continue;
    // The channel pushes the code aside: it bunches at the channel's edge
    // and the columns bend the way the voice goes.
    float sd = e + W * (1.0 - exp(-e / 60.0));
    float bend = 64.0 * (W / OPEN_MAX) * exp(-e / 80.0);
    vec2 q = vec2(p.x - bend + 6.0 * (3.0 - fk) * sin(TAU * time / LOOP_SECONDS), ax + sign(d) * sd);
    float u = q.x / cw + fk * 17.0;
    float col = floor(u);
    // Whole cells per loop, so the loop closes.
    float fall = 5.0 + floor(hash2(vec2(col, fk), 1u) * 8.0);
    float v = q.y / ch - fall * time / LOOP_SECONDS;
    float row = floor(v);
    float stream = 8.0 + floor(hash2(vec2(col, fk), 2u) * 14.0);
    float s = fract((row + floor(hash2(vec2(col, fk), 4u) * stream)) / stream);
    const float SHOW = 0.6;
    if (s > SHOW) continue;
    vec2 cell = vec2(col, row);
    if (hash2(cell, uint(k) + 3u) > 0.88) continue;
    float head = s / SHOW;
    // Squeezed cells near the channel: the glyph squeezes with them.
    float squeeze = 1.0 + (W / 60.0) * exp(-e / 60.0);
    vec2 f = vec2(-(fract(u) - 0.5), -(fract(v) - 0.5) * 1.3);
    float rate = 1.0 + floor(hash2(cell, 6u) * 30.0);
    float turn = mod(floor(time / LOOP_SECONDS * rate + hash2(cell, 5u) * rate), rate);
    int g = int(hash2(cell + turn * 7.0, uint(k) + 7u) * float(GLYPHS)) % GLYPHS;
    float cover = glyph(f, g, px * squeeze / cw);
    float lead = smoothstep(0.86, 1.0, head);
    float bright = (0.1 + 0.9 * pow(head, 1.6)) * (1.0 - 0.32 * fk);
    c += mix(u_cold, u_pale, 0.7 * lead) * cover * bright * (0.62 + 0.5 * lead);
  }
  return c;
}

// ---------- the voice
vec3 voice(vec2 p, float px) {
  vec3 c = vec3(0.0);
  float along = p.x - MOUTH.x;
  float w = max(1.1, 0.9 * px);
  if (along > -40.0) {
    float ax = axisY(p.x);
    float slope = 0.5 * (axisY(p.x + 1.0) - axisY(p.x - 1.0));
    float norm = inversesqrt(1.0 + slope * slope);
    float a = max(along, 0.0);
    float mode = u_hum.y;
    float env = u_chan.z * sin(PI * mode * a / SPAN);
    float harm = 0.5 * u_chan.z * sin(TAU * mode * a / SPAN);
    float start = smoothstep(-6.0, 26.0, along);
    float lit = 0.35 + 0.65 * smoothstep(u_chan.y, u_chan.y - 160.0, along);
    // The long exposure: the envelope's edges and its first overtone.
    float exposure = 0.0;
    for (int i = 0; i < 2; i++) {
      float sgn = float(i) * 2.0 - 1.0;
      exposure += 0.34 * exp(-sq(abs(p.y - ax - sgn * env) * norm / w));
      exposure += 0.14 * exp(-sq(abs(p.y - ax - sgn * harm) * norm / w));
    }
    c += u_cold * exposure * u_hum.x;
    // The string, trembling, with two fading after-images.
    float string = 0.0;
    for (int i = 0; i < 3; i++) {
      float ds = abs(p.y - ax - env * cos(u_hum.z - float(i) * 0.55)) * norm;
      float k = i == 0 ? 1.0 : (i == 1 ? 0.4 : 0.17);
      string += k * (0.95 * exp(-sq(ds / (w * 1.15))) + 0.22 * exp(-ds / (w * 5.0)));
    }
    c += mix(u_cold, u_pale, 0.6) * string;
    c *= lit * start;
    // Knots of light that run out along the string.
    for (int k = 0; k < PULSES; k++) {
      vec4 q = u_pulse[k];
      if (q.y <= 0.0) continue;
      float x = MOUTH.x + q.x;
      vec2 P = vec2(x, axisY(x) + u_chan.z * sin(PI * mode * q.x / SPAN) * cos(u_hum.z));
      float dk = distance(p, P);
      c += mix(u_warm, u_pale, 0.35) * q.y * (1.1 * exp(-sq(dk / 7.0)) + 0.32 * exp(-dk / 30.0));
    }
  }
  // Where the voice leaves her lips.
  float dl = distance(p, MOUTH + vec2(3.0, 0.0));
  c += u_warm * u_lips.x * (0.9 * exp(-sq(dl / 6.0)) + 0.3 * exp(-dl / 34.0));
  return c;
}

void main() {
  // Cover the target with the image, kept on its middle.
  float scale = max(u_res.x / SIZE.x, u_res.y / SIZE.y);
  vec2 frag = vec2(gl_FragCoord.x, u_res.y - gl_FragCoord.y);
  vec2 p = (frag - 0.5 * u_res) / scale + 0.5 * SIZE;
  float px = 1.0 / scale;

  // Her breath lifts her chest and shoulders a pixel or two.
  float lift = 1.4 * u_chan.w * smoothstep(560.0, 1000.0, p.y);
  vec4 fig = texture(u_fig, (p + vec2(0.0, lift)) / SIZE);
  float light = fig.r;
  float body = fig.g;

  vec3 col = u_backdrop;
  col += rain(p, px) * (1.0 - body);
  col += u_cold * light * 1.05 + u_pale * pow(light, 2.6) * 0.5;
  col += voice(p, px);

  // A soft shoulder instead of clipping the brightest glows.
  vec3 over = max(col - 0.85, 0.0);
  col = min(col, 0.85) + over / (1.0 + over * 2.5);
  col += (hash2(gl_FragCoord.xy, 11u) - 0.5) / 255.0;
  if (u_out.x > 0.5) {
    float m = smoothstep(0.0, u_edges.x, v_uv.x) * smoothstep(0.0, u_edges.y, 1.0 - v_uv.x)
            * smoothstep(0.0, u_edges.z, 1.0 - v_uv.y) * smoothstep(0.0, u_edges.w, v_uv.y);
    col = mix(u_backdrop, col, m);
  }
  o = vec4(clamp(col, 0.0, 1.0), 1.0);
}
