// The meadow: one instance per blade, seven vertices each (a ribbon of
// three pieces and a tip). Each blade's root is spread over the meadow in a
// sunflower pattern with a little jitter; the rim is ragged and thins out,
// and nothing grows in the clearing round the person. How the blade bends
// is a pure function of its root and the loop time: its own lean, the wind
// (travelling bands with whole cycles in a loop, and slow gusts that go
// round), and what Rust says is happening: a track running through the
// grass, a broad warm wave, a sharp parting, a still tight spiral and its
// ripple, the breath of the whole field, the word that almost writes itself,
// and the first ring's runners combing the rim. A blade that is moved is
// brighter: the event shows as light in the grass.
uniform vec4 u_wind;    // calm, blade count, light share of a blade
uniform vec2 u_swirl[SWIRL_POINTS];
uniform vec4 u_swirlS;  // head (0..1), strength, half width, length
uniform vec4 u_wave;    // way (x, z), front, strength
uniform vec4 u_wave2;   // second front, its strength, the fronts' width
uniform vec4 u_crack;   // from (x, z), to (x, z)
uniform vec4 u_crackS;  // head, strength, sheen, half width
uniform vec4 u_spiral;  // centre (x, z), radius, strength
uniform vec4 u_ripple;  // radius, strength, width, how far the spiral wound in
uniform vec2 u_breath;  // seconds since the breath began, strength
uniform vec4 u_word;    // corner (x, z), along (x, z)
uniform vec4 u_wordV;   // up (x, z), width, height
uniform vec3 u_wordS;   // written, scattered from, strength
uniform sampler2D u_atlas;

out vec3 v_light;
out float v_across;

void cull() {
  v_light = vec3(0.0);
  v_across = 0.0;
  gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}

