#version 300 es
precision highp float;
precision highp int;
in vec2 v_uv;
flat in uint v_strokes;
in float v_alpha;
in float v_softness;
// 1 on Art's light paintings: amber ink instead of light.
uniform float u_pale;
out vec4 out_color;
const vec4 STROKES[13]=vec4[13](
    vec4(.18,.14,.82,.14),vec4(.18,.50,.82,.50),vec4(.18,.86,.82,.86),
    vec4(.18,.14,.18,.50),vec4(.18,.50,.18,.86),
    vec4(.82,.14,.82,.50),vec4(.82,.50,.82,.86),
    vec4(.50,.14,.50,.86),vec4(.18,.14,.82,.86),vec4(.82,.14,.18,.86),
    vec4(.18,.25,.45,.43),vec4(.82,.22,.56,.43),vec4(.50,.50,.22,.86)
);
float lineDistance(vec2 p,vec2 a,vec2 b){
    vec2 ab=b-a;
    return length(p-a-ab*clamp(dot(p-a,ab)/dot(ab,ab),0.0,1.0));
}
void main(){
    float d=1.0;
    for(int i=0;i<13;i++){
        if((v_strokes & (1u<<uint(i)))!=0u) d=min(d,lineDistance(v_uv,STROKES[i].xy,STROKES[i].zw));
    }
    float aa=max(fwidth(d)*.8,v_softness);
    float ink=1.0-smoothstep(.035-aa,.035+aa,d);
    float glow=exp(-d*d/0.018)*.24;
    out_color=u_pale>0.5?vec4(.70,.34,.03,ink*v_alpha*.75):vec4(1.0,.77,.20,(ink+glow)*v_alpha);
}
