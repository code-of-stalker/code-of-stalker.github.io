#version 300 es
precision highp float;
layout(location=0) in vec4 a_segment;
layout(location=1) in vec4 a_detail;
// @shared
out vec2 v_world;
out float v_side;
flat out float v_opacity;
flat out int v_layer;

vec2 world(vec2 p,int layer) {
    if(layer==0)return hero_world(p);
    if(layer<5){int i=layer-1;vec2 c=object_center(i);return turn(p-c,u_objects[i].z)+c+u_objects[i].xy;}
    vec2 target=(p-SIZE*0.5)/0.94+SIZE*0.5;
    vec2 q=target;
    for(int i=0;i<3;i++)q=target-cloud_drift(q);
    return q;
}
void main() {
    int layer=int(a_detail.z);
    vec2 wa=world(a_segment.xy,layer),wb=world(a_segment.zw,layer);
    vec2 a=world_screen(wa)/SIZE*u_viewport.xy,b=world_screen(wb)/SIZE*u_viewport.xy;
    vec2 direction=b-a;float distance=max(length(direction),0.001);
    vec2 normal=vec2(-direction.y,direction.x)/distance;
    float extent=max(2.2,u_viewport.x/1536.0*3.0);
    vec2 p=mix(a,b,a_detail.x)+normal*a_detail.y*extent;
    gl_Position=vec4(p.x/u_viewport.x*2.0-1.0,1.0-p.y/u_viewport.y*2.0,0.0,1.0);
    v_world=mix(wa,wb,a_detail.x);
    v_side=a_detail.y*extent;
    v_opacity=a_detail.w;v_layer=layer;
}
