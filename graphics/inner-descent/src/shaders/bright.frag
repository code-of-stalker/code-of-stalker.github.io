// The bright part of the world at half size, for the bloom: the
// storyboard's contrast(3) of each pixel, four to one.
uniform sampler2D u_src;

void main() {
  ivec2 ip = ivec2(gl_FragCoord.xy);
  ivec2 top = textureSize(u_src, 0) - 1;
  vec3 s = vec3(0.0);
  for (int k = zero(); k < 4; k++) {
    ivec2 at = min(2 * ip + ivec2(k & 1, k >> 1), top);
    s += clamp(3.0 * texelFetch(u_src, at, 0).rgb - 1.0, 0.0, 1.0);
  }
  o = vec4(s * 0.25, 1.0);
}
