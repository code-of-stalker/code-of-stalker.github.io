#version 300 es
// Page 04's warm light. The passes keep what burns warm in the frame's
// alpha, outside the theme's one-colour recolor; this adds it back over the
// recolored frame in the theme's warm colour, with the finish's shoulder,
// the soft themes' ink and the same soft edges.
precision highp float;
in vec2 v_uv;
out vec4 o;
uniform sampler2D u_frame;
uniform vec4 u_out;   // soft themes' ink, soft edges, -, gain
uniform vec4 u_edges; // left, right, top, bottom
uniform vec3 u_warm;

void main() {
  float w = max(texelFetch(u_frame, ivec2(gl_FragCoord.xy), 0).a * u_out.w, 0.0);
  if (w > 0.7) w = 0.7 + 0.3 * (1.0 - exp(-(w - 0.7) / 0.3));
  w = clamp(w, 0.0, 1.0);
  if (u_out.x > 0.5) w = pow(w, 1.3) * 0.74;
  if (u_out.y > 0.5) {
    w *= smoothstep(0.0, u_edges.x, v_uv.x) * smoothstep(0.0, u_edges.y, 1.0 - v_uv.x)
       * smoothstep(0.0, u_edges.z, 1.0 - v_uv.y) * smoothstep(0.0, u_edges.w, v_uv.y);
  }
  o = vec4(u_warm * w, 1.0);
}
