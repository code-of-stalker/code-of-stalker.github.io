#version 300 es
precision highp float;
precision highp int;
// «Шкатулка», ray-marched. One loop walks the eye ray, then the normal's
// four taps, four taps of occlusion and the lamp's shadow, so the scene's
// distance function is written out once (ANGLE's D3D compiler pays for
// every call site). Out: the color and the signed blur circle (alpha,
// 0.5 = sharp) for the finishing pass. The box mirrors src/lib.rs.
#define ZERO min(int(u_res.x), 0)
uniform vec2 u_res;
uniform vec3 u_eye;
uniform vec4 u_view;       // target xyz, zoom
uniform vec2 u_lens;       // focus distance, aperture
uniform vec4 u_drum;       // the drum's angle, the key's, the turntable's, the barrel's
uniform uvec4 u_pins[28];  // the program: 37 bits a row, two rows a vector
uniform vec4 u_teeth[10];  // how far each tooth's tip is bent
uniform vec4 u_joints[26]; // the figurine (22, 23: its torso's up and front)
uniform vec2 u_light;      // the dim room, the lamp
uniform vec3 u_lamp;
uniform vec3 u_paper;
uniform vec3 u_key;
uniform vec3 u_fill;
in vec2 v_uv;
out vec4 o;

const float TAU = 6.2831853;
const float R = 0.18, ROW = TAU / 56.0, PITCH = 0.028, TIP = 0.184;
const vec2 FIG = vec2(0.675, 0.0);
// Materials: 1 the case's wood, 2 brass, 3 steel, 4 the figurine,
// 5 the table, 6 the drum.
float g_mat;
// How far the eye ray may step before it enters the next pin's cell. Only
// the eye ray's steps use it: normals, occlusion and shadows see real
// surfaces alone, or every cell's edge would print a grid on the drum.
float g_cell;
// The pins cast no lamp shadow: a shadow beside every pin doubles the
// words on the drum, and the pins' own cells make the penumbra band.
bool g_pins;
// True when map() answered with the box around the music box rather than a
// surface: that distance bounds the steps but must not shade anything.
bool g_fake;

mat2 rot(float a) {
  float c = cos(a), s = sin(a);
  return mat2(c, s, -s, c);
}
float box(vec3 p, vec3 b) {
  vec3 q = abs(p) - b;
  return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
}
float box2(vec2 p, vec2 b) {
  vec2 q = abs(p) - b;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
}
// A flat shape `d` given a thickness of 2h along `z`.
float slab(float d, float z, float h) {
  vec2 w = vec2(d, abs(z) - h);
  return min(max(w.x, w.y), 0.0) + length(max(w, 0.0));
}
float cylX(vec3 p, float r, float h) { return slab(length(p.yz) - r, p.x, h); }
float cylY(vec3 p, float r, float h) { return slab(length(p.xz) - r, p.y, h); }
// A tapered limb from a to b.
float seg(vec3 p, vec3 a, vec3 b, float ra, float rb) {
  vec3 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h) - mix(ra, rb, h);
}
// A toothed wheel in its plane: the roots at r, n teeth h tall.
float wheel(vec2 q, float r, float h, float n) {
  float s = TAU / n;
  float a = mod(atan(q.y, q.x) + 0.5 * s, s) - 0.5 * s;
  float l = length(q);
  float tooth = box2(l * vec2(cos(a), sin(a)) - vec2(r + 0.5 * h, 0.0), vec2(0.5 * h, 0.27 * s * r));
  return min(l - r, tooth);
}
float smin(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}
void take(inout float d, float e, float m) {
  if (e < d) { d = e; g_mat = m; }
}

