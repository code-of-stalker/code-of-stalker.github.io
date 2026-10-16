use std::borrow::Cow;
use wasm_bindgen::prelude::*;
use web_sys::HtmlCanvasElement;
use crate::motion::Motion;
use crate::scene_gpu::SceneGpu;
#[path = "uniforms.rs"] mod uniforms;
use uniforms::*;

const VERTEX: &str = r#"
struct Output { @builtin(position) position: vec4<f32>, @location(0) uv: vec2<f32> }
@vertex fn main(@builtin(vertex_index) i: u32) -> Output {
    let points = array<vec2<f32>,3>(vec2(-1.,-1.),vec2(3.,-1.),vec2(-1.,3.));
    var out: Output; out.position = vec4(points[i],0.,1.); out.uv = points[i]*0.5+0.5; return out;
}
"#;
fn error(value: impl std::fmt::Display) -> JsValue { JsValue::from_str(&value.to_string()) }
fn buffer(device: &wgpu::Device) -> wgpu::Buffer {
    device.create_buffer(&wgpu::BufferDescriptor { label: Some("glass uniforms"), size:2048,
        usage:wgpu::BufferUsages::UNIFORM|wgpu::BufferUsages::COPY_DST, mapped_at_creation:false })
}
fn texture(device: &wgpu::Device, width:u32, height:u32, format:wgpu::TextureFormat, upload:bool) -> wgpu::Texture {
    device.create_texture(&wgpu::TextureDescriptor { label:Some("glass texture"),
        size:wgpu::Extent3d {width,height,depth_or_array_layers:1}, mip_level_count:1, sample_count:1,
        dimension:wgpu::TextureDimension::D2, format,
        usage:wgpu::TextureUsages::TEXTURE_BINDING | wgpu::TextureUsages::RENDER_ATTACHMENT | if upload {wgpu::TextureUsages::COPY_DST} else {wgpu::TextureUsages::empty()}, view_formats:&[] })
}
fn pipeline(device:&wgpu::Device, layout:&wgpu::PipelineLayout, shader:&str, format:wgpu::TextureFormat) -> wgpu::RenderPipeline {
    let vertex = device.create_shader_module(wgpu::ShaderModuleDescriptor {label:Some("fullscreen vertex"),source:wgpu::ShaderSource::Wgsl(Cow::Borrowed(VERTEX))});
    let fragment = device.create_shader_module(wgpu::ShaderModuleDescriptor {label:Some("Laboratory translated shader"),source:wgpu::ShaderSource::Wgsl(Cow::Borrowed(shader))});
    device.create_render_pipeline(&wgpu::RenderPipelineDescriptor { label:Some("Laboratory glass"), layout:Some(layout),
        vertex:wgpu::VertexState {module:&vertex,entry_point:Some("main"),compilation_options:Default::default(),buffers:&[]},
        primitive:wgpu::PrimitiveState::default(),depth_stencil:None,multisample:wgpu::MultisampleState::default(),
        fragment:Some(wgpu::FragmentState {module:&fragment,entry_point:Some("main"),compilation_options:Default::default(),
            targets:&[Some(wgpu::ColorTargetState {format,blend:None,write_mask:wgpu::ColorWrites::ALL})]}), multiview_mask:None,cache:None })
}
fn group(device:&wgpu::Device, layout:&wgpu::BindGroupLayout, uniform:&wgpu::Buffer, source:&wgpu::Texture, blur:&wgpu::Texture, sampler:&wgpu::Sampler) -> wgpu::BindGroup {
    let source_view=source.create_view(&Default::default()); let blur_view=blur.create_view(&Default::default());
    device.create_bind_group(&wgpu::BindGroupDescriptor { label:Some("glass inputs"),layout,entries:&[
        wgpu::BindGroupEntry {binding:0,resource:uniform.as_entire_binding()},
        wgpu::BindGroupEntry {binding:1,resource:wgpu::BindingResource::TextureView(&source_view)},
        wgpu::BindGroupEntry {binding:2,resource:wgpu::BindingResource::TextureView(&blur_view)},
        wgpu::BindGroupEntry {binding:3,resource:wgpu::BindingResource::Sampler(sampler)},] })
}
fn pass(encoder:&mut wgpu::CommandEncoder, view:&wgpu::TextureView, pipeline:&wgpu::RenderPipeline, bindings:&wgpu::BindGroup) {
    let attachments = [Some(wgpu::RenderPassColorAttachment {view,depth_slice:None,resolve_target:None,
        ops:wgpu::Operations {load:wgpu::LoadOp::Clear(wgpu::Color::BLACK),store:wgpu::StoreOp::Store}})];
    let mut render = encoder.begin_render_pass(&wgpu::RenderPassDescriptor {label:Some("glass pass"),color_attachments:&attachments,..Default::default()});
    render.set_pipeline(pipeline); render.set_bind_group(0,bindings,&[]); render.draw(0..3,0..1);
}

