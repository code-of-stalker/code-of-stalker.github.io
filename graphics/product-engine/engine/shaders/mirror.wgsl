struct Params{time:vec4<f32>,size:vec4<f32>,base:vec4<f32>,mask:vec4<f32>,energy:vec4<f32>,floor_mask:vec4<f32>,event:vec4<f32>,unused:vec4<f32>}
@group(0) @binding(0) var<uniform> params:Params;
@group(0) @binding(1) var atlas:texture_2d<f32>;
@group(0) @binding(3) var smooth_sampler:sampler;
struct V{@builtin(position) position:vec4<f32>,@location(0) uv:vec2<f32>}
@vertex fn mirror_vs(@builtin(vertex_index)i:u32)->V{let q=array<vec2<f32>,3>(vec2(-1.,-1.),vec2(3.,-1.),vec2(-1.,3.));var v:V;v.position=vec4(q[i],0.,1.);v.uv=vec2(q[i].x*.5+.5,.5-q[i].y*.5);return v;}
// The shared Figma alpha mask is applied to the completed scene, including
// particles and emission, rather than independently fading overlapping layers.
@fragment fn fade_fs(v:V)->@location(0)vec4<f32>{let alpha=clamp(v.uv.y/.0648674,0.,1.)*clamp((1.-v.uv.y)/(1.-.893657),0.,1.);return vec4(0.,0.,0.,alpha);}
fn sample_rect(rect:vec4<f32>,p:vec2<f32>)->vec4<f32>{return textureSampleLevel(atlas,smooth_sampler,(rect.xy+clamp(p,vec2(0.),vec2(1.))*rect.zw)/params.size.xy,0.);}
fn img(p:vec2<f32>)->vec3<f32>{return sample_rect(params.base,p/vec2(576.,410.)).rgb;}
fn region(p:vec2<f32>,center:vec2<f32>,radius:vec2<f32>)->f32{return 1.-smoothstep(.25,1.18,length((p-center)/radius));}
fn movement(p:vec2<f32>,center:vec2<f32>,radius:vec2<f32>,phase:f32,depth:f32)->vec2<f32>{let t=params.time.x;return vec2(sin(t*.44+phase)*1.8,cos(t*.35+phase)*1.15)*region(p,center,radius)*depth;}
@fragment fn mirror_fs(v:V)->@location(0)vec4<f32>{
 let t=params.time.x;let p=vec2(v.uv.x*576.,v.uv.y*412.-1.);if(p.y<0.||p.y>410.){return vec4(0.,0.,0.,1.);}let original=img(p);
 let masks=sample_rect(params.mask,p/vec2(576.,410.)).rgb;let hero=masks.r;let faces=masks.g;let code=masks.b;let field=sample_rect(params.energy,p/vec2(576.,410.)).rgb;let foreground=field.b;
 var offset=movement(p,vec2(65.,179.),vec2(38.,56.),.2,.65)+movement(p,vec2(145.,148.),vec2(49.,76.),1.7,.9)+movement(p,vec2(322.,134.),vec2(64.,92.),3.1,1.15)+movement(p,vec2(439.,176.),vec2(46.,73.),4.6,.8)+movement(p,vec2(530.,159.),vec2(43.,79.),5.9,.55);
 let local_x=clamp((p.x-43.)/507.,0.,1.);let wall_y=(p.y-mix(77.,10.,local_x))/(mix(281.,305.,local_x)-mix(77.,10.,local_x));let phase=fract(t*.052);let band=exp(-pow((wall_y-phase)/.038,2.));let narrow=exp(-pow((wall_y-phase)/.004,2.));
 let pulse=params.event.z*.2;let glitch_area=(1.-smoothstep(5.,9.,abs(p.y-params.event.y)))*(1.-smoothstep(35.,72.,abs(p.x-params.event.x)))*faces;let glitch_echo=(1.-smoothstep(1.,3.,abs(p.y-params.event.y-17.)))*(1.-smoothstep(25.,65.,abs(p.x-params.event.x)))*faces;
 offset.x+=sin(p.y*.33-t*2.1)*band*1.25*1.3*faces+pulse*(glitch_area*7.+glitch_echo*3.)*params.event.w;offset.y+=pulse*glitch_area*.9;
 let heat_area=smoothstep(.008,.37,field.r)*(1.-foreground);var heat=vec2(sin(p.y*.125+t*1.16+sin(p.x*.047-t*.3)*1.7),cos(p.x*.11+p.y*.05+t*.89)*.38);heat*=heat_area*.5*2.6;
 let q=p-(offset*2.+heat)*(1.-foreground);var rgb=mix(img(q),original,hero);rgb*=1.-.48*.8*code;rgb*=1.+faces*(.038*sin(t*.58+p.x*.019));rgb+=faces*(band*.33+narrow*.20)*1.6*(rgb+vec3(.20,.13,.01));rgb+=pulse*(glitch_area+glitch_echo)*.15*vec3(1.,.72,.04);
 let breath=.5+.5*sin(t*.83-.8);rgb*=1.+hero*(breath*.085-.025);let energy=.69+.22*sin(t*.83-.8)+.09*sin(t*1.43+.2);let convection=.78+.22*sin(p.y*.063+t*.71+sin(p.x*.047+t*.24));let glow=(field.r*.24+field.g*.12)*(1.-hero)*energy*convection;rgb+=vec3(1.,.66,.08)*glow;
 let floor_gate=smoothstep(328.+p.x*.063,342.+p.x*.063,p.y)*(1.-foreground);
 if(floor_gate>.001){let depth=60000./max(15.,p.y-300.);let world=vec2((p.x-228.)*depth/220.,depth-600.);let cell=(world+65.)-floor((world+65.)/130.)*130.;let dist=min(cell,130.-cell);let width=depth/220.*.65;let gx=1.-smoothstep(width*.35,width*1.5,dist.x);let gz=1.-smoothstep(width*.35,width*1.5,dist.y);let radius=length(world);let raw=t*225.*2.-radius+16000.;let age=raw-floor(raw/1600.)*1600.;let wave=exp(-age/360.)*(1.-exp(-age/32.));let near_front=exp(-pow(age/45.,2.));let fade=1.-smoothstep(1800.,4300.,radius);let grid=max(gx,gz)*(.035+wave*.52)+gx*gz*wave*.18;rgb+=vec3(1.,.74,.08)*(grid+near_front*.025)*floor_gate*fade*.6;}
 if(params.unused.x>1.5){
  // Approved Laconic composition: cool bodies and masks, localized chest
  // illumination. The original motion, glitch and floor sweep remain intact.
  let violet=params.unused.x>2.5;
  let paper=select(vec3(13.,21.,32.),vec3(13.,20.,38.),violet)/255.;
  let accent=select(vec3(134.,201.,199.),vec3(98.,150.,245.),violet)/255.;
  let line=select(vec3(161.,176.,181.),vec3(98.,150.,245.),violet)/255.;
  let warm=select(vec3(209.,189.,150.),vec3(152.,105.,218.),violet)/255.;
  let tone=pow(clamp(dot(rgb,vec3(.68,.30,.02)),0.,1.),1.10);
  let prominence=max(.28,max(hero,faces*.60));
  var mapped=mix(paper,accent,tone*prominence);
  // Projection wall follows its authored perspective, rather than a rectangle.
  let top=mix(77.,10.,local_x);let bottom=mix(281.,305.,local_x);
  let horizontal=max(1.-smoothstep(1.,5.,abs(p.y-top)),1.-smoothstep(1.,5.,abs(p.y-bottom)));
  let vertical=max(1.-smoothstep(1.,5.,abs(p.x-43.)),1.-smoothstep(1.,5.,abs(p.x-550.)));
  let wall=(max(horizontal,vertical))*(1.-hero)*step(38.,p.x)*step(p.x,555.)*step(top-5.,p.y)*step(p.y,bottom+5.);
  mapped=mix(mapped,mix(paper,line,tone),wall);
  let chest=(p-vec2(224.,235.))/vec2(12.,17.);let halo=(p-vec2(224.,235.))/vec2(35.,47.);
  mapped=mix(mapped,mix(paper,warm,tone),exp(-dot(chest,chest)*2.));
  mapped=mix(mapped,warm,exp(-dot(halo,halo)*2.)*.60*.4*(.96+.04*sin(t*.75-.4)));
  rgb=mapped;
 }
 return vec4(rgb,1.);
}
