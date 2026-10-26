#version 300 es
precision highp float;
layout(location=0) in vec4 a_particle;
uniform vec4 u_view;
out float v_alpha;
void main() {
    vec2 p = (a_particle.xy - vec2(768.0,512.0)) * u_view.z + vec2(768.0,512.0) + u_view.xy;
    gl_Position = vec4(p.x / 768.0 - 1.0, 1.0 - p.y / 512.0, 0.0, 1.0);
    gl_PointSize = a_particle.z * u_view.w;
    v_alpha = a_particle.w;
}
