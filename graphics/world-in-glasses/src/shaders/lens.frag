#version 300 es
precision highp float;
precision highp int;
in vec2 v_local;
in vec4 v_color;
flat in float v_extra;
in vec2 v_position;
uniform sampler2D u_world;
uniform sampler2D u_ruins;
uniform sampler2D u_mask;
uniform sampler2D u_cells;
uniform vec4 u_world_map;
uniform vec4 u_ruins_map[2];
// Per shard: refraction offset, signed tone, turn to the ruins.
uniform vec4 u_cell[64];
uniform vec4 u_sun;
uniform vec4 u_couple;
// x: life of the dream, y: Art's blurred copy.
uniform vec4 u_life;
// Glint x and strength, healing light x and strength.
uniform vec4 u_sweep;
out vec4 out_color;
const float PI=3.14159265;
vec2 world_uv(vec2 p){return p*u_world_map.xy+u_world_map.zw;}
void main(){
    vec2 mask=texture(u_mask,v_local).rg;
    if(max(mask.r,mask.g)<=0.0) discard;
    ivec2 size=textureSize(u_cells,0);
    ivec2 texel=clamp(ivec2(v_local*vec2(size)),ivec2(0),size-ivec2(1));
    int id=int(texelFetch(u_cells,texel,0).r*255.0+0.5);
    vec4 cell=id>0?u_cell[id-1]:vec4(0.0);
    vec2 p=v_position;
    vec2 q=p-cell.xy;
    // Slightly sharper than plain trilinear, like the canvas's high-quality smoothing.
    vec3 color=texture(u_world,world_uv(q),-1.2).rgb;
    if(cell.w>0.0){
        vec4 map=u_ruins_map[id>32?1:0];
        color=mix(color,texture(u_ruins,q*map.xy+map.zw,-1.2).rgb,cell.w);
    }
    if(cell.z>0.0) color=mix(color,vec3(1.0,.839,.431),min(cell.z*.6,1.0));
    else if(cell.z<0.0) color=mix(color,vec3(.102,.063,0.0),min(-cell.z*1.6,1.0));
    vec3 light=vec3(0.0);
    if(u_sun.z>0.0){
        vec2 s=p-u_sun.xy;
        float r=length(s);
        float d=r/34.0;
        light+=mix(vec3(1.0,.98,.843),vec3(1.0,.863,.353),clamp(d,0.0,1.0))*u_sun.z*max(1.0-d,0.0);
        // Ten slow rays: thin wedges 80 px long.
        float sector=PI/5.0;
        float psi=mod(atan(s.y,s.x)-u_sun.w+sector*.5,sector)-sector*.5;
        float across=r*abs(sin(psi))-.04375*r*cos(psi);
        float ray=(1.0-smoothstep(-.5,.5,across))*(1.0-step(80.0,r*cos(psi)));
        light+=vec3(1.0,.941,.667)*ray*.05*u_life.x;
    }
    if(u_couple.z>0.0){
        float d=length(p-u_couple.xy)/10.0;
        light+=mix(vec3(1.0,.925,.667),vec3(1.0,.824,.314),clamp(d,0.0,1.0))*u_couple.z*max(1.0-d,0.0);
    }
    // A faint arc of reflected sky across each whole glass, screened over it.
    vec4 frame=p.x<786.0?vec4(660.0,104.0,116.0,96.0):vec4(793.0,108.0,103.0,94.0);
    float ring=(length(p-vec2(frame.x+frame.z*.3,frame.y-frame.w*.9))-frame.w*1.05)/(frame.w*.2);
    vec2 inside=smoothstep(frame.xy-3.0,frame.xy+3.0,p)*(1.0-smoothstep(frame.xy+frame.zw-3.0,frame.xy+frame.zw+3.0,p));
    float arc=.13*max(1.0-abs(ring*2.0-1.0),0.0)*inside.x*inside.y*u_life.x;
    if(u_sweep.y>0.0){
        float d=abs(p.x+.4663*(p.y-150.0)-u_sweep.x)/16.0;
        light+=vec3(1.0,1.0,.902)*u_sweep.y*max(1.0-d,0.0);
    }
    if(u_sweep.w>0.0){
        float d=abs(p.x-u_sweep.z)/20.0;
        light+=vec3(1.0,.941,.667)*u_sweep.w*max(1.0-d,0.0);
    }
    vec3 sharp=color+light;
    sharp+=vec3(1.0,.98,.9)*arc*(1.0-clamp(sharp,0.0,1.0));
    vec3 halo=textureLod(u_world,world_uv(p),5.4).rgb;
    float glow=mask.g*u_life.y*(1.0-mask.r);
    out_color=vec4(sharp*mask.r+halo*glow,mask.r+glow);
}
