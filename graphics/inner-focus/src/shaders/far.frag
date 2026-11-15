// The far layer: the city across the river at the blue hour (the sky, two
// rows of houses with their windows, the bell tower, the bridge and its
// train, the embankment), the river before it holding the city and the
// first ring, the gulls and the bell's ringing. All of it is far enough for
// one focus; the blur pass melts it while the focus is on him. The lamps,
// the first ring itself and its runners are lights: the composite draws
// them, as points or as discs of light (here only their reflections).

uniform vec4 u_bell;    // the belfry in the frame, the bell's light, how long since it was struck
uniform vec4 u_train;   // the train's head (azimuth), its way
uniform vec4 u_gull[6]; // x, y, size (frame units), wings

// The river's surface, below the deck.
#define WATER -0.5

// ---------- noise that repeats every `period` cells across x
float pnoise(vec2 p, float period) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float x0 = mod(i.x, period);
  float x1 = mod(i.x + 1.0, period);
  float y = i.y + 4096.0;
  float a = hash2(vec2(x0, y), 3u);
  float b = hash2(vec2(x1, y), 3u);
  float c = hash2(vec2(x0, y + 1.0), 3u);
  float d = hash2(vec2(x1, y + 1.0), 3u);
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
// Its octaves about 0, each one fading out as it gets finer than a pixel
// (`fw`: a pixel in cells of the first octave). Each octave doubles the
// scale and the period, so the whole repeats every `period` of p.x.
float pfbm(vec2 p, float period, float fw) {
  float s = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    s += a * (1.0 - smoothstep(0.2, 0.7, fw)) * (pnoise(p, period) - 0.5);
    p = p * 2.0 + vec2(17.0, 9.2);
    period *= 2.0;
    fw *= 2.0;
    a *= 0.5;
  }
  return s / 0.9375;
}

