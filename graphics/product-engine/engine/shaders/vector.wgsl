struct MaskInfo{ uv:vec4<f32>, matrix:vec4<f32>, gradient:vec4<f32>, mode:vec4<f32> }
struct Parameters{ projection:vec4<f32>, masks:array<MaskInfo,32> }
struct VertexOut {
 @builtin(position) position:vec4<f32>, @location(0) color:vec4<f32>, @location(1) gradient:vec4<f32>,
 @location(2) mask0:vec2<f32>, @location(3) mask1:vec2<f32>, @location(4) mask2:vec2<f32>, @location(5) mask3:vec2<f32>,
 // Mask identifiers are discrete data. Interpolating float IDs and truncating
 // in the fragment stage can select a neighbouring mask on another GPU.
 @location(6) @interpolate(flat) mask_ids:vec4<u32>,
}
@group(0) @binding(0) var gradients:texture_2d<f32>;
@group(0) @binding(1) var masks:texture_2d<f32>;
@group(0) @binding(2) var smooth_sampler:sampler;
@group(0) @binding(3) var<uniform> parameters:Parameters;
@group(0) @binding(4) var layer_image:texture_2d<f32>;
@vertex fn vector_vs(@location(0) position:vec2<f32>,@location(1) color:vec4<f32>,@location(2) gradient:vec4<f32>,@location(3) mask0:vec4<f32>,@location(4) mask1:vec4<f32>,@location(5) mask2:vec4<f32>,@location(6) mask3:vec4<f32>)->VertexOut{
 var result:VertexOut;result.position=vec4(position*parameters.projection.xy+parameters.projection.zw,0.,1.);result.color=color;result.gradient=gradient;result.mask0=mask0.xy;result.mask1=mask1.xy;result.mask2=mask2.xy;result.mask3=mask3.xy;result.mask_ids=vec4<u32>(vec4(mask0.z,mask1.z,mask2.z,mask3.z));return result;
}
fn mask_alpha(xy:vec2<f32>,id:u32)->f32 {
 if(id==0u){return 1.;}
 if(any(xy<vec2(0.))||any(xy>vec2(1.))){return 0.;}
 let info=parameters.masks[id];let mode=info.mode.z;
 if(mode<1.5){let uv=info.uv.xy+xy*info.uv.zw;let sample=textureSampleLevel(masks,smooth_sampler,uv,0.);return select(sample.a,dot(sample.rgb,vec3(.2126,.7152,.0722)),mode>.5);}
 if(mode<2.5){return info.mode.w;}
 let p=vec2(dot(xy,info.matrix.xz),dot(xy,info.matrix.yw))+info.gradient.xy;
 let offset=select(p.x,length(p),info.gradient.w>.5);let sample=textureSampleLevel(gradients,smooth_sampler,vec2(clamp(offset,0.,1.),info.gradient.z),0.);
 return select(sample.a,sample.a*dot(sample.rgb,vec3(.2126,.7152,.0722)),mode>3.5)*info.mode.w;
}
@fragment fn vector_fs(v:VertexOut)->@location(0) vec4<f32>{
 let alpha=mask_alpha(v.mask0,v.mask_ids.x)*mask_alpha(v.mask1,v.mask_ids.y)*mask_alpha(v.mask2,v.mask_ids.z)*mask_alpha(v.mask3,v.mask_ids.w);var color=v.color;
 if(v.gradient.w<-.5){return textureSampleLevel(layer_image,smooth_sampler,v.gradient.xy,0.)*color.a*alpha;}
 if(v.gradient.w>0.){
  var p=v.gradient.x;if(v.gradient.w>1.5){p=length(v.gradient.xy);}
  let sample=textureSampleLevel(gradients,smooth_sampler,vec2(clamp(p,0.,1.),v.gradient.z),0.);
  color=vec4(sample.rgb,color.a*sample.a);
 }
 return vec4(color.rgb*color.a*alpha,color.a*alpha);
}
