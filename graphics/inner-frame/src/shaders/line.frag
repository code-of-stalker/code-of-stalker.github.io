// A stroke's light on this pixel: a crisp line with a one-pixel soft edge
// (fainter, not thinner, below a pixel), dashed by its distance along the
// path, perspective-correct. A hidden line, the part of a stroke behind the
// middle of the truss, is dashed and fainter, as on a drawing. A dot is a
// small bright core in a soft glow. Added onto the page in the theme's
// cold, pale and warm. The `#define`s come from lib.rs (browser.rs).
precision highp float;
flat in vec4 v_a;
flat in vec4 v_b;
flat in vec4 v_ink;
flat in vec4 v_tone;
flat in vec4 v_more;
flat in vec3 v_wa;
flat in vec3 v_wb;
in vec2 v_px;
out vec4 o;
uniform vec4 u_fwd;
uniform vec4 u_view;
uniform vec3 u_cold;
uniform vec3 u_warm;
uniform vec3 u_pale;
uniform vec4 u_edges;
uniform vec4 u_out;

// On (1) along the dashes `period` long, `duty` of each drawn; an even grey
// where they would be finer than the pixels.
float dashes(float s, float period, float duty) {
  float u = s / max(period, 1e-4);
  float e = max(fwidth(u), 1e-4);
  float f = fract(u);
  float m = clamp(f / e + 0.5, 0.0, 1.0) * clamp((duty - f) / e + 0.5, 0.0, 1.0);
  return mix(m, duty, smoothstep(0.3, 0.9, e));
}

void main() {
  vec2 pa = v_a.xy;
  vec2 d = v_b.xy - pa;
  float l2 = dot(d, d);
  float ts = l2 > 1e-6 ? clamp(dot(v_px - pa, d) / l2, 0.0, 1.0) : 0.0;
  float dist = length(v_px - (pa + d * ts));
  // Where along the stroke this pixel is, in the world.
  float tw = ts * v_b.w / max((1.0 - ts) * v_a.w + ts * v_b.w, 1e-6);
  float s = mix(v_a.z, v_b.z, tw);
  vec3 world = mix(v_wa, v_wb, tw);

  float w = v_ink.x;
  float hw = 0.5 * max(w, 1.0);
  float line = min(w, 1.0) * (1.0 - smoothstep(hw - 0.5, hw + 0.5, dist));
  float halo = v_more.x * 0.25 * exp(-dist * dist / (2.0 * v_more.z * v_more.z));
  float s1 = max(0.12 * w, 0.7);
  float s2 = max(0.45 * w, 1.0);
  float spot = 0.9 * exp(-dist * dist / (2.0 * s1 * s1)) + 0.35 * exp(-dist * dist / (2.0 * s2 * s2));

  float behind = v_tone.w * smoothstep(-0.04, 0.12, dot(world - CENTRE, u_fwd.xyz));
  // Both computed everywhere, so their derivatives stay defined.
  float mine = dashes(s, v_ink.z, v_ink.w);
  float drawn = dashes(s, HIDDEN.x, 0.5);
  float own = v_ink.z > 0.0 ? mine : 1.0;
  float hidden = v_ink.z > 0.0 ? mine : drawn;
  float mask = mix(own, hidden, behind) * mix(1.0, HIDDEN.y, behind);

  float light = v_more.y > 0.5 ? spot : (line + halo) * mask;
  vec3 tone = u_cold * v_tone.x + u_pale * v_tone.y + u_warm * v_tone.z;
  vec3 c = tone * light * v_ink.y;
  if (u_out.x > 0.5) {
    vec2 uv = gl_FragCoord.xy / u_view.zw;
    c *= smoothstep(0.0, u_edges.x, uv.x) * smoothstep(0.0, u_edges.y, 1.0 - uv.x)
       * smoothstep(0.0, u_edges.z, 1.0 - uv.y) * smoothstep(0.0, u_edges.w, uv.y);
  }
  o = vec4(c, 1.0);
}
