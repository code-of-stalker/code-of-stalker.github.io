// The lines: the crown ring's two strands (kind 0) and its trail of last
// positions (1), the torso and legs rings' fine lines (2), the sweep that
// fills the glass (3), where the glass meets the ground (4), the ripples of
// the heel strikes (5), the footprints (6), the lock's wave along the
// ground (7), the figures among the stars (8). Each instance is one
// straight piece of a curve, drawn as a band a few blurred widths across
// (line.frag).
out vec3 v_color;
out float v_across;
out float v_sigma;

// Nearer the camera than the glass's middle, brighter; from inside the
// glass all of a ring is near.
float facing(vec3 p) {
  vec3 toward = EYE.xyz - SPH.xyz;
  float far = length(toward);
  float f = dot(normalize(p - SPH.xyz), toward / max(far, 1e-4));
  return mix(1.0, mix(0.45, 1.2, 0.5 + 0.5 * f), smoothstep(SPH.w * 0.8, SPH.w * 1.4, far));
}

void main() {
  int kind = int(u_kind.x);
  int i = gl_InstanceID;
  vec3 a = vec3(0.0);
  vec3 b = vec3(0.0);
  float light = 0.0;
  float width = 1.0;
  bool sharp = false;
  if (kind == 0 || kind == 2 || kind == 3) {
    // The rings: two strands of the crown, the torso's and the legs' lines,
    // the sweep.
    int strand = i / RING_SEGMENTS;
    int j = i - strand * RING_SEGMENTS;
    int k = kind == 0 ? 0 : (kind == 2 ? 1 + strand : 3);
    float s0 = TAU * float(j) / float(RING_SEGMENTS);
    float s1 = TAU * float(j + 1) / float(RING_SEGMENTS);
    vec4 c = RC(k);
    vec4 n = RN(k);
    vec4 x = RX(k);
    vec3 off = kind == 0 ? n.xyz * (CROWN_GAP * (float(strand) - 0.5)) : vec3(0.0);
    a = onTilted(c.xyz + off, n.xyz, c.w, s0);
    b = onTilted(c.xyz + off, n.xyz, c.w, s1);
    vec3 mid = 0.5 * (a + b);
    float flash = 1.0 + FLASH_GAIN * x.x;
    if (kind == 0) {
      // A brighter knot runs round each strand, the two strands opposite.
      float run = 0.5 + 0.5 * cos(0.5 * (s0 + s1) - x.y + PI * float(strand));
      light = n.w * CROWN_LIGHT * flash * facing(mid) * (0.75 + 0.5 * run * run * run)
            * (1.0 + 1.5 * x.w);
      width = 1.15;
    } else if (kind == 2) {
      light = n.w * INNER_LINE_LIGHT * smoothstep(0.5, 1.0, x.z) * flash * facing(mid);
      width = 0.8;
    } else {
      light = n.w * THIRD_LIGHT * facing(mid);
      width = 1.5;
    }
  } else if (kind == 1) {
    int k = i / GHOST_SEGMENTS;
    int j = i - k * GHOST_SEGMENTS;
    float s0 = TAU * float(j) / float(GHOST_SEGMENTS);
    float s1 = TAU * float(j + 1) / float(GHOST_SEGMENTS);
    vec4 c = u_d[SLOT_GHOST + 2 * k];
    vec4 n = u_d[SLOT_GHOST + 2 * k + 1];
    a = onTilted(c.xyz, n.xyz, c.w, s0);
    b = onTilted(c.xyz, n.xyz, c.w, s1);
    light = GHOST_LIGHT * n.w * facing(0.5 * (a + b)) * (1.0 + 0.6 * RX(0).x);
    width = 1.4;
  } else if (kind == 4) {
    // The glass's foot: the circle where it meets the ground.
    float r = sqrt(max(SPH.w * SPH.w - SPH.y * SPH.y, 0.0));
    float s0 = TAU * float(i) / float(RING_SEGMENTS);
    float s1 = TAU * float(i + 1) / float(RING_SEGMENTS);
    vec3 c = vec3(SPH.x, 0.004, SPH.z);
    a = bend(c + onRing(s0, r));
    b = bend(c + onRing(s1, r));
    // Each foot's press runs out round it.
    float pressed = 0.0;
    for (int f = 0; f < 2; f++) {
      vec4 e = u_d[SLOT_FEET + f];
      pressed += e.w;
    }
    light = CONTACT_LIGHT * WORLD.z * (SHELL_LATENT * SHELLS.x + SHELLS.y) * (0.8 + 0.25 * pressed);
    width = 1.2;
  } else if (kind == 5 || kind == 6) {
    int segments = kind == 5 ? RIPPLE_SEGMENTS : PRINT_SEGMENTS;
    int k = i / segments;
    int j = i - k * segments;
    float s0 = TAU * float(j) / float(segments);
    float s1 = TAU * float(j + 1) / float(segments);
    vec4 e = u_d[SLOT_PRINT + k];
    vec3 fwd = vec3(sin(e.z), 0.0, cos(e.z));
    vec3 left = vec3(cos(e.z), 0.0, -sin(e.z));
    vec3 mid = vec3(e.x, 0.002, e.y) + fwd * 0.09;
    if (kind == 5) {
      float p = e.w / RIPPLE_SECONDS;
      if (p < 1.0) {
        float r = mix(0.05, RIPPLE_REACH, 1.0 - pow(1.0 - p, 3.0));
        a = bend(mid + onRing(s0, r));
        b = bend(mid + onRing(s1, r));
        light = RIPPLE_LIGHT * (1.0 - p) * (1.0 - p) * smoothstep(0.0, 0.05, p);
      }
    } else if (e.w < PRINT_FADE) {
      // A sole: narrower at the heel than across the ball.
      float wa = 0.042 * (0.85 + 0.15 * cos(s0));
      float wb = 0.042 * (0.85 + 0.15 * cos(s1));
      a = bend(mid + fwd * (0.115 * cos(s0)) + left * (wa * sin(s0)));
      b = bend(mid + fwd * (0.115 * cos(s1)) + left * (wb * sin(s1)));
      float fade = 1.0 - e.w / PRINT_FADE;
      light = PRINT_LIGHT * fade * fade * smoothstep(0.0, 0.1, e.w);
      width = 0.85;
    }
    light *= WORLD.z * pool(mid) * (1.0 + 0.6 * SHELLS.y);
  } else if (kind == 7) {
    // Where the lock's sphere of light meets the ground.
    float r2 = LOCK2.x * LOCK2.x - LOCK.y * LOCK.y;
    if (LOCK2.x > 0.0 && r2 > 0.0) {
      float r = sqrt(r2);
      float s0 = TAU * float(i) / float(RING_SEGMENTS);
      float s1 = TAU * float(i + 1) / float(RING_SEGMENTS);
      vec3 c = vec3(LOCK.x, 0.003, LOCK.z);
      a = bend(c + onRing(s0, r));
      b = bend(c + onRing(s1, r));
      light = LOCK.w * 0.9 * WORLD.z * exp(-r / 4.0);
      width = 1.6;
    }
  } else {
    // A figure of stars: each joined to the next.
    int per = CONSTELLATION_STARS - 1;
    int c = i / per;
    int j = i - c * per;
    vec3 da = constellationStar(c, j);
    vec3 db = constellationStar(c, j + 1);
    if (hitPlanet(EYE.xyz, da) < 0.0 && hitPlanet(EYE.xyz, db) < 0.0) {
      // Short of each star, so the line never covers it.
      a = EYE.xyz + 150.0 * normalize(mix(da, db, 0.12));
      b = EYE.xyz + 150.0 * normalize(mix(da, db, 0.88));
      float w = loopPhase();
      light = CONSTELLATION_LIGHT * WORLD.w * (0.8 + 0.2 * sin(w * pace(uint(c) + 40u, 9.0) + float(j)));
      sharp = true;
      width = 0.7;
    }
  }
  vec3 mid = 0.5 * (a + b);
  if (kind < 7) light *= 1.0 + WAVE_GAIN * lockWave(mid);
  if (kind != 3 && kind < 7) light *= 1.0 + 1.5 * scanned(mid) * float(kind != 0);

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
  // Close up a line goes soft, but never to a band.
  float blur = sharp ? 0.0 : min(lensBlur(z), 0.004 * VIEW.w);
  float sigma = sqrt(base * base + blur * blur);
  float half_width = 3.0 * HALO_SPREAD * sigma;
  gl_Position = pxToClip(mix(pa, pb, end) + nrm * side * half_width);
  v_across = side * half_width;
  v_sigma = sigma;
  // A blurred line keeps its light, spread wider.
  v_color = u_glow * light * (sharp ? 1.0 : depthCue(z)) * base / sigma;
}