// ---------- the city: a way into it is (azimuth, height), `pa` a pixel there
// A row of houses (front or back) `n` to a radian: how much of the pixel it
// covers, its edges and roofs a pixel soft.
float row(float az, float h, vec2 pa, bool front) {
  float n = front ? FRONT_ROW : BACK_ROW;
  float x = az * n + (front ? 0.0 : 0.37);
  float c = floor(x);
  float u = x - c;
  float w = max(pa.x * n, 1e-4);
  float k0 = front ? roofOf(c) : backOf(c);
  float kl = front ? roofOf(c - 1.0) : backOf(c - 1.0);
  float kr = front ? roofOf(c + 1.0) : backOf(c + 1.0);
  float wl = clamp(0.5 - u / w, 0.0, 0.5);
  float wr = clamp(0.5 - (1.0 - u) / w, 0.0, 0.5);
  return cover(h, -1.0, k0, pa.y) * (1.0 - wl - wr) + cover(h, -1.0, kl, pa.y) * wl + cover(h, -1.0, kr, pa.y) * wr;
}
// The lit windows of the houses: 240 to a radian across, 85 to a unit of
// height; some houses have more lit than others, and now and then one goes
// on or off (six times a loop, each at its own moment).
float windows(float az, float h, vec2 pa, float roof, uint seed, float share) {
  if (h < 0.009 || h > roof - 0.004) return 0.0;
  vec2 g = vec2(az * 240.0, h * 85.0);
  vec2 cell = floor(g);
  vec2 u = g - cell;
  vec2 pc = max(pa * vec2(240.0, 85.0), vec2(1e-4));
  float ink = cover(u.x, 0.3, 0.7, pc.x) * cover(u.y, 0.28, 0.68, pc.y);
  if (ink <= 0.0) return 0.0;
  float house = floor(az * FRONT_ROW);
  float share2 = share * (0.35 + 1.3 * hash1(house, seed + 1u));
  float lit = step(hash2(cell, seed + 2u), share2);
  if (hash2(cell, seed + 3u) < 0.06) {
    float k = mod(floor(time / LOOP_SECONDS * 6.0 + hash2(cell, seed + 4u) * 6.0), 6.0);
    lit = step(hash2(cell + vec2(0.0, 131.0 * (k + 1.0)), seed + 5u), 0.5);
  }
  return lit * ink * (0.55 + 0.45 * hash2(cell, seed + 6u));
}
// The bell tower: how much of the pixel it covers; how much of it is the
// openings of its bell chamber, and its clock.
float tower(float az, float h, vec2 pa, out float chamber, out float clock) {
  float x = abs(az - TOWER_AZ);
  chamber = 0.0;
  clock = 0.0;
  if (x > 0.02 || h > 0.23) return 0.0;
  float top = BELFRY.y + 0.006;
  float w = 0.0092;
  if (h > BELFRY.x - 0.004 && h < BELFRY.x) w = 0.0108; // a ledge under the chamber
  if (h > BELFRY.y && h < top) w = 0.0108;              // the cornice over it
  if (h >= top) w = 0.0085 * clamp(1.0 - (h - top) / 0.058, 0.0, 1.0); // the spire
  float body = cover(x, -1.0, w, pa.x) * cover(h, -1.0, top + 0.058, pa.y);
  // Two arched openings, and a clock face below.
  vec2 p = vec2(x - 0.0042, h);
  float d = length(vec2(p.x, p.y - clamp(p.y, BELFRY.x + 0.0055, BELFRY.y - 0.004))) - 0.0026;
  chamber = clamp(0.5 - d / max(pa.x, 1e-5), 0.0, 1.0);
  float r = length(vec2(az - TOWER_AZ, h - 0.106));
  clock = clamp(0.5 - abs(r - 0.0045) / max(pa.x, 1e-5) + 0.35, 0.0, 1.0) * step(r, 0.006);
  return body;
}
// The bridge: arches between piers, the deck over them.
float bridge(float az, float h, vec2 pa) {
  if (az < BRIDGE.x - 0.01 || az > BRIDGE.y + 0.01 || h > 0.05) return 0.0;
  float u = (az - BRIDGE.x) / 0.1;
  float f = fract(u);
  float arch = 0.009 + 0.024 * sqrt(max(1.0 - sq(2.0 * f - 1.0), 0.0));
  float deck = cover(h, arch, 0.042, pa.y);
  float pier = cover(min(f, 1.0 - f) * 0.1, -1.0, 0.0035, pa.x) * cover(h, -1.0, 0.042, pa.y);
  float rail = cover(h, 0.0428, 0.0446, pa.y) * (0.6 + 0.4 * cover(fract(az / 0.006), 0.0, 0.25, pa.x / 0.006));
  float span = cover(az, BRIDGE.x - 0.0035, BRIDGE.y + 0.0035, pa.x);
  return max(max(deck, pier), rail) * span;
}
// The train on the bridge: its cars, their lit windows, its head lamp.
float trainOn(float az, float h, vec2 pa, out float lit) {
  lit = 0.0;
  float head = u_train.x;
  float way = u_train.y;
  float tail = head - way * TRAIN_LENGTH;
  float lo = max(min(head, tail), BRIDGE.x);
  float hi = min(max(head, tail), BRIDGE.y);
  if (hi <= lo || h < 0.04 || h > 0.056) return 0.0;
  float s = (head - az) * way; // how far behind the head
  float car = fract(s / 0.04);
  float body = cover(az, lo, hi, pa.x) * cover(h, 0.0428, 0.0535, pa.y) * cover(car * 0.04, 0.0012, 0.04, pa.x);
  float wu = fract(s / 0.0055);
  float wn = floor(s / 0.0055);
  lit = body * cover(wu * 0.0055, 0.0014, 0.0041, pa.x) * cover(h, 0.0465, 0.0508, pa.y) * step(hash1(wn, 31u), 0.85);
  // The head lamp, while the head is on the bridge.
  if (head > BRIDGE.x && head < BRIDGE.y) {
    vec2 d = vec2(az - head, h - 0.046) / max(pa.x, 1e-5);
    lit += 1.4 * exp(-dot(d, d) / 2.0);
  }
  return body;
}

