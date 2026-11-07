// One callout (pen.rs `label`): the word pinned at the end of its leader,
// standing on an underline that runs from the pin under it, kept inside the
// 3:2 frame. One quad covers the underline, the word and the typing cursor.
// The `#define`s come from lib.rs (browser.rs).
precision highp float;
layout(location = 0) in vec4 a_at;   // the pin, the word's row
layout(location = 1) in vec4 a_word; // light, how much is typed, which way, -
uniform vec4 u_eye;
uniform vec4 u_right;
uniform vec4 u_up;
uniform vec4 u_fwd;
uniform vec4 u_view;
uniform vec4 u_frame; // px of a 720-high frame, -, canvas px per CSS px, -
flat out vec4 v_word; // light, typed, row, atlas px per screen px
flat out vec4 v_box;  // the word's left (px), its baseline, its width, a capital's height
flat out vec2 v_line; // the underline from, to (px, x)
flat out vec2 v_pin;  // the pin's height (px), 1 when the word ends at it
out vec2 v_px;

const vec2 INK[WORDS] = LABEL_INK_LIST;
const vec2 CORNER[6] = vec2[6](
  vec2(0.0, 0.0), vec2(1.0, 0.0), vec2(1.0, 1.0),
  vec2(0.0, 0.0), vec2(1.0, 1.0), vec2(0.0, 1.0)
);

void main() {
  vec3 v = a_at.xyz - u_eye.xyz;
  vec3 c = vec3(dot(v, u_right.xyz), dot(v, u_up.xyz), dot(v, u_fwd.xyz));
  if (c.z < 0.05) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    return;
  }
  vec2 pin = (c.xy / c.z * u_view.xy * 0.5 + 0.5) * u_view.zw;
  float fh = min(u_view.w, u_view.z / FRAME_ASPECT);
  float fw = fh * FRAME_ASPECT;
  float cap = max(LABEL_SIZE.x * fh, LABEL_SIZE.y * u_frame.z);
  float per = LABEL_CAP / cap;
  int row = int(a_at.w + 0.5);
  vec2 ink = INK[row];
  float width = (ink.y - ink.x) / per;
  float gap = 0.4 * cap;
  bool left = a_word.z > 0.5;
  float x0 = left ? pin.x - gap - width : pin.x + gap;
  // Inside the frame, half a capital clear of its sides.
  float lo = 0.5 * (u_view.z - fw) + 0.5 * cap;
  float hi = 0.5 * (u_view.z + fw) - 0.5 * cap - width;
  x0 = clamp(x0, lo, max(lo, hi));
  float base = pin.y + 0.5 * cap;
  vec2 under = left ? vec2(x0 - 0.2 * cap, pin.x) : vec2(pin.x, x0 + width + 0.2 * cap);
  float qx0 = min(min(x0, under.x), pin.x) - 3.0;
  float qx1 = max(max(x0 + width + 0.8 * cap, under.y), pin.x) + 3.0;
  float qy0 = pin.y - 3.0;
  float qy1 = base + 1.3 * cap + 3.0;
  vec2 p = mix(vec2(qx0, qy0), vec2(qx1, qy1), CORNER[gl_VertexID % 6]);
  v_px = p;
  v_word = vec4(a_word.x, a_word.y, float(row), per);
  v_box = vec4(x0, base, width, cap);
  v_line = under;
  v_pin = vec2(pin.y, left ? 1.0 : 0.0);
  gl_Position = vec4(p / u_view.zw * 2.0 - 1.0, 0.0, 1.0);
}
