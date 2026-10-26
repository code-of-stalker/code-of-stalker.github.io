#version 300 es
precision highp float;
// Light inside the body: the soft profile of soft.frag, seen only through
// the body (the figure's blue channel: the cover without the chair), so the
// inner light never spills into the room or onto the chair.
uniform sampler2D u_figure;
uniform vec4 u_rect; // the figure on screen: x, y, width, height (px)
in vec2 v_uv;
in vec4 v_color;
in float v_hard;
in vec2 v_pos;
out vec4 o;
void main() {
  float d = length(v_uv);
  if (d >= 1.0) discard;
  vec2 uv = (v_pos - u_rect.xy) / u_rect.zw;
  float cover = texture(u_figure, uv).b;
  if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) cover = 0.0;
  float k = 1.0 - smoothstep(v_hard * 0.92, 1.0, d);
  o = v_color * k * k * cover;
}
