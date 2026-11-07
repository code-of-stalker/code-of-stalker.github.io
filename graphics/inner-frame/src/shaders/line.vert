// One stroke of the drawing (pen.rs): a straight 3D segment drawn as a
// screen-space quad round its projection, wide enough for its soft edge.
// A segment of zero length is a dot. The end behind the camera is clipped
// at the near plane. The `#define`s come from lib.rs (browser.rs).
precision highp float;
layout(location = 0) in vec4 a_a;    // a, distance along the path at a
layout(location = 1) in vec4 a_b;    // b, distance along the path at b
layout(location = 2) in vec4 a_ink;  // width (px of a 720-high frame), light, dash, duty
layout(location = 3) in vec4 a_tone; // cold, pale, warm, hidden
layout(location = 4) in vec4 a_more; // halo, -, -, -
uniform vec4 u_eye;
uniform vec4 u_right;
uniform vec4 u_up;
uniform vec4 u_fwd;
uniform vec4 u_view;
uniform vec4 u_frame;
flat out vec4 v_a;    // a on screen (px), its distance, 1/depth
flat out vec4 v_b;
flat out vec4 v_ink;  // width (px), light, dash, duty
flat out vec4 v_tone;
flat out vec4 v_more; // halo, dot, -, -
flat out vec3 v_wa;   // the clipped ends in the world, for hidden lines
flat out vec3 v_wb;
out vec2 v_px;

const float NEAR = 0.05;
const int END[6] = int[6](0, 1, 1, 0, 1, 0);
const float SIDE[6] = float[6](-1.0, -1.0, 1.0, -1.0, 1.0, 1.0);

vec3 cam(vec3 p) {
  vec3 v = p - u_eye.xyz;
  return vec3(dot(v, u_right.xyz), dot(v, u_up.xyz), dot(v, u_fwd.xyz));
}

vec2 screen(vec3 c) {
  return (c.xy / c.z * u_view.xy * 0.5 + 0.5) * u_view.zw;
}

void main() {
  vec3 wa = a_a.xyz;
  vec3 wb = a_b.xyz;
  float sa = a_a.w;
  float sb = a_b.w;
  vec3 ca = cam(wa);
  vec3 cb = cam(wb);
  if (ca.z < NEAR && cb.z < NEAR) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    return;
  }
  if (ca.z < NEAR) {
    float k = (NEAR - ca.z) / (cb.z - ca.z);
    wa = mix(wa, wb, k);
    sa = mix(sa, sb, k);
    ca = mix(ca, cb, k);
  } else if (cb.z < NEAR) {
    float k = (NEAR - cb.z) / (ca.z - cb.z);
    wb = mix(wb, wa, k);
    sb = mix(sb, sa, k);
    cb = mix(cb, ca, k);
  }
  vec2 pa = screen(ca);
  vec2 pb = screen(cb);
  float w = a_ink.x * u_frame.x;
  float dotted = distance(a_a.xyz, a_b.xyz) < 1e-6 ? 1.0 : 0.0;
  float halo = 2.5 * max(w, 1.0) + 1.5;
  float radius = dotted > 0.5
    ? 3.0 * 0.45 * w + 1.5
    : max(0.5 * max(w, 1.0) + 1.5, a_more.x > 0.0 ? 3.0 * halo : 0.0);
  vec2 d = pb - pa;
  float len = length(d);
  vec2 dir = len > 1e-3 ? d / len : vec2(1.0, 0.0);
  vec2 n = vec2(-dir.y, dir.x);
  int corner = gl_VertexID % 6;
  vec2 end = END[corner] == 0 ? pa - dir * radius : pb + dir * radius;
  vec2 p = end + n * SIDE[corner] * radius;
  v_px = p;
  v_a = vec4(pa, sa, 1.0 / ca.z);
  v_b = vec4(pb, sb, 1.0 / cb.z);
  v_ink = vec4(w, a_ink.yzw);
  v_tone = a_tone;
  v_more = vec4(a_more.x, dotted, halo, 0.0);
  v_wa = wa;
  v_wb = wb;
  gl_Position = vec4(p / u_view.zw * 2.0 - 1.0, 0.0, 1.0);
}
