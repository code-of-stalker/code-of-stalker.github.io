// The accepted artwork remains immutable. Rust supplies the breath, release,
// three expanding waves, reassembly and fragment geometry in one active clock.
struct Params {
    time: vec4<f32>, size: vec4<f32>, waves: vec4<f32>, last_wave: vec4<f32>,
    energy: vec4<f32>, floor_mask: vec4<f32>, event: vec4<f32>, unused: vec4<f32>
}
@group(0) @binding(0) var<uniform> params: Params;
@group(0) @binding(1) var artwork: texture_2d<f32>;
@group(0) @binding(2) var environment_layers: texture_2d<f32>;
@group(0) @binding(3) var smooth_sampler: sampler;
@group(0) @binding(4) var portrait: texture_2d<f32>;
struct Vertex { @builtin(position) position: vec4<f32>, @location(0) uv: vec2<f32> }
@vertex fn voice_vs(@builtin(vertex_index) i: u32) -> Vertex {
    let points=array<vec2<f32>,3>(vec2(-1.,-1.),vec2(3.,-1.),vec2(-1.,3.));
    var v:Vertex;
    v.position=vec4(points[i],0.,1.);
    v.uv=vec2(points[i].x*.5+.5,.5-points[i].y*.5);
    return v;
}
// Дюна draws Art's light (sand) painting: light added to black air becomes ink.
fn sand()->bool{return params.size.w>.5;}
// The generated dark plate is registered to the source's horizon; the sand
// plate is derived in the artwork's own coordinates.
fn plate_uv(p:vec2<f32>)->vec2<f32>{
    return select(vec2(p.x,.66+(p.y-.70)*1.067),p,sand());
}
fn shine(rgb:vec3<f32>,light:vec3<f32>)->vec3<f32>{
    if(!sand()){return rgb+light;}
    let amount=clamp(dot(light,vec3(.2126,.7152,.0722))*1.6,0.,.9);
    return mix(rgb,vec3(.86,.36,.03),amount);
}
fn art(p:vec2<f32>)->vec3<f32>{
    let source=textureSampleLevel(artwork,smooth_sampler,clamp(p,vec2(0.),vec2(1.)),0.).rgb;
    // Remove the portrait embedded in the OLD scene before layering the edited
    // PNG. This footprint never clips or multiplies the new portrait alpha.
    let old=textureSampleLevel(environment_layers,smooth_sampler,clamp(p,vec2(0.),vec2(1.)),0.).a;
    if(old<=0.){return source;}
    let uv=plate_uv(p);
    let plate=textureSampleLevel(environment_layers,smooth_sampler,clamp(uv,vec2(0.),vec2(1.)),0.).rgb;
    // Continue the authored environment through the old footprint. Filling it
    // with the quiet black plate made a dark moat around the new silhouette.
    // Both anchors lie outside the embedded body; the floor keeps its plate.
    let left=textureSampleLevel(artwork,smooth_sampler,vec2(.40,clamp(p.y,0.,1.)),0.).rgb;
    let right=textureSampleLevel(artwork,smooth_sampler,vec2(.61,clamp(p.y,0.,1.)),0.).rgb;
    let surrounding=mix(left,right,smoothstep(.40,.61,p.x));
    let replacement=mix(surrounding,plate,smoothstep(.72,.85,p.y));
    return mix(source,replacement,old);
}
fn spot(p:vec2<f32>,c:vec2<f32>,r:vec2<f32>)->f32{
    let q=(p-c)/r;
    return exp(-dot(q,q)*2.);
}
fn band(a:f32,b:f32,f:f32,x:f32)->f32{
    return smoothstep(a,a+f,x)*(1.-smoothstep(b-f,b,x));
}
fn portrait_sample(p:vec2<f32>)->vec4<f32>{
    // Feather only the supplied PNG's own alpha edge. Premultiplied RGBA is
    // filtered together, so transparent RGB cannot add a dark/colored fringe.
    // One source pixel is about a quarter display pixel at the inline size.
    let uv=clamp(p,vec2(0.),vec2(1.));
    let user=textureSampleLevel(portrait,smooth_sampler,uv,0.);
    let d=1./vec2<f32>(textureDimensions(portrait));
    let left=textureSampleLevel(portrait,smooth_sampler,uv-vec2(d.x,0.),0.);
    let right=textureSampleLevel(portrait,smooth_sampler,uv+vec2(d.x,0.),0.);
    let above=textureSampleLevel(portrait,smooth_sampler,uv-vec2(0.,d.y),0.);
    let below=textureSampleLevel(portrait,smooth_sampler,uv+vec2(0.,d.y),0.);
    let edge=1.-smoothstep(.75,1.,min(user.a,min(min(left.a,right.a),min(above.a,below.a))));
    let feathered=user*.5+(left+right+above+below)*.125;
    return mix(user,feathered,edge);
}
fn hero(p:vec2<f32>)->f32{
    return portrait_sample(p).a;
}
fn quiet_environment(p:vec2<f32>)->vec3<f32>{
    // Register the generated plate's horizon / ellipse center to the source.
    let uv=plate_uv(p);
    let generated=textureSampleLevel(environment_layers,smooth_sampler,clamp(uv,vec2(0.),vec2(1.)),0.).rgb;
    // The original lower floor has no glyphs: preserve its exact engraving,
    // material and reflection. The generated plate fills the former code wall.
    return mix(generated,art(p),smoothstep(.82,.88,p.y));
}
// Only borrow code from code-bearing rows: rings, figure and voice must not
// descend with the columns. Two scroll phases blend at the source seam.
fn clean_code(p:vec2<f32>)->vec3<f32>{
    let ring=band(.224,.383,.018,p.y);
    let voice=band(.51,.86,.035,p.x)*(1.-smoothstep(.21,.255,p.y));
    return mix(art(p),art(vec2(p.x,p.y+.30)),max(ring,voice));
}
fn flowing_code(p:vec2<f32>,t:f32)->vec3<f32>{
    let column=floor(p.x*61.);
    // Center columns borrow the unobstructed adjacent curtain, never a piece
    // of the person from a different height in the immutable source.
    let source_x=select(p.x,p.x+select(-.20,.20,p.x>=.5),p.x>.40&&p.x<.61);
    let speed=1.+floor(fract(column*.618034)*3.);
    let offset=t/42.*speed;
    let y0=fract(p.y/.71-offset);
    let y1=fract(p.y/.71-offset+.5);
    let weight=sin(y0*3.14159265);
    // The second sample covers the boundary of the first; source glyphs slide
    // continuously, without a visible full-column reset or a hard wrap.
    let w0=weight*weight;
    return clean_code(vec2(source_x,y0*.71))*w0
          +clean_code(vec2(source_x,y1*.71))*(1.-w0);
}
fn ring_light(p:vec2<f32>,radius:f32,alpha:f32)->vec3<f32>{
    let r=max(radius,.025);
    let q=p-vec2(.5,.292);
    let radial=length(vec2(q.x,q.y/0.18));
    let distance=abs(radial-r);
    let core=exp(-pow(distance/.00135,2.));
    let halo=exp(-pow(distance/.008,2.));
    let arc=.62+.38*smoothstep(-.018,.018,q.y);
    return (vec3(1.,.84,.30)*core*.80+vec3(1.,.58,.025)*halo*.16)*alpha*arc;
}
fn with_portrait(background:vec3<f32>,p:vec2<f32>)->vec3<f32>{
    // The source remains untouched; this sampling filter is reversible at runtime.
    let user=portrait_sample(p);
    return user.rgb+background*(1.-user.a);
}
@fragment fn voice_fs(v:Vertex)->@location(0)vec4<f32>{
    let p=v.uv;
    if(params.time.w<.5){return vec4(with_portrait(art(p),p),1.);}
    let t=params.time.x;
    let cycle=t*6.28318530718/14.;
    let breath=params.time.y;
    let voice=params.time.z;
    let restore=params.last_wave.z;
    let person=hero(p);
    let floor_gate=smoothstep(.70+pow(abs(p.x-.5),2.)*.30,.77+pow(abs(p.x-.5),2.)*.30,p.y);
    let gold=vec3(1.,.63,.045);
    let pale=vec3(1.,.88,.38);

    // Connected shoulder/hand/neck field; pelvis and feet remain anchored.
    var q=p;
    let chest=spot(p,vec2(.50,.35),vec2(.105,.22));
    q.x-=(p.x-.5)*.026*breath*chest;
    q.y+=.0040*breath*person*(1.-smoothstep(.46,.72,p.y));
    let lips=spot(p,vec2(.5165,.189),vec2(.008,.008));
    q.y+=(p.y-.1875)*.22*voice*lips;

    let travel=clamp((p.x-.518)/.31,0.,1.);
    let ribbon=band(.518,.854,.027,p.x)
        *spot(p,vec2(p.x,.19-.065*travel),vec2(1.,.077));
    q.y+=ribbon*.019*sin(cycle*10.-travel*14.)*sin(travel*2.3)*voice;
    q.x+=ribbon*.004*sin(cycle*10.-travel*9.)*voice;
    let authored=art(q);
    // Background effects run behind the complete portrait. Its alpha is
    // applied once by with_portrait; gating here as well darkened the fringe.
    let backdrop=1.-floor_gate;
    let ring_zone=band(.224,.383,.021,p.y);
    let rain_gate=backdrop*(1.-ribbon);
    var rgb=mix(authored,flowing_code(p,params.energy.x),rain_gate*.94);

    // The outward front opens a quiet area. Code then returns to its own place,
    // not a newly randomized wall; departing sprites are evaluated in Rust.
    let distance=length(vec2(p.x-.5,(p.y-.30)*.54772));
    let arrival=1.55+distance*3.2;
    let clearing=smoothstep(arrival,arrival+1.7,t)*(1.-restore);
    // A complete quiet frame, not darkened patches around an approximate body.
    // The registered contour samples the SAME artwork, so the portrait cannot
    // jump or ghost during the dissolve. Clearing reaches the entire floor.
    let quiet_frame=quiet_environment(p);
    rgb=mix(rgb,quiet_frame,clearing);
    // The prepainted halo becomes a quiet trace while the moving rings carry
    // the action. Suppress the static voice before inhale/after the release.
    // A weak trace keeps the approved halo readable between releases. The code
    // behind it still scrolls; no stationary horizontal band is cut into rain.
    let trace=ring_zone*.13*(1.-clearing);
    let quiet_voice=ribbon*(.89-.89*voice);
    let current=pow(.5+.5*cos(cycle*4.-p.y*12.+floor(p.x*61.)*1.73),8.);
    if(sand()){
        // A pale page cannot darken or brighten into black air: the trace
        // and the silent voice fade toward the painting and its quiet frame.
        rgb=mix(rgb,authored,trace);
        rgb=mix(rgb,quiet_frame,quiet_voice);
        rgb*=1.+ribbon*voice*(.09+.09*sin(cycle*10.-travel*17.));
    } else {
        rgb+=authored*trace;
        rgb*=1.-quiet_voice;
        rgb*=1.+rain_gate*(current*.25-.045)*(1.-clearing);
        rgb*=1.+ribbon*voice*(.25+.27*sin(cycle*10.-travel*17.));
    }

    // The glow accumulates before speech, then visibly feeds the expanding wave.
    let throat=spot(p,vec2(.499,.274),vec2(.014,.021));
    let halo=spot(p,vec2(.499,.274),vec2(.060,.085));
    let charge=.68*breath+.45*voice;
    rgb+=pale*throat*.48*charge+gold*halo*.085*charge;
    rgb=shine(rgb,ring_light(p,params.waves.x,params.waves.y));
    rgb=shine(rgb,ring_light(p,params.waves.z,params.waves.w));
    rgb=shine(rgb,ring_light(p,params.last_wave.x,params.last_wave.y));

    // The departing field reaches the side curtains as a broad luminous seam.
    let front=exp(-pow((t-arrival-.42)/.33,2.))*(1.-restore);
    rgb=shine(rgb,gold*backdrop*front*.07);

    // The engraved floor is present in both states. Only the voice's reflected
    // light travels across it; no glyph strip survives at its horizon.
    let ground_q=p-vec2(.5,.863);
    let ground_distance=length(vec2(ground_q.x,ground_q.y/.15));
    let ground_wave=exp(-pow((ground_distance-params.waves.x)/.006,2.))
        *params.waves.y*floor_gate;
    rgb=shine(rgb,gold*ground_wave*.28);
    let reflection=spot(p,vec2(.5,.923),vec2(.23,.13))*floor_gate;
    rgb*=1.+reflection*(.28*voice+.10*breath)*select(1.,.3,sand());
    return vec4(with_portrait(rgb,q),1.);
}
