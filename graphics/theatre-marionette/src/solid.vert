#version 300 es
precision highp float;
layout(location=0) in vec2 a_position;
void main(){gl_Position=vec4(a_position.x/768.0-1.0,1.0-a_position.y/512.0,0.0,1.0);}
