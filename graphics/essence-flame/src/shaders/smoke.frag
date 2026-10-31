#version 300 es
precision highp float;
// A curl of smoke, lit faintly from the flame under it: soft across, added
// onto the scene.
uniform vec3 u_key;
in float v_across;
in float v_light;
out vec4 o;
void main() {
  float a = v_light * exp(-2.6 * v_across * v_across);
  o = vec4(u_key * 0.8 * a, 0.0);
}
