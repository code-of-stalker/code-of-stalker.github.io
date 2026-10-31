// Round glows: the motes of the world outside (kind 0), the point and the
// runner (1), the glints where the sphere's lines cross (2). Each instance
// is a square three blurred widths out from its centre (sprite.frag).
out vec3 v_color;
out vec2 v_q;

// The point's and the runner's glows: core, halo, aura; light and size
// (sigma, of the canvas height).
const float GLOW_LIGHT[3] = float[3](2.4, 0.45, 0.07);
const float GLOW_SIZE[3] = float[3](0.0022, 0.018, 0.07);

void main() {
  int i = gl_InstanceID;
  float breath = u_up.w;
  vec3 p;
  float light;
  float sigma0;
  // How far the lens may blur this glow, px.
  float most = 0.05 * u_view.w;
  if (u_kind.x < 0.5) {
    bool near = i < NEAR_MOTES;
    uint seed = uint(i) * 8u + 11u;
    float y = rand(seed) * 2.0 - 1.0;
    float az = rand(seed + 1u) * TAU;
    float k = rand(seed + 2u);
    float r = near ? mix(NEAR_SHELL.x, NEAR_SHELL.y, pow(k, 1.6)) : mix(FAR_SHELL.x, FAR_SHELL.y, k);
    float flat_r = sqrt(1.0 - y * y);
    vec3 dir = vec3(flat_r * sin(az), y, flat_r * cos(az));
    p = dir * r;
    float w = TAU * u_right.w / LOOP_SECONDS;
    float phase = rand(seed + 3u) * TAU;
    if (near) {
      // A slow drift, whole cycles a loop.
      p += 0.05 * vec3(sin(w + phase), sin(2.0 * w + 1.7 * phase), sin(3.0 * w + 0.6 * phase));
    }
    // Each mote breathes at its own pace, whole breaths a loop.
    float pace = floor(2.0 + 4.0 * rand(seed + 5u));
    float twinkle = 0.7 + 0.3 * sin(pace * w + phase);
    // What the runner looks out at as it passes, and the named directions.
    float looked = MOTE_RUNNER * trail(az) * pow(flat_r, 3.0);
    float seen = 1.0 + MOTE_SEEN * (caps(dir) + looked);
    light = (near ? NEAR_LIGHT : FAR_LIGHT) * mix(0.3, 1.0, rand(seed + 4u)) * twinkle * seen;
    sigma0 = (near ? 0.0013 : 0.0009) * u_view.w;
    // The far world stays sharp, like stars.
    if (!near) most = FAR_BLUR * u_view.w;
  } else if (u_kind.x < 1.5) {
    // The point's core, halo and aura (0-2), the runner's core and halo (3-4).
    bool runner = i >= 3;
    int layer = runner ? i - 3 : i;
    float pulse = 1.0 + 0.25 * sin(TAU * u_right.w / BREATH);
    p = runner ? onRing(u_runner.x, breath * u_build.x) : vec3(0.0);
    light = (runner ? u_runner.y * u_build.y : u_build.w * pulse) * GLOW_LIGHT[layer];
    sigma0 = GLOW_SIZE[layer] * u_view.w * (runner ? 1.0 : pulse);
  } else {
    // Meridian c crosses latitude l on side s (0 the meridian's front half,
    // 1 its back); the last two are the poles.
    if (i >= NODES - 2) {
      p = vec3(0.0, i == NODES - 2 ? 1.0 : -1.0, 0.0);
    } else {
      int c = i / 10;
      int k = i - c * 10;
      int l = k % 5;
      float lat = l == 0 ? 0.0 : LATITUDES[l - 1] * u_sphere.z;
      float lon = MERIDIAN_FROM + float(c) * (PI / float(MERIDIANS)) * u_sphere.y + float(k / 5) * PI;
      p = vec3(cos(lat) * sin(lon), sin(lat), cos(lat) * cos(lon));
    }
    light = u_sphere.w * NODE_LIGHT * smoothstep(0.8, 1.0, u_sphere.z) * (1.0 + CAP_GAIN * caps(p));
    p *= breath;
    sigma0 = 0.0016 * u_view.w;
  }
  vec3 v = toView(p);
  if (v.z < 0.3 || light <= 0.0) {
    gl_Position = vec4(0.0, 0.0, 2.0, 1.0);
    return;
  }
  float blur = lensBlur(v.z);
  float sigma = max(min(sqrt(sigma0 * sigma0 + blur * blur), most), sigma0);
  int corner = gl_VertexID;
  vec2 q = vec2(corner == 1 || corner == 2 || corner == 4 ? 1.0 : -1.0,
                corner == 2 || corner == 4 || corner == 5 ? 1.0 : -1.0) * 3.0;
  gl_Position = pxToClip(toPx(v) + q * sigma);
  v_q = q;
  // A blurred glow keeps its light, spread wider; a mote of the world keeps
  // more, so the foreground reads as soft out-of-focus light. Nothing flares
  // right at the lens. The sphere's glints dim on its far side like its
  // lines.
  float spread = sigma0 / sigma;
  float kept = u_kind.x < 0.5 ? spread : spread * spread;
  float side = u_kind.x > 1.5 ? nearSide(v.z) : 1.0;
  v_color = u_glow * light * side * kept * smoothstep(0.3, 1.0, v.z);
}
