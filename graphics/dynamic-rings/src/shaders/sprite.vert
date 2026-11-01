// Round glows: the motes in the air (kind 0), the dots of the floor (1),
// the lights (2: where the feet press, the crown ring's two knots), the far
// stars (3), the beads of the three rings (4), the threads of beads that
// run up through them once they lock (5), the columns of data over the
// horizon (6). Each instance is a square three blurred widths out from its
// centre (sprite.frag).
out vec3 v_color;
out vec2 v_q;

// Pixels of a size in metres at depth z.
float worldPx(float metres, float z) {
  return metres / z * VIEW.y * 0.5 * VIEW.w;
}

// A point between the rings: u 0 on the legs ring, 0.5 the torso's, 1 the
// crown's, at angle s round them.
vec3 between(float u, float s) {
  int k = u < 0.5 ? 2 : 1;
  int l = u < 0.5 ? 1 : 0;
  float x = smoothstep(0.0, 1.0, u < 0.5 ? u * 2.0 : u * 2.0 - 1.0);
  vec3 c = mix(RC(k).xyz, RC(l).xyz, x);
  vec3 n = normalize(mix(RN(k).xyz, RN(l).xyz, x));
  // Fuller between the rings, as round a body.
  float r = mix(RC(k).w, RC(l).w, x) * (1.0 + 0.12 * sin(PI * x));
  return onTilted(c, n, r, s);
}