// The jointed wooden figurine.
float figurine(vec3 p) {
  vec3 up = u_joints[22].xyz, fw = u_joints[23].xyz;
  vec3 j0 = u_joints[0].xyz;
  // pelvis, waist and chest: wooden eggs, flatter front to back
  vec3 q = p + fw * dot(p - j0, fw) * 0.4;
  float d = seg(q, j0 - up * 0.012, j0 + up * 0.008, 0.036, 0.034);
  d = smin(d, seg(q, j0 + up * 0.045, j0 + up * 0.088, 0.027, 0.045), 0.02) / 1.4;
  vec3 neck = u_joints[2].xyz, head = u_joints[3].xyz;
  vec3 hd = normalize(head - neck);
  vec3 face = normalize(fw - hd * dot(fw, hd));
  d = min(d, seg(p, neck - up * 0.012, head, 0.012, 0.011));
  d = smin(d, seg(p, head + hd * 0.014 + face * 0.005, head + hd * 0.044, 0.021, 0.03), 0.008);
  // arms and legs: tapered pieces between ball joints
  for (int c = ZERO; c < 4; c++) {
    int b = 4 + 4 * c;
    vec3 a0 = u_joints[b].xyz, a1 = u_joints[b + 1].xyz, a2 = u_joints[b + 2].xyz, a3 = u_joints[b + 3].xyz;
    bool arm = c < 2;
    vec4 r = arm ? vec4(0.012, 0.009, 0.0072, 0.0075) : vec4(0.02, 0.0135, 0.0092, 0.011);
    float l = min(seg(p, a0, a1, r.x, r.y), seg(p, a1, a2, r.y * 0.95, r.z));
    l = min(l, length(p - a0) - r.x * (arm ? 1.3 : 1.0));
    l = min(l, length(p - a1) - r.y * 1.18);
    l = min(l, length(p - a2) - r.z * 1.15);
    if (arm) {
      l = min(l, seg(p, a2, a3, r.w, 0.0055));
      l = min(l, seg(p, a2, u_joints[20 + c].xyz, 0.0042, 0.0035));
    } else {
      l = min(l, seg(p, u_joints[22 + c].xyz, a3, r.w, 0.0075));
    }
    d = min(d, l);
  }
  return d;
}

