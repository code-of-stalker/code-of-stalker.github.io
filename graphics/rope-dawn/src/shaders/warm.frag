// The warm light (the low sun, its glare and its gold on the fog, the
// light rising in him, the waking city's windows and lamps), kept apart
// from the theme's one-colour recolor and added back over the recolored
// frame in the theme's warm colour, with the finish's bloom, shoulder,
// vignette and soft edges.
out vec4 o;
in vec2 v_uv;
uniform sampler2D u_dof;
uniform vec4 u_out;   // soft themes' ink, soft edges, -, gain
uniform vec4 u_edges; // left, right, top, bottom
uniform vec3 u_warm;

void main() {
  float w = texture(u_dof, v_uv).g;
  w += BLOOM * (0.45 * textureLod(u_dof, v_uv, 2.0).g + 0.3 * textureLod(u_dof, v_uv, 3.0).g
              + 0.22 * textureLod(u_dof, v_uv, 4.0).g + 0.16 * textureLod(u_dof, v_uv, 5.0).g);
  w = max(w * u_out.w, 0.0);
  if (w > 0.7) w = 0.7 + 0.3 * (1.0 - exp(-(w - 0.7) / 0.3));
  vec2 v = v_uv - 0.5;
  w *= 1.0 - 0.55 * dot(v, v);
  w = clamp(w, 0.0, 1.0);
  if (u_out.x > 0.5) w = pow(w, 1.3) * 0.74;
  if (u_out.y > 0.5) {
    w *= smoothstep(0.0, u_edges.x, v_uv.x) * smoothstep(0.0, u_edges.y, 1.0 - v_uv.x)
       * smoothstep(0.0, u_edges.z, 1.0 - v_uv.y) * smoothstep(0.0, u_edges.w, v_uv.y);
  }
  o = vec4(u_warm * w, 1.0);
}
