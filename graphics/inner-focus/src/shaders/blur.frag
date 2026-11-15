// A lens's blur, gathered: 48 taps over a disc u_coc.x px (of the source)
// round each pixel, on a golden-angle spiral turned per pixel, each read
// from the mip that suits the taps' spacing. Drawn at half size; the
// composite reads it smoothly.

uniform sampler2D u_src;
uniform vec4 u_coc; // the disc's radius in source px, the mip to read

void main() {
  vec2 frag = gl_FragCoord.xy;
  vec2 size = vec2(textureSize(u_src, 0));
  float turn = hash2(frag, 5u) * TAU;
  vec4 acc = vec4(0.0);
  for (int i = 0; i < 48; i++) {
    float fi = float(i);
    float r = u_coc.x * sqrt((fi + 0.5) / 48.0);
    float a = fi * 2.39996323 + turn;
    acc += textureLod(u_src, v_uv + r * vec2(cos(a), sin(a)) / size, u_coc.y);
  }
  o = acc / 48.0;
}
