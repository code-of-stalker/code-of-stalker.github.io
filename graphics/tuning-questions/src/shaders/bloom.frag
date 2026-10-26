#version 300 es
precision highp float;
// One separable gaussian tap set; the first pass also downsamples.
uniform sampler2D u_source;
uniform vec2 u_step;
uniform float u_threshold;
in vec2 v_local;
out vec4 o;
uniform float u_body; // 1: the source is the scene (its body light glows too)
vec2 sum;
vec2 tap(vec2 uv) {
  vec4 s = texture(u_source, uv);
  return s.rg + vec2(0.0, u_body * max(s.b * 2.0 - 1.0, 0.0));
}
void main() {
  const float w[5] = float[](0.227027, 0.1945946, 0.1216216, 0.054054, 0.016216);
  sum = tap(v_local) * w[0];
  for (int i = 1; i < 5; i++) {
    sum += tap(v_local + u_step * float(i)) * w[i];
    sum += tap(v_local - u_step * float(i)) * w[i];
  }
  o = vec4(max(sum - u_threshold, 0.0), 0.0, 1.0);
}
