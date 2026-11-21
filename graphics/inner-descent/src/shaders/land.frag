// The land at night below the clouds (metres): his feet at y = 0, the
// ground at y = -height. Ploughed fields, a river, a railway with a night
// train, a road with cars from the village to the city, woods, the farm and
// trees on the horizon once he is low, the cloud deck he has fallen
// through, the dawn on one side. Alpha marks him.

uniform vec4 u_light; // dawn, moon, cloud cover, aurora
uniform vec4 u_storm; // the storm on the map (x, y), its flash, the train's head

// The dawn: the warm of the theme, but the code green in Матрица (amber on
// its green dark reads olive).
#define DAWN mix(WARM, SKY, u_dusk.w)
#define RE 6371.0
const float DAWNAZ = -2.4;
const vec2 CITY = vec2(-4800.0, -5600.0);
const vec2 VIL = vec2(-1500.0, -700.0);
const vec3 MOON = vec3(-0.35, 0.42, -0.84);

// A ray from altitude h (km) to the shell at altitude hs (km): the nearest
// hit, or -1.
float sphT(float h, float hs, vec3 rd) {
  float c = (h - hs) * (2.0 * RE + h + hs);
  float bp = -(RE + h) * rd.y;
  float disc = bp * bp - c;
  if (disc < 0.0) return -1.0;
  if (c > 0.0) return bp > 0.0 ? c / (bp + sqrt(disc)) : -1.0;
  return bp + sqrt(disc);
}
float dawnK(float az) {
  float d = az - DAWNAZ;
  d = atan(sin(d), cos(d));
  return exp(-d * d / 0.6);
}
vec3 hazeCol(float az) {
  return BG * 1.4 + SKY * 0.03 + u_light.x * DAWN * 0.12 * dawnK(az);
}
vec3 landSky(vec3 rd, float hk) {
  float az = atan(rd.z, rd.x);
  float el = asin(clamp(rd.y, -1.0, 1.0));
  float up = max(el + sqrt(2.0 * max(hk, 0.001) / RE), 0.0);
  vec3 sky = mix(hazeCol(az), BG * 0.62, smoothstep(0.0, 0.45, up));
  // The stars, kept to at least about a pixel and dimmed as they widen.
  vec2 sp = vec2(az, el) * 160.0;
  vec2 id = floor(sp);
  vec2 f = fract(sp) - 0.5 - (vec2(hs(id, 0.0), hs(id, 3.3)) - 0.5) * 0.7;
  float rr = max(0.012, sq(0.7 * pxA * 160.0));
  float st = step(0.9, hs(id, 9.1)) * exp(-dot(f, f) / rr) * 0.012 / rr * (0.3 + 0.7 * hs(id, 4.4));
  sky += PALE * 0.75 * st * smoothstep(0.03, 0.25, up) * (1.0 - 0.85 * u_light.x);
  vec3 md = normalize(MOON);
  float mAng = acos(clamp(dot(rd, md), -1.0, 1.0));
  sky += u_light.y * PALE * (0.7 * smoothstep(0.013, 0.011, mAng) + 0.05 * exp(-mAng / 0.08) + 0.025 * exp(-mAng / 0.5));
  float dk = dawnK(az);
  sky += u_light.x * (DAWN * 0.55 * exp(-up / 0.045) * dk + DAWN * 0.14 * exp(-up / 0.22) * sqrt(dk) + SKY * 0.06 * exp(-up / 0.4));
  float ca = atan(CITY.y, CITY.x) - az;
  ca = atan(sin(ca), cos(ca));
  sky += PALE * 0.05 * exp(-up / 0.03) * exp(-ca * ca / 0.05);
  return sky;
}
// Points of light on a grid (cell g metres, share pr, radius r), averaged
// once a pixel covers many.
float lamps(vec2 q, vec2 g, float pr, float r, float fp, float seed, float jit) {
  vec2 id = floor(q / g);
  vec2 f = (fract(q / g) - 0.5) * g;
  vec2 off = (vec2(hs(id, seed + 1.3), hs(id, seed + 2.7)) - 0.5) * g * jit;
  float rr = max(r, fp * 0.8);
  vec2 d = f - off;
  float disc = step(hs(id, seed), pr) * exp(-dot(d, d) / (rr * rr)) * (r * r) / (rr * rr);
  float avg = pr * PI * r * r / (g.x * g.y);
  return mix(disc, avg, smoothstep(0.3, 0.9, fp / min(g.x, g.y)));
}
vec3 landGround(vec2 q, float t, vec3 rd, float hk) {
  float fpa = t * pxA;
  float fpb = fpa / max(-rd.y, 0.05);
  vec2 cs = vec2(260.0, 190.0);
  vec2 qq = q + cs * 0.5 + smoothstep(150.0, 400.0, length(q)) * 160.0 * (vec2(fbm(q / 900.0), fbm(q / 900.0 + 5.0)) - 0.5);
  vec2 ci = floor(qq / cs);
  float hc = hs(ci, 0.7);
  bool mine = ci.x == 0.0 && ci.y == 0.0;
  vec3 c = BG * (0.6 + 0.3 * hc) * (0.7 + 0.6 * fbm(q / 300.0)) * (0.85 + 0.3 * vnoise2(q / 40.0));
  // Furrows, ploughed field by field in different directions.
  float fa = mine ? DAWNAZ : floor(hc * 4.0) * 0.785;
  vec2 fd = vec2(cos(fa), sin(fa));
  float ph = dot(q, vec2(-fd.y, fd.x)) * TAU / 0.7 + (mine ? 0.25 * vnoise2(q * 0.5) : 0.6 * sin(dot(q, fd) * 0.15) + 1.6 * vnoise2(q * 0.5));
  float fur = 0.9 * (2.0 * pow(abs(cos(ph * 0.5)), 0.6) - 1.0) + 0.5 * (vnoise2(q * 5.0) - 0.5) + 0.5 * (vnoise2(q * 11.0) - 0.5) * smoothstep(0.06, 0.015, fpa);
  float fv = smoothstep(0.32, 0.07, fpb) * (mine ? 1.0 : step(0.35, fract(hc * 7.0)));
  c *= 1.0 + 0.45 * fur * fv;
  c += PALE * 0.03 * u_light.y * max(fur, 0.0) * fv + DAWN * 0.06 * u_light.x * smoothstep(0.2, 1.0, fur) * fv;
  float cl = smoothstep(0.05, 0.01, fpa);
  c *= 1.0 + cl * (0.6 * vnoise2(q * 11.0) - 0.3);
  c *= 0.75 + 0.5 * mix(vnoise2(q * 2.6), 0.5, smoothstep(0.08, 0.4, fpa));
  // Water standing in some furrows holds the sky.
  float wet = fv * smoothstep(-0.6, -0.85, fur) * step(0.58, vnoise2(vec2(floor(ph / TAU) * 3.7, dot(q, fd) / 5.0)));
  if (wet > 0.0) c = mix(c, landSky(reflect(rd, vec3(0.0, 1.0, 0.0)), hk) * 0.8, wet);
  // Field edges and hedges.
  vec2 fe = cs * 0.5 - abs(fract(qq / cs) - 0.5) * cs;
  c = mix(c, BG * 0.3, smoothstep(2.0 + fpa, 0.5, min(fe.x, fe.y)) * 0.6);
  // Woods.
  float forest = smoothstep(0.6, 0.63, fbm(q / 900.0 + 3.0)) * smoothstep(350.0, 600.0, length(q));
  c = mix(c, BG * 0.3 * (0.8 + 0.4 * vnoise2(q / 6.0)), forest);
  // The river.
  float zr = -2400.0 + 380.0 * sin(q.x / 1300.0) + 140.0 * sin(q.x / 420.0 + 1.0);
  float river = smoothstep(32.0 + fpa, 28.0, abs(q.y - zr));
  if (river > 0.0) {
    vec3 nw = normalize(vec3((vnoise2(q * 0.4) - 0.5) * 0.08, 1.0, (vnoise2(q * 0.4 + 7.0) - 0.5) * 0.3));
    c = mix(c, landSky(reflect(rd, nw), hk) * 0.85, river);
  }
  // The railway and a night train.
  vec2 tdir = normalize(vec2(1.0, 0.6));
  vec2 tv = q - vec2(0.0, -520.0);
  float ta = dot(tv, tdir);
  float tcx = dot(tv, vec2(-tdir.y, tdir.x));
  c = mix(c, BG * 0.4, smoothstep(2.0 + fpa, 1.0, abs(tcx)) * 0.7);
  float lit = 0.0;
  if (ta > u_storm.w - 330.0 && ta < u_storm.w) {
    c = mix(c, BG * 0.5, smoothstep(2.2 + fpa, 1.5, abs(tcx)));
    lit += 10.0 * step(0.15, fract(ta / 24.0)) * step(0.3, fract(ta / 2.0)) * smoothstep(1.8 + fpa, 1.0, abs(tcx));
  }
  // The road from the village to the city, cars on it.
  vec2 rdir = normalize(CITY - VIL);
  vec2 rv = q - VIL;
  float along = dot(rv, rdir);
  float across = dot(rv, vec2(-rdir.y, rdir.x));
  float onRoad = step(-400.0, along) * step(along, 7000.0);
  c = mix(c, BG * 1.05, smoothstep(4.0 + fpa, 3.0, abs(across)) * 0.8 * onRoad);
  lit += 9.0 * onRoad * step(abs(across), 20.0) * lamps(vec2(along - time * 20.0, across + 20.0), vec2(240.0, 40.0), 1.0, 1.4, fpa, 5.0, 0.0);
  // The village and the city.
  float win = 30.0 * onRoad * step(abs(across - 14.0), 20.0) * lamps(vec2(along, across + 6.0), vec2(70.0, 40.0), 1.0, 0.8, fpa, 31.0, 0.0);
  vec2 vq = q - VIL;
  float va = dot(vq, rdir);
  float vc = dot(vq, vec2(-rdir.y, rdir.x));
  float street = max(smoothstep(45.0, 25.0, abs(vc)) * smoothstep(420.0, 300.0, abs(va)),
                     smoothstep(45.0, 25.0, abs(va - 60.0)) * smoothstep(300.0, 200.0, abs(vc)));
  win += 40.0 * lamps(q, vec2(16.0), 0.55 * street, 0.9, fpa, 11.0, 0.5);
  float city = smoothstep(3600.0, 900.0, length(q - CITY) + 700.0 * (fbm(q / 1500.0) - 0.5));
  win += city * (30.0 * (lamps(q, vec2(30.0, 110.0), 0.92, 1.3, fpa, 21.0, 0.0) + lamps(q, vec2(110.0, 30.0), 0.92, 1.3, fpa, 23.0, 0.0))
               + 18.0 * lamps(q, vec2(22.0), 0.35, 1.0, fpa, 27.0, 0.7) + 0.06);
  c += PALE * lit + mix(WARM, PALE, 0.3) * win;
  // Where he stands the soil is pressed down.
  if (u_scene.x < 0.1) c *= 1.0 - 0.6 * exp(-dot(q, q) / 0.1);
  return mix(c, hazeCol(atan(rd.z, rd.x)), 1.0 - exp(-t / (6000.0 + 8000.0 * hk)));
}
// The cloud deck at 2.45 km: colour and cover.
vec4 clouds(vec3 ro, vec3 rd, float hk, float tg) {
  if (u_light.z <= 0.0) return vec4(0.0);
  float tc = sphT(hk, 2.45, rd);
  if (tc < 0.0 || (tg > 0.0 && tc > tg)) return vec4(0.0);
  float tm = tc * 1000.0;
  vec2 qc = ro.xz + rd.xz * tm;
  float n = 0.8 * fbm(qc / 2600.0 + vec2(4.0, 1.0)) + 0.3 * fbm(qc / 600.0 + 2.0);
  float th = 0.82 - 0.4 * u_light.z;
  float dens = smoothstep(th, th + 0.14, n);
  float az = atan(rd.z, rd.x);
  vec3 c = BG * 0.8 + PALE * 0.035 * fbm(qc / 350.0);
  c += PALE * 0.07 * exp(-length(qc - CITY) / 3000.0);
  c += u_light.y * PALE * 0.06 * (1.0 - smoothstep(th, th + 0.3, n));
  c += u_light.x * DAWN * (0.25 * dawnK(az) + 0.05) * (1.2 - 0.6 * dens);
  c += mix(PALE, COLD, 0.4) * 1.2 * u_storm.z * exp(-length(qc - u_storm.xy) / 1400.0);
  float far = 1.0 - exp(-tm / 40000.0);
  return vec4(mix(c, hazeCol(az), far), dens * (1.0 - 0.6 * far));
}
// Him on the land in his helmet: moonlight, the dawn on one side, the
// land's sky in his visor, his face behind it lit by his voice.
vec3 manLand(vec3 ro, vec3 rd, float tb, float hk) {
  vec3 ph = ro + rd * tb;
  vec3 n = nrmB(ph);
  float oc = aoB(ph, n);
  vec3 q = loc(ph);
  vec3 md = normalize(MOON);
  vec3 dd = normalize(vec3(cos(DAWNAZ), 0.12, sin(DAWNAZ)));
  float sun = u_light.x;
  float rim = pow(1.0 - abs(dot(n, -rd)), 3.0);
  vec3 kd = normalize(vec3(0.6, 0.45, 0.66));
  vec3 col = BG * 1.4 * (0.5 + 0.5 * oc) + mix(COLD, PALE, 0.5) * 0.3 * max(dot(n, kd), 0.0) * oc + PALE * 0.22 * u_light.y * max(dot(n, md), 0.0) * oc + COLD * 0.05 * max(n.y, 0.0) * oc
    + PALE * 0.06 * max(-n.y, 0.0) * oc * (1.0 - sun);
  col += DAWN * 0.5 * sun * max(dot(n, dd), 0.0) * oc;
  col += mix(COLD, PALE, 0.4) * 0.28 * rim + DAWN * 0.3 * sun * rim * max(dot(n, dd) + 0.4, 0.0);
  int w = worn(q);
  if (w >= 0) {
    // Himself out of the suit, in his own clothes, warmed by the dawn; his
    // mouth lit by his voice.
    vec3 warmth = DAWN * (0.07 + 0.14 * sun) * oc;
    if (w == 0) return col * 0.66 + warmth + WARM * 0.5 * max(u_scene.w - 0.35, 0.0) * exp(-length(q - vec3(0.0, 1.668, 0.09)) / 0.035);
    if (w == 1) return col * 0.28 + 0.3 * warmth;
    if (w == 4) return (col * 0.24 + PALE * 0.05 * rim) * (q.y < 0.024 ? 0.45 : 1.0);
    if (w == 3) return col * 0.4 * mix(vec3(1.0), COLD / max(max(COLD.r, COLD.g), max(COLD.b, 0.001)), 0.35) + 0.4 * warmth;
    vec3 tint = mix(vec3(1.0), WARM / max(max(WARM.r, WARM.g), max(WARM.b, 0.001)), 0.5);
    float knit = 0.88 + 0.12 * vnoise2(q.xy * vec2(140.0, 70.0) + q.z * 50.0);
    return col * 0.58 * tint * knit + 0.6 * warmth;
  }
  float seam = smoothstep(0.012, 0.0, abs(q.y - 0.98)) + smoothstep(0.01, 0.0, abs(q.y - 0.55)) + smoothstep(0.01, 0.0, abs(q.y - 1.23));
  col *= 1.0 - 0.35 * min(seam, 1.0);
  vec3 hq = q - HELM;
  if (length(hq) < 0.204 && length(hq) > 0.19) {
    vec3 hn = normalize(hq);
    if (onVisor(hn)) col = visor(ph, rd, n, hn, landSky(reflect(rd, n), hk), col);
  }
  // The burning edge: hot where it eats the suit, a glow just under it.
  if (u_suit.x < 2.1) {
    float b = min(burn(q), 0.0);
    float e = u_suit.y * exp(b / 0.045);
    col = col * (1.0 - 0.6 * u_suit.y * exp(b / 0.09)) + DAWN * 2.4 * e + PALE * 0.9 * e * e * e;
  }
  return col;
}
vec3 land(vec3 ro, vec3 rd, float tb) {
  float lift = u_scene.x;
  float hk = (lift + ro.y) / 1000.0;
  if (tb > 0.0) return manLand(ro, rd, tb, hk);
  float tg = sphT(hk, 0.0, rd);
  vec3 col = tg > 0.0 ? landGround(ro.xz + rd.xz * tg * 1000.0, tg * 1000.0, rd, hk) : landSky(rd, hk);
  float eyeH = lift + ro.y;
  if (eyeH < 40.0 && (tg < 0.0 || tg * 1000.0 > 340.0)) {
    // The trees and the farm on the horizon, a few windows lit.
    const float DL = 340.0;
    const float FARM = -2.85;
    float az = atan(rd.z, rd.x);
    float el = rd.y / length(rd.xz);
    float gap = smoothstep(0.35, 0.55, fbm(vec2(az * 5.0, 3.0)));
    float tree = (7.0 + 9.0 * fbm(vec2(az * 70.0, 1.0)) + 3.0 * vnoise2(vec2(az * 400.0, 2.0))) * gap;
    float fa = az - FARM;
    fa = atan(sin(fa), cos(fa));
    float house = step(abs(fa), 0.022) * 9.0;
    house = max(house, step(abs(fa - 0.04), 0.01) * 10.0);
    house = max(house, step(abs(fa + 0.035), 0.008) * 5.0);
    float roof = step(abs(fa), 0.022) * (6.0 + 3.0 * (1.0 - abs(fa) / 0.022));
    float hgt = max(max(tree, house), roof);
    float top = (hgt - eyeH) / DL;
    float base = -eyeH / DL - 0.002;
    if (el < top && el > base) {
      vec3 sil = mix(BG * 0.35, hazeCol(az), 0.25);
      float wy = el * DL + eyeH;
      float win = step(abs(fa), 0.02) * step(2.0, wy) * step(wy, 3.4) * step(0.45, fract(fa / 0.008)) * step(0.4, hash1(floor(fa / 0.008), 7u));
      win = max(win, step(abs(fa + 0.035), 0.006) * step(1.5, wy) * step(wy, 2.6) * step(0.5, fract(fa / 0.005)));
      col = sil + WARM * 2.2 * win;
    }
  }
  vec4 cl = clouds(ro, rd, hk, tg);
  return mix(col, cl.rgb, cl.a);
}

void main() {
  vec2 frag = gl_FragCoord.xy;
  setup(frag);
  vec3 ro = u_eye.xyz;
  vec3 rd = rayAt(frameAt(frag));
  float tb = marchBody(ro, rd);
  // Whatever of him is under the soil is not seen.
  if (tb > 0.0 && ro.y + rd.y * tb < -u_scene.x) tb = -1.0;
  o = vec4(knee(land(ro, rd, tb)), tb > 0.0 ? 1.0 : 0.0);
}
