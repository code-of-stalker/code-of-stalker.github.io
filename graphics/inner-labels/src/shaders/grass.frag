// A blade's light, added onto what is under it: brightest along its middle,
// so a blade a pixel wide stays smooth.
in vec3 v_light;
in float v_across;
out vec4 o;

void main() {
  float a = 1.5 * (1.0 - v_across * v_across);
  o = vec4(v_light * a * softEdge(gl_FragCoord.xy), 1.0);
}
