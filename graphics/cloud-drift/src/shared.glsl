uniform sampler2D u_source;
uniform sampler2D u_plate;
uniform sampler2D u_person;
uniform vec4 u_camera;
uniform vec4 u_hero;
uniform vec4 u_cloth;
uniform vec4 u_cloud;
uniform vec4 u_objects[4];
uniform vec4 u_control;
uniform vec4 u_wind;
uniform vec4 u_scan;
uniform vec4 u_effects;
uniform vec4 u_viewport;
uniform vec3 u_accent;
uniform vec3 u_background;
const vec2 SIZE = vec2(1536.0, 1024.0);
const float TAU = 6.28318530718;

float edge_coverage(vec2 uv) {
    vec2 distance=min(uv,1.0-uv);
    return smoothstep(0.0,0.10,distance.x)*smoothstep(0.0,0.15,distance.y);
}

vec2 turn(vec2 p, float angle) {
    float c=cos(angle),s=sin(angle);
    return vec2(c*p.x-s*p.y,s*p.x+c*p.y);
}
float bell(vec2 p, vec2 center, vec2 radius) {
    vec2 d=(p-center)/radius;return exp(-dot(d,d)*2.0);
}
vec2 cloud_drift(vec2 q) {
    float near_cloud=smoothstep(270.0,980.0,q.y);
    float left_cloud=1.0-smoothstep(120.0,610.0,q.x);
    vec2 d=u_cloud.xy*(0.22+near_cloud*1.1+left_cloud*0.28);
    d.x+=sin(q.y*0.009+u_camera.w*2.0)*2.7*near_cloud*u_cloth.w;
    d.y+=cos(q.x*0.006+u_camera.w)*2.0*near_cloud*u_cloth.w;
    d.x+=u_wind.x*u_effects.y*(11.0+near_cloud*14.0);
    d.y+=sin(q.x*0.005+u_camera.w*3.0)*u_wind.x*u_effects.y*3.0*near_cloud;
    return d;
}
vec2 plate_point(vec2 q) {return (q+cloud_drift(q)-SIZE*0.5)*0.94+SIZE*0.5;}
vec2 local_hero(vec2 h) {
    float reaching=smoothstep(922.0,1150.0,h.x)*(1.0-smoothstep(310.0,410.0,h.y));
    h=mix(h,turn(h-vec2(948.0,293.0),-u_hero.w)+vec2(948.0,293.0),reaching);
    float hem=bell(h,vec2(462.0,533.0),vec2(195.0,105.0));
    float tie=bell(h,vec2(666.0,429.0),vec2(129.0,71.0));
    float ankles=smoothstep(630.0,950.0,h.y);
    float hair=bell(h,vec2(755.0,116.0),vec2(100.0,82.0))*(1.0-smoothstep(125.0,165.0,h.y));
    h.y+=hem*(u_cloth.x*6.0+u_wind.y*u_effects.y*7.0)+tie*(u_cloth.y*3.8+u_wind.z*u_effects.y*5.0);
    h.x+=hem*(u_cloth.y*3.0+u_wind.x*u_effects.y*5.0)+ankles*u_cloth.z*7.0;
    h.y+=ankles*u_cloth.x*3.0+hair*u_wind.z*u_effects.y*1.5;
    return h;
}
vec2 hero_point(vec2 q) {
    vec2 h=turn(q-vec2(594.0,489.0)-u_hero.xy,-u_hero.z)+vec2(594.0,489.0);
    return local_hero((h-vec2(-9.0,126.0))/0.8);
}
vec2 hero_world(vec2 p) {
    // Invert the exact raster deformation, rather than approximate a second rig.
    vec2 h=p;
    for(int i=0;i<4;i++)h+=p-local_hero(h);
    h=h*0.8+vec2(-9.0,126.0);
    return turn(h-vec2(594.0,489.0),u_hero.z)+vec2(594.0,489.0)+u_hero.xy;
}
vec2 object_center(int i) {
    if(i==0)return vec2(903.0,109.0);if(i==1)return vec2(1211.0,111.0);
    if(i==2)return vec2(1163.0,347.0);return vec2(1409.0,307.0);
}
vec2 object_radius(int i) {
    if(i==0)return vec2(128.0,113.0);if(i==1)return vec2(128.0,114.0);
    if(i==2)return vec2(100.0,125.0);return vec2(126.0,139.0);
}
vec2 object_point(vec2 q,int i) {vec2 c=object_center(i);return turn(q-c-u_objects[i].xy,-u_objects[i].z)+c;}
float object_coverage(vec2 p,int i) {
    float d=length((p-object_center(i))/object_radius(i));
    if(d>=1.0)return 0.0;
    vec3 c=texture(u_source,p/SIZE).rgb;
    return (1.0-smoothstep(0.86,1.0,d))*smoothstep(0.035,0.16,max(c.r,c.g));
}
vec2 world_screen(vec2 q) {return (q-SIZE*0.5+u_camera.xy+u_control.yz)*u_camera.z+SIZE*0.5;}
float scan_weight(vec2 q) {
    if(u_control.w>0.5)return 1.0;
    float distance=u_scan.x-(q.x+q.y*0.24);
    // Only the narrow wake that the scanner has already crossed can reveal lines.
    float wake=smoothstep(0.0,10.0,distance)*(1.0-smoothstep(36.0,128.0,distance));
    return wake*u_scan.y*u_effects.z;
}
