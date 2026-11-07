// The world behind everything, one ray a pixel: the planet's curved
// ground with its grid, the air over it thickening to the horizon, the
// sky's band of light, and the glass sphere round the figure, which glows
// by how much of its shell a ray crosses, brightest at its rim and at its
// foot, is lit by its own ring as that turns, and rings where the wires
// break on it.
out vec4 o;

// Where a ray from o along unit d enters and leaves a sphere; x > y none.
vec2 throughSphere(vec3 o_, vec3 d, vec3 c, float r) {
  vec3 q = o_ - c;
  float b = dot(q, d);
  float h = b * b - (dot(q, q) - r * r);
  if (h < 0.0) return vec2(1.0, -1.0);
  h = sqrt(h);
  return vec2(-b - h, -b + h);
}
// How long [a, b] is, clipped to [0, cut].
float span(float a, float b, float cut) {
  return max(min(b, cut) - max(a, 0.0), 0.0);
}
// Height over the planet.
float altitude(vec3 p) {
  return length(p - planetCentre()) - PLANET_RADIUS;
}
// Fine lines every cell of `g`, about a pixel wide, softened by the lens:
// 1 on a line.
float lines(vec2 g, vec2 fw, float blur) {
  vec2 f = abs(fract(g - 0.5) - 0.5) / max(fw * (1.0 + blur), vec2(1e-5));
  float line = 1.0 - min(min(f.x, f.y), 1.0);
  // Where the cells shrink under a pixel they would only shimmer.
  return line * smoothstep(0.3, 0.08, max(fw.x, fw.y)) / (1.0 + 0.6 * blur);
}

// The glass at a point of its shell: what lights it there.
float shellLight(vec3 m) {
  float y = altitude(m);
  // The sphere's ring lights both halves of it as it turns: lit where it
  // has passed, brightest just behind it.
  vec3 rel = m - SPH.xyz;
  float az = atan(rel.x, rel.z);
  float painted = SHELLS.z >= PI + 0.4 ? 1.0 : smoothstep(0.0, 0.3, SHELLS.z - mod(az, PI));
  float wake = exp(-mod(RX(2).y - az, PI) / 0.45) * RN(2).w * RX(2).z;
  float lit = SHELL_LATENT * SHELLS.x + SHELLS.y * painted + 0.9 * wake;
  // Where a wire's tip nears the glass it glows; where it breaks a ring of
  // light runs out over it.
  for (int t = 0; t < TENTACLES; t++) {
    float on = TT(t, 2).w;
    if (on <= 0.0) continue;
    float broken = TT(t, 1).w;
    if (broken < 0.0) {
      float r = TT(t, 0).w;
      lit += 2.0 * on * r * r * r * r * exp(-length(m - TT(t, 3).xyz) / 0.12);
    } else if (broken < 1.4) {
      float d = (length(rel - TT(t, 4).xyz * SPH.w) - 1.1 * broken) / 0.05;
      float fade = 1.0 - broken / 1.4;
      lit += 1.6 * on * fade * fade * exp(-d * d);
    }
  }
  // Its foot glows where it stands on the ground.
  lit *= 1.0 + 2.0 * exp(-y / 0.14);
  // Each landing sends a ring of light up the glass from the foot.
  float waves = 0.0;
  for (int k = 0; k < PRINTS; k++) {
    vec4 e = u_d[SLOT_PRINT + k];
    if (e.w > 1.8) continue;
    float d = (length(m - vec3(e.x, 0.0, e.y)) - SHELL_WAVE * e.w) / 0.06;
    float fade = 1.0 - e.w / 1.8;
    waves += fade * fade * exp(-d * d);
  }
  lit += 0.6 * waves * (0.3 + 0.7 * SHELLS.y);
  return lit * (1.0 + WAVE_GAIN * lockWave(m) + 1.2 * scanned(m));
}