float map(vec3 p) {
  g_mat = 5.0;
  g_cell = 1.0;
  float d = p.y + 0.5;
  float bound = box(p - vec3(0.0, 0.29, 0.0), vec3(1.1, 0.8, 0.6));
  g_fake = bound > 0.05 && bound < d;
  if (bound > 0.05) return min(d, bound);
  // the case: a wooden tray, four brass columns, the lid's frame
  take(d, max(box(p - vec3(0.0, -0.32, 0.0), vec3(0.976, 0.176, 0.556)) - 0.004,
              -box(p, vec3(0.92, 0.44, 0.5))), 1.0);
  vec3 c = vec3(abs(p.x) - 0.93, p.y - 0.135, abs(p.z) - 0.51);
  float e = max(length(c.xz) - 0.016, abs(c.y) - 0.275);
  e = min(e, max(box(p - vec3(0.0, 0.4125, 0.0), vec3(0.95, 0.0075, 0.53)), -box2(p.xz, vec2(0.91, 0.49))));
  take(d, e, 2.0);
  // the key, outside the left wall
  if (box(p - vec3(-0.98, -0.2, 0.02), vec3(0.11, 0.1, 0.1)) < d) {
    vec3 k = p - vec3(-0.975, -0.2, 0.02);
    take(d, cylX(k, 0.012, 0.1), 3.0);
    vec2 w = rot(-u_drum.y) * k.yz;
    float wing = min(length(vec2(abs(w.x) - 0.048, w.y)) - 0.034, length(w) - 0.018);
    take(d, slab(wing, p.x + 1.075, 0.005) - 0.001, 2.0);
  }
  // the movement
  if (box(p - vec3(-0.02, -0.115, 0.0), vec3(0.9, 0.33, 0.49)) < d) {
    take(d, box(p - vec3(0.0, -0.425, 0.0), vec3(0.9, 0.015, 0.48)), 2.0);
    vec3 b = vec3(abs(p.x) - 0.585, p.y, p.z);
    take(d, min(box(b - vec3(0.0, -0.205, 0.0), vec3(0.015, 0.205, 0.05)), cylX(b, 0.055, 0.015)), 2.0);
    take(d, cylX(p - vec3(-0.04, 0.0, 0.0), 0.012, 0.66), 3.0);
    // the drum and its pins
    float rho = length(p.yz);
    if (g_pins && abs(p.x) < 0.53 && rho < R + 0.03) {
      e = rho - (R + 0.0127);
      if (e < 0.01) {
        float a = atan(p.z, p.y) - u_drum.x;
        float ri = floor(0.5 - a / ROW);
        int row = int(mod(ri, 56.0));
        float ca = u_drum.x - ri * ROW;
        vec2 cs = vec2(cos(ca), sin(ca));
        float py = dot(p.yz, cs), pz = dot(p.yz, vec2(-cs.y, cs.x));
        float ci = clamp(floor(p.x / PITCH + 18.5), 0.0, 36.0);
        float px = p.x - (ci - 18.0) * PITCH;
        int col = int(ci);
        uvec4 w = u_pins[row >> 1];
        uvec2 bits = (row & 1) == 0 ? w.xy : w.zw;
        uint word = col < 32 ? bits.x : bits.y;
        // past this cell's edge another pin may stand
        bool end = (col == 0 && px < 0.0) || (col == 36 && px > 0.0);
        g_cell = min(end ? 1.0 : 0.5 * PITCH - abs(px), rho * 0.056 - abs(pz)) + 0.005;
        e = 1.0;
        if (((word >> uint(col & 31)) & 1u) == 1u)
          e = length(vec3(px, py - clamp(py, R - 0.003, R + 0.0085), pz)) - 0.0042;
      }
      take(d, e, 3.0);
    }
    take(d, cylX(p, R, 0.53), 6.0);
    // the end wheel, which turns the figurine's shaft
    vec3 g = p - vec3(0.555, 0.0, 0.0);
    if (cylX(g, 0.175, 0.01) < d) {
      vec2 h = rot(-u_drum.x) * g.yz;
      float wh = wheel(h, 0.158, 0.014, 40.0);
      float s5 = TAU / 5.0;
      float ah = mod(atan(h.y, h.x) + 0.5 * s5, s5) - 0.5 * s5;
      wh = max(wh, 0.036 - length(length(h) * vec2(cos(ah), sin(ah)) - vec2(0.095, 0.0)));
      take(d, slab(wh, g.x, 0.007), 2.0);
    }
    // the spring barrel and the pinion it drives
    vec3 s = p - vec3(-0.795, -0.2, 0.02);
    if (cylX(s, 0.175, 0.115) < d) {
      take(d, cylX(s, 0.14, 0.105) - 0.002, 2.0);
      take(d, slab(wheel(rot(-u_drum.w) * s.yz, 0.1445, 0.0125, 18.0), s.x - 0.0975, 0.0075), 2.0);
    }
    vec3 pn = p - vec3(-0.675, 0.0, 0.0);
    if (cylX(pn, 0.065, 0.02) < d)
      take(d, slab(wheel(rot(-u_drum.x) * pn.yz, 0.0435, 0.0135, 6.0), pn.x, 0.015), 3.0);
    // the comb: a tooth per column, bent by its last pluck
    if (box(p - vec3(0.0, -0.2, 0.31), vec3(0.53, 0.22, 0.14)) < d) {
      float ki = clamp(floor(p.x / PITCH + 18.5), 0.0, 36.0);
      float x = (ki - 18.0) * PITCH;
      float root = 0.34 - 0.0992 * x;
      int ti = int(ki);
      float bend = u_teeth[ti >> 2][ti & 3];
      float u = clamp((root - p.z) / (root - TIP), 0.0, 1.0);
      vec3 tq = vec3(p.x - x, p.y - bend * u * u, p.z - 0.5 * (root + TIP));
      take(d, 0.9 * box(tq, vec3(0.0105, 0.005, 0.5 * (root - TIP))), 3.0);
      take(d, max(box(p - vec3(0.0, 0.003, 0.365), vec3(0.52, 0.008, 0.075)), 0.34 - 0.0992 * p.x - p.z), 3.0);
      vec3 sc = vec3(p.x - 0.3 * clamp(round(p.x / 0.3), -1.0, 1.0), p.y - 0.014, p.z - 0.415);
      take(d, cylY(sc, 0.011, 0.004) - 0.001, 2.0);
      take(d, box(p - vec3(0.0, -0.208, 0.415), vec3(0.5, 0.202, 0.025)), 2.0);
    }
  }
  // the crown wheel, the shaft through the glass and the turntable
  vec3 t = p - vec3(FIG.x, 0.0, FIG.y);
  if (max(length(t.xz) - 0.14, abs(t.y - 0.305) - 0.15) < d) {
    vec3 cw = t - vec3(0.0, 0.186, 0.0);
    cw.xz = rot(-u_drum.z) * cw.xz;
    float s = TAU / 30.0;
    float a = mod(atan(cw.z, cw.x) + 0.5 * s, s) - 0.5 * s;
    vec2 rq = length(cw.xz) * vec2(cos(a), sin(a));
    e = min(cylY(cw, 0.12, 0.006), box(vec3(rq.x - 0.1125, cw.y + 0.0135, rq.y), vec3(0.0075, 0.0075, 0.0055)));
    take(d, e, 2.0);
    take(d, cylY(t - vec3(0.0, 0.306, 0.0), 0.012, 0.114), 3.0);
    vec3 tt = t - vec3(0.0, 0.4325, 0.0);
    tt.xz = rot(-u_drum.z) * tt.xz;
    float s2 = TAU / 24.0;
    float a2 = mod(atan(tt.z, tt.x) + 0.5 * s2, s2) - 0.5 * s2;
    float notch = length(length(tt.xz) * vec2(cos(a2), sin(a2)) - vec2(0.133, 0.0)) - 0.008;
    take(d, max(cylY(tt, 0.13, 0.0125) - 0.0015, -notch), 2.0);
  }
  // the figurine
  if (max(length(p.xz - FIG) - 0.27, abs(p.y - 0.76) - 0.33) < d) take(d, figurine(p), 4.0);
  return d;
}

