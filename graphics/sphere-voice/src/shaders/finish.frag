#version 300 es
// The accumulated frame onto its target: a soft shoulder where light piles
// up, the engraving on light themes, and on the canvas the soft edges.
precision highp float;
in vec2 v_uv;
out vec4 o;
uniform sampler2D u_frame;
uniform vec4 u_out;      // straight to the canvas, soft edges, engrave on the page, gain
uniform vec3 u_backdrop; // the page
uniform vec4 u_edges;    // left, right, top, bottom
uniform vec3 u_deep;
uniform vec3 u_mid;
uniform vec4 u_ink;      // engrave white, gamma, where the middle ink sits, -

float luma(vec3 c) {
  return dot(c, vec3(0.2126, 0.7152, 0.0722));
}
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}
// The light themes engrave the dark scene on the page: black is the page,
// the brightest light the deep ink (lib.rs engrave).
vec3 engrave(vec3 c) {
  float t = 1.0 - pow(clamp(luma(c) / u_ink.x, 0.0, 1.0), u_ink.y);
  vec3 ink = t < u_ink.z ? mix(u_deep, u_mid, t / u_ink.z)
                         : mix(u_mid, u_backdrop, (t - u_ink.z) / (1.0 - u_ink.z));
  return min(ink, u_backdrop);
}

void main() {
  vec3 c = max(texelFetch(u_frame, ivec2(gl_FragCoord.xy), 0).rgb * u_out.w, 0.0);
  vec3 over = 0.7 + 0.3 * (1.0 - exp(-(c - 0.7) / 0.3));
  c = mix(c, over, step(0.7, c));
  if (u_out.z > 0.5) c = engrave(c);
  // Dither against banding in the faint light.
  c += (hash(gl_FragCoord.xy * 1.37) - 0.5) / 255.0;
  if (u_out.x > 0.5) {
    // Drawn straight to the canvas: melt into the page here, and on a light
    // page never get lighter than the page.
    if (u_out.y > 0.5) {
      float m = smoothstep(0.0, u_edges.x, v_uv.x) * smoothstep(0.0, u_edges.y, 1.0 - v_uv.x)
              * smoothstep(0.0, u_edges.z, 1.0 - v_uv.y) * smoothstep(0.0, u_edges.w, v_uv.y);
      c = mix(u_backdrop, c, m);
    }
    if (u_out.z > 0.5) c = min(c, u_backdrop);
  }
  o = vec4(clamp(c, 0.0, 1.0), 1.0);
}
