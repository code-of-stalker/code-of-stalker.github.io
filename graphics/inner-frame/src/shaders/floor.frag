// The page and the floor of the drawing: each pixel's ray meets the floor
// (y = 0) and reads a fine grid with a coarser one over it, fading out with
// distance and where its lines would crowd closer than a pixel. When the
// floor vibrates, rings run out from the epicentre: the grid ripples and
// brightens on each front. The `#define`s come from lib.rs (browser.rs).
precision highp float;
in vec2 v_uv;
out vec4 o;
uniform vec4 u_eye;   // camera position, loop time
uniform vec4 u_right;
uniform vec4 u_up;
uniform vec4 u_fwd;
uniform vec4 u_view;  // focal x, focal y, width, height (px)
uniform vec4 u_frame; // px of a 720-high frame, the grid's light, density, -
uniform vec4 u_quake; // epicentre x, z; seconds since the vibration began; its light
uniform vec3 u_cold;
uniform vec3 u_backdrop;
uniform vec4 u_edges;
uniform vec4 u_out;

float hash(vec2 p) {
  vec3 q = fract(vec3(p.xyx) * 0.1031);
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}

// One family of grid lines `step` apart, `width` px wide, faded where they
// would crowd closer than a few pixels.
float grid(vec2 p, float step, float width) {
  vec2 q = p / step;
  vec2 w = max(fwidth(q), vec2(1e-5));
  vec2 g = abs(fract(q - 0.5) - 0.5) / (w * width);
  float line = 1.0 - min(min(g.x, g.y), 1.0);
  return line * (1.0 - smoothstep(0.18, 0.45, max(w.x, w.y)));
}

void main() {
  vec2 frag = gl_FragCoord.xy;
  vec2 lens = (frag / u_view.zw * 2.0 - 1.0) / u_view.xy;
  vec3 rd = normalize(u_fwd.xyz + u_right.xyz * lens.x + u_up.xyz * lens.y);
  // Every pixel computes the same, so the grid's derivatives stay defined;
  // the sky above the horizon is masked out.
  float down = step(rd.y, -1e-4);
  float t = -u_eye.y / min(rd.y, -1e-4);
  vec2 p = u_eye.xz + rd.xz * t;

  // The vibration's rings: a ripple and a brighter front each.
  float front = 0.0;
  vec2 away = p - u_quake.xy;
  float d = length(away);
  vec2 dir = away / max(d, 1e-4);
  vec2 shift = vec2(0.0);
  for (int j = 0; j < 3; j++) {
    float r = QUAKE.x * (u_quake.z - QUAKE.y - QUAKE.z * float(j));
    float x = d - r;
    float env = r > 0.0 ? exp(-x * x / 0.02) : 0.0;
    front += env;
    shift += dir * 0.022 * env * sin(x * 38.0);
  }
  front *= u_quake.w;
  p += shift * u_quake.w;

  float fade = 1.0 - smoothstep(GRID_REACH.x, GRID_REACH.y, length(p));
  float width = max(1.0, 0.8 * u_frame.x);
  float minor = grid(p, GRID_STEP.x, width);
  float major = grid(p, GRID_STEP.y, 1.25 * width);
  float light = (GRID_LIGHT.x * minor + GRID_LIGHT.y * major) * (1.0 + 2.5 * front);
  vec3 c = u_cold * light * fade * u_frame.y * down;
  if (u_out.x > 0.5) {
    c *= smoothstep(0.0, u_edges.x, v_uv.x) * smoothstep(0.0, u_edges.y, 1.0 - v_uv.x)
       * smoothstep(0.0, u_edges.z, 1.0 - v_uv.y) * smoothstep(0.0, u_edges.w, v_uv.y);
  }
  c = u_backdrop + c + (hash(frag * 1.37 + 0.5) - 0.5) / 255.0;
  o = vec4(clamp(c, 0.0, 1.0), 1.0);
}
