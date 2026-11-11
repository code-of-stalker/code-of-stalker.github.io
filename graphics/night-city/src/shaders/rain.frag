// A streak's light: soft across, rounded at its ends, hidden behind what the
// world drew nearer.
in vec2 v_q;
in vec2 v_light;
in float v_z;
in float v_len;
out vec4 o;
uniform sampler2D u_world;

void main() {
  float world = texture(u_world, gl_FragCoord.xy / u_res.xy).b;
  float mine = v_z / (v_z + 8.0);
  float seen = smoothstep(-0.002, 0.004, world - mine);
  // Half widths from the streak's core segment: round caps at both ends.
  float r = length(vec2(v_q.x, max(abs(v_q.y) - v_len, 0.0)));
  float shape = 1.0 - smoothstep(0.35, 1.0, r);
  o = vec4(v_light * shape * seen, 0.0, 0.0);
}
