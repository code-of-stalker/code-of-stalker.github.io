// The room as a cloud of points: one for every STRIDE × STRIDE pixels of
// Art's painting, placed in 3D by the depth map, moved by the list's
// layers, lit by the scanner, seen by the moving head.
uniform sampler2D u_room;
uniform vec4 u_wake;       // the opening plane's z, how awake the room is, -, -
uniform vec4 u_sound[3];   // source xyz, age in seconds
uniform vec4 u_soundOn;    // each front's strength
out vec3 v_color;

void main() {
  uint seed = uint(gl_VertexID);
  ivec2 cell = ivec2(gl_VertexID % COLUMNS, gl_VertexID / COLUMNS);
  vec2 jitter = vec2(rand(seed * 2u), rand(seed * 2u + 1u));
  vec2 src = (vec2(cell) + 0.15 + 0.7 * jitter) * STRIDE;
  vec2 s = surface(ivec2(src));
  bool outside = isOutside(s.y);
  bool curtain = s.y > 0.75;
  float z = s.x;
  vec3 home = vec3((src.x - CENTRE) / FOCAL * z, (HORIZON - src.y) / FOCAL * z, z);
  vec3 p = home;
  // The point's colour: the painting averaged over its cell.
  vec3 color = textureLod(u_room, src / SIZE, log2(STRIDE) - 0.5).rgb;
  float lum = dot(color, vec3(0.2126, 0.7152, 0.0722));
  // The scanner meets the world outside at the glass.
  vec3 ps = outside ? home * (GLASS / home.z) : home;
  float time = u_px.y;
  float light = 0.0;
  float ring = 0.0;

  // Smells and pressure: the room breathes.
  if (!outside) p = ROOM_CENTRE + (p - ROOM_CENTRE) * u_layers1.z;

  // Sounds: fronts spread from their sources and stir what they cross.
  for (int k = 0; k < 3; k++) {
    vec3 v = ps - u_sound[k].xyz;
    float d = length(v);
    float x = (d - u_sound[k].w * SOUND_SPEED) / 0.2;
    float f = exp(-x * x) * u_soundOn[k] / (1.0 + 0.4 * d);
    p += (outside ? home.z / GLASS : 1.0) * v / max(d, 1e-3) * 0.03 * f;
    light += 0.5 * f;
    ring += f;
  }

  // Movement: the trees outside sway, the moon stays; the curtain stirs.
  float move = u_layers0.y;
  if (outside && distance(src, MOON) > 48.0) {
    float height = clamp((p.y + 1.5) / 6.5, 0.0, 1.0);
    p.x += move * height * (0.14 * sin(TAU * 0.3 * time + p.y * 0.5)
                          + 0.03 * sin(TAU * 1.1 * time + p.x * 3.0 + p.y * 2.0));
  }
  if (curtain) {
    float fall = clamp((src.y - 40.0) / 680.0, 0.0, 1.0);
    float wave = TAU * 0.25 * time - src.y / 160.0;
    p.x += move * 0.035 * fall * fall * sin(wave);
    p.z += move * 0.02 * fall * sin(wave + 1.2);
    // Temperature: the draft lifts its hem into the room.
    float lift = u_layers0.z * fall * fall * (0.85 + 0.15 * sin(TAU * 0.3 * time + fall * 2.0));
    p.z -= 0.16 * lift;
    p.x += 0.06 * lift;
  }

  // Light and shadow: the lit grows brighter, the shadows deeper.
  color *= mix(1.0, mix(0.55, 1.7, smoothstep(0.05, 0.22, lum)), u_layers0.w);

  // The finest vibrations: every point trembles a hair, and the room glows.
  float tremble = u_layers1.y;
  if (tremble > 0.0) {
    vec3 dir = vec3(rand(seed * 3u + 7u), rand(seed * 3u + 8u), rand(seed * 3u + 9u)) - 0.5;
    p += dir * tremble * 0.008 * sin(TAU * 7.0 * time + rand(seed + 5u) * TAU);
    light += tremble * 0.15;
  }

  // The scanner: the band on the point now, and the light it keeps.
  vec2 a = scanned(ps, 0);
  vec2 b = scanned(ps, 1);
  float band = max(a.x, b.x);
  float after = a.y + b.y;
  // The opening plane wakes the room; it sleeps again as the loop closes.
  float awake = smoothstep(-0.2, 0.2, u_wake.x - ps.z) * u_wake.y;

  vec3 v = toView(p);
  if (v.z < 0.1) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    gl_PointSize = 1.0;
    v_color = vec3(0.0);
    return;
  }
  gl_Position = toClip(v);
  float spacing = STRIDE * u_px.x * u_cam.w * home.z / v.z;
  gl_PointSize = clamp(spacing * DOT_SPRITE * (1.0 + 0.5 * band), 1.0, 64.0);
  vec3 lit = color * mix(DIM, 1.0, awake) * (1.0 + light + 0.6 * after)
           + u_glow * (0.45 * band * (0.35 + 2.0 * lum) + 0.04 * after + 0.06 * ring);
  v_color = lit * DOT_GAIN;
}