void main() {
  int i = gl_InstanceID;
  int kind = int(u_kind.x);
  float w = loopPhase();
  vec3 p = vec3(0.0);
  float light = 0.0;
  float sigma0 = 0.001;
  bool sized = false;
  // How far the lens may blur this glow, of the canvas height.
  float most = 0.05;
  // A blurred mote keeps more of its light, so the foreground reads as
  // soft out-of-focus light; the lights keep their energy.
  bool keepMore = false;
  bool far = false;
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
    float zc = SPH.z;
    float dz = mod(base.z - zc + 0.5 * L, L) - 0.5 * L;
    p = bend(vec3(base.x, base.y, zc + dz));
    float edge = smoothstep(0.5 * L, 0.5 * L - 0.8, abs(dz)) * smoothstep(MOTE_SPAN_X, MOTE_SPAN_X - 0.8, abs(base.x));
    float twinkle = 0.65 + 0.35 * sin(w * pace(seed + 5u, 5.0) + phase);
    light = MOTE_LIGHT * WORLD.w * mix(0.25, 1.0, rand(seed + 4u)) * twinkle * edge
          * (1.0 + SCAN_LIGHT * scanned(p)) * (1.0 + WAVE_GAIN * lockWave(p));
    sigma0 = 0.0013;
    keepMore = true;
  } else if (kind == 1) {
    int gx = i % FLOOR_GRID;
    int gz = i / FLOOR_GRID;
    int repeat = int(floor(WORLD.x / FLOOR_CELL + 0.5));
    int cx = gx - FLOOR_GRID / 2 + int(floor(SPH.x / FLOOR_CELL + 0.5));
    int cz = gz - FLOOR_GRID / 2 + int(floor(SPH.z / FLOOR_CELL + 0.5));
    int wz = ((cz % repeat) + repeat) % repeat;
    uint seed = uint(cx + 4096) * 7919u + uint(wz) * 104729u + 3u;
    vec2 jitter = (vec2(rand(seed), rand(seed + 1u)) - 0.5) * 0.12;
    vec3 flat_ = vec3((float(cx) + jitter.x) * FLOOR_CELL, 0.001, (float(cz) + jitter.y) * FLOOR_CELL);
    p = bend(flat_);
    // The heel strikes' ripples brighten the dots they cross.
    float rippled = 0.0;
    for (int k = 0; k < PRINTS; k++) {
      vec4 e = u_d[SLOT_PRINT + k];
      float q = e.w / RIPPLE_SECONDS;
      if (q >= 1.0) continue;
      vec2 mid = e.xy + 0.09 * vec2(sin(e.z), cos(e.z));
      float rr = mix(0.05, RIPPLE_REACH, 1.0 - pow(1.0 - q, 3.0));
      float x = (length(flat_.xz - mid) - rr) / 0.06;
      rippled += (1.0 - q) * (1.0 - q) * exp(-x * x);
    }
    // Inside the glass's foot the floor is lit as the glass fills.
    float inside = smoothstep(0.1, -0.1, length(flat_.xz - SPH.xz) - sqrt(max(SPH.w * SPH.w - SPH.y * SPH.y, 0.0)));
    float twinkle = 0.75 + 0.25 * sin(w * pace(seed + 3u, 6.0) + rand(seed + 4u) * TAU);
    light = FLOOR_LIGHT * WORLD.z * pool(flat_) * mix(0.3, 1.0, rand(seed + 2u)) * twinkle
          * (1.0 + 3.0 * rippled + WAVE_GAIN * lockWave(p) + SCAN_LIGHT * scanned(p) + 1.2 * inside * SHELLS.y);
    sigma0 = 0.0012;
  } else if (kind == 2) {
    sized = true;
    if (i < 2) {
      // Where each foot presses the ground.
      vec4 f = u_d[SLOT_FEET + i];
      p = bend(f.xyz);
      light = 0.4 * f.w * WORLD.z;
      sigma0 = 0.05;
    } else {
      // The crown ring's knot on each strand.
      int strand = i - 2;
      vec4 c = RC(0);
      vec4 n = RN(0);
      vec4 x = RX(0);
      vec3 off = n.xyz * (CROWN_GAP * (float(strand) - 0.5));
      p = onTilted(c.xyz + off, n.xyz, c.w, x.y - PI * float(strand));
      light = n.w * CROWN_LIGHT * 0.9 * (1.0 + FLASH_GAIN * x.x) * (1.0 + 1.5 * x.w);
      sigma0 = 0.007;
    }
  } else if (kind == 3) {
    // The stars, the figures' stars after them.
    vec3 dir;
    float bright;
    if (i < STARS) {
      uint seed = uint(i) * 6u + 5u;
      float az = rand(seed) * TAU;
      float el = mix(-0.3, 1.45, pow(rand(seed + 1u), 1.6));
      dir = vec3(cos(el) * sin(az), sin(el), cos(el) * cos(az));
      float twinkle = 0.6 + 0.4 * sin(w * pace(seed + 2u, 4.0) + rand(seed + 3u) * TAU);
      bright = mix(0.15, 1.0, pow(rand(seed + 4u), 3.0)) * twinkle;
    } else {
      int j = i - STARS;
      int c = j / CONSTELLATION_STARS;
      dir = constellationStar(c, j - c * CONSTELLATION_STARS);
      bright = 0.9 + 0.1 * sin(w * pace(uint(j) + 70u, 6.0));
    }
    if (hitPlanet(EYE.xyz, dir) < 0.0) {
      p = EYE.xyz + dir * 150.0;
      light = STAR_LIGHT * WORLD.w * bright;
    }
    sigma0 = 0.0008;
    most = 0.0009;
    far = true;
  } else if (kind == 4) {
    // The rings' beads: gathered on their ring, or scattered in a cloud
    // round where it will be, each coming in at its own moment.
    int k = i / BEADS;
    int j = i - k * BEADS;
    uint seed = uint(i) * 5u + 101u;
    vec4 c = RC(k);
    vec4 n = RN(k);
    vec4 x = RX(k);
    float s = (float(j) + 0.5) * TAU / float(BEADS) + x.y;
    vec3 on = onTilted(c.xyz, n.xyz, c.w, s);
    float delay = 0.6 * rand(seed);
    float gathered = smoothstep(delay, delay + 0.4, x.z);
    vec3 cloud = vec3(rand(seed + 1u), rand(seed + 2u), rand(seed + 3u)) * 2.0 - 1.0;
    cloud = c.xyz + normalize(cloud + 1e-3) * pow(rand(seed + 4u), 0.4) * c.w * 1.3
          + 0.05 * vec3(sin(w * pace(seed + 5u, 7.0)), sin(w * pace(seed + 6u, 9.0)), sin(w * pace(seed + 7u, 8.0)));
    p = mix(cloud, on, gathered);
    // Every fifth bead larger; a knot of brighter ones runs round.
    float big = j % 5 == 0 ? 1.0 : 0.0;
    float knot = 0.5 + 0.5 * cos(s - x.y - w * pace(uint(k) + 200u, 3.3));
    float ring = k == 0 ? 0.5 : 1.0;
    light = n.w * BEAD_LIGHT * ring * mix(0.35, 1.0, gathered) * (0.55 + 0.45 * big + 0.6 * pow(knot, 6.0))
          * (1.0 + FLASH_GAIN * x.x) * (1.0 + WAVE_GAIN * lockWave(p));
    if (k == 0) light *= 1.0 + 1.5 * x.w;
    sigma0 = mix(0.0045, 0.0075, big) * (k == 0 ? 0.8 : 1.0);
    sized = true;
  } else if (kind == 5) {
    // The threads: beads spiralling up from the legs through the torso to
    // the crown, whole laps a loop.
    int h = i / THREAD_BEADS;
    int b = i - h * THREAD_BEADS;
    float laps = max(1.0, floor(META.x / 2.6 + 0.5));
    float u = fract((float(b) + 0.5) / float(THREAD_BEADS) + laps * RIGHT.w / META.x);
    float s = TAU * float(h) / float(THREADS) + 1.4 * PI * u + RX(1).y;
    p = between(u, s);
    light = LOCK2.z * THREAD_LIGHT * sin(PI * u) * (1.0 + WAVE_GAIN * lockWave(p));
    sigma0 = 0.0035;
    sized = true;
  } else {
    // A column of data over the horizon: a bright head falls, the code it
    // leaves fading above it.
    int c = i / COLUMN_DOTS;
    int d = i - c * COLUMN_DOTS;
    uint seed = uint(c) * 13u + 401u;
    float L = WORLD.x;
    float side = rand(seed) < 0.5 ? -1.0 : 1.0;
    float x = side * mix(9.0, 48.0, rand(seed + 1u));
    // Mostly ahead of the walk, repeating every loop's walk.
    float zc = SHELLS.w + 8.0;
    float dz = mod(rand(seed + 2u) * L - zc + 0.5 * L, L) - 0.5 * L;
    float height = float(COLUMN_DOTS) * COLUMN_GAP;
    float y = (float(d) + 0.5) * COLUMN_GAP;
    p = bend(vec3(x, y, zc + dz));
    float fall = fract(pace(seed + 4u, 4.0) * RIGHT.w / META.x + rand(seed + 5u));
    float head = height * (1.25 - 1.5 * fall);
    float above = y - head;
    float trail = above > -0.5 * COLUMN_GAP ? exp(-max(above, 0.0) / 2.2) : 0.0;
    float lit = abs(above) < 0.5 * COLUMN_GAP ? 1.0 : 0.0;
    // Each dot a glyph that flickers on and off.
    float glyph = step(0.35, rand(seed + uint(d) * 3u + uint(floor(RIGHT.w * 6.0))));
    float edge = smoothstep(0.5 * L, 0.5 * L - 4.0, abs(dz));
    light = COLUMN_LIGHT * WORLD.w * edge * (0.12 * glyph + 0.55 * trail * glyph + 1.6 * lit);
    if (hidden(p)) light = 0.0;
    sigma0 = 0.0015;
    most = 0.003;
    far = true;
  }
  vec3 v = toView(p);
  if (v.z < 0.3 || light <= 0.0) {
    gl_Position = vec4(0.0, 0.0, 2.0, 1.0);
    return;
  }
  float s0 = sized ? worldPx(sigma0, v.z) : sigma0 * VIEW.w;
  s0 = max(s0, 0.6);
  float blur = far ? 0.0 : lensBlur(v.z);
  float sigma = max(min(sqrt(s0 * s0 + blur * blur), most * VIEW.w), s0);
  int corner = gl_VertexID;
  vec2 q = vec2(corner == 1 || corner == 2 || corner == 4 ? 1.0 : -1.0,
                corner == 2 || corner == 4 || corner == 5 ? 1.0 : -1.0) * 3.0;
  gl_Position = pxToClip(toPx(v) + q * sigma);
  v_q = q;
  float spread = s0 / sigma;
  float kept = keepMore ? spread : spread * spread;
  // Nothing flares right at the lens.
  v_color = u_glow * light * kept * smoothstep(0.3, 1.2, v.z) * (kind == 1 || far ? 1.0 : depthCue(v.z));
}
