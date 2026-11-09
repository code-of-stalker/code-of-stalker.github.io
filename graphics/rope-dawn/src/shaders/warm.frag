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
  // The low sun's rays through the air: its light behind him, the rope
  // and the towers drawn out toward the eye.
  vec3 sp = project(EYE.xyz + normalize(SUN.xyz) * 1e4);
  if (SUN.w > 0.01 && sp.z > 0.0) {
    vec2 su = sp.xy / u_res.xy;
    vec2 step_ = (su - v_uv) / 24.0;
    vec2 uv = v_uv;
    float rays = 0.0, decay = 1.0;
    for (int i = 0 + ZERO; i < 24; i++) {
      uv += step_;
      if (uv.x > 0.0 && uv.x < 1.0 && uv.y > 0.0 && uv.y < 1.0) {
        rays += decay * max(textureLod(u_dof, uv, 1.0).g * u_out.w - 0.45, 0.0);
      }
      decay *= 0.95;
    }
    vec2 off = (su - v_uv) * vec2(u_res.x / u_res.y, 1.0);
    w += SUN.w * 0.05 * rays * exp(-length(off) / 0.7);
  }
  w = mix(w, CLOUD.y * EXPOSURE, VEIL);
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
