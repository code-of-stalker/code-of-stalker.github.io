// Him: Art's figure on a card that stands upright at the origin and turns
// about its own axis to face the camera; the swell lifts it.
out vec2 v_uv;

void main() {
  time = u_eye.w;
  vec2 corner = vec2(float(gl_VertexID & 1), float(gl_VertexID >> 1));
  vec3 side = normalize(vec3(u_right.x, 0.0, u_right.z));
  float x = (corner.x - 0.5) * CARD.x + CARD.w;
  float y = u_scene.x - CARD.z + corner.y * CARD.y;
  v_uv = corner;
  gl_Position = clipOf(side * x + vec3(0.0, y, 0.0));
}
