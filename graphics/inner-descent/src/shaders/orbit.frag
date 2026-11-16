// Low orbit over the night side of the Earth (km): the land with its cities
// and clouds, storms flashing in them, the thin shell of air and its glow,
// the stars and the Moon, the aurora on the limb and, lower down, its
// curtains standing round him. He hangs in his suit; his visor holds the
// Earth and, behind it, his face warmed by his voice. Alpha marks him.

uniform vec4 u_light; // sun, moon, cloud cover, aurora
uniform vec4 u_storm; // the storm on the map (x, y), its flash, the train's head

#define RE 6371.0
#define AURAZ -2.5
const vec3 MOOND = vec3(-0.512, 0.256, -0.82);
const vec3 KEY = vec3(0.55, 0.5, 0.67);
float ALT;

// The aurora's curtains standing round him once he is down among them (km,
// flat round him).
vec3 curtains(vec3 rd, float tE) {
  vec3 c = vec3(0.0);
  for (int k = zero(); k < 3; k++) {
    float fk = float(k);
    float ang = AURAZ + (fk - 1.0) * 0.35;
    vec3 nn = vec3(cos(ang), 0.0, sin(ang));
    float dn = dot(rd, nn);
    if (dn < 0.04) continue;
    float t = (60.0 + 90.0 * fk) / dn;
    if (t > tE) continue;
    vec3 p = rd * t;
    float sx = dot(p, vec3(-nn.z, 0.0, nn.x));
    float h = ALT + p.y;
    float fold = fbm(vec2(sx / 70.0 + fk * 3.0, 0.5));
    float hb = 95.0 + 25.0 * fold;
    float prof = smoothstep(hb - 3.0, hb + 4.0, h) * exp(-max(h - hb, 0.0) / (45.0 + 60.0 * fold));
    float rays = 0.35 + 0.65 * 1.5 * sq(vnoise2(vec2(sx / 2.2 + fold * 8.0, fk)));
    float ext = smoothstep(260.0, 120.0, abs(sx + 40.0 * fk));
    float edge = clamp(0.3 / dn, 0.3, 1.8);
    c += (SKY * 0.5 + PALE * 0.25 * exp(-max(h - hb, 0.0) / 8.0)) * prof * rays * ext * edge;
  }
  return c;
}

