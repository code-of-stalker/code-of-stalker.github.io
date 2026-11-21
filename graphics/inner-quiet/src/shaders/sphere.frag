// The sphere: hardly there, a faint rim where it turns away; in «оба кольца»
// its levels, a line every 15 degrees of latitude. Added to the light.
uniform vec4 u_sphere;
in vec3 v_n;
in float v_lat;
out vec4 o;

void main() {
  time = u_eye.w;
  float K8 = px800();
  vec3 p = vec3(0.0, u_sphere.x, 0.0) + u_sphere.y * v_n;
  vec3 v = normalize(u_eye.xyz - p);
  float rim = pow(1.0 - abs(dot(normalize(v_n), v)), 3.0);
  float c = v_lat / (PI / 12.0);
  float fc = max(fwidth(c), 1e-5);
  float d = abs(fract(c + 0.5) - 0.5) / fc;
  float level = clamp(0.5 * K8 + 0.5 - d, 0.0, 1.0) * smoothstep(0.5, 0.1, fc);
  vec3 col = COLD * u_sphere.z * (0.09 * rim + 0.22 * u_land.w * level);
  o = vec4(col, 1.0);
}
