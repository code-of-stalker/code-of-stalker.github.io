// The sphere round him: a band of latitude a strip (gl_InstanceID).
uniform vec4 u_sphere; // its centre's height, radius, light
out vec3 v_n;
out float v_lat;

void main() {
  time = u_eye.w;
  int lon = gl_VertexID >> 1;
  int lat = gl_InstanceID + (gl_VertexID & 1);
  float phi = PI * (float(lat) / float(SPHERE_LAT) - 0.5);
  float theta = TAU * float(lon) / float(SPHERE_LON);
  v_n = vec3(cos(phi) * cos(theta), sin(phi), cos(phi) * sin(theta));
  v_lat = phi;
  gl_Position = clipOf(vec3(0.0, u_sphere.x, 0.0) + u_sphere.y * v_n);
}
