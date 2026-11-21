// The land as a mesh: one triangle strip a row of it (gl_InstanceID), its
// columns crowding round him, its rows crowding toward the camera. Each
// vertex is lifted by the land's height (common.glsl `relief`) and the
// swell.
out vec3 v_p;
out float v_relief;
out float v_warm;

void main() {
  time = u_eye.w;
  int column = gl_VertexID >> 1;
  int row = gl_InstanceID + (gl_VertexID & 1);
  float u = float(column) / float(COLUMNS) * 2.0 - 1.0;
  float s = float(row) / float(STRIPS);
  vec2 p = vec2(LAND_X * (0.25 * u + 0.75 * u * u * u), LAND_Z.x + (LAND_Z.y - LAND_Z.x) * pow(s, LAND_POW));
  vec2 r = relief(p);
  float swell = swellAt(p);
  v_p = vec3(p.x, r.x + swell, p.y);
  v_relief = r.x + 0.5 * swell;
  v_warm = max(r.y, 0.3 * swell / max(SWELL_HEIGHT, 1e-3));
  gl_Position = clipOf(v_p);
}
