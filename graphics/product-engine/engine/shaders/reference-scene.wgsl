struct Params {
    frame:vec4<f32>, // CSS width, height, active seconds, workload (0 static, 1 rain, 2 observer)
    camera:vec4<f32>, // scale, x, y, observer shift
    motion:vec4<f32>, // other shift, ray span, ray opacity, emission opacity
    style:vec4<f32>, // edge fade, reveal, observer CSS side, spare
}
@group(0) @binding(0) var<uniform> p:Params;
@group(0) @binding(1) var atlas:texture_2d<f32>;
@group(0) @binding(2) var glow:texture_2d<f32>;
@group(0) @binding(3) var smooth_sampler:sampler;
@group(0) @binding(4) var observer:texture_2d<f32>;
struct V { @builtin(position) position:vec4<f32>, @location(0) uv:vec2<f32>, @location(1) color:vec4<f32> }
fn corner(i:u32)->vec2<f32>{let q=array<vec2<f32>,6>(vec2(0.,0.),vec2(1.,0.),vec2(0.,1.),vec2(0.,1.),vec2(1.,0.),vec2(1.,1.));return q[i];}
fn project(pos:vec2<f32>,size:vec2<f32>)->vec4<f32>{return vec4(pos/size*vec2(2.,-2.)+vec2(-1.,1.),0.,1.);}
fn noise(index:u32)->f32 {var v=(73u^index)*0x45d9f3bu;v=(v^(v>>16u))*0x45d9f3bu;return f32(v^(v>>16u))/4294967296.;}
@vertex fn rain_vs(@builtin(vertex_index) v:u32,@builtin(instance_index) i:u32)->V {
    let column=i/33u;let row=32u-i%33u;let c=f32(column);let count=ceil(p.frame.x/11.);
    let depth=1.-noise(column*7u+1u)*0.6;let cell=10.*depth*1.25;
    let tail=floor(23.*(0.6+noise(column*7u+2u)*0.8)+0.5);let cycle=p.frame.y+cell*tail;
    let distance=p.frame.z*0.55*(34.+noise(column*7u+3u)*42.)*depth;
    let raw_head=distance+noise(column*7u+4u)*cycle;let head=raw_head-floor(raw_head/cycle)*cycle;
    let tick=u32(floor(p.frame.z*(1.+0.22*14.)));let random=noise(column*997u+row*17u+tick);
    let glyph=min(u32(floor(random*35.)),34u);let size=24.*depth;let q=corner(v);
    let xy=vec2((c+0.5)*max(11.,p.frame.x/count),head-f32(row)*cell)+(q-0.5)*size;
    var out:V;out.position=project(xy,p.frame.xy);
    if f32(row)>=tail {out.position=vec4(-2.,-2.,0.,1.);}
    out.uv=(vec2(f32(glyph%16u),f32(glyph/16u))+q)/vec2(16.,3.);
    let fade=pow(max(0.,1.-f32(row)/tail),1.7);let opacity=0.51*select(fade*depth,1.,row==0u)*(1.-0.22*random*0.3);
    out.color=vec4(select(vec3(231.,225.,0.),vec3(255.,247.,191.),row==0u)/255.,opacity);return out;
}
@fragment fn rain_fs(v:V)->@location(0) vec4<f32>{let a=textureSample(atlas,smooth_sampler,v.uv).rg;let alpha=(a.x+a.y*(1.-a.x))*v.color.a;return vec4(v.color.rgb*alpha,alpha);}
@vertex fn quad_vs(@builtin(vertex_index) i:u32)->V {let q=corner(i);var out:V;out.position=project(q*320.,vec2(320.));out.uv=q;out.color=vec4(1.);return out;}
@fragment fn background_fs(v:V)->@location(0) vec4<f32>{
    if p.frame.w>0.5 {return vec4(0.,0.,0.,1.);}
    let xy=v.uv*vec2(768.,960.);let r=distance(xy,vec2(490.,280.))/430.;
    var color=mix(vec3(157.,151.,12.),vec3(62.,64.,9.),clamp(r/0.28,0.,1.));
    if r>0.28 {color=mix(vec3(62.,64.,9.),vec3(9.,12.,7.),clamp((r-0.28)/0.72,0.,1.));}
    let g=abs(xy-round(xy/48.)*48.);let major=abs(xy-round(xy/96.)*96.);
    let line=1.-smoothstep(0.25,0.75,min(g.x,g.y));let major_line=1.-smoothstep(0.25,0.75,min(major.x,major.y));
    color=mix(color,mix(vec3(66.,70.,38.),vec3(118.,125.,70.),major_line),line);
    let ring=min(min(abs(distance(xy,vec2(585.,242.))-135.),abs(distance(xy,vec2(125.,725.))-108.)),abs(distance(xy,vec2(610.,775.))-48.));
    color=mix(color,vec3(231.,225.,0.),1.-smoothstep(2.,3.,ring));return vec4(color/255.,1.);
}
fn camera(pos:vec2<f32>)->vec2<f32>{return pos*p.camera.x+p.camera.yz;}
@vertex fn figure_vs(@location(0) point:vec2<f32>,@location(1) part:f32)->V {
    let shift=select(p.camera.w,p.motion.x,part>=2.);var out:V;
    out.position=project(camera(point+vec2(shift,0.)),vec2(320.));out.uv=vec2(0.);
    out.color=vec4(mix(vec3(231.,225.,0.),vec3(255.,245.,154.),select(p.motion.w,0.,part>=1.))/255.,1.);return out;
}
@fragment fn figure_fs(v:V)->@location(0) vec4<f32>{return v.color;}
@vertex fn halo_vs(@builtin(vertex_index) i:u32)->V {let q=corner(i);var out:V;
    out.position=project(camera(vec2(28.+p.camera.w,0.)+q*vec2(122.,244.)),vec2(320.));out.uv=q;out.color=vec4(1.);return out;}
