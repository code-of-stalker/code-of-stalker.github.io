// The scanner itself: the plane (or the growing sphere) of light as a
// faint sheet of fine dots in the room's air, cut where the painted room
// stands in front of it.
in vec2 v_uv;
out vec4 o;

void main() {
  vec4 a = u_scanAxis[0];
  vec4 s = u_scan[0];
  float on = strength(s.z, s.w);
  if (on <= 0.0) discard;
  vec3 e = u_cam.xyz;
  vec3 d = viewRay(v_uv * 2.0 - 1.0);
  float r = front(0);
  float t;
  vec3 n;
  if (a.w > 0.5) {
    // From inside the sphere: the far root.
    vec3 oc = e - a.xyz;
    float b = dot(oc, d);
    float dd = dot(d, d);
    float disc = b * b - dd * (dot(oc, oc) - r * r);
    if (disc < 0.0) discard;
    t = (-b + sqrt(disc)) / dd;
  } else {
    float facing = dot(d, a.xyz);
    if (abs(facing) < 1e-4) discard;
    t = (r - dot(e, a.xyz)) / facing;
  }
  if (t <= 0.0) discard;
  vec3 h = e + d * t;
  if (h.z >= behind(h) - 0.01) discard;
  vec3 room = min(h - ROOM_MIN, ROOM_MAX - h);
  float edge = smoothstep(0.0, 0.25, min(min(room.x, room.y), room.z));
  if (edge <= 0.0) discard;
  // Fine dots on the sheet, faded to their average where they get too
  // small to draw.
  n = a.w > 0.5 ? normalize(h - a.xyz) : a.xyz;
  vec3 u = normalize(cross(n, abs(n.y) < 0.9 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0)));
  vec2 g = vec2(dot(h, u), dot(h, cross(n, u))) / 0.06;
  vec2 f = fract(g) - 0.5;
  float w = max(fwidth(g.x), fwidth(g.y));
  float dots = 1.0 - smoothstep(0.12 - w, 0.12 + w, length(f));
  dots = mix(dots, 0.045, smoothstep(0.15, 0.4, w));
  o = vec4(u_glow * on * edge * (0.005 + 0.05 * dots), 1.0);
}
