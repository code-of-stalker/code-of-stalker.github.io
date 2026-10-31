// What moves in the air of the room, one kind a draw (u_kind.x):
// 0 motes, 1 the draft's streams, 2 the wisp over the cup, 3 the fine
// lattice of space. Hidden behind whatever is painted in front of it.
uniform vec4 u_kind;   // kind, -, -, -
out vec3 v_color;

// Distance from p to the segment a-b.
float segment(vec3 p, vec3 a, vec3 b) {
  vec3 ab = b - a;
  float t = clamp(dot(p - a, ab) / dot(ab, ab), 0.0, 1.0);
  return length(p - a - ab * t);
}

void main() {
  int kind = int(u_kind.x);
  int i = gl_VertexID;
  float time = u_px.y;
  float loop = time / LOOP_SECONDS;
  vec3 p;
  float bright;
  float size;
  if (kind == 0) {
    // Motes rise through the room, whole room heights a loop, and sway;
    // in the moonbeam they catch the light.
    uint s = uint(i) * 11u + 1u;
    float rise = fract(rand(s) + loop * (1.0 + floor(rand(s + 1u) * 2.0)));
    p = vec3(mix(-2.4, 2.4, rand(s + 2u)), mix(-1.0, 1.65, rise), mix(1.75, 3.4, rand(s + 3u)));
    p.x += 0.05 * sin(TAU * loop * (3.0 + floor(rand(s + 4u) * 4.0)) + rand(s + 5u) * TAU);
    p.z += 0.04 * sin(TAU * loop * (2.0 + floor(rand(s + 6u) * 3.0)) + rand(s + 7u) * TAU);
    float fade = smoothstep(0.0, 0.08, rise) * (1.0 - smoothstep(0.92, 1.0, rise));
    float beam = 1.0 - smoothstep(0.3, 0.6, segment(p, BEAM_TOP, BEAM_FLOOR));
    bright = fade * (0.03 + beam * (0.08 + 0.5 * u_layers0.w) + 0.1 * u_layers0.y) * (0.5 + rand(s + 8u));
    size = 0.007;
  } else if (kind == 1) {
    // Cold air pours over the sill, sinks to the floor and runs toward us,
    // around the chair; four dots a particle draw its trail.
    int tail = i % 4;
    uint s = uint(i / 4) * 7u + 3u;
    float lane = rand(s);
    float a = fract(time / 4.0 + rand(s + 1u)) - float(tail) * 0.012;
    vec3 from = vec3(mix(-1.6, -0.5, lane), -0.28, GLASS - 0.05);
    vec3 to = vec3(mix(-1.2, 1.6, lane), -0.93, 1.75);
    p = mix(from, to, a);
    p.y = mix(-0.28, -0.93 + 0.06 * rand(s + 2u), smoothstep(0.0, 0.3, a));
    p.x += 0.05 * sin(TAU * (a * 2.0 + rand(s + 3u)) + time * 0.7);
    vec2 off = p.xz - vec2(1.1, 2.45);
    float r = length(off);
    if (r < 0.45) p.xz += off / max(r, 1e-3) * (0.45 - r);
    bright = u_layers0.z * pow(sin(PI * clamp(a, 0.0, 1.0)), 1.5) * 0.5
           * (1.0 - float(tail) * 0.22) * (0.5 + rand(s + 4u));
    size = 0.007;
  } else if (kind == 2) {
    // A wisp curls up from the cup.
    int tail = i % 4;
    uint s = uint(i / 4) * 5u + 9u;
    float a = fract(time / 5.0 + rand(s)) - float(tail) * 0.01;
    float swirl = TAU * (a * 1.3 + rand(s + 1u) * 0.25) + time * 0.5;
    float spread = 0.4 + 2.5 * a;
    p = CUP + vec3(0.03 * sin(swirl) * spread + 0.08 * a * a, 0.6 * a, 0.025 * cos(swirl) * spread);
    bright = u_layers1.x * pow(sin(PI * clamp(a, 0.0, 1.0)), 2.0) * 0.06 * (0.5 + rand(s + 2u));
    size = 0.004 + 0.004 * a;
  } else {
    // The finest vibrations: a lattice of points through the room's air,
    // each twinkling a whole number of times a loop.
    ivec3 g = ivec3(i % 13, (i / 13) % 7, i / 91);
    uint s = uint(i) * 3u + 17u;
    p = vec3(mix(-2.3, 2.3, float(g.x) / 12.0), mix(-0.85, 1.4, float(g.y) / 6.0), mix(1.85, 3.35, float(g.z) / 7.0));
    p += 0.004 * sin(TAU * 9.0 * time + rand(s) * TAU) * (vec3(rand(s + 1u), rand(s + 2u), rand(s + 3u)) - 0.5);
    bright = u_layers1.y * 0.14 * (0.55 + 0.45 * sin(TAU * loop * (5.0 + floor(rand(s + 4u) * 8.0)) + rand(s + 5u) * TAU));
    size = 0.005;
  }
  vec3 v = toView(p);
  if (v.z < 0.1 || bright <= 0.0 || p.z > behind(p) - 0.02) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    gl_PointSize = 1.0;
    v_color = vec3(0.0);
    return;
  }
  gl_Position = toClip(v);
  gl_PointSize = clamp(2.8 * size * FOCAL * u_px.x * u_cam.w / v.z * 2.0, 1.5, 40.0);
  v_color = u_glow * bright;
}