vec3 earthCol(vec3 rd) {
  vec3 oc = vec3(0.0, RE + ALT, 0.0);
  float lo = 1.0 - smoothstep(60.0, 100.0, ALT);
  float up = max(asin(clamp(rd.y, -1.0, 1.0)) + acos(RE / (RE + ALT)), 0.0);
  float tE = 1e9;
  float b = dot(oc, rd);
  float h = b * b - (dot(oc, oc) - RE * RE);
  vec3 col;
  if (h > 0.0 && -b - sqrt(h) > 0.0) {
    float t = -b - sqrt(h);
    tE = t;
    vec3 ps = oc + rd * t;
    vec3 n = ps / RE;
    // The map stretches as he falls, so the land keeps its scale on screen.
    vec2 q = ps.xz * pow(410.0 / ALT, 0.6);
    float land = smoothstep(0.47, 0.53, fbm(q / 900.0 + vec2(3.1, 1.7)));
    float cityD = smoothstep(0.52, 0.78, fbm(q / 170.0 + 7.0)) * land;
    float lights = cityD * (0.5 + 0.9 * vnoise2(q / 9.0)) + land * 0.12 * smoothstep(0.7, 0.95, vnoise2(q / 14.0));
    float cl = smoothstep(0.52, 0.78, fbm(q / 240.0 + vec2(11.0, 2.0)));
    col = mix(BG * 0.4, BG * 0.6 + COLD * 0.012, land);
    col += mix(PALE, COLD, 0.2) * lights * 0.8 * (1.0 - cl * 0.85);
    col = mix(col, BG * 1.05 + PALE * 0.09 * max(dot(n, MOOND) + 0.3, 0.0), cl * 0.8);
    // A thunderstorm flashing inside the clouds.
    float fl = u_storm.z * (exp(-length(q - u_storm.xy) / 30.0) + 0.5 * exp(-length(q - u_storm.xy - vec2(60.0, -35.0)) / 22.0));
    col += mix(PALE, COLD, 0.4) * 1.1 * fl * (0.4 + 0.6 * cl);
    float graze = 1.0 - max(dot(n, -rd), 0.0);
    col = mix(col, BG * 0.8 + SKY * 0.16, pow(graze, 5.0) * 0.85);
  } else {
    // How high over the ground the ray passes at its lowest.
    float a = (b < 0.0 ? sqrt(max(dot(oc, oc) - b * b, 0.0)) : length(oc)) - RE;
    col = BG * 0.45;
    // The stars, kept to at least about a pixel and dimmed as they widen.
    vec2 sp = vec2(atan(rd.z, rd.x), asin(clamp(rd.y, -1.0, 1.0))) * 160.0;
    vec2 id = floor(sp);
    vec2 f = fract(sp) - 0.5 - (vec2(hs(id, 0.0), hs(id, 3.3)) - 0.5) * 0.7;
    float rr = max(0.012, sq(0.7 * pxA * 160.0));
    float st = step(0.9, hs(id, 9.1)) * exp(-dot(f, f) / rr) * 0.012 / rr * (0.3 + 0.7 * hs(id, 4.4));
    col += PALE * 0.9 * st * mix(smoothstep(120.0, 260.0, a), smoothstep(0.03, 0.15, up), lo);
    // The Moon.
    float mAng = acos(clamp(dot(rd, MOOND), -1.0, 1.0));
    col += PALE * 0.75 * smoothstep(0.022, 0.019, mAng) * (0.8 + 0.2 * fbm(rd.xy * 300.0));
    col += PALE * 0.05 * exp(-mAng / 0.08);
    // The thin shell of air and its airglow.
    col += (1.0 - lo) * (SKY * 0.26 * exp(-max(a, 0.0) / 16.0) + SKY * 0.42 * exp(-sq((a - 95.0) / 7.0)));
    col += lo * (SKY * 0.34 * exp(-up / 0.012) + SKY * 0.1 * exp(-up / 0.06));
    // The aurora standing on the limb.
    float da = atan(rd.z, rd.x) - AURAZ;
    float curt = smoothstep(0.5, 0.18, abs(da));
    float fold = fbm(vec2(da * 9.0, 1.3));
    float rays = sq(vnoise2(vec2(da * 260.0 + fold * 30.0, 0.5))) * 1.6;
    float hgt = smoothstep(95.0, 108.0, a + fold * 20.0) * exp(-max(a - 108.0, 0.0) / (18.0 + 40.0 * fold));
    col += SKY * 0.7 * curt * (0.35 + 0.65 * rays) * hgt;
  }
  if (u_light.w > 0.0) col += u_light.w * curtains(rd, tE);
  return col;
}

vec3 orbit(vec3 ro, vec3 rd, float tb) {
  if (tb < 0.0) return earthCol(rd);
  vec3 ph = ro + rd * tb;
  vec3 n = nrmB(ph);
  float oc = aoB(ph, n);
  vec3 q = loc(ph);
  float aur = u_light.w;
  float dif = max(dot(n, normalize(KEY)), 0.0);
  float rimS = pow(1.0 - abs(dot(n, -rd)), 2.5);
  vec3 col = BG * 0.6 * (0.5 + 0.5 * oc) + PALE * 0.5 * dif * oc + COLD * 0.2 * max(-n.y, 0.0) * oc;
  col += COLD * 0.12 * rimS;
  col += SKY * aur * (0.3 * rimS + 0.12 * max(dot(n, normalize(vec3(cos(AURAZ), 0.3, sin(AURAZ)))), 0.0) * oc);
  // Seams round the limbs and the waist.
  float seam = smoothstep(0.012, 0.0, abs(q.y - 0.98)) + smoothstep(0.01, 0.0, abs(q.y - 0.55)) + smoothstep(0.01, 0.0, abs(q.y - 1.23));
  col *= 1.0 - 0.35 * min(seam, 1.0);
  vec3 hq = q - HELM;
  if (length(hq) < 0.204) {
    vec3 hn = normalize(hq);
    // The visor: the Earth in the glass, his face behind it.
    if (onVisor(hn)) return visor(ph, rd, n, hn, earthCol(reflect(rd, n)), col);
  }
  return col;
}

void main() {
  vec2 frag = gl_FragCoord.xy;
  setup(frag);
  ALT = u_scene.x / 1000.0;
  vec3 ro = u_eye.xyz;
  vec3 rd = rayAt(frameAt(frag));
  float tb = marchBody(ro, rd);
  o = vec4(knee(orbit(ro, rd, tb)), tb > 0.0 ? 1.0 : 0.0);
}
