#version 300 es
precision highp float;
in vec2 v_local;
in vec4 v_color;
flat in float v_extra;
in vec2 v_position;
uniform sampler2D u_texture;
uniform sampler2D u_detail;
// Mip level of the soft bloom; 0 draws the layer itself.
uniform float u_bloom;
out vec4 out_color;
void main(){
    vec4 c;
    if(u_bloom>0.0){
        vec4 figure=textureLod(u_detail,v_local,u_bloom);
        c=figure+textureLod(u_texture,v_local,u_bloom)*(1.0-figure.a);
    } else {
        c=texture(u_texture,v_local);
    }
    // Textures are premultiplied; a negative extra adds light.
    c*=v_color.a;
    if(v_extra<0.0) c.a=0.0;
    out_color=c;
}
