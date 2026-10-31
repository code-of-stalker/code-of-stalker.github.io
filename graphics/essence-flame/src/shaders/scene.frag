// The candle, a standing wax figure on its dish, and the flame in its
// crown, seen a little from above. Each pixel is a point of the frontal plane (cm); the
// dark is the paper and everything else is the flame's light on it. On a
// light page the browser passes black paper and white light, and the
// finish lays that light on the page in ink. The constants above come
// from lib.rs.
uniform vec2 u_res;       // target px
uniform vec3 u_cam;       // the lens's centre (cm) and half the frame's height
uniform vec4 u_flame;     // lean, flicker, height, softness into bare light
uniform vec2 u_light;     // the flame's light, the wax's inner glow
uniform vec4 u_state;     // matter, melt, the loop's angle, the wax's top
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
// A trapezoid round y = 0: bottom and top half-widths, half its height.
float trapezoid(vec2 p, float r1, float r2, float he) {
  vec2 k1 = vec2(r2, he), k2 = vec2(r2 - r1, 2.0 * he);
  p.x = abs(p.x);
  vec2 ca = vec2(p.x - min(p.x, p.y < 0.0 ? r1 : r2), abs(p.y) - he);
  vec2 cb = p - k1 + k2 * clamp(dot(k1 - p, k2) / dot(k2, k2), 0.0, 1.0);
  float s = (cb.x < 0.0 && ca.y < 0.0) ? -1.0 : 1.0;
  return s * sqrt(min(dot(ca, ca), dot(cb, cb)));
}
float box(vec2 p, vec2 b) {
  vec2 d = abs(p) - b;
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}
float crown() { return u_state.w; }
float flameRoot() { return crown() + ROOT_OVER; }

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
  vec2 q = p - vec2(0.0, flameRoot());
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
  return vec2(u_flame.x * flameHeight() * 0.25, flameRoot() + flameHeight() * 0.4);
}
// How much of the flame's light reaches p.
float reach(vec2 p) {
  vec2 l = flameHeart() - p;
  return u_light.x / (1.0 + dot(l, l) / 70.0);
}