@fragment fn halo_fs(v:V)->@location(0) vec4<f32>{let a=textureSample(glow,smooth_sampler,v.uv).r*p.motion.w*0.75;return vec4(vec3(255.,245.,154.)/255.*a,a);}
@fragment fn ray_fs(v:V)->@location(0) vec4<f32>{
    var xy=(v.uv*320.-p.camera.yz)/p.camera.x;xy.x=(xy.x-p.camera.w-96.6)/p.motion.y+96.6;
    let a=vec2(96.6,26.4);let b=vec2(222.6,34.9);let direction=normalize(b-a);let along=dot(xy-a,direction);
    let phase=along-p.frame.z/1.7*6.1;let cell=phase-floor(phase/6.1)*6.1;
    let across=abs(dot(xy-a,vec2(-direction.y,direction.x)));let end_dist=max(max(-along,along-length(b-a)),0.);
    let dash_dist=max(max(-cell,cell-3.1),end_dist);let dist=length(vec2(max(dash_dist,0.),across));
    let alpha=(1.-smoothstep(0.29-fwidth(dist)*0.5,0.29+fwidth(dist)*0.5,dist))*p.motion.z;
    return vec4(vec3(231.,225.,0.)/255.*alpha,alpha);
}
@vertex fn composite_vs(@builtin(vertex_index) i:u32)->V {let q=corner(i);var out:V;let side=p.style.z;
    let origin=vec2(p.frame.x*.5-side*.5,p.frame.y*.5-side*.5);
    out.position=project(origin+q*side,p.frame.xy);out.uv=q;out.color=vec4(1.);return out;}
fn edge_x(x:f32)->f32 {let d=min(x,320.-x);if d<3. {return mix(1.,.85,d/3.);}if d<7. {return mix(.85,.3,(d-3.)/4.);}return mix(.3,0.,clamp((d-7.)/5.,0.,1.));}
fn edge_y(y:f32)->f32 {let t=(y-268.)/50.;if t<.12 {return mix(0.,.03,clamp(t/.12,0.,1.));}if t<.3 {return mix(.03,.2,(t-.12)/.18);}if t<.5 {return mix(.2,.5,(t-.3)/.2);}if t<.7 {return mix(.5,.8,(t-.5)/.2);}if t<.88 {return mix(.8,.97,(t-.7)/.18);}return mix(.97,1.,clamp((t-.88)/.12,0.,1.));}
@fragment fn composite_fs(v:V)->@location(0) vec4<f32>{let xy=v.uv*320.;let edge=(1.-edge_x(xy.x))*(1.-edge_y(xy.y));
    let mask=mix(1.,edge,p.style.x)*(1.-smoothstep(310.,318.,xy.y));
    return textureSample(observer,smooth_sampler,v.uv)*(mask*p.style.y);
}
