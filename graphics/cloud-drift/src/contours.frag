#version 300 es
precision highp float;
in vec2 v_world;
in float v_side;
flat in float v_opacity;
flat in int v_layer;
out vec4 out_color;
// @shared
void main() {
    float reveal=scan_weight(v_world);
    if(reveal<0.002)discard;
    if(v_layer==5) {
        vec2 h=hero_point(v_world);
        if(all(greaterThan(h,vec2(0.0)))&&all(lessThan(h,SIZE))&&texture(u_person,h/SIZE).a>0.25)discard;
        for(int i=0;i<4;i++)if(object_coverage(object_point(v_world,i),i)>0.1)discard;
    }
    float width=max(0.18,u_viewport.x/1536.0*0.23);
    float core=1.0-smoothstep(width,width+0.48,abs(v_side));
    float halo=exp(-v_side*v_side/2.2)*0.045;
    float alpha=(core*0.78+halo)*reveal*v_opacity;
    out_color=vec4(u_accent,alpha);
}