// The figure: a person of wax standing on a little plinth in the dish,
// arms at its sides, the wick in its crown and two old drips down its head.
float person(vec2 q, float k) {
  vec2 hq = (q - vec2(0.0, 9.65)) / vec2(1.2, 1.42);
  float head = max((length(hq) - 1.0) * 1.2, q.y - CANDLE_TOP);
  float neck = capsule(q, vec2(0.0, 7.9), vec2(0.0, 8.5), 0.52);
  float torso = trapezoid(q - vec2(0.0, 6.2), 1.15, 1.65, 1.4) - 0.3;
  float arms = min(capsule(q, vec2(-2.0, 7.45), vec2(-2.2, 4.5), 0.44),
                   capsule(q, vec2(2.0, 7.45), vec2(2.2, 4.5), 0.44));
  float legs = min(capsule(q, vec2(-0.7, 4.7), vec2(-0.66, 0.9), 0.58),
                   capsule(q, vec2(0.7, 4.7), vec2(0.66, 0.9), 0.58));
  float plinth = box(q - vec2(0.0, DISH_TOP + 0.35), vec2(1.5, 0.3)) - 0.1;
  float drips = min(capsule(q, vec2(-0.45, CANDLE_TOP - 0.1), vec2(-1.12, 9.3), 0.14),
                    capsule(q, vec2(0.4, CANDLE_TOP - 0.1), vec2(1.1, 9.85), 0.12));
  float d = smin(smin(head, neck, k + 0.25), torso, k + 0.35);
  d = smin(d, arms, k + 0.12);
  d = smin(d, legs, k + 0.1);
  d = smin(d, plinth, k + 0.15);
  return smin(d, drips, 0.06 + k);
}
// It melts from the top down: the figure's parts run together and settle
// into one plain column of wax, lower by the sink, drips running down it
// and a puddle spreading in the dish.
float figure(vec2 p) {
  float m = u_state.y, top = crown();
  vec2 q = vec2(p.x, DISH_TOP + (p.y - DISH_TOP) * (CANDLE_TOP - DISH_TOP) / (top - DISH_TOP));
  float man = person(q, 0.9 * m);
  float column = box(p - vec2(0.0, 0.5 * (top + DISH_TOP)), vec2(1.3, 0.5 * (top - DISH_TOP) - 0.6)) - 0.6;
  float runs = 1e3;
  for (int i = 0; i < 3; i++) {
    float x = vec3(-1.75, 1.1, 1.8)[i];
    float len = (vec3(4.2, 2.6, 6.0)[i]) * smoothstep(0.35, 1.0, m);
    runs = min(runs, capsule(p, vec2(x, top - 0.7), vec2(x * 1.04, top - 0.7 - len), 0.2 - 0.04 * float(i)));
  }
  // no runs before the wax runs
  runs += 10.0 * (1.0 - smoothstep(0.3, 0.5, m));
  float down = clamp(1.6 * m - 0.6 * (1.0 - (p.y - DISH_TOP) / (top - DISH_TOP)), 0.0, 1.0);
  float d = mix(man, column, smoothstep(0.0, 1.0, down));
  d = smin(d, runs, 0.25);
  float r = 1.7 + 1.5 * m;
  float puddle = (length((p - vec2(0.0, DISH_TOP)) / vec2(r, r * TILT)) - 1.0) * r * TILT;
  return smin(d, puddle, 0.2 + 0.2 * m);
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
  // behind the candle.
  float pool = exp(-pow(p.x / 8.0, 2.0) - pow((p.y - 0.6) / 2.6, 2.0)) * (1.0 - smoothstep(2.2, 3.6, p.y));
  col += u_key * 0.11 * lit * pool * matter;

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

  // The figure: wax lit from inside under the flame, its head brightest,
  // thin edges glowing more than the thick body; the flame's light glances
  // on it from above, glossier as it melts.
  float top = crown();
  float fd = figure(p);
  if (fd < 0.5) {
    float e = 0.02;
    vec2 g = vec2(figure(p + vec2(e, 0.0)) - figure(p - vec2(e, 0.0)), figure(p + vec2(0.0, e)) - figure(p - vec2(0.0, e))) / (2.0 * e);
    float z = clamp(-fd / 0.6, 0.0, 1.0) * 0.9 + 0.1;
    vec3 n = normalize(vec3(g * (1.0 - z), z));
    vec2 lp = flameHeart() - p;
    vec3 l = normalize(vec3(lp, 2.0));
    float diffuse = max(dot(n, l), 0.0);
    float spec = pow(max(dot(reflect(-l, n), vec3(0.0, 0.0, 1.0)), 0.0), 14.0 + 16.0 * melt);
    float sss = exp(-(top - p.y) / 2.6);
    float thin = 1.0 - clamp(-fd / 1.1, 0.0, 1.0);
    float r = reach(p);
    float light = lit * glow * (0.08 + 0.95 * sss * (0.55 + 0.45 * thin)) * (0.55 + 0.45 * n.z);
    vec3 c = wax * (light + 0.45 * r * diffuse) + u_key * r * (0.2 + 0.35 * melt) * spec;
    col = mix(col, u_paper + c, (1.0 - smoothstep(-px, px, fd)) * matter);
  }
  // Its crown: a rim of translucent wax round a pool that mirrors the
  // flame, wider once the figure is a plain column.
  float tr = mix(0.5, 1.3, melt), te = TILT * tr;
  vec2 tt = (p - vec2(0.0, top)) / vec2(tr, te);
  float outer = 1.0 - smoothstep(1.0 - px / te, 1.0 + px / te, length(tt));
  float poolIn = 1.0 - smoothstep(0.72, 0.8, length(tt));
  float mirror = exp(-pow(p.x / 0.3, 2.0) - pow((p.y - top + 0.06) / 0.07, 2.0));
  vec3 topCol = wax * lit * glow * mix(1.05, 0.62, poolIn) + u_key * 0.7 * mirror * lit * poolIn;
  col = mix(col, u_paper + topCol, outer * matter);

  // The flame and the light round it, added.
  col += flame(p) * (0.85 + 0.15 * lit);
  vec2 hp = (p - flameHeart()) / vec2(1.0, 1.4);
  float rr = length(hp);
  col += u_key * lit * (0.28 * exp(-rr / 1.1) + 0.07 * exp(-rr / 5.0)) * (1.0 + 0.5 * u_flame.w);

  // The wick stands dark in the flame's hollow, its tip an ember.
  float wick = capsule(p, vec2(0.0, top - 0.05), vec2(0.16 + u_flame.x * 0.35, top + WICK), 0.065);
  float wm = (1.0 - smoothstep(-px, px, wick)) * matter;
  col = mix(col, u_paper * 0.4, wm * 0.92);
  float ember = exp(-length(p - vec2(0.16 + u_flame.x * 0.35, top + WICK)) / 0.07);
  col += u_key * 0.6 * ember * matter;

  o = vec4(col, 1.0);
}
