#version 300 es
precision highp float;
// The light's bloom (the scene's alpha says how much of a pixel is light),
// the night at the loop's seam, grain and the soft edges into the page.
uniform sampler2D u_scene;
uniform vec2 u_res;       // canvas px
uniform vec3 u_paper;
uniform vec3 u_backdrop;
uniform vec4 u_post;      // shown, grain seed, soft edges, unused
uniform vec4 u_edges;     // left, right, top, bottom
in vec2 v_uv;
out vec4 o;
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main() {
  vec3 c = texture(u_scene, v_uv).rgb;
  // Two rings of bloom: a tight one and a wide breath of light.
  vec3 near = vec3(0.0), wide = vec3(0.0);
  float wn = 0.0, ww = 0.0;
  const int N = 40;
  float aspect = u_res.x / u_res.y;
  for (int i = 0; i < N; i++) {
    float k = (float(i) + 0.5) / float(N);
    float a = float(i) * 2.39996;
    vec2 dir = vec2(cos(a) / aspect, sin(a));
    float rn = sqrt(k) * 0.022, rw = sqrt(k) * 0.085;
    vec4 sn = texture(u_scene, v_uv + dir * rn);
    vec4 sw = texture(u_scene, v_uv + dir * rw);
    float gn = exp(-k * 2.5), gw = exp(-k * 2.0);
    near += sn.rgb * sn.a * gn;
    wide += sw.rgb * sw.a * gw;
    wn += gn;
    ww += gw;
  }
  c += near / wn * 0.75 + wide / ww * 0.55;
  vec2 q = v_uv - 0.5;
  c = mix(u_paper, c, 1.0 - 0.55 * dot(q, q));
  c = mix(u_paper, c, u_post.x);
  c += (hash(gl_FragCoord.xy + u_post.y) - 0.5) * 0.016;
  c += (hash(gl_FragCoord.xy * 1.37) - 0.5) / 255.0;
  if (u_post.z > 0.5) {
    float m = smoothstep(0.0, u_edges.x, v_uv.x) * smoothstep(0.0, u_edges.y, 1.0 - v_uv.x)
            * smoothstep(0.0, u_edges.z, 1.0 - v_uv.y) * smoothstep(0.0, u_edges.w, v_uv.y);
    c = mix(u_backdrop, c, m);
  }
  o = vec4(clamp(c, 0.0, 1.0), 1.0);
}
