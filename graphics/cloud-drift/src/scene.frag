#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 out_color;
// @shared

float line_distance(vec2 p,vec2 a,vec2 b) {vec2 d=b-a;return length(p-a-d*clamp(dot(p-a,d)/dot(d,d),0.0,1.0));}
float glyph(vec2 p,int code) {
    const int shapes[12]=int[12](119,36,93,109,46,107,123,37,127,111,181,214);
    int bits=shapes[code];float d=100.0;
    if((bits&1)!=0)d=min(d,line_distance(p,vec2(-2.0,-4.0),vec2(2.0,-4.0)));
    if((bits&2)!=0)d=min(d,line_distance(p,vec2(-2.0,-4.0),vec2(-2.0,0.0)));
    if((bits&4)!=0)d=min(d,line_distance(p,vec2(2.0,-4.0),vec2(2.0,0.0)));
    if((bits&8)!=0)d=min(d,line_distance(p,vec2(-2.0,0.0),vec2(2.0,0.0)));
    if((bits&16)!=0)d=min(d,line_distance(p,vec2(-2.0,0.0),vec2(-2.0,4.0)));
    if((bits&32)!=0)d=min(d,line_distance(p,vec2(2.0,0.0),vec2(2.0,4.0)));
    if((bits&64)!=0)d=min(d,line_distance(p,vec2(-2.0,4.0),vec2(2.0,4.0)));
    if((bits&128)!=0)d=min(d,line_distance(p,vec2(-2.0,-4.0),vec2(2.0,4.0)));
    float aa=max(0.32,1536.0/u_viewport.x*0.45);
    return 1.0-smoothstep(0.18,0.18+aa,d);
}
float matrix_rain(vec2 q) {
    q.x+=sin(q.y*0.005+u_camera.w)*u_wind.x*u_effects.y*4.0;
    float column=floor((q.x+26.0)/51.0);
    float seed=fract(sin(column*127.1+12.7)*43758.5453);
    float local_x=q.x-(column*51.0+sin(column*3.1)*9.0);
    if(abs(local_x)>4.0)return 0.0;
    float cycles=1.0+step(0.52,seed);
    float flow=mod(q.y-u_camera.w/TAU*1024.0*cycles+seed*1024.0,1024.0);
    float row=floor(flow/16.0);
    float y=mod(flow,16.0)-8.0;
    if(abs(y)>5.2)return 0.0;
    int character=int(mod(floor(seed*134.0)+row*7.0,12.0));
    float tail=exp(-row/(8.0+seed*12.0));
    float brightness=(0.09+0.37*tail)*(0.62+seed*0.38);
    return glyph(vec2(local_x,y),character)*brightness;
}
float wind_threads(vec2 q) {
    float ink=0.0;
    for(int i=0;i<4;i++) {
        float f=float(i);
        float center_x=260.0+f*345.0+u_wind.x*90.0;
        float y=270.0+f*185.0+sin(q.x*0.004+f*2.0)*32.0;
        float window=exp(-pow((q.x-center_x)/125.0,4.0));
        float line=exp(-pow((q.y-y)/0.8,2.0));
        ink+=line*window*0.085;
    }
    return ink*u_wind.x*u_effects.y;
}

vec3 dream(vec3 behind, vec2 q, vec2 center, vec2 radius, int index) {
    vec4 motion = u_objects[index];
    vec2 p = turn(q - center - motion.xy, -motion.z) + center;
    float d = length((p - center) / radius);
    if (d >= 1.0) return behind;
    vec3 art = texture(u_source, p / SIZE).rgb;
    float edge = 1.0 - smoothstep(0.86, 1.0, d);
    // These visions live in black air (the light paintings carry a matte).
    // Retain the engraved gold pixels without carrying a rectangular crop of
    // the source into the reconstructed sky.
    float coverage = vision(p) * edge;
    float band = exp(-pow((p.x + p.y * 0.32 - center.x - center.y * 0.32
        - sin(u_camera.w + float(index)) * radius.x * 1.7) / 15.0, 2.0));
    // A pale painting brightened past white washes out: pulse it gently.
    float pulse = light_paintings() ? 0.3 : 1.0;
    art *= 1.0 + (motion.w - 1.0 + band * 0.16 * u_cloth.w) * pulse;
    return mix(behind, art, coverage);
}

void main() {
    if (u_control.x > 0.5) {
        out_color = vec4(mix(u_background,texture(u_source, v_uv).rgb,edge_coverage(v_uv)), 1.0);
        return;
    }
    vec2 q = (v_uv * SIZE - SIZE * 0.5) / u_camera.z + SIZE * 0.5 - u_camera.xy - u_control.yz;
    vec2 plate = plate_point(q);
    vec3 color = texture(u_plate, clamp(plate / SIZE, 0.001, 0.999)).rgb;
    // Quiet moving illumination follows the illustration's existing edges.
    float cloud_light = sin(q.x * 0.003 - q.y * 0.002 + u_camera.w) * 0.05 * u_cloth.w;
    color *= 1.0 + cloud_light;
    float rain=matrix_rain(q)*u_effects.x*min(u_cloth.w,1.0);
    if(light_paintings()) {
        // Amber ink on the pale sky, fading over the darker suit and clouds.
        rain*=smoothstep(0.35,0.75,dot(color,vec3(0.2126,0.7152,0.0722)));
        color*=1.0-vec3(0.07,0.38,0.78)*min((rain+wind_threads(q))*1.6,1.0);
    } else {
        rain*=1.0-smoothstep(0.10,0.48,color.r)*0.8;
        color+=vec3(0.85,0.65,0.06)*(rain+wind_threads(q));
    }

    color = dream(color, q, vec2(903.0, 109.0), vec2(128.0, 113.0), 0);
    color = dream(color, q, vec2(1211.0, 111.0), vec2(128.0, 114.0), 1);
    color = dream(color, q, vec2(1163.0, 347.0), vec2(100.0, 125.0), 2);
    color = dream(color, q, vec2(1409.0, 307.0), vec2(126.0, 139.0), 3);

    vec2 h = hero_point(q);
    if (all(greaterThanEqual(h, vec2(0.0))) && all(lessThanEqual(h, SIZE))) {
        vec4 hero = texture(u_person, h / SIZE);
        // The extraction stores its opaque interior at alpha 253/254.
        float alpha = smoothstep(0.012, 0.995, hero.a);
        color = mix(color, hero.rgb, alpha);
    }
    // Dim only the short trailing reveal so the etched contours read clearly.
    // The leading light is composited afterwards and retains the theme accent.
    if(u_control.w<0.5)color*=1.0-scan_weight(q)*(light_paintings()?0.12:0.42);
    float scan_distance=abs(u_scan.x-(q.x+q.y*0.24));
    float pixel_size=SIZE.x/max(u_viewport.x,1.0);
    float scan_core=1.0-smoothstep(pixel_size*0.4,pixel_size*1.25,scan_distance);
    float scan_halo=exp(-pow(scan_distance/(pixel_size*6.0),2.0))*0.16;
    float scan_light=(scan_core+scan_halo)*u_scan.y*u_effects.z;
    // On the light paintings the scanner draws in ink instead of light.
    if(light_paintings())color=mix(color,u_accent*0.6,min(scan_light,1.0));
    else color+=u_accent*scan_light;
    if(u_control.w>0.5)color=vec3(0.0);
    out_color = vec4(mix(u_background,max(color,vec3(0.0)),edge_coverage(v_uv)), 1.0);
}
