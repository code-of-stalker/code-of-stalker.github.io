// A callout's word, typed out left to right behind a cursor, on its
// underline. A soft cover under the letters knocks the strokes behind them
// back to the page so the word reads (blend ONE, ONE_MINUS_SRC_ALPHA).
// The `#define`s come from lib.rs (browser.rs).
precision highp float;
flat in vec4 v_word;
flat in vec4 v_box;
flat in vec2 v_line;
flat in vec2 v_pin;
in vec2 v_px;
out vec4 o;
uniform sampler2D u_atlas; // the words, one 128 px row each
uniform vec4 u_frame;
uniform vec3 u_pale;
uniform vec3 u_backdrop;

const vec2 INK[WORDS] = LABEL_INK_LIST;

void main() {
  float light = v_word.x;
  float typed = v_word.y;
  float row = v_word.z;
  float per = v_word.w;
  vec2 ink = INK[int(row + 0.5)];
  float x0 = v_box.x;
  float base = v_box.y;
  float cap = v_box.w;
  float ax = ink.x + (v_px.x - x0) * per;
  float ay = LABEL_BASE - (v_px.y - base) * per;
  float inside = step(LABEL_BAND.x - 24.0, ay) * step(ay, LABEL_BAND.y + 24.0)
               * step(ink.x - 24.0, ax) * step(ax, ink.y + 24.0);
  vec2 uv = vec2(ax, row * 128.0 + clamp(ay, 0.5, 127.5)) / ATLAS;
  float lod = max(0.0, log2(per));
  // Typed up to here; the cursor stands just after it.
  float front = ink.x + typed * (ink.y - ink.x);
  float shown = clamp((front - ax) / per + 0.5, 0.0, 1.0);
  float letters = textureLod(u_atlas, uv, lod).r * inside * shown;
  float blur = textureLod(u_atlas, uv, lod + 2.5).r * inside * shown;
  float cursor = typed < 1.0
    ? step(front + 6.0, ax) * step(ax, front + 6.0 + 0.55 * LABEL_CAP)
      * step(LABEL_BASE - LABEL_CAP, ay) * step(ay, LABEL_BASE)
    : 0.0;
  // The underline grows out from the pin as the word is typed.
  float th = max(0.8 * u_frame.x, 1.0);
  float along = v_line.y - v_line.x;
  float grown = clamp(1.6 * typed, 0.0, 1.0);
  bool fromLeft = v_pin.y > 0.5;
  float a = fromLeft ? v_line.y - along * grown : v_line.x;
  float b = fromLeft ? v_line.y : v_line.x + along * grown;
  float span = clamp(v_px.x - a + 0.5, 0.0, 1.0) * clamp(b - v_px.x + 0.5, 0.0, 1.0);
  float under = span * (1.0 - smoothstep(0.5 * th - 0.5, 0.5 * th + 0.5, abs(v_px.y - v_pin.x)));
  float cover = 0.85 * min(1.0, 2.4 * blur + cursor) * light;
  vec3 lit = u_pale * light * (0.95 * letters + 0.6 * cursor + 0.45 * under);
  o = vec4(u_backdrop * cover + lit, cover);
}
