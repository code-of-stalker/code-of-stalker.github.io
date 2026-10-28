// The sand, the seal and the lamps, seen through the lens: one ray per
// pixel over the ground's relief. Out: the color and the signed size of
// the blur circle (alpha, 0.5 = sharp) for the finishing pass.
uniform vec2 u_res;
uniform vec3 u_eye;
uniform vec4 u_view;    // target xyz, zoom
uniform vec2 u_lens;    // focus distance, aperture (blur px per unit of defocus)
uniform vec4 u_lamp;    // position, power
uniform vec4 u_runner;  // the light that follows the chain: position, power
uniform vec4 u_seal;    // x, z, height of its face, kind
uniform vec2 u_copies;  // how many copies of the imprint run along the chain, their depth
uniform vec4 u_chain;   // direction, step, sway
uniform vec3 u_life;    // drift of the grain, how alive the sand is
uniform vec3 u_paper;
uniform vec3 u_key;     // lamp light (dark pages)
uniform vec3 u_fill;
uniform vec3 u_ink;     // shadows (light pages)
uniform float u_light;  // a light page
uniform sampler2D u_prints;
in vec2 v_uv;
out vec4 o;

const float TOP = 0.03, BOTTOM = -0.045;
// Away from the imprints nothing rises above the grain's own ripples.
const float GRAIN_TOP = 0.009;
float g_far;

vec3 printAt(vec2 p) {
  vec2 uv = p / (2.0 * SPAN) + 0.5;
  if (uv.x <= 0.0 || uv.y <= 0.0 || uv.x >= 1.0 || uv.y >= 1.0) return vec3(0.0);
  vec4 t = textureLod(u_prints, uv, 0.0);
  return vec3((t.r + t.g / 255.0) * (HMAX - HMIN) + HMIN, t.b, t.a);
}
vec2 copyAt(float i) {
  return u_chain.xy * i * u_chain.z + vec2(u_chain.y, -u_chain.x) * u_chain.w * sin(i * 1.9);
}
vec3 prints(vec2 p) {
  vec3 a = printAt(p);
  if (u_copies.x > 0.0) {
    float i = clamp(floor(dot(p, u_chain.xy) / u_chain.z + 0.5), 1.0, ceil(u_copies.x));
    float c = u_copies.y * clamp(u_copies.x - i + 1.0, 0.0, 1.0);
    if (c > 0.0) a += printAt(p - copyAt(i)) * c;
  }
  return a;
}
// Whether an imprint (ours or a copy) may lie under this point: its disc,
// widened by the longest stride taken above the bare grain.
bool nearPrint(vec2 p) {
  const float R = SPAN + 0.1;
  if (dot(p, p) < R * R) return true;
  if (u_copies.x > 0.0) {
    float i = clamp(floor(dot(p, u_chain.xy) / u_chain.z + 0.5), 1.0, ceil(u_copies.x));
    vec2 q = p - copyAt(i);
    if (dot(q, q) < R * R) return true;
  }
  return false;
}
float H(vec2 p) {
  vec3 r = prints(p);
  return ripples(p, g_far, u_life.xy) * (1.0 - clamp(r.y, 0.0, 1.0)) + r.x;
}

float sealSdf(vec3 p) {
  vec3 q = p - vec3(u_seal.x, u_seal.z, u_seal.y);
  int kind = int(u_seal.w + 0.5);
  float d2 = shape(q.xz, kind);
  vec2 w = vec2(d2 + 0.01, abs(q.y - 0.1) - 0.09);
  float base = min(max(w.x, w.y), 0.0) + length(max(w, 0.0)) - 0.01;
  // its face, cut where the words are: the imprint's ridges, mirrored
  if (d2 < 0.0 && q.y < 0.03) base = max(base, 0.7 * DEPTH * face(q.xz, kind) - q.y);
  vec3 n = q - vec3(0.0, 0.2, 0.0);
  float r = 0.085 - 0.03 * smoothstep(0.0, 0.2, n.y);
  vec2 c = vec2(length(n.xz) - r, abs(n.y - 0.15) - 0.15);
  float stem = min(max(c.x, c.y), 0.0) + length(max(c, 0.0)) - 0.01;
  float knob = length(q - vec3(0.0, 0.52, 0.0)) - 0.12;
  float h = clamp(0.5 + 0.5 * (knob - stem) / 0.04, 0.0, 1.0);
  float top = mix(knob, stem, h) - 0.04 * h * (1.0 - h);
  h = clamp(0.5 + 0.5 * (top - base) / 0.03, 0.0, 1.0);
  return mix(top, base, h) - 0.03 * h * (1.0 - h);
}
bool sealShown() { return u_seal.z < 1.5; }

vec3 groundNormal(vec2 p, float e) {
  float hx = H(p + vec2(e, 0.0)) - H(p - vec2(e, 0.0));
  float hz = H(p + vec2(0.0, e)) - H(p - vec2(0.0, e));
  return normalize(vec3(-hx, 2.0 * e, -hz));
}

float shadow(vec3 p, vec3 L, float far) {
  float s = 1.0, t = 0.003;
  for (int i = 0; i < 48; i++) {
    vec3 q = p + L * t;
    if (q.y > TOP + 0.01 && (!sealShown() || q.y > u_seal.z + 0.7)) break;
    if (q.y > GRAIN_TOP + 0.002 && !sealShown() && !nearPrint(q.xz)) break;
    float h = q.y - H(q.xz);
    float st = sealShown() ? sealSdf(q) : 1e3;
    s = min(s, min(16.0 * h / t, 10.0 * st / t));
    if (s < 0.0) break;
    t += clamp(t * 0.16, 0.003, 0.15);
    if (t > far) break;
  }
  return clamp(s, 0.0, 1.0);
}

