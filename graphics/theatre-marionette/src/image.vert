#version 300 es
precision highp float;
layout(location=0) in vec4 a_vertex;
out vec2 v_uv;
out vec2 v_position;
void main() {
    v_uv=a_vertex.zw;
    v_position=a_vertex.xy;
    gl_Position=vec4(a_vertex.x/768.0-1.0,1.0-a_vertex.y/512.0,0.0,1.0);
}