void main() {
  uint id = uint(gl_InstanceID);
  int vid = gl_VertexID;
  float n = u_wind.y;
  float t = u_eye.w;
  float j0 = hash1(id, 1u);
  float j1 = hash1(id, 2u);
  float j2 = hash1(id, 3u);
  float j3 = hash1(id, 4u);
  // ---------- where it grows
  float fi = float(gl_InstanceID);
  float spacing = FIELD.z * sqrt(3.14159265 / n);
  float r0 = FIELD.z * sqrt((fi + 0.5) / n) + (j0 - 0.5) * spacing;
  float th0 = fi * 2.39996323 + (j1 - 0.5) * spacing / max(r0, 0.05);
  vec2 xz = FIELD.xy + r0 * vec2(cos(th0), sin(th0));
  vec2 out_ = xz - FIELD.xy;
  float r = length(out_);
  vec2 dir = out_ / max(r, 1e-4);
  float rim = FIELD.z * (0.9 + 0.1 * vnoise2(dir * 2.5 + 40.0));
  float hole = CLEARING * (0.94 + 0.2 * vnoise2(dir * 2.0 + 70.0));
  float keep = smoothstep(rim, rim - 0.9, r) * smoothstep(hole, hole + 0.12, r);
  if (j2 > keep) {
    cull();
    return;
  }
  float H = mix(BLADE.x, BLADE.y, j3) * (0.75 + 0.5 * vnoise2(xz * 0.9 + 11.0));
  H *= mix(0.55, 1.0, smoothstep(rim, rim - 1.2, r)) * mix(0.65, 1.0, smoothstep(hole, hole + 0.5, r));

  // ---------- how it bends
  vec2 b = (vec2(hash1(id, 5u), hash1(id, 6u)) - 0.5) * 0.4
         + 0.22 * (vec2(vnoise2(xz * 0.5), vnoise2(xz * 0.5 + 31.0)) - 0.5) + vec2(0.12, 0.08);
  float sheen = 0.0;
  float warmW = 0.0;
  // The wind: bands rolling across, whole cycles in a loop, and gusts that
  // go round, so the loop closes.
  float calm = u_wind.x;
  float ph = TAU * t / LOOP_SECONDS;
  vec2 wd = vec2(0.82, 0.572);
  vec2 wp = vec2(-wd.y, wd.x);
  float along = dot(xz, wd);
  float across = dot(xz, wp);
  float w1 = sin(along * 1.3 + across * 0.2 - 13.0 * ph);
  float w2 = sin(along * 2.1 - across * 0.5 - 21.0 * ph + 1.7);
  float w3 = sin(along * 3.4 + across * 0.9 - 34.0 * ph + 4.1);
  float gust = vnoise2(xz * 0.28 + 2.5 * vec2(cos(ph), sin(ph)));
  float wave = (0.5 + 0.8 * gust) * (0.16 * w1 + 0.08 * w2 + 0.045 * w3) + 0.1 * gust;
  b += wd * calm * (wave + 0.035 * sin(TAU * (90.0 * t / LOOP_SECONDS + j0)));
  sheen += calm * 0.55 * max(0.16 * w1 + 0.08 * w2, 0.0) * (0.4 + gust);

  // «Есть мысль»: something runs through the grass and leaves its track,
  // the grass pushed aside and leaning the way it went.
  if (u_swirlS.y > 0.0) {
    float head = u_swirlS.x;
    float hw = u_swirlS.z;
    float best = 1e9;
    float at = 0.0;
    vec2 tang = vec2(1.0, 0.0);
    vec2 near = xz;
    vec2 tip = u_swirl[0];
    for (int k = 0; k < SWIRL_POINTS - 1; k++) {
      float s0 = float(k) / float(SWIRL_POINTS - 1);
      if (s0 >= head) break;
      float s1 = float(k + 1) / float(SWIRL_POINTS - 1);
      vec2 a = u_swirl[k];
      vec2 c = u_swirl[k + 1];
      float cut = clamp((head - s0) / (s1 - s0), 0.0, 1.0);
      vec2 e = mix(a, c, cut);
      tip = e;
      float h;
      float d = segd(xz, a, e, h);
      if (d < best) {
        best = d;
        at = s0 + (s1 - s0) * cut * h;
        tang = normalize(c - a);
        near = mix(a, e, h);
      }
    }
    float x = best / hw;
    if (x < 3.0) {
      vec2 side = xz - near;
      side = length(side) > 1e-5 ? side / length(side) : vec2(-tang.y, tang.x);
      float k = u_swirlS.y * (0.55 + 0.45 * exp(-(head - at) / 0.3));
      b += k * (side * 1.75 * x * exp(-x * x) + tang * 0.55 * exp(-x * x));
      sheen += k * 0.9 * exp(-sq(x / 1.2));
    }
    float dh = length(xz - tip);
    sheen += u_swirlS.y * 0.9 * exp(-sq(dh / 0.32)) * (1.0 - pow(head, 8.0));
  }

  // «Есть эмоция»: a broad warm wave rolls through, a weaker one behind it;
  // after it the grass swings back and stays a little warm.
  if (u_wave.w > 0.0 || u_wave2.y > 0.0) {
    float s = dot(out_, u_wave.xy);
    float g1 = exp(-sq((s - u_wave.z) / u_wave2.z)) * u_wave.w;
    float g2 = exp(-sq((s - u_wave2.x) / u_wave2.z)) * u_wave2.y;
    float behind = max(u_wave.z - s, 0.0);
    float swing = sin(behind * 2.2) * exp(-behind / 1.2) * 0.3 * u_wave.w;
    b += u_wave.xy * (0.95 * (g1 + g2) - swing);
    sheen += 0.75 * (g1 + g2);
    warmW += g1 + g2 + 0.3 * u_wave.w * smoothstep(0.0, 0.8, behind) * exp(-behind / 3.0);
  }

  // «Есть импульс»: a sharp parting runs along its line, the grass thrown
  // to both sides, a flash along it.
  if (u_crackS.y > 0.0 || u_crackS.z > 0.0) {
    vec2 a = u_crack.xy;
    vec2 c = mix(a, u_crack.zw, u_crackS.x);
    float h;
    float x = segd(xz, a, c, h) / u_crackS.w;
    if (x < 8.0) {
      vec2 tang = normalize(u_crack.zw - u_crack.xy);
      vec2 nrm = vec2(-tang.y, tang.x);
      float sgn = dot(xz - a, nrm) >= 0.0 ? 1.0 : -1.0;
      b += nrm * sgn * u_crackS.y * 1.8 * x * exp(-x * x * 0.5);
      sheen += u_crackS.z * exp(-x * x * 0.7) + 0.25 * u_crackS.y * exp(-x * x * 0.12);
    }
  }

  // «Есть напряжение»: the grass wound into a still tight spiral, trembling;
  // «Есть расслабление»: it lets go and a ripple runs out.
  vec2 fromSpiral = xz - u_spiral.xy;
  float rs = length(fromSpiral);
  vec2 radial = fromSpiral / max(rs, 1e-4);
  if (u_spiral.w > 0.0) {
    float R = u_spiral.z;
    if (rs < R * 1.4) {
      vec2 tangent = vec2(-radial.y, radial.x);
      float k = u_spiral.w * smoothstep(R * 1.35, R * 0.6, rs) * smoothstep(0.0, 0.12, rs);
      b = mix(b, (tangent * 0.85 - radial * 0.45) * 1.25, k * 0.85);
      float arm = 0.5 + 0.5 * cos(3.0 * (atan(fromSpiral.y, fromSpiral.x) + 2.6 * log(max(rs, 1e-3) / R) + 2.0 * (1.0 - u_ripple.w)));
      sheen += k * (0.2 + 0.8 * arm * arm * arm);
      b += radial * k * 0.04 * sin(t * 37.0 + j0 * 40.0);
    }
  }
  if (u_ripple.y > 0.0) {
    float x = (rs - u_ripple.x) / u_ripple.z;
    if (abs(x) < 4.0) {
      float k = u_ripple.y * exp(-u_ripple.x / 6.0);
      float g = exp(-x * x) + 0.45 * exp(-sq(x + 2.2));
      b += radial * k * 1.0 * g;
      sheen += k * 1.3 * g;
    }
    b *= 1.0 - 0.35 * u_ripple.y * smoothstep(u_ripple.x + 0.2, u_ripple.x - 0.6, rs);
  }

  // «Есть физиология»: the whole field breathes out from the person.
  if (u_breath.y > 0.0) {
    // Rings run out from the person one breath apart, 4.5 units between them.
    float tb = u_breath.x - r / 1.4;
    if (tb > 0.0) {
      float wv = sin(TAU * tb / 3.2) * u_breath.y;
      b += dir * 0.4 * wv;
      sheen += 0.75 * pow(max(wv, 0.0), 1.5);
      H *= 1.0 + 0.12 * wv;
    }
  }

  // «Не интерпретируй»: the wind almost writes a word, then scatters it.
  if (u_wordS.z > 0.0) {
    vec2 d = xz - u_word.xy;
    float u = dot(d, u_word.zw) / u_wordV.z;
    float v = dot(d, u_wordV.xy) / u_wordV.w;
    if (u > -0.02 && u < 1.02 && v > -0.05 && v < 1.05) {
      vec2 uv = vec2(mix(WORD.x, WORD.z, u), mix(WORD.w, WORD.y, v)) / ATLAS;
      float m = textureLod(u_atlas, uv, 1.0).r;
      float written = smoothstep(u - 0.03, u + 0.03, u_wordS.x);
      float whole = 1.0 - smoothstep(u_wordS.y - 0.04, u_wordS.y + 0.04, u);
      float k = u_wordS.z * m * written;
      float held = k * whole;
      float loose = k * (1.0 - whole) * exp(-max(u - u_wordS.y, 0.0) / 0.12);
      // Written blades lie flat along the line, combed the way it is written.
      b = mix(b, normalize(u_word.zw * 0.9 - u_wordV.xy * 0.35) * 1.25, min(held * 1.2, 1.0));
      b += (vec2(hash1(id, 7u), hash1(id, 8u)) - 0.5) * 2.4 * loose;
      sheen += 1.8 * held + 0.6 * loose;
      warmW += 0.25 * held;
    }
  }

  // The first ring's runners comb the rim as they pass.
  {
    vec2 q = xz - OUTER.xz;
    float rr = length(q);
    float nearRim = smoothstep(FIELD.z - 1.6, FIELD.z - 0.2, rr);
    if (nearRim > 0.0) {
      float th = atan(q.y, q.x);
      float p = fract((th + u_misc.x) / (TAU / 3.0));
      float k = u_misc.z * nearRim * (exp(-p / 0.1) + 0.4 * exp(-(1.0 - p) / 0.03));
      b += vec2(sin(th), -cos(th)) * 0.75 * k;
      sheen += 0.45 * k;
    }
  }

  // ---------- the blade
  float L = length(b);
  float fold = min(L, 1.25);
  vec2 bf = b * (fold / max(L, 1e-4));
  float lean = 1.0 - 0.42 * fold * fold;
  vec3 P0 = vec3(xz.x, 0.0, xz.y);
  vec3 P1 = vec3(xz.x + bf.x * H * 0.28, H * 0.55 * (1.0 - 0.2 * fold), xz.y + bf.y * H * 0.28);
  vec3 P2 = vec3(xz.x + bf.x * H * 0.85, H * max(0.2, lean), xz.y + bf.y * H * 0.85);
  int level = vid >> 1;
  float s = level == 0 ? 0.0 : level == 1 ? 0.38 : level == 2 ? 0.72 : 1.0;
  float side = vid == 6 ? 0.0 : (vid & 1) == 0 ? -1.0 : 1.0;
  vec3 P = (1.0 - s) * (1.0 - s) * P0 + 2.0 * s * (1.0 - s) * P1 + s * s * P2;
  vec3 T = 2.0 * (1.0 - s) * (P1 - P0) + 2.0 * s * (P2 - P1);
  vec3 v = P - u_eye.xyz;
  float vz = dot(v, u_fwd.xyz);
  if (vz < NEAR * 4.0) {
    cull();
    return;
  }
  vec2 ndc = vec2(dot(v, u_right.xyz), dot(v, u_up.xyz)) / (vz * u_fwd.w) * u_view.xy;
  vec3 v2 = v + T * 0.01;
  float vz2 = max(dot(v2, u_fwd.xyz), NEAR);
  vec2 ndc2 = vec2(dot(v2, u_right.xyz), dot(v2, u_up.xyz)) / (vz2 * u_fwd.w) * u_view.xy;
  vec2 tpx = (ndc2 - ndc) * u_view.zw * 0.5;
  vec2 npx = length(tpx) > 1e-6 ? normalize(vec2(-tpx.y, tpx.x)) : vec2(1.0, 0.0);
  float focal = u_view.y * u_view.w * 0.5 / u_fwd.w;
  float hw = 0.0042 * (0.8 + 0.4 * j3) * (1.0 - 0.75 * s);
  float hwpx = hw * focal / vz;
  float drawn = max(hwpx, 0.6);
  ndc += npx * side * drawn / (u_view.zw * 0.5);
  gl_Position = vec4(ndc * vz, (FAR + NEAR) / (FAR - NEAR) * vz - 2.0 * FAR * NEAR / (FAR - NEAR), vz);

  // ---------- its light
  float fog = exp(-max(vz - 3.0, 0.0) / 7.0);
  float bright = 0.4 * (0.2 + 0.12 * j0) * fog + 0.75 * sheen * mix(1.0, fog, 0.5);
  vec3 mist = mix(u_cold, u_pale, 0.55);
  vec3 col = mix(mist, u_warm, clamp(warmW, 0.0, 1.0) * 0.85);
  col = mix(col, u_pale, clamp(sheen - 0.6, 0.0, 1.0) * 0.4);
  v_light = col * (0.05 * fog + 0.85 * bright) * mix(0.25, 1.0, pow(s, 0.7)) * (hwpx / drawn) * u_wind.z;
  v_across = side;
}
