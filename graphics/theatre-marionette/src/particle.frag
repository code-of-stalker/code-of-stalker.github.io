#version 300 es
precision highp float;
in float v_alpha;
out vec4 out_color;
void main(){
    vec2 p=2.0*gl_PointCoord-1.0;
    float d=dot(p,p);
    float a=(exp(-d*13.0)+0.16*exp(-d*3.0))*(1.0-smoothstep(0.5,1.0,d))*v_alpha;
    out_color=vec4(1.0,0.77,0.12,a);
}