// The lamp's pool: it hangs front left and aims at the box.
float spot(vec3 p) {
  vec3 axis = normalize(vec3(0.15, 0.05, 0.0) - u_lamp);
  return smoothstep(0.8, 0.95, dot(normalize(p - u_lamp), axis));
}

void main() {
  vec2 uv = (v_uv - 0.5) * vec2(u_res.x / u_res.y, 1.0);
  vec3 fw = normalize(u_view.xyz - u_eye);
  vec3 rt = normalize(cross(vec3(0.0, 1.0, 0.0), fw));
  vec3 up = cross(fw, rt);
  vec3 d = normalize(fw * u_view.w + rt * uv.x + up * uv.y);
  vec3 e = u_eye;
  vec3 hp = e, n = vec3(0.0), L = vec3(0.0, 1.0, 0.0);
  float t = 0.01, hit = -1.0, m = 0.0, eps = 0.0, occ = 0.0, sh = 1.0, s = 0.0;
  int phase = 0;
  for (int i = ZERO; i < 300; i++) {
    int k = phase - 1;
    vec3 tap = 0.5773 * (2.0 * vec3(ivec3((k + 3) >> 1, k >> 1, k) & 1) - 1.0);
    float reach = 0.01 + 0.03 * float(phase - 5);
    vec3 q = phase == 0 ? e + d * t
           : phase < 5 ? hp + tap * eps
           : phase < 9 ? hp + n * reach
           : hp + n * 0.002 + L * s;
    g_pins = phase < 9;
    float h = map(q);
    if (phase == 0) {
      if (h < 0.0004 * t + 5e-5) {
        hit = t; hp = q; m = g_mat; eps = 0.00025 + 0.0005 * t; phase = 1;
      } else {
        t += 0.85 * min(h, g_cell);
        if (t > 9.0) break;
      }
    } else if (phase < 5) {
      n += tap * h;
      phase++;
      if (phase == 5) n = normalize(n);
    } else if (phase < 9) {
      occ += (reach - (g_fake ? reach : h)) * pow(0.85, float(phase - 5));
      phase++;
      if (phase == 9) {
        // the lamp's shadow, only where the lamp reaches
        L = normalize(u_lamp - hp);
        if (u_light.y * spot(hp) * dot(n, L) <= 0.0) break;
        s = 0.004;
      }
    } else {
      if (!g_fake) sh = min(sh, 10.0 * h / s);
      s += clamp(h, 0.004, 0.12);
      if (sh < 0.02 || s > 3.0) break;
    }
  }
  sh = clamp(sh, 0.0, 1.0);

  float base = 1.0 - 0.5 * u_light.x;
  vec3 col = u_paper;
  float z = 1e3;
  if (hit > 0.0) {
    vec3 p = hp;
    z = dot(p - e, fw);
    float ao = clamp(1.0 - 3.0 * occ, 0.0, 1.0);
    vec3 alb;
    float sp, ks, metal;
    if (m < 1.5) {
      float grain = 0.5 + 0.5 * sin(p.y * 150.0 + p.x * 9.0 + 3.0 * sin(p.x * 11.0 + p.z * 23.0));
      alb = vec3(0.085, 0.07, 0.058) * (0.75 + 0.5 * grain); sp = 24.0; ks = 0.12; metal = 0.0;
    } else if (m < 2.5) {
      alb = vec3(0.42, 0.36, 0.25); sp = 40.0; ks = 0.7; metal = 0.6;
    } else if (m < 3.5) {
      alb = vec3(0.26, 0.27, 0.28); sp = 90.0; ks = 0.35; metal = 0.8;
    } else if (m < 4.5) {
      float grain = 0.5 + 0.5 * sin(p.y * 420.0 + 4.0 * sin(p.x * 60.0 + p.z * 50.0));
      alb = vec3(0.5, 0.45, 0.38) * (0.94 + 0.08 * grain); sp = 14.0; ks = 0.1; metal = 0.0;
    } else if (m < 5.5) {
      alb = vec3(0.045); sp = 10.0; ks = 0.06; metal = 0.0;
    } else {
      // the lathe's fine rings round the drum, gone before they would shimmer
      float lathe = sin(p.x * 2400.0 + 2.0 * sin(p.x * 37.0)) * smoothstep(0.9, 0.25, hit);
      alb = vec3(0.17, 0.15, 0.11) * (1.0 + 0.06 * lathe); sp = 50.0; ks = 0.45; metal = 0.5;
    }
    vec3 Ld = normalize(u_lamp - p);
    float lamp = u_light.y * spot(p) * 1.8;
    float facing = max(dot(n, Ld), 0.0);
    float sky = 0.35 + 0.65 * max(dot(n, normalize(vec3(-0.4, 1.0, -0.7))), 0.0);
    vec3 light = u_key * (lamp * facing * sh + 0.3 * u_light.x * sky) * ao
               + u_fill * u_light.x * 0.06 * (0.6 + 0.4 * n.y) * ao;
    vec3 c = alb * light;
    vec3 tint = mix(u_key, alb / max(alb.r, max(alb.g, alb.b)), 0.6 * metal);
    float spec = ks * pow(max(dot(n, normalize(Ld - d)), 0.0), sp) * (sp + 8.0) / 25.0;
    c += tint * spec * lamp * facing * sh;
    // metals mirror the dim room
    vec3 r = reflect(d, n);
    c += metal * tint * ao * u_light.x * (u_fill * 0.05 * (0.4 + 0.6 * max(r.y, 0.0)) + u_key * 0.04);
    // a cool rim from behind
    c += u_fill * 0.05 * u_light.x * pow(1.0 - max(dot(n, -d), 0.0), 4.0) * ao;
    c = 1.0 - exp(-1.5 * c);
    col = u_paper * (m > 4.5 && m < 5.5 ? 1.0 : base) + c;
    col = mix(col, u_paper, smoothstep(1.6, 4.5, length(p.xz)));
  }
  // the glass lid: only its sheen and the lamp in it
  float tg = (0.42 - e.y) / d.y;
  if (tg > 0.0 && (hit < 0.0 || tg < hit)) {
    vec3 g = e + d * tg;
    if (abs(g.x) < 0.91 && abs(g.z) < 0.49 && length(g.xz - FIG) > 0.13) {
      float f = 0.04 + 0.96 * pow(1.0 - abs(d.y), 5.0);
      vec3 r = reflect(d, vec3(0.0, d.y < 0.0 ? 1.0 : -1.0, 0.0));
      float glint = pow(max(dot(r, normalize(u_lamp - g)), 0.0), 400.0) * u_light.y * 2.5;
      col = mix(col, u_paper, 0.05) + f * (u_fill * 0.08 * u_light.x + u_key * 0.05 * u_light.y) + u_key * glint;
    }
  }
  float coc = clamp(u_lens.y * (z - u_lens.x) / max(z, 0.01), -22.0, 22.0);
  o = vec4(clamp(col, 0.0, 1.0), 0.5 + coc / 44.0);
}
