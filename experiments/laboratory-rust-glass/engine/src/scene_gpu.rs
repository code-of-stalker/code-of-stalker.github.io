//! Full scene: persistent GPU assets, batched rain, vector figures, cached glow.
use std::borrow::Cow;
use wgpu::util::DeviceExt;
use crate::scene_model::{observer_pose,ObserverPose,SceneClock};
mod geometry {include!(concat!(env!("OUT_DIR"),"/geometry.rs"));}

fn texture(device:&wgpu::Device,w:u32,h:u32,format:wgpu::TextureFormat,samples:u32,label:&str,usage:wgpu::TextureUsages)->wgpu::Texture {
    device.create_texture(&wgpu::TextureDescriptor{label:Some(label),size:wgpu::Extent3d{width:w,height:h,depth_or_array_layers:1},mip_level_count:1,sample_count:samples,dimension:wgpu::TextureDimension::D2,format,usage,view_formats:&[]})
}
fn upload(device:&wgpu::Device,queue:&wgpu::Queue,w:u32,h:u32,channels:u32,bytes:&[u8])->wgpu::Texture {
    let t=texture(device,w,h,if channels==1 {wgpu::TextureFormat::R8Unorm} else {wgpu::TextureFormat::Rgba8Unorm},1,"scene static atlas",wgpu::TextureUsages::TEXTURE_BINDING|wgpu::TextureUsages::COPY_DST);
    queue.write_texture(t.as_image_copy(),bytes,wgpu::TexelCopyBufferLayout{offset:0,bytes_per_row:Some(w*channels),rows_per_image:Some(h)},wgpu::Extent3d{width:w,height:h,depth_or_array_layers:1});t
}
fn make_group(device:&wgpu::Device,layout:&wgpu::BindGroupLayout,params:&wgpu::Buffer,atlas:&wgpu::TextureView,glow:&wgpu::TextureView,observer:&wgpu::TextureView,sampler:&wgpu::Sampler)->wgpu::BindGroup {
    device.create_bind_group(&wgpu::BindGroupDescriptor{label:Some("scene textures"),layout,entries:&[
        wgpu::BindGroupEntry{binding:0,resource:params.as_entire_binding()},wgpu::BindGroupEntry{binding:1,resource:wgpu::BindingResource::TextureView(atlas)},
        wgpu::BindGroupEntry{binding:2,resource:wgpu::BindingResource::TextureView(glow)},wgpu::BindGroupEntry{binding:3,resource:wgpu::BindingResource::Sampler(sampler)},
        wgpu::BindGroupEntry{binding:4,resource:wgpu::BindingResource::TextureView(observer)},]})
}
fn pipeline(device:&wgpu::Device,layout:&wgpu::PipelineLayout,shader:&wgpu::ShaderModule,vs:&str,fs:&str,format:wgpu::TextureFormat,samples:u32,stencil:u8)->wgpu::RenderPipeline {
    let buffers=[Some(wgpu::VertexBufferLayout{array_stride:12,step_mode:wgpu::VertexStepMode::Vertex,attributes:&wgpu::vertex_attr_array![0=>Float32x2,1=>Float32]})];
    let mut depth=None;
    if samples>1 {
        let state=wgpu::StencilFaceState {compare:if stencil==1 {wgpu::CompareFunction::Equal} else {wgpu::CompareFunction::Always},
            pass_op:if stencil==2 {wgpu::StencilOperation::Replace} else {wgpu::StencilOperation::Keep},..Default::default()};
        depth=Some(wgpu::DepthStencilState{format:wgpu::TextureFormat::Depth24PlusStencil8,depth_write_enabled:Some(false),depth_compare:Some(wgpu::CompareFunction::Always),
            stencil:wgpu::StencilState{front:state,back:state,read_mask:255,write_mask:if stencil==2 {255} else {0}},bias:Default::default()});
    }
    device.create_render_pipeline(&wgpu::RenderPipelineDescriptor{label:Some(vs),layout:Some(layout),vertex:wgpu::VertexState{module:shader,entry_point:Some(vs),compilation_options:Default::default(),buffers:if vs=="figure_vs" {&buffers} else {&[]}},
        primitive:Default::default(),depth_stencil:depth,multisample:wgpu::MultisampleState{count:samples,..Default::default()},
        fragment:Some(wgpu::FragmentState{module:shader,entry_point:Some(fs),compilation_options:Default::default(),targets:&[Some(wgpu::ColorTargetState{format,
            blend:Some(wgpu::BlendState::PREMULTIPLIED_ALPHA_BLENDING),write_mask:if stencil==2 {wgpu::ColorWrites::empty()} else {wgpu::ColorWrites::ALL}})]}),multiview_mask:None,cache:None})
}
pub struct SceneGpu {
    params:wgpu::Buffer,vertices:wgpu::Buffer,indices:wgpu::Buffer,
    atlas:wgpu::Texture,glow:wgpu::Texture,atlas_view:wgpu::TextureView,glow_view:wgpu::TextureView,
    observer:wgpu::Texture,msaa:wgpu::Texture,depth:wgpu::Texture,
    observer_view:wgpu::TextureView,msaa_view:wgpu::TextureView,depth_view:wgpu::TextureView,
    layout:wgpu::BindGroupLayout,sampler:wgpu::Sampler,group:wgpu::BindGroup,composite_group:wgpu::BindGroup,
    rain:wgpu::RenderPipeline,background:wgpu::RenderPipeline,figure:wgpu::RenderPipeline,masked_figure:wgpu::RenderPipeline,
    mask:wgpu::RenderPipeline,halo:wgpu::RenderPipeline,ray:wgpu::RenderPipeline,composite:wgpu::RenderPipeline,
    pub width:f32,pub height:f32,side:u32,ratio:f32,kind:u32,reduced:bool,last_paint:f64,clock:SceneClock,
    pub updated:bool,pub pose:ObserverPose,pub updates:u32,pub observer_frames:u32,pub textures_created:u32,
}
impl SceneGpu {
    pub fn new(device:&wgpu::Device,queue:&wgpu::Queue,format:wgpu::TextureFormat,kind:u32)->Self {
        let params=device.create_buffer(&wgpu::BufferDescriptor{label:Some("scene uniform"),size:64,usage:wgpu::BufferUsages::UNIFORM|wgpu::BufferUsages::COPY_DST,mapped_at_creation:false});
        let vertices=device.create_buffer_init(&wgpu::util::BufferInitDescriptor{label:Some("original SVG tessellation"),contents:include_bytes!(concat!(env!("OUT_DIR"),"/observer.vertices")),usage:wgpu::BufferUsages::VERTEX});
        let indices=device.create_buffer_init(&wgpu::util::BufferInitDescriptor{label:Some("SVG indices"),contents:include_bytes!(concat!(env!("OUT_DIR"),"/observer.indices")),usage:wgpu::BufferUsages::INDEX});
        let atlas=upload(device,queue,768,144,4,include_bytes!(concat!(env!("OUT_DIR"),"/rain.atlas")));
        let glow=upload(device,queue,488,976,1,include_bytes!(concat!(env!("OUT_DIR"),"/observer.glow")));
        let atlas_view=atlas.create_view(&Default::default());let glow_view=glow.create_view(&Default::default());
        let tex_entry=|binding|wgpu::BindGroupLayoutEntry{binding,visibility:wgpu::ShaderStages::FRAGMENT,ty:wgpu::BindingType::Texture{sample_type:wgpu::TextureSampleType::Float{filterable:true},view_dimension:wgpu::TextureViewDimension::D2,multisampled:false},count:None};
        let layout=device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor{label:Some("scene layout"),entries:&[
            wgpu::BindGroupLayoutEntry{binding:0,visibility:wgpu::ShaderStages::VERTEX_FRAGMENT,ty:wgpu::BindingType::Buffer{ty:wgpu::BufferBindingType::Uniform,has_dynamic_offset:false,min_binding_size:wgpu::BufferSize::new(64)},count:None},
            tex_entry(1),tex_entry(2),wgpu::BindGroupLayoutEntry{binding:3,visibility:wgpu::ShaderStages::FRAGMENT,ty:wgpu::BindingType::Sampler(wgpu::SamplerBindingType::Filtering),count:None},tex_entry(4)]});
        let sampler=device.create_sampler(&wgpu::SamplerDescriptor{mag_filter:wgpu::FilterMode::Linear,min_filter:wgpu::FilterMode::Linear,..Default::default()});
        let observer=texture(device,1,1,format,1,"observer resolve",wgpu::TextureUsages::RENDER_ATTACHMENT|wgpu::TextureUsages::TEXTURE_BINDING);
        let msaa=texture(device,1,1,format,4,"observer MSAA",wgpu::TextureUsages::RENDER_ATTACHMENT);
        let depth=texture(device,1,1,wgpu::TextureFormat::Depth24PlusStencil8,4,"observer occlusion",wgpu::TextureUsages::RENDER_ATTACHMENT);
        let observer_view=observer.create_view(&Default::default());let msaa_view=msaa.create_view(&Default::default());let depth_view=depth.create_view(&Default::default());
        let group=make_group(device,&layout,&params,&atlas_view,&glow_view,&glow_view,&sampler);
        let composite_group=make_group(device,&layout,&params,&atlas_view,&glow_view,&observer_view,&sampler);
        let pipe_layout=device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor{label:Some("scene pipeline layout"),bind_group_layouts:&[Some(&layout)],immediate_size:0});
        let shader=device.create_shader_module(wgpu::ShaderModuleDescriptor{label:Some("Rust full-scene WGSL"),source:wgpu::ShaderSource::Wgsl(Cow::Borrowed(include_str!("../shaders/scene.wgsl")))});
        let rain=pipeline(device,&pipe_layout,&shader,"rain_vs","rain_fs",wgpu::TextureFormat::Rgba8Unorm,1,0);
        let background=pipeline(device,&pipe_layout,&shader,"quad_vs","background_fs",wgpu::TextureFormat::Rgba8Unorm,1,0);
        let figure=pipeline(device,&pipe_layout,&shader,"figure_vs","figure_fs",format,4,0);
        let masked_figure=pipeline(device,&pipe_layout,&shader,"figure_vs","figure_fs",format,4,1);
        let mask=pipeline(device,&pipe_layout,&shader,"figure_vs","figure_fs",format,4,2);
        let halo=pipeline(device,&pipe_layout,&shader,"halo_vs","halo_fs",format,4,1);
        let ray=pipeline(device,&pipe_layout,&shader,"quad_vs","ray_fs",format,4,0);
        let composite=pipeline(device,&pipe_layout,&shader,"composite_vs","composite_fs",format,1,0);
        Self{params,vertices,indices,atlas,glow,atlas_view,glow_view,observer,msaa,depth,observer_view,msaa_view,depth_view,layout,sampler,group,composite_group,rain,background,figure,masked_figure,mask,halo,ray,composite,
            width:1.,height:1.,side:1,ratio:2.,kind,reduced:false,last_paint:-1000.,clock:SceneClock::default(),updated:false,pose:observer_pose(0.,false),updates:0,observer_frames:0,textures_created:5}
    }
    pub fn configure(&mut self,device:&wgpu::Device,format:wgpu::TextureFormat,width:f32,height:f32,ratio:f32,reduced:bool){
        self.width=width;self.height=height;self.ratio=ratio;self.reduced=reduced;self.last_paint=-1000.;
        let side=((width*0.74).min(height*0.64)*ratio).round().max(1.) as u32;
        if side!=self.side {
            self.observer.destroy();self.msaa.destroy();self.depth.destroy();
            self.observer=texture(device,side,side,format,1,"observer resolve",wgpu::TextureUsages::RENDER_ATTACHMENT|wgpu::TextureUsages::TEXTURE_BINDING);
            self.msaa=texture(device,side,side,format,4,"observer MSAA",wgpu::TextureUsages::RENDER_ATTACHMENT);
            self.depth=texture(device,side,side,wgpu::TextureFormat::Depth24PlusStencil8,4,"observer occlusion",wgpu::TextureUsages::RENDER_ATTACHMENT);
            self.observer_view=self.observer.create_view(&Default::default());self.msaa_view=self.msaa.create_view(&Default::default());self.depth_view=self.depth.create_view(&Default::default());
            self.composite_group=make_group(device,&self.layout,&self.params,&self.atlas_view,&self.glow_view,&self.observer_view,&self.sampler);
            self.side=side;self.textures_created+=3;
        }
    }
    pub fn advance(&mut self,now:f64)->f64{self.clock.advance(now,self.reduced)}
    pub fn source_size(&self)->[u32;2]{
        if self.kind==0 {return [768,960];}
        let ratio=self.ratio.min(2048./self.width.max(self.height));
        [(self.width*ratio).round().max(1.) as u32,(self.height*ratio).round().max(1.) as u32]
    }
    pub fn prepare(&mut self,reveal:f32,queue:&wgpu::Queue){
        let ms=self.clock.elapsed;let seconds=ms/1000.;self.pose=observer_pose(seconds,self.reduced);let s=self.pose;
        self.updated=self.last_paint<0.||(!self.reduced&&self.kind>0&&ms-self.last_paint>=1000./30.);
        if self.updated {self.last_paint=ms;self.updates+=1;}
        let values=[self.width,self.height,seconds as f32,self.kind as f32,s.scale,s.x,s.y,s.observer_x,s.other_x,s.span,s.ray,s.emission,s.edge,reveal,(self.width*0.74).min(self.height*0.64),0.];
        queue.write_buffer(&self.params,0,bytemuck::cast_slice(&values));
    }
    pub fn background(&self,encoder:&mut wgpu::CommandEncoder,target:&wgpu::TextureView){
        if !self.updated {return;}
        let attachments=[Some(wgpu::RenderPassColorAttachment{view:target,depth_slice:None,resolve_target:None,ops:wgpu::Operations{load:wgpu::LoadOp::Clear(wgpu::Color::BLACK),store:wgpu::StoreOp::Store}})];
        let mut pass=encoder.begin_render_pass(&wgpu::RenderPassDescriptor{label:Some("GPU rain batch"),color_attachments:&attachments,..Default::default()});
        pass.set_bind_group(0,&self.group,&[]);
        if self.kind==0 {pass.set_pipeline(&self.background);pass.draw(0..6,0..1);} else {pass.set_pipeline(&self.rain);pass.draw(0..6,0..(self.width/11.).ceil().min(240.) as u32*33);}
    }
    pub fn observer(&mut self,encoder:&mut wgpu::CommandEncoder){
        if self.kind!=2{return;}
        let attachments=[Some(wgpu::RenderPassColorAttachment{view:&self.msaa_view,depth_slice:None,resolve_target:Some(&self.observer_view),ops:wgpu::Operations{load:wgpu::LoadOp::Clear(wgpu::Color::TRANSPARENT),store:wgpu::StoreOp::Discard}})];
        let mut pass=encoder.begin_render_pass(&wgpu::RenderPassDescriptor{label:Some("vector Observer"),color_attachments:&attachments,
            depth_stencil_attachment:Some(wgpu::RenderPassDepthStencilAttachment{view:&self.depth_view,depth_ops:None,stencil_ops:Some(wgpu::Operations{load:wgpu::LoadOp::Clear(0),store:wgpu::StoreOp::Discard})}),..Default::default()});
        pass.set_bind_group(0,&self.group,&[]);pass.set_vertex_buffer(0,self.vertices.slice(..));pass.set_index_buffer(self.indices.slice(..),wgpu::IndexFormat::Uint32);
        let range=|id:usize|geometry::RANGES[id][0]..geometry::RANGES[id][1];
        pass.set_pipeline(&self.mask);pass.set_stencil_reference(1);pass.draw_indexed(range(4),0,0..1);pass.draw_indexed(range(5),0,0..1);
        pass.set_stencil_reference(0);
        if self.pose.emission>0.0001 {pass.set_pipeline(&self.halo);pass.draw(0..6,0..1);}
        pass.set_pipeline(&self.masked_figure);pass.draw_indexed(range(0),0,0..1);pass.draw_indexed(range(1),0,0..1);
        pass.set_pipeline(&self.figure);pass.draw_indexed(range(2),0,0..1);pass.draw_indexed(range(3),0,0..1);
        if self.pose.ray>0.0001 {pass.set_pipeline(&self.ray);pass.draw(0..6,0..1);}
        self.observer_frames+=1;
    }
    pub fn composite(&self,encoder:&mut wgpu::CommandEncoder,target:&wgpu::TextureView){
        if self.kind!=2{return;}
        let attachments=[Some(wgpu::RenderPassColorAttachment{view:target,depth_slice:None,resolve_target:None,ops:wgpu::Operations{load:wgpu::LoadOp::Load,store:wgpu::StoreOp::Store}})];
        let mut pass=encoder.begin_render_pass(&wgpu::RenderPassDescriptor{label:Some("Observer feather and composite"),color_attachments:&attachments,..Default::default()});
        pass.set_pipeline(&self.composite);pass.set_bind_group(0,&self.composite_group,&[]);pass.draw(0..6,0..1);
    }
    pub fn time(&self)->f64{self.clock.elapsed}
    pub fn reset(&mut self){self.clock.restart();self.last_paint=-1000.;}
    pub fn suspend(&mut self){self.clock.suspend();}
    pub fn seek(&mut self,seconds:Option<f64>){self.clock.seek(seconds);self.last_paint=-1000.;}
    pub fn counts(&self)->[usize;2]{[geometry::VERTEX_COUNT,geometry::INDEX_COUNT]}
    pub fn dispose(&self){self.atlas.destroy();self.glow.destroy();self.observer.destroy();self.msaa.destroy();self.depth.destroy();self.params.destroy();self.vertices.destroy();self.indices.destroy();}
}