void main() {
  vec2 ndc = gl_FragCoord.xy / VIEW.zw * 2.0 - 1.0;
  vec3 d = normalize(FWD.xyz + RIGHT.xyz * (ndc.x / VIEW.x) + UP.xyz * (ndc.y / VIEW.y));
  float light = 0.0;

  // The planet.
  float tp = hitPlanet(EYE.xyz, d);
  bool ground = tp > 0.0;
  float cut = ground ? tp : 1e5;
  vec3 p = EYE.xyz + d * max(tp, 0.0);
  vec3 q = p - planetCentre();
  float arc = atan(length(q.xz), q.y) * PLANET_RADIUS;
  vec2 flat_ = normalize(q.xz + vec2(0.0, 1e-6)) * arc + vec2(0.0, SHELLS.w);
  // Half a cell aside, so no line runs straight under the walk.
  vec2 g = flat_ / PLANET_CELL + vec2(0.5, 0.0);
  vec2 fw = fwidth(g);
  float zp = max(dot(p - EYE.xyz, FWD.xyz), 0.3);
  float grid = lines(g, fw, lensBlur(zp));
  // Brighter where the lines cross.
  vec2 fc = abs(fract(g - 0.5) - 0.5) / max(fw * 2.5, vec2(1e-5));
  float cross_ = (1.0 - min(fc.x, 1.0)) * (1.0 - min(fc.y, 1.0)) * smoothstep(0.3, 0.08, max(fw.x, fw.y));
  if (ground) {
    float r = length(flat_ - SPH.xz);
    float reach = exp(-r / PLANET_REACH);
    float near = pool(vec3(flat_.x, 0.0, flat_.y));
    light += PLANET_LIGHT * WORLD.z * (0.25 + 2.2 * grid + 3.0 * cross_) * reach * (1.0 + 2.5 * near);
    // The crown ring's plane, the lock's wave.
    light += WORLD.z * (0.35 * SCAN_LIGHT * scanned(p) * exp(-r / 10.0) + 0.25 * WAVE_GAIN * lockWave(p));
    // The glass's foot: a line of light round it, a faint lit disc in it.
    float foot = sqrt(max(SPH.w * SPH.w - SPH.y * SPH.y, 0.0));
    float x = (r - foot) / 0.11;
    float glass = SHELL_LATENT * SHELLS.x + SHELLS.y;
    light += CONTACT_LIGHT * WORLD.z * (0.5 * glass * exp(-x * x) + 0.12 * SHELLS.y * smoothstep(foot + 0.05, foot - 0.3, r));
    // The planet's edge catches the light.
    float graze = 1.0 - abs(dot(normalize(q), d));
    light += ATMOSPHERE_LIGHT * 0.6 * pow(graze, 10.0) * WORLD.w;
    // Page 03's lantern lights the ground round it, its grid most; the
    // figures' shadows run out from it over the planet.
    if (LAMP.w > 0.0) {
      light += LAMP_GROUND * (0.25 + 2.2 * grid + 3.0 * cross_) * lampMeets(p) * lampOn(p, 0.0);
    }
  }

  // The air: thicker low, so the far ground and the horizon glow.
  float end = min(cut, 90.0);
  float depth = 0.0;
  for (int k = 0; k < 10; k++) {
    float t = (float(k) + 0.5) / 10.0 * end;
    depth += exp(-max(altitude(EYE.xyz + d * t), 0.0) / 2.0);
  }
  depth *= end / 10.0;
  light += ATMOSPHERE_LIGHT * WORLD.w * (1.0 - exp(-depth / 22.0));
  if (!ground) {
    // A thin bright line just over the horizon, and the sky's band.
    vec3 c = EYE.xyz - planetCentre();
    float b = dot(c, d);
    float miss = b < 0.0 ? sqrt(max(dot(c, c) - b * b, 0.0)) - PLANET_RADIUS : 1e3;
    light += ATMOSPHERE_LIGHT * WORLD.w * 0.8 * exp(-miss / 0.35);
    vec3 axis = normalize(vec3(0.42, 0.62, -0.66));
    float across = dot(d, axis) / 0.24;
    float clouds = 0.55 + 0.45 * sin(dot(d, vec3(5.1, 1.7, 3.3)) + 1.3) * sin(dot(d, vec3(-2.3, 4.4, 6.1)));
    light += NEBULA_LIGHT * WORLD.w * exp(-across * across) * clouds;
  }

  // The glass.
  vec2 outer = throughSphere(EYE.xyz, d, SPH.xyz, SPH.w);
  vec2 inner = throughSphere(EYE.xyz, d, SPH.xyz, SPH.w - SHELL);
  bool crossesIn = inner.x <= inner.y;
  // Its grid, at the front and the back of the shell, turning with its
  // ring.
  float spin = -RX(2).y;
  vec3 front = EYE.xyz + d * outer.x - SPH.xyz;
  vec3 back = EYE.xyz + d * outer.y - SPH.xyz;
  float cell = PI / 12.0;
  vec2 gf = vec2(atan(front.x, front.z) + spin, asin(clamp(front.y / SPH.w, -1.0, 1.0))) / cell;
  vec2 gb = vec2(atan(back.x, back.z) + spin, asin(clamp(back.y / SPH.w, -1.0, 1.0))) / cell;
  vec2 fwf = vec2(min(fwidth(gf.x), fwidth(mod(gf.x + 12.0, 24.0))), fwidth(gf.y));
  vec2 fwb = vec2(min(fwidth(gb.x), fwidth(mod(gb.x + 12.0, 24.0))), fwidth(gb.y));
  if (outer.x <= outer.y) {
    float lenFront = crossesIn ? span(outer.x, inner.x, cut) : span(outer.x, outer.y, cut);
    float lenBack = crossesIn ? span(inner.y, outer.y, cut) : 0.0;
    vec3 mf = EYE.xyz + d * (crossesIn ? 0.5 * (outer.x + inner.x) : 0.5 * (outer.x + outer.y));
    vec3 mb = EYE.xyz + d * 0.5 * (inner.y + outer.y);
    float glass = SHELL_LATENT * SHELLS.x + SHELLS.y;
    // From inside, only the far wall is there to see: give it the light.
    float inside = smoothstep(SPH.w, SPH.w - 0.3, length(EYE.xyz - SPH.xyz));
    light += SHELL_LIGHT * (lenFront * shellLight(mf) + mix(0.55, 1.0, inside) * lenBack * shellLight(mb));
    float zf = max(dot(front + SPH.xyz - EYE.xyz, FWD.xyz), 0.3);
    float zb = max(dot(back + SPH.xyz - EYE.xyz, FWD.xyz), 0.3);
    float seenFront = outer.x > 0.0 && outer.x < cut ? 1.0 : 0.0;
    float seenBack = outer.y > 0.0 && outer.y < cut ? 1.0 : 0.0;
    light += SHELL_GRID * glass * (seenFront * lines(gf, fwf, lensBlur(zf)) + mix(0.4, 5.0, inside) * seenBack * lines(gb, fwb, lensBlur(zb)));
    // The air inside it, lit as it fills.
    if (crossesIn) {
      float chord = span(inner.x, inner.y, cut);
      float filled = 0.4 * SHELLS.y * min(SHELLS.z / PI, 1.0);
      light += GLASS_FOG * chord * (0.12 * SHELLS.x + filled);
    }
    // The lantern lights the glass and its grid where it sees the flame,
    // the figure's shadow falls on its far wall, and the flame glints on
    // it, outside and in.
    if (LAMP.w > 0.0) {
      float lf = lampOn(mf, 0.0);
      float lb = lampOn(mb, 0.0);
      float gridF = seenFront * lines(gf, fwf, lensBlur(zf));
      float gridB = seenBack * lines(gb, fwb, lensBlur(zb));
      light += LAMP_GLASS * (SHELL_LIGHT * (lenFront * lf + mix(0.55, 1.0, inside) * lenBack * lb)
                           + SHELL_GRID * (lf * gridF + mix(0.4, 5.0, inside) * lb * gridB));
      vec3 hf = normalize(normalize(LAMP.xyz - front - SPH.xyz) - d);
      vec3 hb = normalize(normalize(LAMP.xyz - back - SPH.xyz) - d);
      float glintF = pow(max(dot(normalize(front), hf), 0.0), 600.0);
      float glintB = pow(max(-dot(normalize(back), hb), 0.0), 600.0);
      light += LAMP_GLINT * (seenFront * lf * glintF + 0.5 * seenBack * lb * glintB);
    }
  }
  // The air round the lantern glows.
  if (LAMP.w > 0.0) {
    vec3 c = LAMP.xyz - EYE.xyz;
    float tc = dot(c, d);
    float k = sqrt(LAMP_MIST * LAMP_MIST + max(dot(c, c) - tc * tc, 0.0));
    light += LAMP_AIR * LAMP.w * LAMP_MIST * LAMP_MIST / k * (atan((end - tc) / k) + atan(tc / k));
  }
  o = vec4(u_glow * light, 0.0);
}
