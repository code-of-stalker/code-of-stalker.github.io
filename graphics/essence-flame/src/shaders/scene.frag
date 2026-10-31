// The candle on its dish, the wax doll on the table and the flame, seen
// a little from above. Each pixel is a point of the frontal plane (cm); the
// dark is the paper and everything else is the flame's light on it. On a
// light page the browser passes black paper and white light, and the
// finish lays that light on the page in ink. The constants above come
// from lib.rs.
uniform vec2 u_res;       // target px
uniform vec3 u_cam;       // the lens's centre (cm) and half the frame's height
uniform vec4 u_flame;     // lean, flicker, height, softness into bare light
uniform vec2 u_light;     // the flame's light, the wax's inner glow
uniform vec3 u_state;     // matter, melt, the loop's angle
uniform vec3 u_paper;
uniform vec3 u_key;
uniform vec3 u_fill;
in vec2 v_uv;
out vec4 o;

float smin(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}
float capsule(vec2 p, vec2 a, vec2 b, float r) {
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h) - r;
}

// The flame's living waves: whole cycles per loop, running up the flame.
float wave(float y) {
  float a = u_state.z;
  return 0.45 * sin(CYCLES.x * a - 3.1 * y) + 0.3 * sin(CYCLES.y * a - 5.3 * y + 1.3)
       + 0.17 * sin(CYCLES.z * a - 8.2 * y + 2.4) + 0.08 * sin(CYCLES.w * a - 12.0 * y + 0.7);
}
float flameHeight() { return FLAME_H * u_flame.z; }
// Where p lies in the flame: across over its half-width there, and 0..1
// from the rounded root under the wick to the tip.
vec2 flameSpace(vec2 p) {
  float h = flameHeight();
  vec2 q = p - vec2(0.0, FLAME_ROOT);
  float s = clamp(q.y / h, 0.0, 1.2);
  q.x -= u_flame.x * h * s * s;
  q.x -= u_flame.y * 0.17 * h * s * s * wave(s);
  float y = (q.y / h + 0.16) / 1.16;
  float f = pow(clamp(y, 0.0, 1.0), 0.55) * pow(clamp(1.0 - y, 0.0, 1.0), 1.1) / 0.349;
  float w = FLAME_W * f * (1.0 + 0.3 * u_flame.w) + 1e-3;
  return vec2(q.x / w, y);
}
// The flame's own light: a bright body, a whiter core, a dark hollow over
// the wick and a cool root. As it softens into bare light the hollow and
// the root go and its edge melts.
vec3 flame(vec2 p) {
  vec2 f = flameSpace(p);
  float d = abs(f.x), y = f.y, pure = u_flame.w;
  float soft = 0.45 * pure;
  float body = (1.0 - smoothstep(0.55 - soft, 1.02 + soft, d))
             * smoothstep(-0.02, 0.1 + 0.1 * pure, y) * (1.0 - smoothstep(0.84 - 0.2 * pure, 1.0, y));
  float thin = 1.0 - 0.45 * smoothstep(0.55, 1.0, y);
  float hollow = (1.0 - smoothstep(0.16, 0.55, d)) * (1.0 - smoothstep(0.08, 0.36, y)) * (1.0 - pure);
  float core = (1.0 - smoothstep(0.0, 0.7, d)) * smoothstep(0.1, 0.38, y) * (1.0 - smoothstep(0.5, 0.88, y));
  float root = smoothstep(0.3, 0.0, y) * smoothstep(0.3, 0.85, d) * (1.0 - smoothstep(0.95, 1.3, d))
             * smoothstep(-0.06, 0.04, y) * (1.0 - pure);
  vec3 hot = mix(u_key, vec3(1.0), 0.45);
  return u_key * body * thin * (0.9 - 0.65 * hollow) + hot * 0.55 * core * (1.0 - hollow) + u_fill * 0.85 * root;
}
vec2 flameHeart() {
  return vec2(u_flame.x * flameHeight() * 0.25, FLAME_ROOT + flameHeight() * 0.4);
}
// How much of the flame's light reaches p.
float reach(vec2 p) {
  vec2 l = flameHeart() - p;
  return u_light.x / (1.0 + dot(l, l) / 70.0);
}

