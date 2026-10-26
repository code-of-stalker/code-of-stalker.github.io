#version 300 es
precision highp float;
in vec2 v_local;
in vec4 v_color;
flat in float v_extra;
in vec2 v_position;
uniform float u_clip;
uniform sampler2D u_mask;
uniform vec4 u_region;
out vec4 out_color;
void main(){
    // Linear falloff to the rim of the local unit disc or across a line;
    // the magnitude of extra sets how hard the edge is.
    float f=clamp((1.0-length(v_local))*abs(v_extra),0.0,1.0);
    float a=v_color.a*f;
    if(u_clip>0.5) a*=texture(u_mask,(v_position-u_region.xy)/u_region.zw).r;
    out_color=vec4(v_color.rgb*a,v_extra<0.0?0.0:a);
}