// Light reaching a point from a lamp: diffuse × shadow × falloff.
float lamp(vec4 l, vec3 p, vec3 n, bool seal) {
  if (l.w <= 0.0) return 0.0;
  vec3 to = l.xyz - p;
  float dist = length(to);
  vec3 L = to / dist;
  float facing = dot(n, L);
  if (facing <= 0.0) return 0.0;
  // the seal is dark and matte: its own shadows would only cut it up
  float s = seal ? 1.0 : shadow(p + n * 0.002, L, dist);
  return facing * s * l.w / (1.0 + 0.12 * dist * dist);
}

void main() {
  vec2 uv = (v_uv - 0.5) * vec2(u_res.x / u_res.y, 1.0);
  vec3 fw = normalize(u_view.xyz - u_eye);
  vec3 rt = normalize(cross(fw, vec3(0.0, 1.0, 0.0)));
  vec3 up = cross(rt, fw);
  vec3 d = normalize(fw * u_view.w + rt * uv.x + up * uv.y);
  vec3 e = u_eye;
  float hit = -1.0;
  bool seal = false;
  g_far = 0.0;
  if (sealShown()) {
    float t = 0.0;
    for (int i = 0; i < 100; i++) {
      float s = sealSdf(e + d * t);
      if (s < 0.0006) { hit = t; seal = true; break; }
      t += s * 0.9;
      if (t > 30.0) break;
    }
  }
  if (d.y < 0.0) {
    float t = max((TOP - e.y) / d.y, 0.0), prev = t;
    float limit = seal ? hit : min((BOTTOM - e.y) / d.y, 40.0);
    bool found = false;
    for (int i = 0; i < 240; i++) {
      if (t > limit) break;
      g_far = smoothstep(4.0, 14.0, t);
      vec3 p = e + d * t;
      if (p.y > GRAIN_TOP && !nearPrint(p.xz)) {
        // above the bare grain: stride down to it, never across an imprint
        prev = t;
        t += min((p.y - GRAIN_TOP) / -d.y + 0.0005, 0.1);
        continue;
      }
      if (p.y < H(p.xz)) { found = true; break; }
      prev = t;
      t += clamp(t * 0.003, 0.001, 0.05);
    }
    if (found) {
      for (int i = 0; i < 7; i++) {
        float m = 0.5 * (prev + t);
        vec3 p = e + d * m;
        if (p.y < H(p.xz)) t = m; else prev = m;
      }
      hit = t;
      seal = false;
    }
  }
  vec3 col = u_paper;
  float z = 1e3;
  if (hit > 0.0) {
    vec3 p = e + d * hit;
    z = dot(p - e, fw);
    g_far = smoothstep(4.0, 14.0, hit);
    vec3 n;
    if (seal) {
      float s = 0.0015;
      n = normalize(vec3(
        sealSdf(p + vec3(s, 0, 0)) - sealSdf(p - vec3(s, 0, 0)),
        sealSdf(p + vec3(0, s, 0)) - sealSdf(p - vec3(0, s, 0)),
        sealSdf(p + vec3(0, 0, s)) - sealSdf(p - vec3(0, 0, s))));
    } else {
      n = groundNormal(p.xz, 0.0016 + 0.0008 * hit);
    }
    float key = lamp(u_lamp, p, n, seal) + lamp(u_runner, p, n, seal);
    float fill = max(dot(n, normalize(vec3(0.7, 0.35, -0.4))), 0.0);
    float sky = 0.5 + 0.5 * n.y;
    float grain = noise(p.xz * 260.0 + u_life.xy * 3.0) * (1.0 - g_far);
    float pressed = seal ? 0.0 : clamp(prints(p.xz).z, 0.0, 1.0);
    grain = mix(grain, 0.5, 0.8 * pressed);
    if (u_light < 0.5) {
      vec3 sand = mix(vec3(0.42, 0.45, 0.46), vec3(0.5, 0.52, 0.52), grain) * (1.0 - 0.22 * pressed);
      if (seal) sand = vec3(0.045, 0.052, 0.06);
      col = u_paper * 0.6 + sand * (u_key * key + u_fill * 0.07 * fill + u_key * 0.06 * sky);
      if (seal) {
        col += u_fill * 0.18 * pow(1.0 - abs(dot(n, -d)), 3.0) * clamp(key * 3.0, 0.2, 1.0);
        // the lit sand under it lights its face a little
        col += u_key * 0.05 * max(-n.y, 0.0) * u_lamp.w;
      }
      // the living sand glints on its crests; pressed sand does not
      if (!seal) {
        vec3 L = normalize(u_lamp.xyz - p);
        float g = pow(max(dot(reflect(-L, n), -d), 0.0), 40.0) * step(0.93, noise(p.xz * 420.0 + u_life.xy * 9.0));
        col += u_key * g * u_life.z * (1.0 - pressed) * 0.6 * min(key, 1.0);
      }
      // the lamp's highlights roll off instead of clipping
      col = 1.0 - exp(-col * 1.3);
    } else {
      float lit = clamp(0.55 + 0.45 * min(key, 1.0) + 0.04 * grain + 0.05 * fill - 0.06 * pressed, 0.0, 1.0);
      if (seal) lit = 0.25 + 0.25 * min(key, 1.0) + 0.1 * max(-n.y, 0.0);
      col = mix(u_ink, u_paper, lit);
    }
    col = mix(col, u_paper, 1.0 - exp(-max(hit - 1.5, 0.0) * 0.12));
  }
  float coc = clamp(u_lens.y * (z - u_lens.x) / max(z, 0.01), -22.0, 22.0);
  o = vec4(col, 0.5 + coc / 44.0);
}
