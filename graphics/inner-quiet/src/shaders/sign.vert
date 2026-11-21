// The signs on the spikes: a card a sign (gl_InstanceID) facing the camera,
// its middle a little over the spike's tip, wide enough for the warm
// brackets at their widest.
uniform vec4 u_sign[SIGNS * 3]; // per sign: (tip, size), (kind, light, warmth, motion), (brackets' light, their size, 0, 0)
out vec2 v_q;                   // where on the sign, in its sizes, 0 at its middle
flat out vec4 v_kind;
flat out vec4 v_brackets;

void main() {
  time = u_eye.w;
  int id = gl_InstanceID;
  vec4 at = u_sign[3 * id];
  vec4 kind = u_sign[3 * id + 1];
  vec4 brackets = u_sign[3 * id + 2];
  v_kind = kind;
  v_brackets = brackets;
  if (kind.y <= 0.0 && brackets.x <= 0.0) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    return;
  }
  const float EXTENT = 2.0;
  vec2 corner = vec2(float(gl_VertexID & 1), float(gl_VertexID >> 1)) * 2.0 - 1.0;
  v_q = corner * EXTENT;
  vec3 middle = at.xyz + vec3(0.0, 0.95 * at.w, 0.0);
  vec3 p = middle + (u_right.xyz * corner.x + u_up.xyz * corner.y) * EXTENT * at.w;
  gl_Position = clipOf(p);
}
