#version 300 es
precision highp float;
in vec2 v_local;
in vec4 v_color;
flat in float v_extra;
in vec2 v_position;
// Antialiasing width in units of the radius.
uniform float u_aa;
out vec4 out_color;
const vec3 FILL=vec3(.965,.784,.329);
const vec3 RIM=vec3(1.0,.894,.588);
const vec3 HIGHLIGHT=vec3(1.0,.973,.855);
void main(){
    vec2 l=v_local;
    float d=length(l);
    float edge=1.0-smoothstep(1.0-u_aa,1.0,d);
    if(edge<=0.0) discard;
    // Thin film: almost clear in the middle, denser towards the edge, no outline.
    float g=clamp(length(l-vec2(-.12,-.1)*(1.0-d)),0.0,1.0);
    float film=g<.62?mix(.16,.24,g/.62):g<.88?mix(.24,.42,(g-.62)/.26):mix(.42,.55,(g-.88)/.12);
    float s=(d-.8)/.2;
    float rim=s<0.0?0.0:s<.75?mix(0.0,.22,s/.75):s<.93?mix(.22,.42,(s-.75)/.18):mix(.42,.18,(s-.93)/.07);
    float window=max(1.0-length(l-vec2(.36,-.46))/.26,0.0)*.7;
    float bounce=max(1.0-length(l-vec2(-.42,.5))/.16,0.0)*.22;
    float a=film*edge;
    out_color=vec4(FILL*a+(RIM*rim+HIGHLIGHT*(window+bounce))*edge,a);
}
