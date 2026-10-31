// The lines: the orbit ring (kind 0), its ticks (1), the meridians (2), the
// parallels (3), the runner's gaze (4), the waves (5). Each instance is one
// straight piece
// of a curve, drawn as a band a few blurred widths across (line.frag).
out vec3 v_color;
out float v_across;
out float v_sigma;

// Meridian c at s: the ring tilted up about a line across it, standing
// through the poles, then fanned around the vertical.
vec3 onMeridian(int c, float s) {
  float lon = MERIDIAN_FROM + float(c) * (PI / float(MERIDIANS)) * u_sphere.y;
  vec3 across = vec3(sin(lon), 0.0, cos(lon));
  float tilt = u_sphere.x * PI * 0.5;
  vec3 lift = cos(tilt) * vec3(cos(lon), 0.0, -sin(lon)) + sin(tilt) * vec3(0.0, 1.0, 0.0);
  return cos(s) * across + sin(s) * lift;
}
// Parallel c at s: a copy of the ring slid toward its latitude.
vec3 onParallel(int c, float s) {
  float lat = LATITUDES[c] * u_sphere.z;
  return vec3(cos(lat) * sin(s), sin(lat), cos(lat) * cos(s));
}

void main() {
  int kind = int(u_kind.x);
  int i = gl_InstanceID;
  float breath = u_up.w;
  vec3 a, b;
  float light;
  if (kind == 0) {
    float s0 = TAU * float(i) / float(RING_SEGMENTS);
    float s1 = TAU * float(i + 1) / float(RING_SEGMENTS);
    float r = u_build.x * breath;
    a = onRing(s0, r);
    b = onRing(s1, r);
    light = u_build.y * (RING_LIGHT + RUNNER_GLOW * trail(0.5 * (s0 + s1)));
  } else if (kind == 1) {
    float s = TAU * float(i) / float(TICKS);
    float reach = (i % 6 == 0 ? TICK_LONG : TICK_SHORT) * u_build.z;
    a = onRing(s, breath * 1.012);
    b = onRing(s, breath * (1.012 + reach));
    light = u_build.y * smoothstep(0.0, 0.3, u_build.z) * (TICK_LIGHT + RUNNER_GLOW * trail(s));
  } else if (kind == 2 || kind == 3) {
    int c = i / CIRCLE_SEGMENTS;
    int j = i - c * CIRCLE_SEGMENTS;
    float s0 = TAU * float(j) / float(CIRCLE_SEGMENTS);
    float s1 = TAU * float(j + 1) / float(CIRCLE_SEGMENTS);
    if (kind == 2) {
      a = breath * onMeridian(c, s0);
      b = breath * onMeridian(c, s1);
      // The first rises off the ring; the others leave it as the fan opens.
      float emerge = c == 0 ? smoothstep(0.0, 0.25, u_sphere.x) : smoothstep(0.0, 0.3, u_sphere.y);
      light = u_sphere.w * MERIDIAN_LIGHT * emerge;
    } else {
      a = breath * onParallel(c, s0);
      b = breath * onParallel(c, s1);
      light = u_sphere.w * PARALLEL_LIGHT * smoothstep(0.0, 0.3, u_sphere.z);
    }
  } else if (kind == 5) {
    // A wave: a circle on the sphere around side c, opening from its pole.
    int c = i / CIRCLE_SEGMENTS;
    int j = i - c * CIRCLE_SEGMENTS;
    float s0 = TAU * float(j) / float(CIRCLE_SEGMENTS);
    float s1 = TAU * float(j + 1) / float(CIRCLE_SEGMENTS);
    vec2 w = wave(c);
    vec3 d = DIRS[c];
    vec3 e1 = normalize(cross(d, abs(d.y) < 0.9 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0)));
    vec3 e2 = cross(d, e1);
    a = breath * (cos(w.x) * d + sin(w.x) * (cos(s0) * e1 + sin(s0) * e2));
    b = breath * (cos(w.x) * d + sin(w.x) * (cos(s1) * e1 + sin(s1) * e2));
    light = u_sphere.w * WAVE_LIGHT * w.y;
  } else {
    // The gaze: from just outside the ring out along the runner's radius.
    float u0 = float(i) / float(GAZE_SEGMENTS);
    float u1 = float(i + 1) / float(GAZE_SEGMENTS);
    a = onRing(u_runner.x, breath * mix(1.1, GAZE, u0));
    b = onRing(u_runner.x, breath * mix(1.1, GAZE, u1));
    light = u_runner.y * u_build.y * GAZE_LIGHT * (1.0 - u0) * (1.0 - u0);
  }
  vec3 dir = normalize(a + b + vec3(0.0, 1e-5, 0.0));
  // Where the meridians crowd at the poles, each gives less.
  if (kind == 2) light *= mix(1.0, 0.35, pow(abs(dir.y), 8.0));
  if (kind != 5) light *= 1.0 + CAP_GAIN * caps(dir);

  vec3 va = toView(a);
  vec3 vb = toView(b);
  if (min(va.z, vb.z) < 0.1 || light <= 0.0) {
    gl_Position = vec4(0.0, 0.0, 2.0, 1.0);
    return;
  }
  vec2 pa = toPx(va);
  vec2 pb = toPx(vb);
  vec2 along = pb - pa;
  float len = length(along);
  vec2 t = len > 1e-4 ? along / len : vec2(1.0, 0.0);
  vec2 n = vec2(-t.y, t.x);
  // Two triangles: corners 0 1 2 / 0 2 3 of the band from a to b.
  int v = gl_VertexID;
  float end = (v == 1 || v == 2 || v == 4) ? 1.0 : 0.0;
  float side = (v == 2 || v == 4 || v == 5) ? 1.0 : -1.0;
  float z = mix(va.z, vb.z, end);
  float base = LINE_WIDTH * u_view.w * (kind == 5 ? WAVE_WIDTH : 1.0);
  float blur = lensBlur(z);
  float sigma = sqrt(base * base + blur * blur);
  float half_width = 3.0 * HALO_SPREAD * sigma;
  gl_Position = pxToClip(mix(pa, pb, end) + n * side * half_width);
  v_across = side * half_width;
  v_sigma = sigma;
  // The far side of the sphere dimmer than the near; a blurred line keeps
  // its light, spread wider.
  v_color = u_glow * light * nearSide(z) * base / sigma;
}
