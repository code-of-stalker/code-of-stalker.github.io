#version 450
layout(std140,set=0,binding=0) uniform Params {vec4 _data[128];};
layout(set=0,binding=1) uniform texture2D texSource;
layout(set=0,binding=2) uniform texture2D texBlur;
layout(set=0,binding=3) uniform sampler linearSampler;
layout(set=0,binding=4) uniform texture2D texContour;
layout(location=0) out vec4 fragColor;
#define uFirstPass _data[0].x
#define uDecodeSourceTexture _data[1].x
#define uFrameAspect _data[2].x
#define uSourceAspect _data[3].x
#define uDirection _data[4].xy
#define uRadius int(_data[5].x)

vec4 readSource(vec2 uv){return textureLod(sampler2D(texSource,linearSampler),vec2(uv.x,1.-uv.y),0.);}
vec4 readBlur(vec2 uv){return textureLod(sampler2D(texBlur,linearSampler),vec2(uv.x,1.-uv.y),0.);}
vec4 readContour(vec2 uv){return textureLod(sampler2D(texContour,linearSampler),uv,0.);}
vec4 LinearTransferOETF( in vec4 value ) {
	return value;
}
vec4 sRGBTransferEOTF( in vec4 value ) {
	return vec4( mix( pow( value.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), value.rgb * 0.0773993808, vec3( lessThanEqual( value.rgb, vec3( 0.04045 ) ) ) ), value.a );
}
vec4 sRGBTransferOETF( in vec4 value ) {
	return vec4( mix( pow( value.rgb, vec3( 0.41666 ) ) * 1.055 - vec3( 0.055 ), value.rgb * 12.92, vec3( lessThanEqual( value.rgb, vec3( 0.0031308 ) ) ) ), value.a );
}
vec4 linearToOutputTexel(vec4 c){return _data[127].x>.5?sRGBTransferOETF(c):c;}










layout(location=0) in vec2 vUv;

vec3 sampleInput(vec2 uv) {
  if (uFirstPass < 0.5) {
    return readSource( clamp(uv, vec2(0.0), vec2(1.0))).rgb;
  }

  vec2 scale = vec2(1.0);
  float sourceAspect = max(uSourceAspect, 0.01);
  if (uFrameAspect > sourceAspect) {
    scale.y = sourceAspect / uFrameAspect;
  } else {
    scale.x = uFrameAspect / sourceAspect;
  }
  vec2 sourceUv = (uv - 0.5) * scale + 0.5;
  vec4 texel = readSource( clamp(sourceUv, vec2(0.001), vec2(0.999)));
  return uDecodeSourceTexture > 0.5 ? sRGBTransferEOTF(texel).rgb : texel.rgb;
}

void main() {
  vec3 color = sampleInput(vUv) * _data[6+int(0)].x;
  for (int i = 1; i <= 36; i++) {
    if (i > uRadius) break;
    vec2 offset = uDirection * float(i);
    color += (sampleInput(vUv + offset) + sampleInput(vUv - offset)) * _data[6+int(i)].x;
  }
  // Both intermediate textures remain linear. Only the final glass pass encodes output.
  fragColor = vec4(color, 1.0);
}