// The city's way (az, h): the sky, the houses, the tower, the bridge, the
// embankment.
vec3 above(float az, float h, vec2 pa) {
  // The blue hour: the sky light low down, the city's glow over it.
  vec3 c = mix(bg * 1.9 + u_cold * 0.1, bg * 0.92 + u_cold * 0.02, smoothstep(0.0, 0.5, h));
  c += u_pale * 0.035 * exp(-max(h, 0.0) / 0.07);
  vec3 lamp = mix(u_pale, u_cold, 0.2);
  // The row behind, in the haze, a few dim windows.
  float k2 = row(az, h, pa, false);
  if (k2 > 0.0) {
    float roof = backOf(floor(az * BACK_ROW + 0.37));
    vec3 houses = bg * 1.22 + u_cold * 0.035 + lamp * 0.16 * windows(az, h, pa, roof, 40u, 0.12);
    c = mix(c, houses, k2);
  }
  // The front row with its windows.
  float k1 = row(az, h, pa, true);
  if (k1 > 0.0) {
    float roof = roofs(az);
    vec3 houses = bg * 0.62 + u_cold * 0.01 + lamp * 0.42 * windows(az, h, pa, roof, 50u, 0.27);
    c = mix(c, houses, k1);
  }
  // The bell tower, its chamber lit when the bell rings.
  float chamber;
  float clock;
  float kt = tower(az, h, pa, chamber, clock);
  if (kt > 0.0) {
    vec3 t = bg * 0.55 + u_cold * 0.012;
    t = mix(t, bg * 0.4 + u_pale * (0.12 + 0.6 * u_bell.z), chamber);
    t += u_pale * 0.13 * clock;
    c = mix(c, t, kt);
  }
  // A glow round the chamber while the bell sounds.
  vec2 bd = vec2(az - TOWER_AZ, h - 0.5 * (BELFRY.x + BELFRY.y));
  c += u_pale * 0.1 * u_bell.z * exp(-length(bd) / 0.012);
  // The bridge and the train on it.
  float kb = bridge(az, h, pa);
  if (kb > 0.0) c = mix(c, bg * 0.5 + u_cold * 0.015, kb);
  float trainLit;
  float kr = trainOn(az, h, pa, trainLit);
  if (kr > 0.0 || trainLit > 0.0) {
    c = mix(c, bg * 0.45, kr);
    c += u_pale * 0.6 * trainLit;
  }
  // The embankment: a wall over the water, lit under its lamps.
  if (h < 0.006) {
    float i = floor(az / LAMP_STEP + 0.5);
    float pool = lampLight(i) * exp(-sq((az - i * LAMP_STEP) / 0.006));
    vec3 wall = bg * 0.48 + u_pale * 0.07 * pool;
    wall += bg * 0.5 * cover(h, 0.0042, 0.0052, pa.y);
    c = mix(c, wall, cover(h, -1.0, 0.0052, pa.y));
  }
  return c;
}

// ---------- in the frame
// A gull: two wings, each from the body to the wrist to the tip.
float gull(vec2 f, vec4 g) {
  vec2 p = (f - g.xy) / g.z;
  if (abs(p.x) > 1.3 || abs(p.y) > 1.0) return 0.0;
  p.x = abs(p.x);
  vec2 wrist = vec2(0.45, 0.12 + 0.15 * g.w);
  vec2 tip = vec2(1.0, 0.05 + 0.55 * g.w);
  float d = min(segd(p, vec2(0.0), wrist), segd(p, wrist, tip));
  d = min(d, length(p / vec2(1.6, 1.0)) - 0.05);
  return line(max(d, 0.0) * g.z / pixel, 0.65 * px800());
}
// The bell's ringing: three arcs either side of the belfry, going out.
float ringing(vec2 f) {
  if (u_bell.z < 0.003) return 0.0;
  vec2 p = f - u_bell.xy;
  float r = length(p);
  float side = (1.0 - smoothstep(0.5, 0.75, abs(atan(p.y, abs(p.x)))));
  float c = 0.0;
  for (int k = 0; k < 3; k++) {
    float rk = 0.075 * (0.4 + 0.45 * float(k) + 0.6 * u_bell.w);
    c += line(abs(r - rk) / pixel, 0.6 * px800()) * (1.0 - 0.25 * float(k));
  }
  return c * side * u_bell.z;
}

