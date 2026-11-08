// The rain, the drops the step throws up out of the puddle and those that
// bounce off his palm: one streak each, drawn out by its fall in one frame's
// exposure and widened by the lens's blur, lit by the lamps it passes (most
// when the lamp is behind it), the shops' spill and the voice's shells.
out vec2 v_q;
out vec2 v_light;
out float v_z;
out float v_len;

#define RAIN_TOTAL (RAIN + SPLASH + PALM_DROPS)
const float GRAVITY = 9.8;

// The lamps' light on a drop at p seen along view (toward the eye), cold and
// warm: water throws light forward, so a drop between the eye and a lamp
// shines brightest.
vec2 rainLight(vec3 p, vec3 view) {
  vec2 l = vec2(0.0);
  for (int side = 0; side < 2; side++) {
    float s = side == 0 ? 1.0 : -1.0;
    float k0 = floor(p.z / LAMP_GAP - lampOffset(s) + 0.5);
    for (int j = -1; j <= 1; j++) {
      float k = k0 + float(j);
      vec3 d = p - lampHead(s, k);
      float d2 = dot(d, d);
      float phase = 0.4 + 2.0 * pow(max(dot(d * inversesqrt(d2), view), 0.0), 4.0);
      float i = LAMP_LIGHT * lampFlicker(s, k) * lampCone(d) * phase / max(d2, 0.25);
      if (side == 0) l.x += i; else l.y += i;
    }
  }
  return l + shopSpill(p) + vec2(0.01, 0.008);
}

void hide() {
  gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
  v_q = vec2(0.0);
  v_light = vec2(0.0);
  v_z = 0.0;
  v_len = 0.0;
}

void main() {
  int id = gl_InstanceID;
  vec2 q = vec2[6](vec2(-1.0, -1.0), vec2(1.0, -1.0), vec2(1.0, 1.0),
                   vec2(-1.0, -1.0), vec2(1.0, 1.0), vec2(-1.0, 1.0))[gl_VertexID];
  uint u = uint(id);
  vec3 a, b;
  float light = RAIN_LIGHT;
  if (id < RAIN) {
    // A drop of the lattice that wraps round the box about RAINC: one loop
    // later each is where it was, the box one REPEAT on.
    vec3 box = vec3(RAIN_BOX_X, RAIN_BOX_Y, RAIN_BOX_Z);
    vec3 r = vec3(rand(u * 3u + 1u), rand(u * 3u + 2u), rand(u * 3u + 3u));
    vec3 vel = vec3(RAIN_BOX_X / LOOP, -RAIN_FALL, 0.0);
    vec3 lo = RAINC.xyz - 0.5 * box;
    vec3 p = lo + mod(r * box + vel * TIME - lo, box);
    vec3 e = min(p - lo, lo + box - p);
    light *= smoothstep(0.0, 2.0, e.x) * smoothstep(0.0, 1.5, e.y) * smoothstep(0.0, 3.0, e.z);
    float floor_ = groundAt(p.x);
    if (p.y < floor_) {
      // Fallen: a splash dot for a moment where it struck.
      float since = (floor_ - p.y) / RAIN_FALL;
      if (since > 0.12) { hide(); return; }
      a = vec3(p.x, floor_ + 0.01 + 0.3 * since, p.z);
      b = a;
      light *= 0.7 * (1.0 - since / 0.12);
    } else {
      a = p;
      b = p - normalize(vel) * RAIN_STREAK;
    }
  } else if (id < RAIN + SPLASH) {
    // The step into the puddle throws a crown of drops.
    int k = id - RAIN;
    int half_ = SPLASH / 2;
    vec4 s = STEP(k / half_);
    float age = s.z;
    float wet = puddle(s.xy);
    if (age > 0.6 || wet < 0.05) { hide(); return; }
    float ang = TAU * (float(k % half_) + rand(u * 7u)) / float(half_);
    float out_ = 0.6 + 0.9 * rand(u * 7u + 1u);
    float up = 1.0 + 1.4 * rand(u * 7u + 2u);
    vec3 v = vec3(cos(ang) * out_, up, sin(ang) * out_) * (0.6 + 0.4 * wet);
    vec3 p = vec3(s.x, 0.0, s.y) + v * age - vec3(0.0, 0.5 * GRAVITY * age * age, 0.0);
    if (p.y < 0.0) { hide(); return; }
    vec3 vn = v - vec3(0.0, GRAVITY * age, 0.0);
    a = p;
    b = p - vn * 0.02;
    light *= 2.2 * wet * (1.0 - age / 0.6);
  } else {
    // Drops bouncing off his palm while he holds it up into the rain.
    int k = id - RAIN - SPLASH;
    if (HAND.w <= 0.0) { hide(); return; }
    float period = 0.5 + 0.4 * rand(u * 5u);
    float age = mod(TIME + period * rand(u * 5u + 1u), period);
    if (age > 0.32) { hide(); return; }
    float ang = TAU * rand(u * 5u + 2u);
    float out_ = 0.3 + 0.7 * rand(u * 5u + 3u);
    float up = 0.7 + 0.9 * rand(u * 5u + 4u);
    vec3 v = vec3(cos(ang) * out_, up, sin(ang) * out_);
    vec3 p = HAND.xyz + vec3(0.0, 0.03, 0.0) + v * age - vec3(0.0, 0.5 * GRAVITY * age * age, 0.0);
    vec3 vn = v - vec3(0.0, GRAVITY * age, 0.0);
    a = p;
    b = p - vn * 0.02;
    light *= 1.6 * HAND.w * (1.0 - age / 0.32) * step(float(k), float(PALM_DROPS) * HAND.w);
  }
  vec3 pa = project(a), pb = project(b);
  float z = 0.5 * (pa.z + pb.z);
  if (min(pa.z, pb.z) < 0.15 || light <= 0.0) { hide(); return; }
  vec3 mid = 0.5 * (a + b);
  vec2 lit = rainLight(mid, normalize(EYE.xyz - mid));
  lit.x += 3.0 * shellRings(mid);
  lit *= exp(-HAZE * z);
  // Thin as a drop, widened by the lens; wide streaks spread their light.
  float coc = blurAt(z);
  float w = clamp(coc, 1.2, 40.0);
  float body = clamp(0.006 / pixelAt(z) / 1.2, 0.12, 1.0);
  v_light = lit * light * body * 1.2 / w * u_res.z;
  v_z = z;
  vec2 d = pb.xy - pa.xy;
  float len = length(d);
  vec2 along = len > 1e-3 ? d / len : vec2(0.0, 1.0);
  vec2 across = vec2(-along.y, along.x);
  float hw = 0.5 * w;
  vec2 px = mix(pa.xy, pb.xy, 0.5 + 0.5 * q.y) + along * q.y * hw + across * q.x * hw;
  v_len = 0.5 * len / hw;
  v_q = vec2(q.x, q.y * (v_len + 1.0));
  gl_Position = vec4(px / u_res.xy * 2.0 - 1.0, 0.0, 1.0);
}
