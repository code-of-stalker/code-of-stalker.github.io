#version 300 es
precision highp float;
// The lens's blur (each pixel gathers the neighbours whose blur circle
// reaches it), a quiet band under the words, grain and the soft edges into
// the page. A light page never gets lighter than the page.
uniform sampler2D u_scene;
uniform vec2 u_res;       // canvas px
uniform vec3 u_paper;
uniform vec3 u_backdrop;
uniform vec4 u_post;      // light page, words shown, grain seed, soft edges
uniform vec4 u_edges;     // left, right, top, bottom
in vec2 v_uv;
out vec4 o;
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main() {
  float px = u_res.y / 1024.0;
  vec4 c0 = texture(u_scene, v_uv);
  float s0 = (c0.a - 0.5) * 44.0;
  float r0 = abs(s0) * px;
  vec3 acc = c0.rgb;
  float w = 1.0;
  const int N = 56;
  float reach = 22.0 * px;
  for (int i = 0; i < N; i++) {
    float r = sqrt((float(i) + 0.5) / float(N)) * reach;
    float a = float(i) * 2.39996;
    vec4 s = texture(u_scene, v_uv + r * vec2(cos(a), sin(a)) / u_res);
    float ss = (s.a - 0.5) * 44.0;
    float rs = abs(ss) * px;
    // what lies behind a sharp pixel does not spill over it
    if (ss > s0) rs = min(rs, r0 * 1.5 + 0.5);
    float k = smoothstep(r - 1.0, r + 0.5, rs);
    acc += s.rgb * k;
    w += k;
  }
  vec3 c = acc / w;
  vec2 q = v_uv - 0.5;
  if (u_post.x < 0.5) {
    c = mix(u_paper, c, 1.0 - 0.5 * dot(q, q));
    // the words sit on a darker strip of sand
    c = mix(c, u_paper, 0.72 * u_post.y * smoothstep(0.34, 0.02, v_uv.y) * (1.0 - 1.4 * q.x * q.x));
    c += (hash(gl_FragCoord.xy + u_post.z) - 0.5) * 0.018;
  } else {
    c = mix(c, u_paper, 0.6 * u_post.y * smoothstep(0.34, 0.02, v_uv.y) * (1.0 - 1.4 * q.x * q.x));
  }
  c += (hash(gl_FragCoord.xy * 1.37) - 0.5) / 255.0;
  if (u_post.w > 0.5) {
    float m = smoothstep(0.0, u_edges.x, v_uv.x) * smoothstep(0.0, u_edges.y, 1.0 - v_uv.x)
            * smoothstep(0.0, u_edges.z, 1.0 - v_uv.y) * smoothstep(0.0, u_edges.w, v_uv.y);
    c = mix(u_backdrop, c, m);
  }
  if (u_post.x > 0.5) c = min(c, max(u_paper, u_backdrop));
  o = vec4(clamp(c, 0.0, 1.0), 1.0);
}