// The wax doll: a little figure on a disc of wax. As it melts it sinks,
// spreads, leans into the heat and runs into its puddle.
float doll(vec2 p) {
  // It melts from the top: the head sags into the shoulders, the arms run
  // down the body, the body slumps to a mound and the mound to a puddle.
  float m = u_state.y;
  float mh = smoothstep(0.0, 0.45, m), ma = smoothstep(0.12, 0.6, m), mb = smoothstep(0.5, 1.0, m);
  float s = DOLL_H / 4.0;
  vec2 q = (p - vec2(DOLL_X, 0.0)) / s;
  q.x -= 0.12 * mh * max(q.y - 1.4, 0.0);
  float head = length(q - vec2(0.05 * mh, 3.45 - 0.95 * mh)) - (0.5 + 0.1 * mh);
  float trunk = capsule(q, vec2(0.0, 1.45), vec2(0.0, 2.6 - 0.35 * mh), 0.55 + 0.12 * ma);
  float legs = min(capsule(q, vec2(-0.27, 0.2), vec2(-0.2, 1.35), 0.24),
                   capsule(q, vec2(0.27, 0.2), vec2(0.2, 1.35), 0.24));
  vec2 sag = vec2(0.22, -0.5) * ma;
  float arms = min(capsule(q, vec2(-0.56 + sag.x, 2.5 + sag.y), vec2(-0.7, 1.2 - 0.4 * ma), 0.18 + 0.06 * ma),
                   capsule(q, vec2(0.56 - sag.x, 2.5 + sag.y), vec2(0.7, 1.2 - 0.4 * ma), 0.18 + 0.06 * ma));
  float d = smin(smin(head, trunk, 0.16 + 0.4 * mh), smin(legs, arms, 0.05 + 0.3 * ma), 0.13 + 0.4 * ma);
  // the mound it becomes, lower and wider as it goes
  float mh2 = mix(2.9, 0.18, mb);
  vec2 rad = vec2(0.9 + 0.9 * mb, mh2);
  float mound = (length(q / rad) - 1.0) * min(rad.x, rad.y);
  d = mix(d, mound, smoothstep(0.25, 0.8, m)) * s;
  float r = 0.9 + 1.6 * m;
  vec2 c = p - vec2(DOLL_X + 0.5 * m, 0.0);
  float disc = (length(c / vec2(r, r * TILT)) - 1.0) * r * TILT;
  return smin(d, disc, 0.2 + 0.3 * m);
}

