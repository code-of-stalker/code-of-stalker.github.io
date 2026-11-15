// The two layers put together: him over the city, each sharp or blurred by
// its own circle of confusion (u_blur, px of an 800 px frame). Over the city
// goes what is brighter than a frame holds, drawn here as a lens shows it:
// the first ring with its ticks, its trail and its runners, the lamps of the
// far embankment and of the bridge, and, once the city melts, its windows'
// discs. Then a soft shoulder for piled light, the edges melted into the
// page, a dither.

uniform sampler2D u_far;
uniform sampler2D u_near;
uniform sampler2D u_farBlur;
uniform sampler2D u_nearBlur;
uniform vec4 u_run[RUNNERS]; // the first ring's runners: frame x, y, light
uniform vec4 u_edges;

// A point of light r px@800 from its centre, I bright, through a lens whose
// circle of confusion is R px@800: a small sharp point that opens into a
// disc as dim as it is wide, a little brighter at its rim.
float spot(float r, float R, float I) {
  float sharp = exp(-sq(r / 1.3));
  float disc = (1.0 - smoothstep(R - 0.9, R + 0.9, r)) * (0.7 + 0.3 * smoothstep(0.5 * R, R, r));
  disc *= clamp(6.0 / max(R * R, 1e-3) + 0.06, 0.0, 1.0);
  return I * mix(sharp, disc, smoothstep(0.8, 3.0, R));
}

// The lamps along the far embankment and on the bridge, and the windows'
// discs once the city is soft enough; `per` is px@800 a radian.
float cityLights(vec3 rd, float R, float per) {
  vec2 ch = cityAt(rd);
  float s = 0.0;
  float i0 = floor(ch.x / LAMP_STEP + 0.5);
  for (int k = -1; k <= 1; k++) {
    float i = i0 + float(k);
    float light = lampLight(i);
    if (light > 0.0) s += spot(length(rd - cityWay(i * LAMP_STEP, LAMP_HEIGHT)) * per, R, 0.9 * light);
  }
  float j = clamp(floor((ch.x - BRIDGE_LAMPS.x) / BRIDGE_LAMPS.y + 0.5), 0.0, 9.0);
  s += spot(length(rd - cityWay(BRIDGE_LAMPS.x + j * BRIDGE_LAMPS.y, BRIDGE_LAMPS.z)) * per, R, 0.75);
  if (R > 2.0) {
    float fade = smoothstep(2.0, 6.0, R);
    vec2 cell = vec2(0.02, 0.01);
    vec2 c0 = floor(ch / cell);
    for (int a = -1; a <= 1; a++) {
      for (int b = -2; b <= 2; b++) {
        vec2 c = c0 + vec2(float(a), float(b));
        if (hash2(c, 61u) > 0.13) continue;
        vec2 at = (c + vec2(hash2(c, 62u), hash2(c, 63u))) * cell;
        if (at.y < 0.006 || at.y > 0.066 || at.y > roofs(at.x) - 0.004) continue;
        s += fade * spot(length(rd - cityWay(at.x, at.y)) * per, R, 0.22 + 0.2 * hash2(c, 64u));
      }
    }
  }
  return s;
}

void main() {
  vec2 frag = gl_FragCoord.xy;
  setup(frag);
  vec2 f = frameAt(frag);
  vec3 rd = rayAt(f);
  float k800 = px800();
  // The first ring, and a pixel's size along it (the angle has two cuts so
  // one of them is always smooth).
  vec3 rg = firstRing(u_eye.xyz, rd);
  float a2 = rg.y < 0.0 ? rg.y + TAU : rg.y;
  float pxT = max(min(fwidth(rg.y), fwidth(a2)), 1e-7);

  float Rn = u_blur.x;
  float Rf = u_blur.y;
  ivec2 ip = ivec2(frag);
  vec4 near = mix(texelFetch(u_near, ip, 0), texture(u_nearBlur, v_uv), smoothstep(0.3, 1.5, Rn * k800));
  vec3 far = mix(texelFetch(u_far, ip, 0).rgb, texture(u_farBlur, v_uv).rgb, smoothstep(0.3, 1.5, Rf * k800));

  // The lights of the far layer.
  float per = 1.0 / (pxA * k800);
  vec3 lamp = mix(u_pale, u_cold, 0.2);
  vec3 light = lamp * cityLights(rd, Rf, per);
  if (rg.z > 0.0) {
    // px@800 off the ring, + below it, where the ticks hang.
    float d = -rg.x * (u_ring1.y < 0.0 ? -1.0 : 1.0) / pxA / k800;
    float w = 1.15;
    float wb = sqrt(w * w + sq(0.55 * Rf));
    float core = exp(-sq(d / wb)) * w / wb * (1.0 + max(Rf - 1.5, 0.0) / 7.0);
    float glow = 0.12 * exp(-sq(d / (7.0 + Rf)));
    float tail = exp(-behindRunner(rg.y) / 0.115);
    // Ticks hang outward every 4 degrees, long and short by turns.
    float step4 = TAU / 90.0;
    float ki = floor(rg.y / step4 + 0.5);
    float dt = (rg.y - ki * step4) / pxT / k800;
    float len = mod(ki, 2.0) < 0.5 ? 5.0 : 2.75;
    float along = smoothstep(-0.5, 0.5, d) * (1.0 - smoothstep(len - 0.5, len + 0.5, d));
    float tick = exp(-sq(dt / 0.7)) * along * exp(-Rf / 3.0);
    light += u_ring2.w * (u_cold * (0.85 * core + glow + 0.45 * tick) + mix(u_cold, u_pale, 0.45) * 0.8 * tail * core);
  }
  // Its runners.
  float s = 1.0 + Rf / 6.0;
  float run = 0.0;
  for (int k = 0; k < RUNNERS; k++) {
    vec4 r = u_run[k];
    if (r.z <= 0.0) continue;
    float d = length(f - r.xy) / pixel / k800;
    run += r.z * (spot(d, Rf, 1.3) + (0.5 * exp(-sq(d / (9.0 * s))) + 0.2 * exp(-d / (10.0 * s))) / s);
  }
  light += mix(u_cold, u_pale, 0.5) * u_ring2.w * run;

  vec3 col = near.rgb / ENCODE + (far + light) * (1.0 - near.a);
  // A soft shoulder where light piles up, then the edges melt into the page.
  vec3 over = 0.7 + 0.3 * (1.0 - exp(-(col - 0.7) / 0.3));
  col = mix(col, over, step(0.7, col));
  if (u_blur.z > 0.5) {
    float e = smoothstep(0.0, u_edges.x, v_uv.x) * smoothstep(0.0, u_edges.y, 1.0 - v_uv.x)
            * smoothstep(0.0, u_edges.z, 1.0 - v_uv.y) * smoothstep(0.0, u_edges.w, v_uv.y);
    col = mix(bg, col, e);
  }
  col += (hash2(frag * 1.37 + 0.5, 0u) - 0.5) / 255.0;
  o = vec4(clamp(col, 0.0, 1.0), 1.0);
}
