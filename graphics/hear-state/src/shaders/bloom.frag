#version 300 es
precision highp float;
// One separable gaussian tap set; the first pass also downsamples.
uniform sampler2D u_source;
uniform vec2 u_step;     // texel offset per tap
uniform float u_threshold;
in vec2 v_uv;
out vec4 o;
void main() {
  const float w[5] = float[](0.227027, 0.1945946, 0.1216216, 0.054054, 0.016216);
  vec2 sum = texture(u_source, v_uv).rg * w[0];
  for (int i = 1; i < 5; i++) {
    sum += texture(u_source, v_uv + u_step * float(i)).rg * w[i];
    sum += texture(u_source, v_uv - u_step * float(i)).rg * w[i];
  }
  sum = max(sum - u_threshold, 0.0);
  o = vec4(sum, 0.0, 1.0);
}
