#version 300 es
precision highp float;
layout(location=0) in vec4 a_vertex;
layout(location=1) in vec4 a_style;
out vec2 v_uv;
flat out uint v_strokes;
out float v_alpha;
out float v_softness;
void main(){
    gl_Position=vec4(a_vertex.x/768.0-1.0,1.0-a_vertex.y/512.0,0.0,1.0);
    v_uv=a_vertex.zw;
    v_strokes=uint(a_style.x);
    v_alpha=a_style.y;
    v_softness=a_style.z;
}
