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
    if f32(row)>=tail || noise(column*7u+5u)>p.style.w {out.position=vec4(-2.,-2.,0.,1.);}
    out.uv=(vec2(f32(glyph%16u),f32(glyph/16u))+q)/vec2(16.,3.);
    let fade=pow(max(0.,1.-f32(row)/tail),1.7);let opacity=0.51*select(fade*depth,1.,row==0u)*(1.-0.22*random*0.3);
    out.color=vec4(select(vec3(231.,225.,0.),vec3(255.,247.,191.),row==0u)/255.,opacity);return out;
}
@fragment fn rain_fs(v:V)->@location(0) vec4<f32>{let a=textureSample(atlas,smooth_sampler,v.uv).rg;let alpha=(a.x+a.y*(1.-a.x))*v.color.a;return vec4(v.color.rgb*alpha,alpha);}