void main() {
  float aspect = u_res.x / u_res.y;
  vec2 p = u_cam.xy + vec2((v_uv.x - 0.5) * aspect, v_uv.y - 0.5) * 2.0 * u_cam.z;
  float px = 2.0 * u_cam.z / u_res.y;
  float matter = u_state.x, melt = u_state.y;
  float lit = u_light.x, glow = u_light.y;
  vec3 col = u_paper;
  vec3 wax = u_key * 0.62;

  // The table: only where the flame's light pools on it, ending in the dark
  // behind the candle. The doll's shadow falls away from the flame.
  float pool = exp(-pow(p.x / 8.0, 2.0) - pow((p.y - 0.6) / 2.6, 2.0)) * (1.0 - smoothstep(2.2, 3.6, p.y));
  float dollTop = DOLL_H * (1.0 - 0.86 * melt);
  float shadow = exp(-pow((p.y - 0.15) / 0.32, 2.0))
               * smoothstep(DOLL_X + 0.6, DOLL_X - 0.2, p.x)
               * smoothstep(DOLL_X - 0.4 - 0.75 * dollTop, DOLL_X - 0.2, p.x);
  col += u_key * 0.11 * lit * pool * (1.0 - 0.75 * shadow) * matter;

  // The dish: a dark brass saucer; the flame shines in its front rim.
  float dr = 4.0, de = dr * TILT;
  float du = p.x / dr;
  if (abs(du) < 1.0) {
    float arc = sqrt(1.0 - du * du);
    float top = (1.0 - smoothstep(-px, px, length((p - vec2(0.0, DISH_TOP)) / vec2(dr, de)) - 1.0));
    float arcY = DISH_TOP - de * arc;
    float front = smoothstep(arcY - 0.42 - px, arcY - 0.42 + px, p.y) * (1.0 - smoothstep(arcY - px, arcY + px, p.y));
    float rim = max(top, front);
    float shine = exp(-pow(p.x / 0.9, 2.0)) * front;
    vec3 brass = u_key * (0.05 + 0.08 * top) * lit + u_key * 0.5 * shine * lit;
    col = mix(col, u_paper * 0.6 + brass, rim * matter);
  }

  // The doll, lit from the flame's side, glossier as it melts.
  float dd = doll(p);
  if (dd < 0.4) {
    float e = 0.02;
    vec2 g = vec2(doll(p + vec2(e, 0.0)) - doll(p - vec2(e, 0.0)), doll(p + vec2(0.0, e)) - doll(p - vec2(0.0, e))) / (2.0 * e);
    float z = clamp(-dd / 0.45, 0.0, 1.0) * 0.9 + 0.1;
    vec3 n = normalize(vec3(g * (1.0 - z), z));
    vec2 lp = flameHeart() - p;
    vec3 l = normalize(vec3(lp, 2.5));
    float diffuse = max(dot(n, l), 0.0);
    float spec = pow(max(dot(reflect(-l, n), vec3(0.0, 0.0, 1.0)), 0.0), 12.0 + 20.0 * melt);
    float edge = smoothstep(0.0, -0.25, dd) * (1.0 - smoothstep(-0.25, -0.6, dd));
    float r = reach(p);
    vec3 c = wax * r * (0.12 + 0.85 * diffuse) + u_key * r * (0.25 + 0.6 * melt) * spec
           + wax * r * 0.25 * edge * max(lp.x, 0.0) / length(lp);
    col = mix(col, u_paper + 1.5 * c, (1.0 - smoothstep(-px, px, dd)) * matter);
  }

  // The candle: its body glows from inside under the flame, brightest
  // at the lip; three old drips run down its front.
  float u = p.x / CANDLE_R;
  if (abs(u) < 1.0) {
    float side = sqrt(1.0 - u * u);
    float e = TILT * CANDLE_R * side;
    float lip = CANDLE_TOP - e;
    float inBody = smoothstep(DISH_TOP - e - px, DISH_TOP - e + px, p.y) * (1.0 - smoothstep(lip - px, lip + px, p.y));
    float sss = exp(-(CANDLE_TOP - p.y) / 2.6);
    float drips = 0.0;
    for (int i = 0; i < 3; i++) {
      float x = CANDLE_R * vec3(-0.55, 0.12, 0.62)[i];
      float len = vec3(2.4, 1.3, 3.1)[i];
      float top = CANDLE_TOP - TILT * CANDLE_R * sqrt(1.0 - pow(x / CANDLE_R, 2.0));
      float c = capsule(p, vec2(x, top), vec2(x + 0.05, top - len), 0.17 - 0.03 * float(i));
      drips = max(drips, 1.0 - smoothstep(-0.12, px, c));
    }
    float light = lit * glow * (0.1 + 0.95 * sss) * (0.5 + 0.5 * side) * (1.0 + 0.35 * drips);
    float edgeGlow = exp(-pow((p.y - lip) / 0.14, 2.0)) * 0.55 * lit * glow;
    vec3 c = wax * (light + edgeGlow);
    col = mix(col, u_paper + c, inBody * matter);
    // The top: a ring of translucent wall round a pool of molten wax that
    // mirrors the flame.
    vec2 t = (p - vec2(0.0, CANDLE_TOP)) / vec2(CANDLE_R, TILT * CANDLE_R);
    float outer = 1.0 - smoothstep(1.0 - px / (TILT * CANDLE_R), 1.0 + px / (TILT * CANDLE_R), length(t));
    float poolIn = 1.0 - smoothstep(0.8, 0.84, length(t));
    float mirror = exp(-pow(p.x / 0.32, 2.0) - pow((p.y - CANDLE_TOP + 0.12) / 0.1, 2.0));
    vec3 topCol = wax * lit * glow * mix(1.05, 0.62, poolIn) + u_key * 0.7 * mirror * lit * poolIn;
    col = mix(col, u_paper + topCol, outer * matter);
  }

  // The flame and the light round it, added.
  col += flame(p) * (0.85 + 0.15 * lit);
  vec2 hp = (p - flameHeart()) / vec2(1.0, 1.4);
  float rr = length(hp);
  col += u_key * lit * (0.28 * exp(-rr / 1.1) + 0.07 * exp(-rr / 5.0)) * (1.0 + 0.5 * u_flame.w);

  // The wick stands dark in the flame's hollow, its tip an ember.
  float wick = capsule(p, vec2(0.0, CANDLE_TOP - 0.05), vec2(0.16 + u_flame.x * 0.35, CANDLE_TOP + WICK), 0.065);
  float wm = (1.0 - smoothstep(-px, px, wick)) * matter;
  col = mix(col, u_paper * 0.4, wm * 0.92);
  float ember = exp(-length(p - vec2(0.16 + u_flame.x * 0.35, CANDLE_TOP + WICK)) / 0.07);
  col += u_key * 0.6 * ember * matter;

  o = vec4(col, 1.0);
}
