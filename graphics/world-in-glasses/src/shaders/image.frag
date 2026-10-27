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
// Page over paper, and amount: the light painting's pale sky and stone take
// the page's own color; the darks keep the painted ones.
uniform vec4 u_page;
// Where the paper lands: the sky glowing around her head is brighter than the
// paper, and must not end up as a paler patch on the page.
uniform vec3 u_sky;
// Luminance from which a color counts as pale sky or stone.
uniform vec2 u_pale;
out vec4 out_color;
vec3 on_page(vec3 c){
    float w=smoothstep(u_pale.x,u_pale.y,dot(c,vec3(.2126,.7152,.0722)))*u_page.a;
    return mix(c,min(c*u_page.rgb,u_sky),w);
}
void main(){
    vec4 c;
    if(u_bloom>0.0){
        vec4 figure=textureLod(u_detail,v_local,u_bloom);
        c=figure+textureLod(u_texture,v_local,u_bloom)*(1.0-figure.a);
    } else {
        c=texture(u_texture,v_local);
    }
    if(u_page.a>0.0&&c.a>0.0) c.rgb=on_page(c.rgb/c.a)*c.a;
    // Textures are premultiplied; a negative extra adds light.
    c*=v_color.a;
    if(v_extra<0.0) c.a=0.0;
    out_color=c;
}
