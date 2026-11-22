// The finished frame: the lens's image with the bloom of its lights (its
// own smaller mips, over the page), a shoulder where light piles up, a
// vignette toward the page, grain, and on the canvas the soft edges.
out vec4 o;
in vec2 v_uv;
uniform sampler2D u_dof;
uniform vec4 u_out;      // soft edges, time, -, -
uniform vec3 u_backdrop; // the page round the scene
uniform vec4 u_edges;    // left, right, top, bottom
uniform vec3 u_paper;    // the scene's page

float grain(vec2 p, float t) {
  uint x = uint(p.x) * 1973u + uint(p.y) * 9277u + uint(pm(int(floor(t * 24.0)), 100000)) * 26699u;
  return rand(x) - 0.5;
}

void main() {
  vec3 L = texture(u_dof, v_uv).rgb;
  vec3 bloom = 0.45 * textureLod(u_dof, v_uv, 2.0).rgb + 0.3 * textureLod(u_dof, v_uv, 3.0).rgb
             + 0.22 * textureLod(u_dof, v_uv, 4.0).rgb + 0.16 * textureLod(u_dof, v_uv, 5.0).rgb;
  L += BLOOM * max(bloom - 1.13 * u_paper, 0.0);
  // The shoulder, by the brightest channel so the colour holds.
  float m = max(max(L.r, L.g), L.b);
  if (m > 0.7) L *= (0.7 + 0.3 * (1.0 - exp(-(m - 0.7) / 0.3))) / m;
  vec2 v = v_uv - 0.5;
  L = u_paper + (L - u_paper) * (1.0 - 0.6 * dot(v, v));
  float lum = dot(max(L, 0.0), vec3(0.3, 0.5, 0.2));
  L += 0.014 * grain(gl_FragCoord.xy, u_out.y) * (0.25 + sqrt(lum));
  L += (rand(uint(gl_FragCoord.x) * 7919u + uint(gl_FragCoord.y) * 104729u) - 0.5) / 255.0;
  vec3 col = clamp(L, 0.0, 1.0);
  if (u_out.x > 0.5) {
    float e = smoothstep(0.0, u_edges.x, v_uv.x) * smoothstep(0.0, u_edges.y, 1.0 - v_uv.x)
            * smoothstep(0.0, u_edges.z, 1.0 - v_uv.y) * smoothstep(0.0, u_edges.w, v_uv.y);
    col = mix(u_backdrop, col, e);
  }
  o = vec4(col, 1.0);
}
