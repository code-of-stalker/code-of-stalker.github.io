// The finished frame: the lens's image with the bloom of its brightest
// lights (its own smaller mips) and the rain over it, a shoulder where light
// piles up, grain, a vignette, and on the canvas the soft edges. Writes the
// cold light only, as grey: the theme's recolor inks it in its colour.
out vec4 o;
in vec2 v_uv;
uniform sampler2D u_dof;
uniform sampler2D u_rain;
uniform vec4 u_out;      // straight to the canvas, soft edges, -, gain
uniform vec3 u_backdrop; // the page
uniform vec4 u_edges;    // left, right, top, bottom

float grain(vec2 p, float t) {
  uint x = uint(p.x) * 1973u + uint(p.y) * 9277u + uint(pm(int(floor(t * 24.0)), int(LOOP * 24.0))) * 26699u;
  return rand(x) - 0.5;
}

void main() {
  vec2 L = texture(u_dof, v_uv).rg;
  vec2 bloom = 0.45 * textureLod(u_dof, v_uv, 2.0).rg + 0.3 * textureLod(u_dof, v_uv, 3.0).rg
             + 0.22 * textureLod(u_dof, v_uv, 4.0).rg + 0.16 * textureLod(u_dof, v_uv, 5.0).rg;
  L += BLOOM * bloom;
  L += texelFetch(u_rain, ivec2(gl_FragCoord.xy), 0).rg;
  float c = max(L.x * u_out.w, 0.0);
  if (c > 0.7) c = 0.7 + 0.3 * (1.0 - exp(-(c - 0.7) / 0.3));
  vec2 v = v_uv - 0.5;
  c *= 1.0 - 0.55 * dot(v, v);
  c += 0.014 * grain(gl_FragCoord.xy, TIME) * (0.25 + sqrt(c));
  c += (rand(uint(gl_FragCoord.x) * 7919u + uint(gl_FragCoord.y) * 104729u) - 0.5) / 255.0;
  c = clamp(c, 0.0, 1.0);
  vec3 col = vec3(c);
  if (u_out.x > 0.5 && u_out.y > 0.5) {
    float m = smoothstep(0.0, u_edges.x, v_uv.x) * smoothstep(0.0, u_edges.y, 1.0 - v_uv.x)
            * smoothstep(0.0, u_edges.z, 1.0 - v_uv.y) * smoothstep(0.0, u_edges.w, v_uv.y);
    col = mix(u_backdrop, col, m);
  }
  o = vec4(col, 1.0);
}
