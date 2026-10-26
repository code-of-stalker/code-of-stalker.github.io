#version 300 es
precision highp float;
in float v_alpha;
out vec4 out_color;
// @shared
void main() {
    vec2 p = (gl_PointCoord - 0.5) * 2.0;
    float core = exp(-dot(p,p) * 29.0);
    float rays = (exp(-abs(p.x)*27.0-abs(p.y)*4.5)+exp(-abs(p.y)*27.0-abs(p.x)*4.5))*0.32;
    float a = (core+rays)*(1.0-smoothstep(0.7,1.0,length(p)))*v_alpha;
    out_color = vec4(1.0, 0.78, 0.07, a*edge_coverage(gl_FragCoord.xy/u_viewport.xy));
}
