// The sky over the land: the page, a faint glow of the air at the horizon,
// sparse small stars.
out vec4 o;

void main() {
  time = u_eye.w;
  vec2 f = frameAt(gl_FragCoord.xy);
  vec3 rd = rayAt(f);
  vec3 col = skyAt(rd);
  // Stars on a grid of directions; a pixel in radians at the frame's middle.
  float pxA = 2.0 / (u_view.y * u_view.w) * u_fwd.w;
  vec2 a = vec2(atan(rd.x, rd.z), asin(clamp(rd.y, -1.0, 1.0)));
  const float CELL = 0.035;
  vec2 g = a / CELL;
  vec2 cell = floor(g);
  float pick = hash2(cell, 11u);
  if (pick > 0.86 && rd.y > 0.02) {
    vec2 at = (cell + 0.2 + 0.6 * vec2(hash2(cell, 12u), hash2(cell, 13u))) * CELL;
    vec2 d = (a - at) * vec2(cos(a.y), 1.0);
    float r = length(d) / pxA;
    float size = 0.6 + 0.9 * hash2(cell, 14u);
    float twinkle = 0.75 + 0.25 * sin(TAU * (7.0 + floor(5.0 * hash2(cell, 15u))) * time / LOOP_SECONDS + 6.0 * pick);
    float b = (pick - 0.86) / 0.14;
    col += mix(PALE, COLD, 0.4) * 0.5 * b * twinkle * exp(-sq(r / size)) * smoothstep(0.02, 0.15, rd.y);
  }
  o = vec4(col, 1.0);
}
