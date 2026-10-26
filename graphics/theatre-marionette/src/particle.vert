#version 300 es
precision highp float;
layout(location=0) in vec4 a_particle;
uniform float u_density;
out float v_alpha;
void main(){
    gl_Position=vec4(a_particle.x/768.0-1.0,1.0-a_particle.y/512.0,0.0,1.0);
    gl_PointSize=max(1.0,a_particle.z*u_density);
    v_alpha=a_particle.w;
}
