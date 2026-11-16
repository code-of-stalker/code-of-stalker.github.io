// Him: a man in a space suit, front +z, feet on y = 0 of his own frame.
// He wears his round helmet all the way down; his face behind the visor
// (`headS`) is only seen through the glass. The world turns into his frame
// by `loc` (body.rs `Pose::to_local`).

float sdEll(vec3 p, vec3 r) {
  float k0 = length(p / r);
  float k1 = length(p / (r * r));
  return k0 * (k0 - 1.0) / k1;
}
float sdBox(vec3 p, vec3 b) {
  vec3 q = abs(p) - b;
  return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
}
float sdCap(vec3 p, vec3 a, vec3 b, float r) {
  vec3 pa = p - a;
  vec3 ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h) - r;
}
// A cone between two spheres of radii r1 at a and r2 at b.
float sdRC(vec3 p, vec3 a, vec3 b, float r1, float r2) {
  vec3 ba = b - a;
  float l2 = dot(ba, ba);
  float rr = r1 - r2;
  float a2 = l2 - rr * rr;
  float il2 = 1.0 / l2;
  vec3 pa = p - a;
  float y = dot(pa, ba);
  float z = y - l2;
  vec3 xv = pa * l2 - ba * y;
  float x2 = dot(xv, xv);
  float y2 = y * y * l2;
  float z2 = z * z * l2;
  float k = sign(rr) * rr * rr * x2;
  if (sign(z) * a2 * z2 > k) return sqrt(x2 + z2) * il2 - r2;
  if (sign(y) * a2 * y2 < k) return sqrt(x2 + y2) * il2 - r1;
  return (sqrt(x2 * a2 * il2) + y * rr) * il2 - r1;
}
float smin(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}

