#version 300 es
precision highp float;
// Shared by every pass: authored position, local/UV coordinate, colour, extra.
layout(location=0) in vec4 a_vertex;
layout(location=1) in vec4 a_color;
layout(location=2) in float a_extra;
uniform vec4 u_view;
out vec2 v_local;
out vec4 v_color;
flat out float v_extra;
out vec2 v_position;
void main(){
    v_local=a_vertex.zw;
    v_color=a_color;
    v_extra=a_extra;
    v_position=a_vertex.xy;
    gl_Position=vec4(a_vertex.xy*u_view.xy+u_view.zw,0.0,1.0);
}
