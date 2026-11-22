precision highp float;
// «Он тот же»: a fixed camera; he stands in the middle and the world behind
// him changes through the seven places. The cold ring rides his sphere and
// carries a scan line across the frame; above it the next place has already
// come. Then the warm ring fills him with light that trembles, and at the end
// the seven places open round his chest star as sectors and merge into one.
// Positions are the places' own px (y down); the values come from compose()
// in lib.rs, the constants are its #defines (browser.rs).
uniform sampler2D u_places_a; // luminance of places 1, 2, 3 in R, G, B
uniform sampler2D u_places_b; // places 4, 5, 6
uniform sampler2D u_places_c; // place 7
uniform sampler2D u_hero;     // him, straight alpha
uniform vec2 u_res;
uniform vec4 u_window;        // place px shown: centre, size (window() in lib.rs)
uniform float u_px;           // place px per target px
uniform vec4 u_out;           // soft edges, -, -, -
uniform vec3 u_backdrop;      // the page around the scene
uniform vec4 u_edges;         // left, right, top, bottom
uniform float u_mode;         // recolor mode (0 accent by luminance, 2 ink on paper)
uniform vec3 u_paper;
uniform vec3 u_accent;
uniform vec3 u_highlight;
uniform vec3 u_cold;          // the first ring, the scan line, the seams
uniform vec3 u_warm;          // the second ring, the light inside him
uniform vec3 u_pale;          // white-hot cores
uniform vec4 u_ring[4];       // per ring: centre, A | B, runner, light
uniform vec4 u_fx[4];         // Frame.fx
in vec2 v_uv;
out vec4 o;

const float PI = 3.14159265;
const float TAU = 6.28318531;
const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);

float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float gauss(float d, float sigma) { return exp(-d * d / (2.0 * sigma * sigma)); }
// smoothstep that falls from 1 to 0 between a and b (a < b).
float fall(float a, float b, float x) { return 1.0 - smoothstep(a, b, x); }
float wrapAngle(float a) { return mod(a + PI, TAU) - PI; }

// The theme's recolor of a place's level, as scene-palette's recolor.frag.
vec3 recolor(float level) {
  level = clamp(level, 0.0, 1.0);
  if (u_mode < 0.5) return u_accent * level;
  float ink = pow(level, 1.3) * 0.74;
  vec3 muted = mix(u_accent, vec3(dot(u_accent, LUMA)), 0.4);
  vec3 tint = mix(muted, u_highlight, smoothstep(0.45, 0.95, level) * 0.55);
  return u_paper * (1.0 - ink) + tint * ink;
}

// A point of light: a hot core in the pale, a glow in its own color.
vec3 spark(float d, float core, float glow, vec3 color) {
  return u_pale * gauss(d, core) * 0.8 + color * (gauss(d, core * 1.6) * 0.6 + gauss(d, glow) * 0.22);
}

// One ring round him: centre + A sin θ + B cos θ, its front at θ = 0; a
// runner goes round it (dir: which way) with a bright tail.
vec3 ring(vec2 q, int r, vec3 color, float dir, float figure, float thin) {
  vec4 a = u_ring[2 * r], b = u_ring[2 * r + 1];
  vec2 C = a.xy, A = a.zw, B = b.xy;
  // At his eye's height the ring is seen edge on: keep it a thin oval.
  B.y = (B.y < 0.0 ? -1.0 : 1.0) * max(abs(B.y), 0.5);
  vec2 e = q - C;
  float cy = clamp(e.y / B.y, -1.0, 1.0);
  float th = atan(clamp((e.x - B.x * cy) / A.x, -1.0, 1.0), cy);
  for (int i = 0; i < 4; i++) {
    float sn = sin(th), cs = cos(th);
    vec2 diff = C + A * sn + B * cs - q;
    vec2 d1 = A * cs - B * sn;
    vec2 d2 = -(A * sn + B * cs);
    float g2 = dot(d1, d1) + dot(diff, d2);
    th -= clamp(dot(diff, d1) / max(g2, 1e-3), -0.25, 0.25);
  }
  float front = cos(th);
  float dist = distance(C + A * sin(th) + B * front, q);
  // Its back goes behind him.
  float hidden = fall(-0.2, 0.05, front) * figure;
  float behind = mod(dir * (b.z - th), TAU) / TAU;
  float tail = 1.0 + 1.3 * exp(-behind / 0.06) + 0.4 * exp(-behind / 0.25);
  float k = b.w * tail * (0.75 + 0.25 * front)
          * (gauss(dist, thin) * (0.8 / thin) * 0.9 + gauss(dist, 3.5) * 0.18 + exp(-dist / 16.0) * 0.03);
  vec3 light = mix(color, u_pale, 0.35 * gauss(dist, thin)) * k;
  vec2 P = C + A * sin(b.z) + B * cos(b.z);
  float hideP = fall(-0.2, 0.05, cos(b.z)) * figure;
  light += (1.0 - hideP) * b.w * 1.4 * spark(distance(q, P), 2.2, 11.0, color);
  return light * (1.0 - hidden);
}

// One place's level by its number (0..6), lifted from the dark painting.
float pick(float L[7], float k) {
  int i = int(k + 0.5);
  float v = L[0];
  for (int j = 1; j < 7; j++) if (j == i) v = L[j];
  return v;
}