float torsoS(vec3 p) {
  float d = sdEll(p - vec3(0.0, 1.02, -0.035), vec3(0.165, 0.12, 0.128));
  d = smin(d, sdEll(p - vec3(0.0, 1.21, -0.045), vec3(0.142, 0.15, 0.094)), 0.07);
  d = smin(d, sdEll(p - vec3(0.0, 1.395, -0.04), vec3(0.172, 0.165, 0.118)), 0.07);
  return smin(d, sdCap(p, vec3(-0.165, 1.51, -0.055), vec3(0.165, 1.51, -0.055), 0.056), 0.07);
}
float headS(vec3 p) {
  float d = sdEll(p - vec3(0.0, 1.73, -0.02), vec3(0.091, 0.117, 0.104));
  d = smin(d, sdEll(p - vec3(0.0, 1.712, 0.083), vec3(0.016, 0.03, 0.026)), 0.012);
  d = smin(d, sdEll(p - vec3(0.0, 1.648, 0.04), vec3(0.052, 0.036, 0.05)), 0.03);
  vec3 a = vec3(abs(p.x), p.yz);
  d = max(d, -sdEll(a - vec3(0.036, 1.748, 0.094), vec3(0.022, 0.013, 0.016)));
  return max(d, -sdEll(p - vec3(0.0, 1.666, 0.09), vec3(0.021, 0.009, 0.018)));
}
// One leg and one arm of the suit, mirrored by |x|.
float legsSp(vec3 a) {
  float l = sdRC(a, vec3(0.1, 0.98, -0.02), vec3(0.12, 0.55, 0.08), 0.085, 0.06);
  l = smin(l, sdRC(a, vec3(0.12, 0.55, 0.08), vec3(0.125, 0.15, -0.02), 0.058, 0.045), 0.04);
  return smin(l, sdRC(a, vec3(0.125, 0.11, -0.04), vec3(0.135, 0.07, 0.12), 0.055, 0.045), 0.03);
}
float armsSp(vec3 a) {
  float r = sdRC(a, vec3(0.2, 1.48, -0.05), vec3(0.3, 1.23, 0.06), 0.05, 0.042);
  r = smin(r, sdRC(a, vec3(0.3, 1.23, 0.06), vec3(0.31, 1.01, 0.17), 0.042, 0.034), 0.03);
  return smin(r, sdEll(a - vec3(0.312, 0.96, 0.2), vec3(0.04, 0.062, 0.05)), 0.02);
}
const vec3 HELM = vec3(0.0, 1.735, 0.012);
float figure(vec3 q) {
  vec3 a = vec3(abs(q.x), q.y, q.z);
  float d = smin(torsoS(q), legsSp(a), 0.06);
  d = smin(d, armsSp(a), 0.04) - 0.045;
  d = smin(d, sdRC(q, vec3(0.0, 1.4, -0.04), vec3(0.0, 1.0, -0.03), 0.205, 0.18), 0.05);
  d = min(d, length(q - HELM) - 0.2);
  // The life-support pack on his back.
  return min(d, sdBox(q - vec3(0.0, 1.33, -0.255), vec3(0.18, 0.25, 0.075)) - 0.03);
}
// A point of the scene in his own frame: turned back by his yaw, then
// tipped back about his waist.
vec3 loc(vec3 p) {
  p = vec3(yawC * p.x - yawS * p.z, p.y - WAIST, yawS * p.x + yawC * p.z);
  return vec3(p.x, pitchC * p.y - pitchS * p.z + WAIST, pitchS * p.y + pitchC * p.z);
}
float body(vec3 p) {
  return figure(loc(p));
}
// The four corners of a tetrahedron, in a loop the compiler keeps (one
// copy of `body` instead of four).
vec3 corner(int i) {
  return 0.5773 * (2.0 * vec3(float(((i + 3) >> 1) & 1), float((i >> 1) & 1), float(i & 1)) - 1.0);
}
vec3 nrmB(vec3 p) {
  vec3 n = vec3(0.0);
  for (int i = zero(); i < 4; i++) {
    vec3 e = corner(i);
    n += e * body(p + 0.001 * e);
  }
  return normalize(n);
}
float aoB(vec3 p, vec3 n) {
  float occ = 0.0;
  float sca = 1.0;
  for (int i = zero(); i < 6; i++) {
    float h = 0.02 + 0.07 * float(i);
    float d = body(p + n * h);
    occ += (h - d) * sca;
    sca *= 0.75;
  }
  return clamp(1.0 - 2.4 * occ, 0.0, 1.0);
}
vec2 box(vec3 ro, vec3 rd, vec3 lo, vec3 hi) {
  vec3 inv = 1.0 / rd;
  vec3 t0 = (lo - ro) * inv;
  vec3 t1 = (hi - ro) * inv;
  vec3 tn = min(t0, t1);
  vec3 tf = max(t0, t1);
  return vec2(max(max(max(tn.x, tn.y), tn.z), 0.0), min(min(tf.x, tf.y), tf.z));
}
// How far along the ray he is, or -1.
float marchBody(vec3 ro, vec3 rd) {
  vec2 bb = box(ro, rd, vec3(-0.9, -0.2, -0.9), vec3(0.9, 2.2, 0.9));
  if (bb.x >= bb.y) return -1.0;
  float t = bb.x;
  for (int i = zero(); i < 220; i++) {
    float d = body(ro + rd * t);
    if (d < 0.0004) return t;
    t += d * 0.9;
    if (t > bb.y) break;
  }
  return -1.0;
}
// The visor: where on the helmet (its normal `hn`, his frame) the glass is.
bool onVisor(vec3 hn) {
  return hn.z > 0.32 && hn.y > -0.42 && hn.y < 0.62;
}
// The visor at `ph` (normal `n`): the world `refl` in the glass, his face
// behind it warmed by his voice, the rim in the shell's colour.
vec3 visor(vec3 ph, vec3 rd, vec3 n, vec3 hn, vec3 refl, vec3 shell) {
  float F = 0.25 + 0.75 * pow(1.0 - max(dot(n, -rd), 0.0), 3.0);
  vec3 face = BG * 0.15;
  float t = 0.004;
  for (int i = zero(); i < 60; i++) {
    vec3 pl = loc(ph + rd * t);
    float d = headS(pl);
    if (d < 0.0006) {
      vec3 fn = vec3(0.0);
      for (int k = zero(); k < 4; k++) {
        vec3 e = corner(k);
        fn += e * headS(pl + 0.0014 * e);
      }
      fn = normalize(fn);
      vec3 Lp = HELM + vec3(0.0, -0.03, 0.27) - pl;
      float wl = max(dot(fn, normalize(Lp)), 0.0);
      face = WARM * (0.012 + 0.6 * u_scene.w * pow(wl, 1.6)) + COLD * 0.015 * max(fn.y, 0.0);
      break;
    }
    t += d * 0.9;
    if (t > 0.42) break;
  }
  vec3 v = face * (1.0 - F) + refl * F * 0.9 + WARM * 0.03 * u_scene.w;
  float frame = smoothstep(0.36, 0.33, hn.z) + smoothstep(-0.38, -0.42, hn.y) + smoothstep(0.58, 0.62, hn.y);
  return mix(v, shell * 0.8, min(frame, 1.0));
}
