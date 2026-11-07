// The lines: the crown ring's two strands (kind 0) and its trail of last
// positions (1), the scanner and its echo (2), the sphere's turning ring
// and its trail (3), where the glass meets the ground (4), the ripples of
// the heel strikes (5), the footprints (6), the lock's wave along the
// ground (7), the figures among the stars (8), the wires (9), the things
// the walk passes (10), the spires over the horizon (11), the seats (12).
// Each instance is
// one straight piece of a curve, drawn as a band a few blurred widths
// across (line.frag).
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
    // The rings: two strands of the crown, the scanner and its echo, the
    // sphere's ring and the trail it leaves as it turns.
    int strand = i / RING_SEGMENTS;
    int j = i - strand * RING_SEGMENTS;
    int k = kind == 0 ? 0 : (kind == 2 ? 1 : 2);
    float s0 = TAU * float(j) / float(RING_SEGMENTS);
    float s1 = TAU * float(j + 1) / float(RING_SEGMENTS);
    vec4 c = RC(k);
    vec4 n = RN(k);
    vec4 x = RX(k);
    vec3 off = kind == 0 ? n.xyz * (CROWN_GAP * (float(strand) - 0.5)) : vec3(0.0);
    float fade = 1.0;
    if (kind == 2 && strand == 1) {
      // The echo lags where the scanner has just been.
      float rate = -sin(TAU * LOCK2.w / SWEEP);
      off = -n.xyz * 0.06 * rate;
      fade = 0.35 * abs(rate);
    }
    if (kind == 3 && strand > 0) {
      // Behind the turning ring its last places, fading.
      float turned = x.y - SPIN_STEP * float(strand) * x.z;
      n.xyz = vec3(cos(turned), 0.0, -sin(turned));
      float f = 1.0 - float(strand) / float(SPIN_TRAIL);
      fade = 0.4 * f * f * x.z;
    }
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
      light = n.w * INNER_LINE_LIGHT * smoothstep(0.5, 1.0, x.z) * flash * facing(mid) * fade;
      width = 1.1;
    } else {
      // Under the ground it is gone.
      light = n.w * SPIN_LIGHT * flash * facing(mid) * fade * smoothstep(-0.02, 0.06, min(a.y, b.y));
      width = strand == 0 ? 1.3 : 1.0;
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
  } else if (kind == 9) {
    // A wire: three strands braided round its writhing middle, grown out
    // of the ground as far as it has reached, crumbling back from the
    // glass once it has broken there.
    int per = TENTACLE_STRANDS * TENTACLE_SEGMENTS;
    int t = i / per;
    int strand = (i - t * per) / TENTACLE_SEGMENTS;
    int j = i - t * per - strand * TENTACLE_SEGMENTS;
    float w = TT(t, 3).w;
    float shown = min(TT(t, 0).w, wireCut(t));
    float s0 = float(j) / float(TENTACLE_SEGMENTS);
    float s1 = min(float(j + 1) / float(TENTACLE_SEGMENTS), shown);
    if (s0 < shown && TT(t, 2).w > 0.0) {
      vec3 ends[2];
      for (int e = 0; e < 2; e++) {
        float s = e == 0 ? s0 : s1;
        vec3 c = wire(t, s, w);
        vec3 along = normalize(wire(t, min(s + 0.01, 1.0), w) - wire(t, max(s - 0.01, 0.0), w));
        vec3 n1 = normalize(cross(along, abs(along.y) < 0.95 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0)));
        vec3 n2 = cross(along, n1);
        float turn = TAU * float(strand) / float(TENTACLE_STRANDS) + 16.0 * s + 0.6 * w;
        ends[e] = bend(c + mix(0.06, 0.008, s) * (n1 * cos(turn) + n2 * sin(turn)));
      }
      a = ends[0];
      b = ends[1];
      float s = 0.5 * (s0 + s1);
      // Light runs along it toward the figure; its growing tip and its
      // crumbling edge burn.
      float run = pow(fract(2.0 * s - 0.8 * RIGHT.w + 0.33 * float(strand)), 8.0);
      float edge = exp(-(shown - s) / 0.03);
      light = TENTACLE_LIGHT * TT(t, 2).w * (0.45 + 1.4 * run + 3.0 * edge) * mix(0.8, 1.2, s)
            * (1.0 + WAVE_GAIN * lockWave(0.5 * (a + b)));
      width = mix(1.8, 0.9, s);
    }
  } else if (kind == 10) {
    // A thing the walk passes, a cube on the ground or a crystal in the
    // air: faint outside the glass; once inside, a ring runs up and down it
    // and its edges light where the ring and the crown ring's plane cross
    // them.
    int edges = 12 * THING_PIECES;
    int per = edges + THING_RING;
    int c = i / per;
    int local = i - c * per;
    int e = min(local, edges - 1) / THING_PIECES;
    int piece = min(local, edges - 1) - e * THING_PIECES;
    uint seed = uint(c) * 17u + 601u;
    float L = WORLD.x;
    bool air = rand(seed) < 0.5;
    float side = rand(seed + 1u) < 0.5 ? -1.0 : 1.0;
    float size = mix(0.07, 0.13, rand(seed + 2u));
    // Where the walk passes it, and whether it is there at all.
    vec4 placed = THING(c);
    vec2 own = c % 2 == 0 ? placed.xy : placed.zw;
    float dz = mod(own.x - SPH.z + 0.5 * L, L) - 0.5 * L;
    vec3 at = vec3(side * mix(0.42, 0.95, rand(seed + 4u)),
                   air ? mix(0.75, 1.85, rand(seed + 5u)) : size,
                   SPH.z + dz);
    float w = loopPhase();
    float yaw = TAU * rand(seed + 6u) + (air ? w * pace(seed + 7u, 9.0) : 0.0);
    float tilt = air ? 0.5 * sin(w * pace(seed + 8u, 13.0) + TAU * rand(seed + 9u)) : 0.0;
    if (air) at.y += 0.05 * sin(w * pace(seed + 10u, 7.0));
    // Edge e of a cube (on the ground) or an octahedron (in the air).
    vec3 pa;
    vec3 pb;
    if (!air) {
      int axis = e / 4;
      int bits = e - axis * 4;
      float u = float(bits & 1) * 2.0 - 1.0;
      float v = float(bits >> 1) * 2.0 - 1.0;
      vec3 one = axis == 0 ? vec3(1.0, 0.0, 0.0) : (axis == 1 ? vec3(0.0, 1.0, 0.0) : vec3(0.0, 0.0, 1.0));
      vec3 two = axis == 0 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
      vec3 three = axis == 2 ? vec3(0.0, 1.0, 0.0) : vec3(0.0, 0.0, 1.0);
      vec3 q = two * u + three * v;
      pa = q - one;
      pb = q + one;
    } else {
      int pair = e / 4;
      int bits = e - pair * 4;
      vec3 ea = pair == 2 ? vec3(0.0, 1.5, 0.0) : vec3(1.0, 0.0, 0.0);
      vec3 eb = pair == 0 ? vec3(0.0, 1.5, 0.0) : vec3(0.0, 0.0, 1.0);
      pa = ea * (float(bits & 1) * 2.0 - 1.0);
      pb = eb * (float(bits >> 1) * 2.0 - 1.0);
    }
    float edge = smoothstep(0.5 * L, 0.5 * L - 2.0, abs(dz)) * own.y;
    float inside = smoothstep(0.04, -0.1, length(at - SPH.xyz) - SPH.w);
    // Its scanning ring, slowly up and down it.
    float tall = air ? 1.5 * size : size;
    float ringY = at.y + 1.15 * tall * sin(w * pace(seed + 11u, 3.0));
    if (local >= edges) {
      int j = local - edges;
      float s0 = TAU * float(j) / float(THING_RING);
      float s1 = TAU * float(j + 1) / float(THING_RING);
      // Wider where it passes the thing's middle, as round its girth.
      float r = size * mix(1.25, 1.75, 1.0 - abs(ringY - at.y) / (1.15 * tall));
      vec3 round_ = vec3(at.x, ringY, at.z);
      a = bend(round_ + onRing(s0, r));
      b = bend(round_ + onRing(s1, r));
      light = THING_LIGHT * META.w * edge * inside * 1.4 * (1.0 + WAVE_GAIN * lockWave(round_));
      width = 0.8;
    } else {
      vec3 qa = mix(pa, pb, float(piece) / float(THING_PIECES));
      vec3 qb = mix(pa, pb, float(piece + 1) / float(THING_PIECES));
      mat3 turn = mat3(cos(yaw), 0.0, -sin(yaw), 0.0, 1.0, 0.0, sin(yaw), 0.0, cos(yaw))
                * mat3(1.0, 0.0, 0.0, 0.0, cos(tilt), sin(tilt), 0.0, -sin(tilt), cos(tilt));
      a = bend(at + turn * qa * size);
      b = bend(at + turn * qb * size);
      vec3 m = 0.5 * (a + b);
      // Once inside, light runs along its edges.
      float run = pow(fract(float(piece) / float(THING_PIECES) - 1.5 * RIGHT.w + rand(seed + uint(e))), 6.0);
      float cut = (m.y - ringY) / (0.3 * size);
      light = THING_LIGHT * META.w * edge * (0.12 + inside * (0.6 + 0.7 * run + 2.5 * exp(-cut * cut)))
            * (1.0 + 4.0 * scanned(m) * inside) * (1.0 + WAVE_GAIN * lockWave(m));
      width = 0.9;
    }
  } else if (kind == 12) {
    // A seat of light: a block's edges and level lines round its sides. It
    // builds from the ground up, its growing top bright, and melts back
    // down into the ground the same way.
    int edges = 12 * SEAT_PIECES;
    int per = edges + 4 * SEAT_LEVELS * SEAT_PIECES;
    int c = i / per;
    int local = i - c * per;
    vec4 s = u_d[SLOT_SEAT + c];
    vec3 size = vec3(SEAT_HALF_X, 0.5 * SEAT_TOP, SEAT_HALF_Z);
    vec3 mid = vec3(s.x, 0.5 * SEAT_TOP, s.y);
    vec3 pa;
    vec3 pb;
    float t0;
    float t1;
    float strength;
    if (local < edges) {
      int e = local / SEAT_PIECES;
      int piece = local - e * SEAT_PIECES;
      int axis = e / 4;
      int bits = e - axis * 4;
      float u = float(bits & 1) * 2.0 - 1.0;
      float v = float(bits >> 1) * 2.0 - 1.0;
      vec3 one = axis == 0 ? vec3(1.0, 0.0, 0.0) : (axis == 1 ? vec3(0.0, 1.0, 0.0) : vec3(0.0, 0.0, 1.0));
      vec3 two = axis == 0 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
      vec3 three = axis == 2 ? vec3(0.0, 1.0, 0.0) : vec3(0.0, 0.0, 1.0);
      vec3 q = two * u + three * v;
      pa = q - one;
      pb = q + one;
      t0 = float(piece) / float(SEAT_PIECES);
      t1 = float(piece + 1) / float(SEAT_PIECES);
      strength = 1.0;
    } else {
      int j = local - edges;
      int level = j / (4 * SEAT_PIECES);
      int k = j - level * 4 * SEAT_PIECES;
      int side_ = k / SEAT_PIECES;
      int piece = k - side_ * SEAT_PIECES;
      float h = 2.0 * (float(level) + 1.0) / float(SEAT_LEVELS + 1) - 1.0;
      vec2 corner[4] = vec2[4](vec2(-1.0, -1.0), vec2(1.0, -1.0), vec2(1.0, 1.0), vec2(-1.0, 1.0));
      vec2 ca = corner[side_];
      vec2 cb = corner[(side_ + 1) % 4];
      pa = vec3(ca.x, h, ca.y);
      pb = vec3(cb.x, h, cb.y);
      t0 = float(piece) / float(SEAT_PIECES);
      t1 = float(piece + 1) / float(SEAT_PIECES);
      strength = 0.32;
    }
    vec3 qa = mid + size * mix(pa, pb, t0);
    vec3 qb = mid + size * mix(pa, pb, t1);
    a = bend(qa);
    b = bend(qb);
    vec3 m = 0.5 * (qa + qb);
    // Built up to here; the growing top is lit while it moves.
    float top = s.w * SEAT_TOP;
    float built = smoothstep(top + 0.015, top - 0.03, m.y);
    float moving = smoothstep(0.0, 0.06, s.w) * (1.0 - smoothstep(0.94, 1.0, s.w));
    float rim = (m.y - top) / 0.03;
    float growing = moving * exp(-rim * rim);
    float inside = smoothstep(0.04, -0.1, length(m - SPH.xyz) - SPH.w);
    light = SEAT_LIGHT * s.z * (strength * built * mix(0.45, 1.0, inside) + 1.6 * growing)
          * (1.0 + 2.5 * scanned(m));
    if (hidden(m)) light = 0.0;
    width = strength > 0.5 ? 0.9 : 0.7;
  } else if (kind == 11) {
    // A spire over the horizon: a mast and three stays to the ground; a
    // light climbs the mast.
    int c = i / SPIRE_PIECES;
    int j = i - c * SPIRE_PIECES;
    vec4 f = spire(c);
    uint seed = uint(c) * 23u + 811u;
    vec3 foot = vec3(f.x, 0.0, f.z);
    float h = f.w;
    float climb = fract(pace(seed + 5u, 6.0) * RIGHT.w / META.x + rand(seed + 6u));
    if (j < 16) {
      float u0 = float(j) / 16.0;
      float u1 = float(j + 1) / 16.0;
      a = bend(foot + vec3(0.0, h * u0, 0.0));
      b = bend(foot + vec3(0.0, h * u1, 0.0));
      float d = (0.5 * (u0 + u1) - climb) / 0.05;
      light = 0.8 + 2.0 * exp(-d * d);
    } else {
      int stay = (j - 16) / 8;
      int k = j - 16 - stay * 8;
      float az = TAU * (float(stay) / 3.0 + rand(seed + 7u));
      vec3 top = foot + vec3(0.0, 0.72 * h, 0.0);
      vec3 low = foot + 0.5 * h * vec3(sin(az), 0.0, cos(az));
      float u0 = float(k) / 8.0;
      float u1 = float(k + 1) / 8.0;
      // Each stay sags a little.
      a = bend(mix(top, low, u0) - vec3(0.0, 0.06 * h * sin(PI * u0), 0.0));
      b = bend(mix(top, low, u1) - vec3(0.0, 0.06 * h * sin(PI * u1), 0.0));
      light = 0.45;
    }
    float dz = f.z - (SHELLS.w + 6.0);
    float edge = smoothstep(0.5 * WORLD.x, 0.5 * WORLD.x - 5.0, abs(dz));
    light *= SPIRE_LIGHT * WORLD.w * edge;
    if (hidden(0.5 * (a + b))) light = 0.0;
    width = 0.8;
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
