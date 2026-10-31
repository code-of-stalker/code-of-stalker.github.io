#version 300 es
precision highp float;
// A quiet band under the words, grain and the soft edges into the page. On
// a light page the scene was lit on black: its light is laid on the page in
// the lamp's color, deepening to ink only where it is strongest, and
// nothing gets lighter than the page.
uniform sampler2D u_scene;
uniform vec3 u_paper;
uniform vec3 u_backdrop;
uniform vec3 u_lamp;
uniform vec3 u_ink;
uniform vec4 u_post;      // light page, words shown, grain seed, soft edges
uniform vec4 u_edges;     // left, right, top, bottom
in vec2 v_uv;
out vec4 o;
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main() {
  vec3 c = texture(u_scene, v_uv).rgb;
  vec2 q = v_uv - 0.5;
  float strip = u_post.y * smoothstep(0.3, 0.02, v_uv.y) * (1.0 - 1.4 * q.x * q.x);
  if (u_post.x < 0.5) {
    c = mix(u_paper, c, 1.0 - 0.5 * dot(q, q));
    // the words sit on a darker strip of the table
    c = mix(c, u_paper, 0.72 * strip);
    c += (hash(gl_FragCoord.xy + u_post.z) - 0.5) * 0.018;
  } else {
    float a = 1.0 - exp(-2.4 * max(c.r, max(c.g, c.b)));
    // an S-curve keeps faint light near the page and pulls lit forms to ink
    a = a * a * (3.0 - 2.0 * a);
    a *= 1.0 - 0.6 * strip;
    c = a < 0.55 ? mix(u_paper, u_lamp, a / 0.55) : mix(u_lamp, u_ink, (a - 0.55) / 0.45);
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
