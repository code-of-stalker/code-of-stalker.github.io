// The finished frame: the lens's image with the bloom of its brightest
// lights (its own smaller mips) and the rain over it, a shoulder where light
// piles up, grain, a vignette, page 07's tape, and on the canvas the soft
// edges. Writes the cold light only, as grey: the theme's recolor inks it
// in its colour.
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

// Page 08 in his eyes, his hand fills the view at the world's coarser
// sharpness: one world texel along the depth edge through uv, so that
// light and depth gathered along it smooth the hand's stair-stepped rim.
vec2 edgeAlong(vec2 uv) {
  vec2 tx = 1.0 / vec2(textureSize(u_dof, 0));
  float e = textureLod(u_dof, uv + vec2(tx.x, 0.0), 0.0).b;
  float w = textureLod(u_dof, uv - vec2(tx.x, 0.0), 0.0).b;
  float n = textureLod(u_dof, uv + vec2(0.0, tx.y), 0.0).b;
  float s = textureLod(u_dof, uv - vec2(0.0, tx.y), 0.0).b;
  vec2 g = vec2(e - w, n - s);
  float len = length(g);
  return len > 1e-6 ? vec2(-g.y, g.x) / len * tx : vec2(0.0);
}
const float ALONG[4] = float[4](-2.0, -0.7, 0.7, 2.0);

// Page 08 in his eyes: his phone's screen at uv drawn again at the
// canvas's own sharpness, over the world's softer one: what it shows, and
// how much of this pixel it covers where nothing (his thumb) is nearer.
// Called in uniform flow only (its derivatives).
vec2 phoneSharp(vec2 uv, vec2 along) {
  float k = PHONE_C.w;
  vec3 face = cross(PHONE_X.xyz, PHONE_Y.xyz);
  vec2 ndc = uv * 2.0 - 1.0;
  vec3 rd = normalize(FWD.xyz + RIGHT.xyz * (ndc.x / VIEW.x) + UP.xyz * (ndc.y / VIEW.y));
  vec3 glass = PHONE_C.xyz + face * (PHONE_T * k);
  float t = dot(glass - EYE.xyz, face) / min(dot(rd, face), -1e-4);
  vec3 s = EYE.xyz + rd * t - PHONE_C.xyz;
  vec2 l = vec2(dot(s, PHONE_X.xyz), dot(s, PHONE_Y.xyz));
  vec2 half_ = vec2(PHONE_SCREEN_W, PHONE_SCREEN_H) * k;
  vec2 at = vec2(0.5 + 0.5 * l.x / half_.x, 0.5 - 0.5 * l.y / half_.y);
  vec2 texel = at * UI_CELL;
  float lod = log2(max(max(length(dFdx(texel)), length(dFdy(texel))), 1.0));
  float px = max(length(dFdx(l)), length(dFdy(l)));
  float cover = smoothstep(0.5 * px, -0.5 * px, roundRect(l, half_, SCREEN_CORNER * k));
  // The world's depth is coarser than the canvas: taps along its edge
  // match the thumb's smoothed rim over the glass.
  float z = t * dot(rd, FWD.xyz);
  float seen = 0.0;
  for (int i = ZERO; i < 4; i++) {
    float D = textureLod(u_dof, uv + ALONG[i] * along, 0.0).b;
    seen += 0.25 * smoothstep(-0.006, -0.002, 8.0 * D / max(1.0 - D, 1e-4) - z);
  }
  return vec2(phoneUi(at, lod), cover * seen * step(0.0, t));
}

void main() {
  vec2 uv = tapeUv(v_uv);
  vec2 L = texture(u_dof, uv).rg;
  vec2 along = vec2(0.0);
  if (PHONE_TAP.w > 0.0) {
    along = edgeAlong(uv);
    vec2 smooth_ = vec2(0.0);
    for (int i = ZERO; i < 4; i++) smooth_ += 0.25 * textureLod(u_dof, uv + ALONG[i] * along, 0.0).rg;
    L = mix(L, smooth_, PHONE_TAP.w);
  }
  vec2 bloom = 0.45 * textureLod(u_dof, uv, 2.0).rg + 0.3 * textureLod(u_dof, uv, 3.0).rg
             + 0.22 * textureLod(u_dof, uv, 4.0).rg + 0.16 * textureLod(u_dof, uv, 5.0).rg;
  L += BLOOM * bloom;
  ivec2 size = textureSize(u_rain, 0);
  ivec2 at = clamp(ivec2(gl_FragCoord.xy) + ivec2((uv - v_uv) * vec2(size)), ivec2(0), size - 1);
  L += texelFetch(u_rain, at, 0).rg;
  float c = max(L.x * u_out.w, 0.0);
  if (c > 0.7) c = 0.7 + 0.3 * (1.0 - exp(-(c - 0.7) / 0.3));
  if (PHONE_TAP.w > 0.0) {
    vec2 sharp = phoneSharp(uv, along);
    c = mix(c, sharp.x, sharp.y * PHONE_TAP.w);
  }
  vec2 v = v_uv - 0.5;
  c *= (1.0 - 0.55 * dot(v, v)) * tunnel(v_uv);
  if (TAPE_ON > 0.0) {
    // Washed out, in lines, snow in the bands, a flash as it stops.
    c = c * tapeLines(gl_FragCoord.y) + 0.025 * TAPE_ON;
    float snow = rand(uint(gl_FragCoord.x) * 3613u + uint(gl_FragCoord.y) * 6151u
                      + uint(TAPE_T * 30.0) * 92821u);
    c += TAPE_ON * tapeBands(v_uv.y) * snow * snow * 0.5 + 0.3 * TAPE_FLASH;
  }
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
