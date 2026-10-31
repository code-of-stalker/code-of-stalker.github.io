#version 300 es
precision highp float;
// A thread is all but invisible until a glint runs along it; a ring of
// sound is the strike's light; a mote of dust shines only in a light.
// Added to the scene; alpha carries this line's own blur circle.
uniform vec3 u_key;
uniform vec3 u_fill;
in vec2 v_line;
in vec2 v_glint;
in vec2 v_paint;
in float v_fade;
in float v_coc;
out vec4 o;
void main() {
  vec3 c;
  float kind = v_paint.y;
  if (kind < 0.5) {
    float profile = exp(-v_line.x * v_line.x * 3.0);
    float g = v_glint.y * exp(-pow((v_line.y - v_glint.x) / 0.035, 2.0));
    c = (u_fill * v_paint.x + mix(u_fill, u_key, 0.55) * 1.3 * g) * profile;
  } else if (kind < 1.5) {
    float profile = exp(-v_line.x * v_line.x * 2.2);
    c = mix(u_key, u_fill, 0.2) * v_paint.x * 1.1 * profile;
  } else {
    float profile = exp(-dot(v_line, v_line) * 3.5);
    c = mix(u_fill, u_key, 0.4) * v_paint.x * profile;
  }
  c *= v_fade;
  if (max(c.r, max(c.g, c.b)) < 0.004) discard;
  o = vec4(c, 0.5 + v_coc / 44.0);
}
