#version 300 es
precision highp float;
in vec2 v_uv;
in vec2 v_position;
uniform sampler2D u_texture;
uniform float u_kind;
uniform float u_light;
uniform float u_environment;
uniform vec4 u_beams[3];
uniform vec4 u_haze;
uniform vec4 u_edge_widths;
uniform vec4 u_backdrop;
out vec4 out_color;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){
    vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
    return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+1.),f.x),f.y);
}
float mist(vec2 p){
    vec2 q=(p-u_haze.xy)/vec2(250.0,92.0);
    return .42+.38*noise(q)+.20*noise(q*2.03+vec2(7.1,1.8));
}
float beams(vec2 p){
    float light=0.0;
    float t=clamp((p.y+.14)/1.18,0.0,1.0);
    for(int i=0;i<3;i++){
        vec4 b=u_beams[i];
        float center=mix(b.x,b.y,t);
        float width=.004+b.z*t;
        float cone=exp(-2.6*pow((p.x-center)/width,2.0));
        light+=cone*b.w*(.95-.48*t);
    }
    return light;
}
void main() {
    vec2 screen=v_position/vec2(1536.0,1024.0);
    if(u_kind>4.5){
        // Composite after every scene layer, so rain and light cannot reveal
        // the rectangular boundary. Widths are independent of buffer density.
        vec4 distances=vec4(screen.x,1.0-screen.x,screen.y,1.0-screen.y);
        vec4 fade=smoothstep(vec4(0.0),u_edge_widths,distances);
        out_color=vec4(u_backdrop.rgb,1.0-fade.x*fade.y*fade.z*fade.w);
        return;
    }
    // Foreground is a separate, transparent bank of stage haze. Its field
    // translations and radiance arrive from Rust, just like the light targets.
    if(u_kind>3.5){
        float band=exp(-pow((screen.y-.83)/.13,2.0));
        float sides=.35+.65*abs(screen.x-.5)*2.0;
        float alpha=mist(v_position)*band*sides*u_haze.z*.7;
        out_color=vec4(.68,.45,.09,alpha);
        return;
    }
    vec4 ink=texture(u_texture,v_uv);
    if(u_kind>0.5 && u_kind<1.5) {
        // Discard the negligible extraction haze. RGB in alpha-zero pixels
        // must never become a second opaque background around the heroine.
        ink.a=smoothstep(0.065,0.994,ink.a);
    }
    if(u_kind<0.5) {
        vec2 p=(v_position-vec2(768.0,510.0))/vec2(470.0,800.0);
        float spot=exp(-dot(p,p));
        ink.rgb*=1.0+(u_light-1.0)*spot;
        if(u_environment>0.0){
            float light=beams(screen);
            // Preserve the painted highlights; the added light occupies the
            // air and changes the illumination on the surrounding architecture.
            ink.rgb*=1.0+light*.9;
            ink.rgb+=vec3(1.0,.71,.12)*light*(1.0-smoothstep(.75,1.0,screen.y)*.75);
            float bank=exp(-pow((screen.y-.72)/.17,2.0));
            float center=exp(-pow((screen.x-.5)/.42,2.0));
            ink.rgb+=vec3(.75,.43,.06)*mist(v_position)*bank*center*u_haze.z;
            float floor=smoothstep(.83,.99,screen.y);
            float reflection=exp(-pow((screen.x-u_beams[0].y)/.18,2.0));
            ink.rgb+=vec3(1.0,.76,.16)*floor*reflection*mist(v_position)*u_haze.w;
        }
    } else if(u_kind<1.5 && u_environment>0.0){
        // Small moving highlights on the existing costume, without flattening
        // its black fabric or replacing the source illustration's gold edges.
        ink.rgb*=1.0+beams(screen)*1.15;
    }
    out_color=ink;
}
