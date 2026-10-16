struct Params{data:array<vec4<f32>,128>}
@group(0) @binding(0)var<uniform>p:Params;
struct V{@builtin(position)position:vec4<f32>,@location(0)uv:vec2<f32>}
fn linear(v:vec3<f32>)->vec3<f32>{return select(pow((v+0.055)/1.055,vec3(2.4)),v/12.92,v<=vec3(0.04045));}
@fragment fn main(v:V)->@location(0)vec4<f32>{
    let size=p.data[126].xy;let xy=vec2(v.uv.x,1.-v.uv.y)*size;
    let spheres=array<vec3<f32>,4>(vec3(size.x-66.,22.,28.),vec3(size.x-35.,size.y+2.,28.),vec3(52.,size.y*.38,15.),vec3(42.,size.y-68.,15.));
    var color=vec3(0.);for(var i=0u;i<4u;i++){let s=spheres[i];let r=length(xy-s.xy-vec2(s.z*.5))/(s.z*.5);let edge=1.-smoothstep(1.-2./s.z,1.,r);
        let a=clamp((r-.72)/.28,0.,1.);let rgb=vec3(245.,221.,7.)/255.*(.14*(1.-a)+a);color=mix(color,linear(rgb),edge);
    }return vec4(color,1.);
}
