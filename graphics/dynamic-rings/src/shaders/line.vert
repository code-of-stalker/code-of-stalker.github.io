// The lines: the outer ring (kind 0), its ticks (1), the runner's gaze (2),
// the inner sphere (3), the waist ring (4) and its trail (5), the ripples
// of the heel strikes (6), the footprints (7), the outer ring's shadow on
// the floor (8), the lock's wave along the floor (9). Each instance is one
// straight piece of a curve, drawn as a band a few blurred widths across
// (line.frag).
out vec3 v_color;
out float v_across;
out float v_sigma;

const float SPHERE_LATS[5] = float[5](SPHERE_LAT_0, SPHERE_LAT_1, SPHERE_LAT_2, SPHERE_LAT_3, SPHERE_LAT_4);

// The outer ring as far as the runner has drawn it.
float drawn(float s) {
  if (R1.z >= 1.0) return 1.0;
  float ahead = mod(ORBIT_START - s, TAU);
  return clamp((TAU * R1.z - ahead) / 0.08, 0.0, 1.0);
}

void main() {
  int kind = int(u_kind.x);
  int i = gl_InstanceID;
  vec3 a = vec3(0.0);
  vec3 b = vec3(0.0);
  float light = 0.0;
  float width = 1.0;
  if (kind == 0 || kind == 8) {
    float s0 = TAU * float(i) / float(RING_SEGMENTS);
    float s1 = TAU * float(i + 1) / float(RING_SEGMENTS);
    vec3 c = kind == 0 ? R1C.xyz : vec3(R1C.x, 0.003, R1C.z);
    a = c + onRing(s0, R1C.w);
    b = c + onRing(s1, R1C.w);
    float s = 0.5 * (s0 + s1);
    if (kind == 0) {
      light = R1.x * (ORBIT_LIGHT * drawn(s) * (1.0 + FLASH_GAIN * R1.w) + RUNNER_GLOW * trail(s));
    } else {
      light = R1.x * FLOOR_RING_LIGHT * drawn(s) * (1.0 + 0.5 * R1.w) * WORLD.z;
    }
  } else if (kind == 1) {
    float s = TAU * float(i) / float(TICKS);
    float reach = (i % 6 == 0 ? TICK_LONG : TICK_SHORT) * R1.y;
    a = R1C.xyz + onRing(s, R1C.w * 1.012);
    b = R1C.xyz + onRing(s, R1C.w * (1.012 + reach));
    light = R1.x * smoothstep(0.0, 0.3, R1.y) * (TICK_LIGHT * (1.0 + FLASH_GAIN * R1.w) + RUNNER_GLOW * trail(s));
  } else if (kind == 2) {
    float u0 = float(i) / float(GAZE_SEGMENTS);
    float u1 = float(i + 1) / float(GAZE_SEGMENTS);
    a = R1C.xyz + onRing(R1RUN.x, R1C.w * mix(GAZE_FROM, GAZE_TO, u0));
    b = R1C.xyz + onRing(R1RUN.x, R1C.w * mix(GAZE_FROM, GAZE_TO, u1));
    light = R1.x * R1RUN.y * R1RUN.z * GAZE_LIGHT * (1.0 - u0) * (1.0 - u0);
  } else if (kind == 3) {
    // Five latitudes slide off the equator, three meridians rise through
    // the poles; the whole sphere turns slowly.
    int c = i / SPHERE_SEGMENTS;
    int j = i - c * SPHERE_SEGMENTS;
    float s0 = TAU * float(j) / float(SPHERE_SEGMENTS);
    float s1 = TAU * float(j + 1) / float(SPHERE_SEGMENTS);
    float open = R2.y;
    vec3 da, db;
    float emerge;
    if (c < 5) {
      float lat = SPHERE_LATS[c] * open;
      da = vec3(cos(lat) * sin(s0), sin(lat), cos(lat) * cos(s0));
      db = vec3(cos(lat) * sin(s1), sin(lat), cos(lat) * cos(s1));
      emerge = c == 0 ? 1.0 : smoothstep(0.0, 0.3, open);
    } else {
      float lon = R2X.x + float(c - 5) * (PI / float(SPHERE_MERIDIANS));
      vec3 across = vec3(sin(lon), 0.0, cos(lon));
      float tilt = smoothstep(0.25, 1.0, open) * PI * 0.5;
      vec3 lift = cos(tilt) * vec3(cos(lon), 0.0, -sin(lon)) + sin(tilt) * vec3(0.0, 1.0, 0.0);
      da = cos(s0) * across + sin(s0) * lift;
      db = cos(s1) * across + sin(s1) * lift;
      emerge = smoothstep(0.25, 0.5, open);
    }
    a = R2C.xyz + R2C.w * da;
    b = R2C.xyz + R2C.w * db;
    // Its near side brighter than its far side.
    vec3 toward = normalize(EYE.xyz - R2C.xyz);
    float facing = dot(normalize(da + db + vec3(0.0, 1e-5, 0.0)), toward);
    light = R2.x * SPHERE_LIGHT * emerge * mix(0.45, 1.2, 0.5 + 0.5 * facing) * (1.0 + FLASH_GAIN * R2.z);
    width = 0.8;
  } else if (kind == 4 || kind == 5) {
    int k = kind == 4 ? 0 : i / GHOST_SEGMENTS;
    int j = kind == 4 ? i : i - k * GHOST_SEGMENTS;
    int n = kind == 4 ? ACTION_SEGMENTS : GHOST_SEGMENTS;
    float s0 = TAU * float(j) / float(n);
    float s1 = TAU * float(j + 1) / float(n);
    if (kind == 4) {
      a = onTilted(R3C.xyz, R3N.xyz, R3C.w, s0);
      b = onTilted(R3C.xyz, R3N.xyz, R3C.w, s1);
      // A string of beads until the first step joins them into a line.
      float g = abs(fract((0.5 * (s0 + s1) + R3.w) * float(BEADS) / TAU) - 0.5) * 2.0;
      float duty = mix(0.16, 1.25, R3.y);
      float dash = 1.0 - smoothstep(duty - 0.1, duty, g);
      light = R3N.w * ACTION_LIGHT * dash * (1.0 + FLASH_GAIN * R3.x);
    } else {
      vec4 c = u_d[SLOT_GHOST + k];
      vec3 n = u_d[SLOT_GHOST_NORMAL + k].xyz;
      a = onTilted(c.xyz, n, R3C.w, s0);
      b = onTilted(c.xyz, n, R3C.w, s1);
      light = GHOST_LIGHT * c.w * (1.0 + 0.6 * R3.x);
    }
  } else if (kind == 6 || kind == 7) {
    int k = i / (kind == 6 ? RIPPLE_SEGMENTS : PRINT_SEGMENTS);
    int j = i - k * (kind == 6 ? RIPPLE_SEGMENTS : PRINT_SEGMENTS);
    float n = float(kind == 6 ? RIPPLE_SEGMENTS : PRINT_SEGMENTS);
    float s0 = TAU * float(j) / n;
    float s1 = TAU * float(j + 1) / n;
    vec4 e = u_d[SLOT_PRINT + k];
    vec3 fwd = vec3(sin(e.z), 0.0, cos(e.z));
    vec3 left = vec3(cos(e.z), 0.0, -sin(e.z));
    vec3 mid = vec3(e.x, 0.002, e.y) + fwd * 0.09;
    if (kind == 6) {
      float p = e.w / RIPPLE_SECONDS;
      if (p < 1.0) {
        float r = mix(0.05, RIPPLE_REACH, 1.0 - pow(1.0 - p, 3.0));
        a = mid + onRing(s0, r);
        b = mid + onRing(s1, r);
        light = RIPPLE_LIGHT * (1.0 - p) * (1.0 - p) * smoothstep(0.0, 0.05, p);
      }
    } else if (e.w < PRINT_FADE) {
      // A sole: narrower at the heel than across the ball.
      float wa = 0.042 * (0.85 + 0.15 * cos(s0));
      float wb = 0.042 * (0.85 + 0.15 * cos(s1));
      a = mid + fwd * (0.115 * cos(s0)) + left * (wa * sin(s0));
      b = mid + fwd * (0.115 * cos(s1)) + left * (wb * sin(s1));
      float fade = 1.0 - e.w / PRINT_FADE;
      light = PRINT_LIGHT * fade * fade * smoothstep(0.0, 0.1, e.w);
      width = 0.85;
    }
    light *= WORLD.z * pool(mid);
  } else {
    // Where the lock's sphere of light meets the floor.
    float r2 = LOCK2.x * LOCK2.x - LOCK.y * LOCK.y;
    if (LOCK2.x > 0.0 && r2 > 0.0) {
      float r = sqrt(r2);
      float s0 = TAU * float(i) / float(RING_SEGMENTS);
      float s1 = TAU * float(i + 1) / float(RING_SEGMENTS);
      vec3 c = vec3(LOCK.x, 0.003, LOCK.z);
      a = c + onRing(s0, r);
      b = c + onRing(s1, r);
      light = LOCK.w * 0.9 * WORLD.z * exp(-r / 3.0);
      width = 1.6;
    }
  }
  vec3 mid = 0.5 * (a + b);
  if (kind != 9) light *= 1.0 + WAVE_GAIN * lockWave(mid);

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
  vec2 nrm = vec2(-t.y, t.x);
  // Two triangles: corners 0 1 2 / 0 2 3 of the band from a to b.
  int v = gl_VertexID;
  float end = (v == 1 || v == 2 || v == 4) ? 1.0 : 0.0;
  float side = (v == 2 || v == 4 || v == 5) ? 1.0 : -1.0;
  float z = mix(va.z, vb.z, end);
  float base = LINE_WIDTH * VIEW.w * width;
  float blur = lensBlur(z);
  float sigma = sqrt(base * base + blur * blur);
  float half_width = 3.0 * HALO_SPREAD * sigma;
  gl_Position = pxToClip(mix(pa, pb, end) + nrm * side * half_width);
  v_across = side * half_width;
  v_sigma = sigma;
  // A blurred line keeps its light, spread wider.
  v_color = u_glow * light * depthCue(z) * base / sigma;
}
