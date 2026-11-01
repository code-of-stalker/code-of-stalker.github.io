// Round glows: the motes in the air (kind 0), the dots of the floor (1),
// the lights (2: the runner, the inner core, the feet, the lock), the far
// stars (3), the beads of the waist ring (4). Each instance is a square
// three blurred widths out from its centre (sprite.frag).
out vec3 v_color;
out vec2 v_q;

// Pixels of a size in metres at depth z.
float worldPx(float metres, float z) {
  return metres / z * VIEW.y * 0.5 * VIEW.w;
}

void main() {
  int i = gl_InstanceID;
  int kind = int(u_kind.x);
  float w = loopPhase();
  vec3 p;
  float light;
  float sigma0;
  bool sized = false;
  // How far the lens may blur this glow, of the canvas height.
  float most = 0.05;
  // A blurred mote keeps more of its light, so the foreground reads as
  // soft out-of-focus light; the lights keep their energy.
  bool keepMore = false;
  if (kind == 0) {
    uint seed = uint(i) * 8u + 11u;
    float L = WORLD.y;
    vec3 base = vec3(
      (rand(seed) * 2.0 - 1.0) * MOTE_SPAN_X,
      mix(0.05, MOTE_SPAN_Y, pow(rand(seed + 1u), 1.3)),
      rand(seed + 2u) * L);
    float phase = rand(seed + 3u) * TAU;
    base += 0.06 * vec3(sin(w * pace(seed + 6u, 12.0) + phase),
                        sin(w * pace(seed + 7u, 15.0) + 1.7 * phase),
                        sin(w * pace(seed + 8u, 18.0) + 0.6 * phase));
    float zc = R1C.z;
    float dz = mod(base.z - zc + 0.5 * L, L) - 0.5 * L;
    p = vec3(base.x, base.y, zc + dz);
    float edge = smoothstep(0.5 * L, 0.5 * L - 0.8, abs(dz)) * smoothstep(MOTE_SPAN_X, MOTE_SPAN_X - 0.8, abs(base.x));
    float twinkle = 0.65 + 0.35 * sin(w * pace(seed + 5u, 5.0) + phase);
    // What the runner looks out at brightens as it passes.
    vec3 d = p - R1C.xyz;
    float r = length(d.xz);
    float seen = trail(atan(d.x, d.z)) * R1RUN.z * smoothstep(R1C.w, R1C.w * 1.35, r) * exp(-abs(d.y) / 0.9);
    light = MOTE_LIGHT * WORLD.w * mix(0.25, 1.0, rand(seed + 4u)) * twinkle * edge
          * (1.0 + MOTE_GAZE * seen) * (1.0 + WAVE_GAIN * lockWave(p));
    sigma0 = 0.0013;
    keepMore = true;
  } else if (kind == 1) {
    int gx = i % FLOOR_GRID;
    int gz = i / FLOOR_GRID;
    int repeat = int(floor(WORLD.x / FLOOR_CELL + 0.5));
    int cx = gx - FLOOR_GRID / 2 + int(floor(R1C.x / FLOOR_CELL + 0.5));
    int cz = gz - FLOOR_GRID / 2 + int(floor(R1C.z / FLOOR_CELL + 0.5));
    int wz = ((cz % repeat) + repeat) % repeat;
    uint seed = uint(cx + 4096) * 7919u + uint(wz) * 104729u + 3u;
    vec2 jitter = (vec2(rand(seed), rand(seed + 1u)) - 0.5) * 0.12;
    p = vec3((float(cx) + jitter.x) * FLOOR_CELL, 0.001, (float(cz) + jitter.y) * FLOOR_CELL);
    // The heel strikes' ripples brighten the dots they cross.
    float rippled = 0.0;
    for (int k = 0; k < PRINTS; k++) {
      vec4 e = u_d[SLOT_PRINT + k];
      float q = e.w / RIPPLE_SECONDS;
      if (q >= 1.0) continue;
      vec2 mid = e.xy + 0.09 * vec2(sin(e.z), cos(e.z));
      float rr = mix(0.05, RIPPLE_REACH, 1.0 - pow(1.0 - q, 3.0));
      float x = (length(p.xz - mid) - rr) / 0.06;
      rippled += (1.0 - q) * (1.0 - q) * exp(-x * x);
    }
    float twinkle = 0.75 + 0.25 * sin(w * pace(seed + 3u, 6.0) + rand(seed + 4u) * TAU);
    light = FLOOR_LIGHT * WORLD.z * pool(p) * mix(0.3, 1.0, rand(seed + 2u)) * twinkle
          * (1.0 + 3.0 * rippled + WAVE_GAIN * lockWave(p));
    sigma0 = 0.0012;
  } else if (kind == 2) {
    sized = true;
    if (i < 2) {
      // The runner's core and halo.
      p = R1C.xyz + onRing(R1RUN.x, R1C.w);
      light = R1.x * R1RUN.y * (i == 0 ? 2.2 : 0.35) * (1.0 + 0.6 * R1.w);
      sigma0 = i == 0 ? 0.012 : 0.07;
    } else if (i < 5) {
      // The inner light: core, halo, aura, breathing.
      p = R2C.xyz;
      float breathe = 0.85 + 0.3 * UP.w;
      light = R2.w * (i == 2 ? 1.5 : (i == 3 ? 0.3 : 0.05)) * breathe * (1.0 + FLASH_GAIN * R2.z);
      sigma0 = (i == 2 ? 0.01 : (i == 3 ? 0.05 : 0.22)) * mix(0.9, 1.1, UP.w);
    } else if (i < 7) {
      // Where each foot presses the ground.
      vec4 f = u_d[SLOT_FEET + i - 5];
      p = f.xyz;
      light = 0.35 * f.w * WORLD.z;
      sigma0 = 0.05;
    } else {
      // The lock: a glow from the chest as its wave leaves.
      p = LOCK.xyz;
      light = 0.6 * LOCK.w;
      sigma0 = 0.12 + 0.03 * max(LOCK2.x, 0.0);
    }
  } else if (kind == 3) {
    uint seed = uint(i) * 6u + 5u;
    float az = rand(seed) * TAU;
    float el = mix(0.03, 0.85, pow(rand(seed + 1u), 1.8));
    vec3 dir = vec3(cos(el) * sin(az), sin(el), cos(el) * cos(az));
    p = R1C.xyz + dir * 36.0;
    float twinkle = 0.6 + 0.4 * sin(w * pace(seed + 2u, 4.0) + rand(seed + 3u) * TAU);
    light = STAR_LIGHT * WORLD.w * mix(0.15, 1.0, pow(rand(seed + 4u), 3.0)) * twinkle;
    sigma0 = 0.0008;
    most = 0.0009;
  } else {
    // The waist ring's beads: what it is before it holds, its knots after.
    float s = (float(i) + 0.5) * TAU / float(BEADS) - R3.w;
    p = onTilted(R3C.xyz, R3N.xyz, R3C.w, s);
    light = R3N.w * mix(1.6, 0.35, R3.y) * (1.0 + FLASH_GAIN * R3.x) * (1.0 + WAVE_GAIN * lockWave(p));
    sigma0 = 0.006;
    sized = true;
  }
  vec3 v = toView(p);
  if (v.z < 0.3 || light <= 0.0) {
    gl_Position = vec4(0.0, 0.0, 2.0, 1.0);
    return;
  }
  float s0 = sized ? worldPx(sigma0, v.z) : sigma0 * VIEW.w;
  s0 = max(s0, 0.6);
  float blur = lensBlur(v.z);
  float sigma = max(min(sqrt(s0 * s0 + blur * blur), most * VIEW.w), s0);
  int corner = gl_VertexID;
  vec2 q = vec2(corner == 1 || corner == 2 || corner == 4 ? 1.0 : -1.0,
                corner == 2 || corner == 4 || corner == 5 ? 1.0 : -1.0) * 3.0;
  gl_Position = pxToClip(toPx(v) + q * sigma);
  v_q = q;
  float spread = s0 / sigma;
  float kept = keepMore ? spread : spread * spread;
  // Nothing flares right at the lens.
  v_color = u_glow * light * kept * smoothstep(0.3, 1.2, v.z) * (kind == 1 || kind == 3 ? 1.0 : depthCue(v.z));
}
