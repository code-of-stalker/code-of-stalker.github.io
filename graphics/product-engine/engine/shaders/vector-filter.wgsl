struct Parameters{ sampling:vec4<f32>, control:vec4<f32> }
@group(0) @binding(0) var source:texture_2d<f32>;
@group(0) @binding(1) var original:texture_2d<f32>;
@group(0) @binding(2) var linear_sampler:sampler;
@group(0) @binding(3) var<uniform> p:Parameters;
struct VertexOut{ @builtin(position) position:vec4<f32>, @location(0) uv:vec2<f32> }
@vertex fn filter_vs(@builtin(vertex_index) i:u32)->VertexOut{let q=array<vec2<f32>,3>(vec2(-1.,-1.),vec2(3.,-1.),vec2(-1.,3.));var out:VertexOut;out.position=vec4(q[i],0.,1.);out.uv=vec2(q[i].x*.5+.5,.5-q[i].y*.5);return out;}
fn sample(uv:vec2<f32>)->vec4<f32>{if(any(uv<vec2(0.))||any(uv>vec2(1.))){return vec4(0.);}return textureSampleLevel(source,linear_sampler,uv,0.);}
@fragment fn filter_fs(v:VertexOut)->@location(0) vec4<f32>{
 if(p.control.x>1.5){var spread=vec4(0.);for(var y=-1;y<=1;y++){for(var x=-1;x<=1;x++){spread=max(spread,sample(v.uv+vec2(f32(x),f32(y))*p.sampling.xy));}}
  if(p.control.z>.5){spread*=1.-textureSampleLevel(original,linear_sampler,v.uv,0.).a;}return spread;
 }
 var color=vec4(0.);var weights=0.;let count=i32(p.control.w);let half_count=(count-1)/2;let sigma=max(.01,p.sampling.z);let spacing=max(1.,sigma*3./f32(max(1,half_count)));
 for(var i=-12;i<=12;i++){if(abs(i)<=half_count){let distance=f32(i)*spacing;let w=exp(-.5*distance*distance/(sigma*sigma));color+=sample(v.uv+distance*p.sampling.xy)*w;weights+=w;}}
 color/=max(.0001,weights);let alpha=clamp(color.a*p.control.y,0.,1.);return vec4(color.rgb*(alpha/max(.00001,color.a)),alpha);
}
