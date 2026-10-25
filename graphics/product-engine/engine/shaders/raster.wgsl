struct Params{time:vec4<f32>,size:vec4<f32>,base:vec4<f32>,mask:vec4<f32>,energy:vec4<f32>,floor_mask:vec4<f32>,event:vec4<f32>,unused:vec4<f32>}
@group(0) @binding(0) var<uniform> params:Params;
@group(0) @binding(1) var atlas:texture_2d<f32>;
@group(0) @binding(2) var glyphs:texture_2d<f32>;
@group(0) @binding(3) var smooth_sampler:sampler;
struct V{@builtin(position) position:vec4<f32>,@location(0) world:vec2<f32>,@location(1) uv:vec2<f32>,@location(2) rect:vec4<f32>,@location(3) color:vec4<f32>,@location(4) effect:vec4<f32>}
@vertex fn sprite_vs(@location(0) position:vec2<f32>,@location(1) world:vec2<f32>,@location(2) uv:vec2<f32>,@location(3) rect:vec4<f32>,@location(4) color:vec4<f32>,@location(5) effect:vec4<f32>)->V{var v:V;v.position=vec4(position,0.,1.);v.world=world;v.uv=uv;v.rect=rect;v.color=color;v.effect=effect;return v;}
fn sample_rect(rect:vec4<f32>,p:vec2<f32>)->vec4<f32>{return textureSampleLevel(atlas,smooth_sampler,(rect.xy+p*rect.zw)/params.size.xy,0.);}
fn card_polygon(index:u32)->array<vec2<f32>,4>{
 switch index{case 0u:{return array<vec2<f32>,4>(vec2(23.,23.),vec2(205.,90.),vec2(204.,485.),vec2(23.,537.));}case 1u:{return array<vec2<f32>,4>(vec2(23.,23.),vec2(200.,84.),vec2(200.,422.),vec2(23.,481.));}case 2u:{return array<vec2<f32>,4>(vec2(23.,23.),vec2(174.,76.),vec2(174.,374.),vec2(23.,409.));}case 3u:{return array<vec2<f32>,4>(vec2(23.,76.),vec2(174.,23.),vec2(174.,409.),vec2(23.,374.));}case 4u:{return array<vec2<f32>,4>(vec2(23.,85.),vec2(200.,23.),vec2(200.,481.),vec2(23.,428.));}default:{return array<vec2<f32>,4>(vec2(23.,91.),vec2(205.,23.),vec2(205.,537.),vec2(23.,485.));}}
}
fn card_inside(p:vec2<f32>,size:vec2<f32>,phase:f32)->bool{let i=u32(round((phase-.3)/1.19));let q=card_polygon(i);var sign=0.;for(var k=0u;k<4u;k++){let a=(q[k]-size*.5)*vec2(.82,.88)+size*.5;let b=(q[(k+1u)%4u]-size*.5)*vec2(.82,.88)+size*.5;let cross=(b.x-a.x)*(p.y-a.y)-(b.y-a.y)*(p.x-a.x);if(k==0u){sign=cross;}else if(cross*sign<0.){return false;}}return true;}
@fragment fn sprite_fs(v:V)->@location(0)vec4<f32>{
 var uv=v.uv;let kind=v.effect.x;
 if(kind>0.5&&kind<1.5){let local=uv-v.rect.xy;let middle=v.effect.y;let gate=exp(-pow((floor(local.y/5.)*5.-middle)/27.,2.));let shift=sin(floor(local.y/5.)*5.*.086-params.time.x*1.8+v.effect.w)*gate*v.effect.z;
  if(abs(local.y-middle)<52.&&card_inside(local,v.rect.zw,v.effect.w)){uv.x-=shift;}
 }
 var pixel=textureSampleLevel(atlas,smooth_sampler,uv/params.size.xy,0.);
 if(kind>8.5&&kind<9.5){let local=(uv-v.rect.xy)/v.rect.zw;let feather=smoothstep(0.,.12,local.x)*smoothstep(0.,.12,1.-local.x)*smoothstep(0.,.10,local.y)*smoothstep(0.,.10,1.-local.y);pixel*=feather;}
 if((kind>2.5&&kind<4.5)||(kind>7.5&&kind<8.5)){let cell=textureSampleLevel(glyphs,smooth_sampler,v.uv/vec2(768.,144.),0.);let core=cell.r;let glow=cell.g;let a=clamp(core+glow*.6,0.,1.);var ink=vec3(1.,.875,.412);var halo=vec3(.92,.66,0.);if(params.size.w>.5){ink=vec3(1.,.4,0.);halo=vec3(1.,.64,.25);}pixel=vec4(clamp(ink*core+halo*glow*.6,vec3(0.),vec3(a)),a);}
 if(kind>3.5&&kind<5.5){let p=vec2(v.world.x/1487.,(v.world.y-632.)/412.);if(p.x>=0.&&p.x<=1.&&p.y>=0.&&p.y<=1.){pixel*=1.-sample_rect(params.floor_mask,p).a;}}
 if(kind>5.5&&kind<6.5){let mask=sample_rect(params.mask,v.world/vec2(576.,410.)).b;pixel*=mask;}
 if(kind>6.5&&kind<7.5){let mask=sample_rect(params.energy,v.world/vec2(576.,410.)).b;pixel*=1.-mask;}
 if(kind>7.5&&kind<8.5){let mask=sample_rect(params.mask,v.world/vec2(576.,410.)).b;pixel*=mask;}
 let result=vec4(pixel.rgb*v.color.rgb*v.color.a,pixel.a*v.color.a);
 // Mirror is already colored in its scene pass and bypasses presentation.
 // Its separate rain/foreground sprites need the same premultiplied palette.
 if(params.unused.x>2.5&&params.unused.y>.5){let ink=clamp(max(max(result.r,result.g),result.b),0.,result.a);let accent=select(vec3(98.,150.,245.),vec3(152.,105.,218.),kind<.5)/255.;return vec4(vec3(13.,20.,38.)/255.*(result.a-ink)+accent*ink,result.a);}
 return result;
}
