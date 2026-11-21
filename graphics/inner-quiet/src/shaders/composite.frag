// The world on the page: its bloom, a soft shoulder where light piles up,
// the edges melted into the page, a dither.
uniform sampler2D u_world;
uniform sampler2D u_bright;
uniform vec4 u_edges;
uniform vec4 u_bloom; // amount, blur (px800), the world's scale
in vec2 v_uv;
out vec4 o;

vec3 bloom(float K8) {
  vec2 texel = 1.0 / vec2(textureSize(u_bright, 0));
  float s = max(u_bloom.y * K8 * u_bloom.z / 2.0 / 1.12, 1.0);
  float lod = log2(s);
  vec3 sum = vec3(0.0);
  for (int j = zero(); j < 5; j++) {
    float wj = j == 2 ? 6.0 : (j == 1 || j == 3 ? 4.0 : 1.0);
    for (int i = 0; i < 5; i++) {
      float wi = i == 2 ? 6.0 : (i == 1 || i == 3 ? 4.0 : 1.0);
      sum += wi * wj * textureLod(u_bright, v_uv + vec2(float(i - 2), float(j - 2)) * s * texel, lod).rgb;
    }
  }
  return sum / 256.0;
}

void main() {
  time = u_eye.w;
  vec2 frag = gl_FragCoord.xy;
  float K8 = px800();
  vec3 col = texture(u_world, v_uv).rgb + u_bloom.x * bloom(K8);
  vec3 over = 0.7 + 0.3 * (1.0 - exp(-(col - 0.7) / 0.3));
  col = mix(col, over, step(0.7, col));
  if (u_scene.y > 0.5) {
    float e = smoothstep(0.0, u_edges.x, v_uv.x) * smoothstep(0.0, u_edges.y, 1.0 - v_uv.x)
            * smoothstep(0.0, u_edges.z, 1.0 - v_uv.y) * smoothstep(0.0, u_edges.w, v_uv.y);
    col = mix(u_backdrop, col, e);
  }
  col += (hash2(frag * 1.37 + 0.5, 0u) - 0.5) / 255.0;
  o = vec4(clamp(col, 0.0, 1.0), 1.0);
}
