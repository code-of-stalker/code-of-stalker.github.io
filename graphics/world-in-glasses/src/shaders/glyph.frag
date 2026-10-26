#version 300 es
precision highp float;
precision highp int;
in vec2 v_local;
in vec4 v_color;
flat in float v_extra;
in vec2 v_position;
uniform float u_stroke;
// 0 adds the code as light (dark originals), 1 inks it (light paintings).
uniform float u_cover;
out vec4 out_color;
const vec4 STROKES[13]=vec4[13](
    vec4(.18,.14,.82,.14),vec4(.18,.50,.82,.50),vec4(.18,.86,.82,.86),
    vec4(.18,.14,.18,.50),vec4(.18,.50,.18,.86),
    vec4(.82,.14,.82,.50),vec4(.82,.50,.82,.86),
    vec4(.50,.14,.50,.86),vec4(.18,.14,.82,.86),vec4(.82,.14,.18,.86),
    vec4(.18,.25,.45,.43),vec4(.82,.22,.56,.43),vec4(.50,.50,.22,.86)
);
float segment(vec2 p,vec2 a,vec2 b){
    vec2 ab=b-a;
    return length(p-a-ab*clamp(dot(p-a,ab)/dot(ab,ab),0.0,1.0));
}
void main(){
    uint strokes=uint(v_extra+0.5);
    float d=1.0;
    for(int i=0;i<13;i++){
        if((strokes&(1u<<uint(i)))!=0u) d=min(d,segment(v_local,STROKES[i].xy,STROKES[i].zw));
    }
    float aa=max(fwidth(d),0.02);
    float ink=1.0-smoothstep(u_stroke-aa,u_stroke+aa,d);
    float glow=exp(-d*d/0.03)*.3;
    float a=(ink+glow*(1.0-u_cover))*v_color.a;
    out_color=vec4(v_color.rgb*a,a*u_cover);
}