void main() {
  vec2 frag = gl_FragCoord.xy;
  setup(frag);
  vec2 f = frameAt(frag);
  vec3 ro = u_eye.xyz;
  vec3 rd = rayAt(f);
  // Every way at every pixel, so a pixel's size on each comes from its
  // neighbours: into the city, onto the river, back up from it.
  vec2 ch = cityAt(rd);
  vec2 pa = max(fwidth(ch), vec2(1e-6));
  float down = min(rd.y, -1e-4);
  float tW = (WATER - ro.y) / down;
  vec3 pw = ro + rd * tW;
  float dist = min(length(pw.xz), FAR_BANK);
  vec2 wq = vec2(ch.x * 90.0 + time * 1.6, log(max(dist, 1.0)) * 8.0);
  vec2 fw = fwidth(wq);
  float slope = -down / length(rd.xz);
  float hR = (WATER + slope * max(FAR_BANK - dist, 0.0)) / FAR_BANK;
  vec2 paR = max(fwidth(vec2(ch.x, hR)), pa);
  vec3 up = vec3(rd.x, slope * length(rd.xz), rd.z);
  float pxR = max(fwidth(firstRing(pw, normalize(up)).x), 1e-4);

  // The river shivers: the way back up from it is bent by the ripples.
  bool water = ch.y < 0.0;
  float n1 = 0.0;
  float n2 = 0.0;
  if (water) {
    float fwm = max(fw.x, fw.y);
    n1 = pfbm(wq, 96.0, fwm);
    n2 = pfbm(wq + vec2(13.0, 7.3), 96.0, fwm);
  }
  float az = water ? ch.x + 0.0025 * n2 : ch.x;
  float h = water ? max(hR + 0.016 * n1, 0.0) : ch.y;
  vec3 city = above(az, h, water ? paR : pa);

  vec3 col = city;
  if (water) {
    // The river: dark, holding the city, more of it the lower the way
    // comes in.
    float fres = mix(0.3, 0.88, exp(-slope / 0.08));
    col = bg * 0.42 + u_cold * 0.012 + city * fres * 0.85;
    // The lamps' light broken into streaks: the embankment's, the bridge's.
    vec3 lampC = mix(u_pale, u_cold, 0.2);
    float st = 0.0;
    float i0 = floor(az / LAMP_STEP + 0.5);
    for (int k = -1; k <= 1; k++) {
      float i = i0 + float(k);
      vec2 d = vec2((az - i * LAMP_STEP) / paR.x / 1.6, (h - LAMP_HEIGHT) / 0.006);
      st += lampLight(i) * exp(-dot(d, d));
    }
    if (az > BRIDGE.x - 0.03 && az < BRIDGE.y + 0.03) {
      float j = clamp(floor((az - BRIDGE_LAMPS.x) / BRIDGE_LAMPS.y + 0.5), 0.0, 9.0);
      vec2 d = vec2((az - BRIDGE_LAMPS.x - j * BRIDGE_LAMPS.y) / paR.x / 1.6, (h - BRIDGE_LAMPS.z) / 0.008);
      st += 0.8 * exp(-dot(d, d));
    }
    col += lampC * 0.55 * st * fres;
    // The first ring in the river, and its runners' tails.
    vec3 rg = firstRing(pw, normalize(up + vec3(0.004 * n2, 0.03 * n1, 0.0)));
    if (rg.z > 0.0) {
      float dpx = rg.x / pxR;
      float tail = exp(-behindRunner(rg.y) / 0.115);
      col += (u_cold * line(dpx, 1.1 * px800()) + mix(u_cold, u_pale, 0.45) * tail * line(dpx, 1.6 * px800()))
           * 0.4 * u_ring2.w * fres;
    }
  }
  // The gulls over the water, and the bell's ringing.
  float g = 0.0;
  for (int i = 0; i < 6; i++) g = max(g, gull(f, u_gull[i]));
  col = mix(col, u_pale * 0.55 + bg * 0.3, g);
  col += u_pale * 0.7 * ringing(f);
  col += (hash2(frag * 1.37 + 0.5, 0u) - 0.5) / 255.0;
  o = vec4(clamp(col, 0.0, 1.0), 1.0);
}
