// The curves as ribbons a few px wide, one a strip (gl_InstanceID): a level
// ring round him (kind 0: centre, radius) or a bowed segment (kind 1: from,
// to, its middle raised). Each is drawn over part of its length.
uniform vec4 u_curve[CURVES * 4]; // per curve: a, b, style (width px800, light, warmth, dashes a metre), span (from, to, runner or pulse, run)
out float v_across;   // px off the middle
out float v_s;        // where along it (0..1)
out float v_metres;   // how far along it (m)
out float v_back;     // 1 on a ring's far half
flat out vec4 v_style;
flat out vec4 v_span;
flat out float v_half;

vec3 curveAt(vec4 a, vec4 b, float s) {
  if (b.w < 0.5) {
    float angle = TAU * s;
    return a.xyz + a.w * vec3(cos(angle), 0.0, sin(angle));
  }
  vec3 p = mix(a.xyz, b.xyz, s);
  p.y += a.w * 4.0 * s * (1.0 - s);
  return p;
}
vec2 pxOf(vec4 c) {
  return c.xy / c.w * 0.5 * u_view.zw;
}

void main() {
  time = u_eye.w;
  int id = gl_InstanceID;
  vec4 a = u_curve[4 * id];
  vec4 b = u_curve[4 * id + 1];
  vec4 style = u_curve[4 * id + 2];
  vec4 span = u_curve[4 * id + 3];
  v_style = style;
  v_span = span;
  float K8 = px800();
  // Core and glow.
  float halfPx = (3.2 * style.x + 2.0) * K8;
  v_half = halfPx;
  int i = gl_VertexID >> 1;
  float side = (gl_VertexID & 1) == 0 ? -1.0 : 1.0;
  float s = mix(span.x, span.y, float(i) / float(CURVE_SEGMENTS));
  float ds = max(span.y - span.x, 1e-4) / float(CURVE_SEGMENTS);
  vec3 p = curveAt(a, b, s);
  vec4 c = clipOf(p);
  vec4 c0 = clipOf(curveAt(a, b, s - 0.5 * ds));
  vec4 c1 = clipOf(curveAt(a, b, s + 0.5 * ds));
  if (style.y <= 0.0 || span.y - span.x < 1e-4 || min(c.w, min(c0.w, c1.w)) < 0.15) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    return;
  }
  vec2 t = pxOf(c1) - pxOf(c0);
  t = length(t) > 1e-4 ? normalize(t) : vec2(1.0, 0.0);
  vec2 n = vec2(-t.y, t.x);
  vec2 q = pxOf(c) + n * side * halfPx;
  v_across = side * halfPx;
  v_s = s;
  float length_ = b.w < 0.5 ? TAU * a.w : length(b.xyz - a.xyz);
  v_metres = s * length_;
  v_back = b.w < 0.5 && dot(p - a.xyz, u_fwd.xyz) > 0.0 ? 1.0 : 0.0;
  gl_Position = vec4(q / (0.5 * u_view.zw) * c.w, c.z, c.w);
}
