#version 300 es
precision highp float;
in vec2 v_local;
in vec4 v_color;
flat in float v_extra;
in vec2 v_position;
// Vignette, grain, flash, grain seed.
uniform vec4 u_post;
uniform vec4 u_edges;
uniform vec4 u_backdrop;
// 0: film grain, blended as dst · (src + 1 − a); 1: vignette, flash, edges.
uniform float u_pass;
out vec4 out_color;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7))+u_post.w)*43758.5453);}
void main(){
    if(u_pass<0.5){
        // Like an overlay of grey noise: scales the image by 1 ± grain.
        float g=u_post.y;
        out_color=vec4(vec3(2.0*g*hash(floor(gl_FragCoord.xy))),g);
        return;
    }
    vec2 s=v_position/vec2(1536.0,1024.0);
    float v=clamp((length(v_position-vec2(768.0,512.0))-358.4)/747.52,0.0,1.0)*u_post.x;
    float flash=u_post.z;
    vec4 fade=smoothstep(vec4(0.0),u_edges,vec4(s.x,1.0-s.x,s.y,1.0-s.y));
    // The scene melts into the page around all four edges.
    float e=(1.0-fade.x*fade.y*fade.z*fade.w)*u_backdrop.a;
    float keep=(1.0-v)*(1.0-flash)*(1.0-e);
    vec3 c=u_backdrop.rgb*e+vec3(1.0,.961,.824)*flash*(1.0-e);
    out_color=vec4(c,1.0-keep);
}
