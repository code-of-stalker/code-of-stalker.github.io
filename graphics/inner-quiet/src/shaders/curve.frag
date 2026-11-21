// A curve's light: a sharp core and a soft glow, dotted if it has dashes;
// a ring's runner with its trail, a segment's pulse running along it, its
// tip soft. Added to the light.
in float v_across;
in float v_s;
in float v_metres;
in float v_back;
flat in vec4 v_style;
flat in vec4 v_span;
flat in float v_half;
out vec4 o;

void main() {
  time = u_eye.w;
  float K8 = px800();
  float w = v_style.x * K8;
  float d = abs(v_across);
  float core = clamp(0.5 * w + 0.5 - d, 0.0, 1.0);
  float glow = exp(-sq(d / (1.6 * w + 1.0))) * 0.45 + exp(-sq(d / (3.0 * w + 1.5))) * 0.18;
  float light = core + glow;
  float boost = 1.0;
  bool ring = v_span.w != 0.0;
  if (ring) {
    // How far behind the runner, in turns.
    float behind = fract((v_span.z - v_s) * v_span.w);
    boost += 1.3 * exp(-behind / 0.06) + 0.4 * exp(-behind / 0.25);
    boost *= v_back > 0.5 ? 0.55 : 1.0;
  } else {
    if (v_span.z >= 0.0) {
      // Three pulses running up a faint thread, each with a tail: light
      // rising, not a standing bar.
      float behind = fract(v_span.z - 3.0 * v_s);
      boost = 0.28 + 1.9 * exp(-behind / 0.05) + 0.6 * exp(-behind / 0.25);
    }
    float tip = (v_span.y - v_s) / max(v_span.y - v_span.x, 1e-4);
    boost *= smoothstep(0.0, 0.08, tip);
  }
  if (v_style.w > 0.0) {
    // Dots: round, the dashes' count a metre.
    float u = abs(fract(v_metres * v_style.w) - 0.5) / v_style.w;
    float metresPx = max(fwidth(v_metres), 1e-6);
    float r = length(vec2(u / metresPx, d));
    float dot_ = clamp(1.2 * w + 0.5 - r, 0.0, 1.0) + 0.35 * exp(-sq(r / (2.5 * w + 1.0)));
    light = dot_;
  }
  vec3 ink = mix(COLD, WARM, v_style.z);
  o = vec4(ink * v_style.y * light * boost, 1.0);
}