/// Owns the GPU device, textures, render passes and interaction state in Rust.
#[wasm_bindgen]
pub struct GlassEngine {
    canvas:HtmlCanvasElement, surface:wgpu::Surface<'static>, device:wgpu::Device, queue:wgpu::Queue,
    config:wgpu::SurfaceConfiguration, layout:wgpu::BindGroupLayout, sampler:wgpu::Sampler,
    glass_pipeline:wgpu::RenderPipeline, blur_pipeline:wgpu::RenderPipeline,
    source:wgpu::Texture, source_width:u32, source_height:u32, horizontal:wgpu::Texture, vertical:wgpu::Texture,
    horizontal_view:wgpu::TextureView, vertical_view:wgpu::TextureView,
    glass_buffer:wgpu::Buffer, h_buffer:wgpu::Buffer, v_buffer:wgpu::Buffer,
    glass_group:wgpu::BindGroup, h_group:wgpu::BindGroup, v_group:wgpu::BindGroup,
    blur_format:wgpu::TextureFormat, blur_width:u32, blur_height:u32,
    params:[f32;512], motion:Motion, motion_cfg:[f32;8], dirty:bool, last:Option<f64>,
    backend:String, disposed:bool, light_x:f32,light_y:f32,
    textures_allocated:u32, blur_views_allocated:u32, source_uploads:u32, blur_passes:u32, submitted_frames:u32, surface_skips:u32,
    scene:Option<SceneGpu>,source_view:wgpu::TextureView,
}
impl GlassEngine {
    async fn create_internal(canvas:HtmlCanvasElement, force_gl:bool, source_width:u32,source_height:u32,scene_kind:Option<u32>) -> Result<GlassEngine,JsValue> {
        if source_width==0 || source_height==0 || source_width>4096 || source_height>4096 {return Err(error("Invalid source image"));}
        let mut description=wgpu::InstanceDescriptor::new_without_display_handle();
        description.backends=if force_gl {wgpu::Backends::GL} else {wgpu::Backends::BROWSER_WEBGPU|wgpu::Backends::GL};
        let instance=wgpu::util::new_instance_with_webgpu_detection(description).await;
        let surface=instance.create_surface(wgpu::SurfaceTarget::Canvas(canvas.clone())).map_err(error)?;
        let adapter=instance.request_adapter(&wgpu::RequestAdapterOptions {power_preference:wgpu::PowerPreference::HighPerformance,compatible_surface:Some(&surface),..Default::default()}).await.map_err(error)?;
        let backend=format!("{:?}",adapter.get_info().backend);
        let (device,queue)=adapter.request_device(&wgpu::DeviceDescriptor {label:Some("Laboratory Rust glass"),
            required_limits:wgpu::Limits::downlevel_webgl2_defaults().using_resolution(adapter.limits()),..Default::default()}).await.map_err(error)?;
        let caps=surface.get_capabilities(&adapter);
        let mut config=surface.get_default_config(&adapter,canvas.width().max(1),canvas.height().max(1)).ok_or_else(||error("Surface unavailable"))?;
        if let Some(format)=caps.formats.iter().find(|f|!f.is_srgb()) {config.format=*format;}
        surface.configure(&device,&config);
        let features=adapter.get_texture_format_features(wgpu::TextureFormat::Rgba16Float);
        let blur_format=if features.allowed_usages.contains(wgpu::TextureUsages::RENDER_ATTACHMENT|wgpu::TextureUsages::TEXTURE_BINDING)
            && features.flags.contains(wgpu::TextureFormatFeatureFlags::FILTERABLE) {wgpu::TextureFormat::Rgba16Float} else {wgpu::TextureFormat::Rgba8Unorm};
        let layout=device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {label:Some("glass layout"),entries:&[
            wgpu::BindGroupLayoutEntry {binding:0,visibility:wgpu::ShaderStages::FRAGMENT,ty:wgpu::BindingType::Buffer {ty:wgpu::BufferBindingType::Uniform,has_dynamic_offset:false,min_binding_size:wgpu::BufferSize::new(2048)},count:None},
            wgpu::BindGroupLayoutEntry {binding:1,visibility:wgpu::ShaderStages::FRAGMENT,ty:wgpu::BindingType::Texture {sample_type:wgpu::TextureSampleType::Float {filterable:true},view_dimension:wgpu::TextureViewDimension::D2,multisampled:false},count:None},
            wgpu::BindGroupLayoutEntry {binding:2,visibility:wgpu::ShaderStages::FRAGMENT,ty:wgpu::BindingType::Texture {sample_type:wgpu::TextureSampleType::Float {filterable:true},view_dimension:wgpu::TextureViewDimension::D2,multisampled:false},count:None},
            wgpu::BindGroupLayoutEntry {binding:3,visibility:wgpu::ShaderStages::FRAGMENT,ty:wgpu::BindingType::Sampler(wgpu::SamplerBindingType::Filtering),count:None},] });
        let pipe_layout=device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {label:Some("glass pipeline layout"),bind_group_layouts:&[Some(&layout)],immediate_size:0});
        let error_scope=device.push_error_scope(wgpu::ErrorFilter::Validation);
        let glass_pipeline=pipeline(&device,&pipe_layout,include_str!("../shaders/glass.wgsl"),config.format);
        let blur_pipeline=pipeline(&device,&pipe_layout,include_str!("../shaders/blur.wgsl"),blur_format);
        if let Some(e)=error_scope.pop().await {return Err(error(e));}
        let sampler=device.create_sampler(&wgpu::SamplerDescriptor {label:Some("linear clamp"),mag_filter:wgpu::FilterMode::Linear,min_filter:wgpu::FilterMode::Linear,..Default::default()});
        let source=texture(&device,source_width,source_height,if scene_kind.is_some(){wgpu::TextureFormat::Rgba8Unorm}else{wgpu::TextureFormat::Rgba8UnormSrgb},true);
        let source_view=source.create_view(&Default::default());
        let horizontal=texture(&device,1,1,blur_format,false); let vertical=texture(&device,1,1,blur_format,false);
        let horizontal_view=horizontal.create_view(&Default::default());let vertical_view=vertical.create_view(&Default::default());
        let glass_buffer=buffer(&device);let h_buffer=buffer(&device);let v_buffer=buffer(&device);
        let glass_group=group(&device,&layout,&glass_buffer,&source,&vertical,&sampler);
        let h_group=group(&device,&layout,&h_buffer,&source,&source,&sampler);
        let v_group=group(&device,&layout,&v_buffer,&horizontal,&horizontal,&sampler);
        let scope=device.push_error_scope(wgpu::ErrorFilter::Validation);
        let scene=scene_kind.map(|kind|SceneGpu::new(&device,&queue,config.format,kind));
        if let Some(e)=scope.pop().await {return Err(error(e));}
        let engine=Self {canvas,surface,device,queue,config,layout,sampler,glass_pipeline,blur_pipeline,source,source_width,source_height,horizontal,vertical,
            horizontal_view,vertical_view,glass_buffer,h_buffer,v_buffer,glass_group,h_group,v_group,blur_format,blur_width:1,blur_height:1,
            params:[0.;512],motion:Motion::default(),motion_cfg:[2.,2.,2.5,1.,1.,1.,41.,0.],dirty:true,last:None,backend,disposed:false,light_x:-0.70710677,light_y:0.70710677,
            textures_allocated:3,blur_views_allocated:2,source_uploads:0,blur_passes:0,submitted_frames:0,surface_skips:0,scene,source_view};
        Ok(engine)
    }
}
#[wasm_bindgen]
impl GlassEngine {
    pub async fn create(canvas:HtmlCanvasElement,force_gl:bool,source:HtmlCanvasElement)->Result<GlassEngine,JsValue>{
        let mut engine=Self::create_internal(canvas,force_gl,source.width(),source.height(),None).await?;
        engine.update_canvas_source(source)?;Ok(engine)
    }
    pub async fn create_full(canvas:HtmlCanvasElement,force_gl:bool,scene_kind:u32)->Result<GlassEngine,JsValue>{
        if scene_kind>2{return Err(error("Invalid scene"));}
        Self::create_internal(canvas,force_gl,1,1,Some(scene_kind)).await
    }
    /// Upload a freshly painted canvas through the browser API, without JS pixel readback.
    pub fn update_canvas_source(&mut self, canvas:HtmlCanvasElement)->Result<(),JsValue> {
        if self.disposed {return Err(error("Renderer disposed"));}
        let width=canvas.width();let height=canvas.height();
        if width==0 || height==0 || width>4096 || height>4096 {return Err(error("Invalid source dimensions"));}
        if width!=self.source_width || height!=self.source_height {
            self.source.destroy();
            self.source=texture(&self.device,width,height,wgpu::TextureFormat::Rgba8UnormSrgb,true);
            self.source_view=self.source.create_view(&Default::default());
            self.textures_allocated+=1;
            self.source_width=width;self.source_height=height;
            self.glass_group=group(&self.device,&self.layout,&self.glass_buffer,&self.source,&self.vertical,&self.sampler);
            self.h_group=group(&self.device,&self.layout,&self.h_buffer,&self.source,&self.source,&self.sampler);
        }
        self.queue.copy_external_image_to_texture(
            &wgpu::CopyExternalImageSourceInfo {source:wgpu::ExternalImageSource::HTMLCanvasElement(canvas),origin:wgpu::Origin2d::ZERO,flip_y:false},
            wgpu::CopyExternalImageDestInfo {texture:&self.source,mip_level:0,origin:wgpu::Origin3d::ZERO,aspect:wgpu::TextureAspect::All,color_space:wgpu::PredefinedColorSpace::Srgb,premultiplied_alpha:false},
            wgpu::Extent3d {width,height,depth_or_array_layers:1});
        self.source_uploads+=1;self.dirty=true;Ok(())
    }
    pub fn backend(&self)->String {format!("Rust {} / wgpu / {} · {:?}",if self.scene.is_some(){"вся сцена"}else{"стекло"},self.backend,self.blur_format)}
    /// Cumulative application resource counters, not GPU memory or GPU execution timings.
    pub fn diagnostics(&self)->Vec<f64> {
        vec![(self.textures_allocated+self.scene.as_ref().map_or(0,|s|s.textures_created)) as f64,self.blur_views_allocated as f64,self.source_uploads as f64,
            self.blur_passes as f64,self.submitted_frames as f64,self.surface_skips as f64,
            self.scene.as_ref().map_or(0,|s|s.updates) as f64,self.scene.as_ref().map_or(0,|s|s.observer_frames) as f64,
            self.scene.as_ref().map_or(0,|s|s.counts()[0]) as f64,self.scene.as_ref().map_or(0,|s|s.counts()[1]) as f64]
    }
    pub fn resize(&mut self, width:f32,height:f32,ratio:f32)->Result<(),JsValue> {
        if !width.is_finite() || !height.is_finite() || !ratio.is_finite() {return Err(error("Invalid size"));}
        let ratio=ratio.clamp(1.,2.);let w=(width.max(1.)*ratio).floor() as u32;let h=(height.max(1.)*ratio).floor() as u32;
        if w>4096 || h>4096 {return Err(error("Preview exceeds texture budget"));}
        if self.config.width!=w || self.config.height!=h {self.canvas.set_width(w);self.canvas.set_height(h);self.config.width=w;self.config.height=h;self.surface.configure(&self.device,&self.config);self.dirty=true;}
        if let Some(scene)=&mut self.scene {
            scene.configure(&self.device,self.config.format,width,height,ratio,self.motion_cfg[7]>0.5);
            let [source_w,source_h]=scene.source_size();
            if self.source_width!=source_w||self.source_height!=source_h {
                self.source.destroy();self.source=texture(&self.device,source_w,source_h,wgpu::TextureFormat::Rgba8Unorm,false);
                self.source_view=self.source.create_view(&Default::default());self.textures_allocated+=1;self.source_width=source_w;self.source_height=source_h;
                self.glass_group=group(&self.device,&self.layout,&self.glass_buffer,&self.source,&self.vertical,&self.sampler);
                self.h_group=group(&self.device,&self.layout,&self.h_buffer,&self.source,&self.source,&self.sampler);
            }
        }
        Ok(())
    }
    pub fn configure(&mut self,values:&[f32],h_values:&[f32],v_values:&[f32],blur_width:u32,blur_height:u32,motion:&[f32])->Result<(),JsValue> {
        if values.len()!=512 || h_values.len()!=512 || v_values.len()!=512 || motion.len()!=8 || values.iter().chain(h_values).chain(v_values).chain(motion).any(|v|!v.is_finite()) {return Err(error("Invalid glass parameters"));}
        if blur_width==0 || blur_height==0 || blur_width>4096 || blur_height>4096 {return Err(error("Invalid blur dimensions"));}
        self.params.copy_from_slice(values);self.params[U_PIXEL_RATIO]=self.params[U_PIXEL_RATIO].clamp(1.,2.);
        self.params[508]=if self.config.format.is_srgb() {0.} else {1.}; self.motion_cfg.copy_from_slice(motion);
        if let Some(scene)=&mut self.scene {self.params[U_DECODE_SOURCE_TEXTURE]=1.;scene.configure(&self.device,self.config.format,scene.width,scene.height,self.params[U_PIXEL_RATIO],motion[7]>0.5);}
        if self.blur_width!=blur_width || self.blur_height!=blur_height {
            self.horizontal.destroy();self.vertical.destroy();
            self.horizontal=texture(&self.device,blur_width,blur_height,self.blur_format,false);
            self.vertical=texture(&self.device,blur_width,blur_height,self.blur_format,false);
            self.horizontal_view=self.horizontal.create_view(&Default::default());
            self.vertical_view=self.vertical.create_view(&Default::default());
            self.textures_allocated+=2;self.blur_views_allocated+=2;
            self.blur_width=blur_width;self.blur_height=blur_height;
            self.glass_group=group(&self.device,&self.layout,&self.glass_buffer,&self.source,&self.vertical,&self.sampler);
            self.v_group=group(&self.device,&self.layout,&self.v_buffer,&self.horizontal,&self.horizontal,&self.sampler);
        }
        let mut horizontal_values=[0.;512];horizontal_values.copy_from_slice(h_values);if self.scene.is_some(){horizontal_values[4]=1.;}
        self.queue.write_buffer(&self.h_buffer,0,bytemuck::cast_slice(&horizontal_values));
        self.queue.write_buffer(&self.v_buffer,0,bytemuck::cast_slice(v_values)); self.dirty=true;Ok(())
    }
    pub fn pointer(&mut self,x:f32,y:f32,down:bool) {self.motion.pointer(x,y,down);}
    pub fn replay(&mut self) {self.motion.replay();}
    pub fn reset_clock(&mut self) {self.last=None;self.motion.pointer(self.motion.x,self.motion.y,false);if let Some(s)=&mut self.scene{s.suspend();}}
    pub fn restart_scene(&mut self){if let Some(s)=&mut self.scene{s.reset();}self.last=None;self.motion.replay();}
    pub fn seek_scene(&mut self,seconds:f64){if let Some(s)=&mut self.scene{s.seek(if seconds<0.{None}else{Some(seconds)});}self.last=None;self.motion.reveal=1.;}
    /// One WASM call per RAF. Sign encodes whether the rain target was updated;
    /// magnitude minus one is active scene time in ms, avoiding per-frame allocations.
    pub fn render_full(&mut self,now:f64)->Result<f64,JsValue>{
        let time=self.scene.as_mut().ok_or_else(||error("Full scene not initialized"))?.advance(now);
        self.render(time)?;Ok((time+1.)*if self.scene.as_ref().unwrap().updated{1.}else{-1.})
    }
    pub fn observer_state(&self)->Vec<f64>{self.scene.as_ref().map_or_else(Vec::new,|s|vec![s.pose.scale as f64,s.pose.x as f64,s.pose.y as f64,s.observer_frames as f64,s.time()])}
    pub fn render(&mut self,time:f64)->Result<f32,JsValue> {
        if self.disposed {return Err(error("Renderer disposed"));}
        let dt=self.last.map(|last|((time-last)/1000.).max(0.) as f32).unwrap_or(0.);self.last=Some(time);
        let c=self.motion_cfg;self.motion.step(dt,c[0],c[1],c[2],c[7]>0.5);
        if c[4]<0.5 {self.motion.reveal=1.;} if c[5]<0.5 {self.motion.pulse=1.;}
        self.params[U_TOUCH..U_TOUCH+4].copy_from_slice(&[self.motion.x,1.-self.motion.y,if c[3]>0.5 {self.motion.pressure} else {0.},0.]);
        self.params[U_SCAN]=self.motion.reveal;
        let angle=c[6].to_radians()+(self.motion.x-0.5)*0.35-(self.motion.y-0.5)*0.2;
        let fraction=1.-(-dt.min(1.)/0.18).exp();self.light_x+=(angle.cos()-self.light_x)*fraction;self.light_y+=(angle.sin()-self.light_y)*fraction;
        self.params[U_DIRECTED_LIGHT]=self.light_x;self.params[U_DIRECTED_LIGHT+1]=self.light_y;
        let ratio=self.params[U_PIXEL_RATIO]; let panel=[self.params[U_GLASS_PANEL],self.params[U_GLASS_PANEL+1],self.params[U_GLASS_PANEL+2],self.params[U_GLASS_PANEL+3]];
        self.params[U_PULSE_REVEAL]=(self.motion.pulse_x-panel[0]+panel[2]/2.)*self.config.width as f32/ratio;
        self.params[U_PULSE_REVEAL+1]=(self.motion.pulse_y-(1.-panel[1])+panel[3]/2.)*self.config.height as f32/ratio;
        self.params[U_PULSE_REVEAL+2]=self.motion.pulse;self.params[U_TIME]=if c[7]>0.5 {0.} else {(time/1000.) as f32};
        self.queue.write_buffer(&self.glass_buffer,0,bytemuck::cast_slice(&self.params));
        let frame=match self.surface.get_current_texture() {
            wgpu::CurrentSurfaceTexture::Success(frame)|wgpu::CurrentSurfaceTexture::Suboptimal(frame)=>frame,
            wgpu::CurrentSurfaceTexture::Timeout|wgpu::CurrentSurfaceTexture::Occluded=>{self.surface_skips+=1;return Ok(self.motion.reveal);},
            wgpu::CurrentSurfaceTexture::Outdated=>{self.surface_skips+=1;self.surface.configure(&self.device,&self.config);return Ok(self.motion.reveal);},
            problem=>return Err(error(format!("Graphics surface: {problem:?}. Restart the renderer."))),
        };
        let mut encoder=self.device.create_command_encoder(&wgpu::CommandEncoderDescriptor {label:Some("glass frame")});
        if let Some(scene)=&mut self.scene {scene.prepare(self.motion.reveal,&self.queue);scene.background(&mut encoder,&self.source_view);self.dirty|=scene.updated;scene.observer(&mut encoder);}
        if self.dirty && self.params[U_BLUR_ENABLED]>0.5 {
            pass(&mut encoder,&self.horizontal_view,&self.blur_pipeline,&self.h_group);
            pass(&mut encoder,&self.vertical_view,&self.blur_pipeline,&self.v_group); self.dirty=false;self.blur_passes+=2;
        }
        let frame_view=frame.texture.create_view(&Default::default());
        pass(&mut encoder,&frame_view,&self.glass_pipeline,&self.glass_group);
        if let Some(scene)=&self.scene {scene.composite(&mut encoder,&frame_view);}
        self.queue.submit(Some(encoder.finish()));self.queue.present(frame);self.submitted_frames+=1;Ok(self.motion.reveal)
    }
    pub fn dispose(&mut self) {if !self.disposed {if let Some(scene)=&self.scene{scene.dispose();}self.source.destroy();self.horizontal.destroy();self.vertical.destroy();self.glass_buffer.destroy();self.h_buffer.destroy();self.v_buffer.destroy();self.device.destroy();self.disposed=true;}}
}
