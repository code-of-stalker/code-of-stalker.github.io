// The figure: points of light on its skin. Each point belongs to one of
// the body's rounded cones (lib.rs cone_points) at a place fixed by its
// number; it is set on that cone, then onto the blended surface of all of
// them, so the points ride the limbs as the figure moves. Its light
// gathers at the outline, dims on the far side, and answers the scanner
// running up and down it, the breath's beat and the lock's wave.
uniform vec4 u_b[CONES * 3];
out vec3 v_color;

const float BLEND[CONES] = float[CONES](BLENDS);
const int CONE_END[CONES] = int[CONES](CONE_ENDS);

// iq's rounded cone: spheres of r1 at a and r2 at b and the cone tangent
// to both.
float roundCone(vec3 p, vec3 a, vec3 b, float r1, float r2) {
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
// Cone c, flattened along its squash axis about its middle.
float cone(int c, vec3 p) {
  vec4 a = u_b[3 * c];
  vec4 b = u_b[3 * c + 1];
  vec4 s = u_b[3 * c + 2];
  vec3 m = 0.5 * (a.xyz + b.xyz);
  vec3 q = p + s.xyz * dot(p - m, s.xyz) * (1.0 / s.w - 1.0);
  return roundCone(q, a.xyz, b.xyz, a.w, b.w) * s.w;
}
float smin(float a, float b, float k) {
  float h = max(k - abs(a - b), 0.0) / k;
  return min(a, b) - h * h * k * 0.25;
}
float body(vec3 p) {
  float d = cone(0, p);
  for (int c = 1; c < CONES; c++) {
    d = smin(d, cone(c, p), BLEND[c]);
  }
  return d;
}

void main() {
  int i = gl_VertexID;
  int c = 0;
  for (int j = 0; j < CONES - 1; j++) {
    if (i >= CONE_END[j]) c = j + 1;
  }
  uint seed = uint(i) * 9u + 17u;
  vec4 a = u_b[3 * c];
  vec4 b = u_b[3 * c + 1];
  vec4 s = u_b[3 * c + 2];
  vec3 ax = b.xyz - a.xyz;
  float len = length(ax);
  vec3 dir = len > 1e-5 ? ax / len : vec3(0.0, 1.0, 0.0);
  vec3 e1 = normalize(cross(dir, abs(dir.y) < 0.9 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0)));
  vec3 e2 = cross(dir, e1);
  // Its place on the cone: along the side, or on either end's cap.
  float side = PI * (a.w + b.w) * len;
  float capA = TAU * a.w * a.w;
  float capB = TAU * b.w * b.w;
  float pick = rand(seed) * (side + capA + capB);
  float u = rand(seed + 1u);
  float th = TAU * rand(seed + 2u);
  vec3 ring = cos(th) * e1 + sin(th) * e2;
  vec3 p;
  if (pick < side) {
    p = mix(a.xyz, b.xyz, u) + mix(a.w, b.w, u) * ring;
  } else {
    bool atA = pick < side + capA;
    vec3 d = (atA ? -dir : dir) * u + sqrt(1.0 - u * u) * ring;
    p = atA ? a.xyz + a.w * d : b.xyz + b.w * d;
  }
  vec3 m = 0.5 * (a.xyz + b.xyz);
  p -= s.xyz * dot(p - m, s.xyz) * (1.0 - s.w);
  // Onto the blended skin; points buried inside another part stay dark.
  const vec2 k = vec2(1.0, -1.0);
  const float h = 0.003;
  float d1 = body(p + k.xyy * h);
  float d2 = body(p + k.yyx * h);
  float d3 = body(p + k.yxy * h);
  float d4 = body(p + k.xxx * h);
  float dist = 0.25 * (d1 + d2 + d3 + d4);
  vec3 n = normalize(k.xyy * d1 + k.yyx * d2 + k.yxy * d3 + k.xxx * d4);
  p -= n * dist;
  vec3 v = toView(p);
  float light = LOCK2.y * BODY_LIGHT;
  if (dist < -0.02 || v.z < 0.3 || light <= 0.0) {
    gl_Position = vec4(0.0, 0.0, 2.0, 1.0);
    gl_PointSize = 0.0;
    return;
  }
  vec3 toEye = normalize(EYE.xyz - p);
  float facing = dot(n, toEye);
  float rim = 1.0 - abs(facing);
  light *= mix(0.4, 1.0, rim * rim) * (facing > 0.0 ? 1.0 : 0.5);
  float w = loopPhase();
  light *= mix(0.35, 1.0, rand(seed + 3u)) * (0.6 + 0.4 * sin(w * pace(seed + 4u, 3.0) + TAU * rand(seed + 5u)));
  // Fine bands of the hologram drifting up the body.
  light *= 0.8 + 0.35 * smoothstep(0.55, 1.0, sin(p.y * TAU / 0.045 - 2.0 * w));
  // On each full in-breath a beat runs down from the scanner, at the top
  // of the head, through the body.
  float since = LOCK2.w;
  float out_ = (length(p - RC(1).xyz) - 0.95 * since) / 0.07;
  float lift = 1.6 * RN(1).w * exp(-out_ * out_) * exp(-since / 0.8);
  // The scanner cuts the skin in a bright line where its plane runs; what
  // it has just passed glows on, and the rest of the figure waits dim.
  float rate = -sin(TAU * since / BEAT);
  float level = p.y - RC(1).y;
  float behind = -level * sign(rate);
  float scanning = RN(1).w * smoothstep(0.5, 1.0, RX(1).z);
  float passed = behind > 0.0 ? sqrt(abs(rate)) * exp(-behind / SLICE_GLOW) : 0.0;
  float cut = scanning * exp(-level * level / (SLICE * SLICE));
  lift += SLICE_LIGHT * cut;
  light *= mix(1.0, mix(UNSCANNED, 1.0, passed), scanning);
  // The crown ring lights the skin it comes near.
  vec3 q = p - RC(0).xyz;
  float along = dot(q, RN(0).xyz);
  float r = length(q - RN(0).xyz * along) - RC(0).w;
  lift += 1.4 * RN(0).w * exp(-(along * along + r * r) / (0.12 * 0.12));
  light *= 1.0 + lift + WAVE_GAIN * lockWave(p) + 0.25 * SHELLS.y;
  // Its own size in metres, but never finer than a pixel's worth.
  float s0 = max(max(BODY_DOT / v.z * VIEW.y * 0.5 * VIEW.w, BODY_SIZE * VIEW.w), 0.65);
  // In the scanner's cut the points swell into a line, as wide close up
  // as far off.
  s0 += 1.3 * BODY_SIZE * VIEW.w * cut;
  float blur = lensBlur(v.z);
  float sigma = min(sqrt(s0 * s0 + blur * blur), u_kind.y / 6.0);
  gl_Position = pxToClip(toPx(v));
  gl_PointSize = 6.0 * sigma;
  // In focus each point peaks at its light; a blurred one keeps its energy.
  float spread = s0 / sigma;
  v_color = u_glow * light * spread * spread * depthCue(v.z);
}