void main() {
  vec2 q = u_window.xy + (vec2(v_uv.x, 1.0 - v_uv.y) - 0.5) * u_window.zw;
  float thin = max(0.8, 0.6 * u_px);

  // The seven places under this pixel.
  vec2 uv = q / SIZE;
  vec3 pa = texture(u_places_a, uv).rgb;
  vec3 pb = texture(u_places_b, uv).rgb;
  float pc = texture(u_places_c, uv).r;
  float L[7];
  L[0] = pa.r; L[1] = pa.g; L[2] = pa.b;
  L[3] = pb.r; L[4] = pb.g; L[5] = pb.b;
  L[6] = pc;
  for (int k = 0; k < 7; k++) L[k] = min(L[k] * PLACE_GAIN, 1.0);

  // The place standing; while a change is under way, the next one above the
  // scan line, which the cold ring carries down the frame.
  float top = u_window.y - 0.5 * u_window.w, bottom = u_window.y + 0.5 * u_window.w;
  float line = top - LINE_MARGIN + (bottom - top + 2.0 * LINE_MARGIN) * u_fx[0].z;
  float changing = u_fx[0].w;
  float above = changing * fall(line - 4.0 * u_px, line + 4.0 * u_px, q.y);
  float level = mix(pick(L, u_fx[0].x), pick(L, u_fx[0].y), above);

  // «Перепроверяй себя»: the seven places open as sectors round his star,
  // turning slowly; the sectors widen until every place is in every part,
  // and they merge into one image (a screen of all seven); out of it the
  // open field comes back.
  vec2 fromHeart = q - HEART;
  float theta = atan(fromHeart.y, fromHeart.x);
  float sectors = u_fx[1].x, width = u_fx[1].y, turn = u_fx[1].z, merge = u_fx[1].w;
  float resolve = u_fx[2].x;
  float seams = 0.0;
  if (sectors > 0.0) {
    float sum = 0.0, part = 0.0, screen = 1.0;
    for (int k = 0; k < 7; k++) {
      float c = -0.5 * PI + (float(k) + 0.5) * TAU / 7.0 + turn;
      float w = exp(-pow(wrapAngle(theta - c) / width, 2.0));
      sum += w;
      part += w * L[k];
      float g = mix(0.6, k == 0 ? 1.0 : 0.0, resolve);
      screen *= 1.0 - g * L[k];
      // The seams between sectors: thin cold rays out of his chest.
      float edge = wrapAngle(theta - c - PI / 7.0) * length(fromHeart);
      seams += gauss(edge, thin * 1.2) * (0.8 / thin);
    }
    part /= max(sum, 1e-4);
    level = mix(mix(level, part, sectors), 1.0 - screen, merge);
    seams *= sectors * (1.0 - smoothstep(0.0, 0.6, merge)) * smoothstep(30.0, 120.0, length(fromHeart));
  }
  vec3 col = recolor(level);

  // Him: dark smoky glass with warm light inside, the same in every place.
  vec2 pH = vec2(HERO_AXIS, HERO_CROWN) + (q - vec2(AXIS, CROWN)) * (HERO_SOLES - HERO_CROWN) / (FEET - CROWN);
  vec2 uvH = pH / HERO_TEX;
  vec4 hero = texture(u_hero, uvH);
  float figure = smoothstep(0.05, 0.95, hero.a);
  float heroL = dot(hero.rgb, LUMA);
  float rimF = figure * clamp((1.0 - textureLod(u_hero, uvH, 3.0).a) * 2.5, 0.0, 1.0);
  // «Позволь телу запомнить»: the warm ring climbs him and leaves him lit,
  // the light trembling in fine waves up his body.
  float fill = u_fx[2].z;
  float lit = fill * smoothstep(u_fx[2].y - 6.0, u_fx[2].y + 6.0, q.y);
  float tremble = u_fx[2].w * (0.5 + 0.5 * sin(TAU * (pH.y / 46.0 + u_fx[3].z * 2.0)));
  float glow = 1.0 + 0.9 * lit + 0.6 * tremble * lit;
  vec3 glass = u_paper * 0.55;
  vec3 inner = u_warm * (1.35 * heroL) * glow + u_pale * pow(heroL, 3.0) * 0.9;
  inner += lit * u_warm * (0.03 + 0.8 * rimF) + fill * u_warm * gauss(q.y - u_fx[2].y, 3.0) * 0.6 * figure;
  col = mix(col, glass + inner, figure);

  // The scan line at the edge of the change, behind him.
  vec3 light = vec3(0.0);
  float d = q.y - line;
  light += (1.0 - figure) * changing * u_cold
         * (gauss(d, thin * 1.2) * (0.7 / thin) * 0.55 + gauss(d, 6.0) * 0.08 + level * 1.6 * gauss(d, 14.0));
  light += (1.0 - figure) * u_cold * 0.35 * seams;

  // His star: a steady spark that opens into a glow while the places merge.
  float star = u_fx[3].x;
  float r = distance(q, HEART);
  light += spark(r, 1.6, 6.0, u_warm) * (0.5 + 1.2 * star);
  light += star * u_warm * (exp(-r / 60.0) * 0.18 + gauss(r, 150.0) * 0.05);

  // The rings: the cold first rides his sphere, the warm second scans him.
  light += ring(q, 0, u_cold, 1.0, hero.a, thin);
  light += ring(q, 1, u_warm, -1.0, hero.a, thin);
  col += light;

  // Dither against banding in the glows.
  col += (hash(gl_FragCoord.xy * 1.37) - 0.5) / 255.0;
  if (u_out.x > 0.5) {
    float m = smoothstep(0.0, u_edges.x, v_uv.x) * smoothstep(0.0, u_edges.y, 1.0 - v_uv.x)
            * smoothstep(0.0, u_edges.z, 1.0 - v_uv.y) * smoothstep(0.0, u_edges.w, v_uv.y);
    col = mix(u_backdrop, col, m);
  }
  o = vec4(clamp(col, 0.0, 1.0), 1.0);
}
